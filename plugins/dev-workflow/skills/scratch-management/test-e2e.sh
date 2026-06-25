#!/usr/bin/env bash
# End-to-end tests for scratch-management.
#
# Exercises scratch commands (archive, save, list, archived, config) against
# temp directories — both the scratch repo and its "origin" remote are local
# bare repos.
#
# Usage:
#   bash test-e2e.sh                   # run all groups
#   bash test-e2e.sh archive           # run only archive tests
#   bash test-e2e.sh save list         # run multiple groups
#   bash test-e2e.sh -v                # verbose — stream every scratch output
#   bash test-e2e.sh -v archive save   # combine flags and filters
#
# Group names: archive, save, list, archived, config
# Exit code: 0 if all pass, 1 otherwise.

set -u
set -o pipefail

# ── argv parsing ───────────────────────────────────────────────────────────
VERBOSE=0
FILTERS=()
for arg in "$@"; do
  case "$arg" in
    -v|--verbose) VERBOSE=1 ;;
    -h|--help)
      sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    -*) printf 'unknown flag: %s\n' "$arg" >&2; exit 2 ;;
    *) FILTERS+=("$arg") ;;
  esac
done

group_matches_filter() {
  local group="$1"
  (( ${#FILTERS[@]} == 0 )) && return 0  # no filters = run everything
  local f
  for f in "${FILTERS[@]}"; do
    [[ "$group" == *"$f"* ]] && return 0
  done
  return 1
}

# ── infra ──────────────────────────────────────────────────────────────────
ROOT_TMP=$(mktemp -d -t scratch-e2e-XXXXXX)
trap 'rm -rf "$ROOT_TMP"' EXIT

PASS=0
FAIL=0
SKIP=0
FAIL_NAMES=()

if [[ -t 1 ]]; then
  C_GREEN=$'\033[32m'; C_RED=$'\033[31m'; C_DIM=$'\033[2m'; C_CYAN=$'\033[36m'; C_RESET=$'\033[0m'
else
  C_GREEN=''; C_RED=''; C_DIM=''; C_CYAN=''; C_RESET=''
fi

run_scratch() {
  local dir="$1"; shift
  SCRATCH_STDOUT=$(cd "$dir" && scratch "$@" 2>&1)
  SCRATCH_EXIT=$?
  if (( VERBOSE )); then
    printf '%s\n' "$SCRATCH_STDOUT" | sed 's/^/    | /'
  fi
}

# Build project with scratch/ + bare-repo origin. Each test gets its own
# subdir so parallel groups don't collide.
# $1 = project name (subdir), $2 = populate_archive (0 or 1)
# Sets: PROJECT_DIR, SCRATCH_DIR, REMOTE_DIR
setup_project() {
  local name="$1"
  local populate_archive="${2:-0}"
  PROJECT_DIR="$ROOT_TMP/$name"
  SCRATCH_DIR="$PROJECT_DIR/scratch"
  REMOTE_DIR="$PROJECT_DIR/remote.git"

  mkdir -p "$SCRATCH_DIR"
  git init -q --bare "$REMOTE_DIR"

  (
    cd "$SCRATCH_DIR"
    git init -q -b main
    git config user.email test@test && git config user.name test
    git remote add origin "$REMOTE_DIR"
    mkdir -p keep-folder done-folder
    echo "keep" > keep-folder/README.md
    echo "done" > done-folder/README.md
    cat > .scratch-config.json <<EOF
{"projectName":"$name","archiveBranch":"archive"}
EOF
    git add -A && git commit -q -m "initial"
    git push -q -u origin main

    if (( populate_archive )); then
      git checkout -q --orphan archive
      git rm -rf --cached -q .
      git clean -fdq
      echo "# Scratch Archive" > README.md
      mkdir -p legacy-folder
      echo "legacy content" > legacy-folder/README.md
      git add -A && git commit -q -m "Initialize archive branch"
      git push -q -u origin archive
      git checkout -q -f main
    fi
  )
}

assert() {
  local desc="$1" actual="$2" expected="$3"
  [[ "$actual" == "$expected" ]] && return 0
  printf '  %sassertion failed%s: %s\n' "$C_RED" "$C_RESET" "$desc" >&2
  printf '    expected: %s\n' "$expected" >&2
  printf '    actual:   %s\n' "$actual" >&2
  return 1
}

assert_contains() {
  local desc="$1" haystack="$2" needle="$3"
  [[ "$haystack" == *"$needle"* ]] && return 0
  printf '  %sassertion failed%s: %s\n' "$C_RED" "$C_RESET" "$desc" >&2
  printf '    expected substring: %s\n' "$needle" >&2
  printf '    actual output:\n' >&2
  printf '%s\n' "$haystack" | sed 's/^/      | /' >&2
  return 1
}

assert_not_contains() {
  local desc="$1" haystack="$2" needle="$3"
  [[ "$haystack" != *"$needle"* ]] && return 0
  printf '  %sassertion failed%s: %s\n' "$C_RED" "$C_RESET" "$desc" >&2
  printf '    unexpected substring: %s\n' "$needle" >&2
  printf '    actual output:\n' >&2
  printf '%s\n' "$haystack" | sed 's/^/      | /' >&2
  return 1
}

# record <group> <name> <test_fn>
record() {
  local group="$1" name="$2" fn="$3"
  if ! group_matches_filter "$group"; then
    ((SKIP++))
    return 0
  fi
  if "$fn"; then
    printf '%sPASS%s  [%s] %s\n' "$C_GREEN" "$C_RESET" "$group" "$name"
    ((PASS++))
  else
    printf '%sFAIL%s  [%s] %s\n' "$C_RED" "$C_RESET" "$group" "$name"
    ((FAIL++))
    FAIL_NAMES+=("[$group] $name")
  fi
}

branches_at() {
  ( cd "$1" && git branch | tr '\n' ' ' | sed 's/  */ /g; s/^ //; s/ $//' )
}

# ── archive tests ──────────────────────────────────────────────────────────

test_archive_greenfield() {
  setup_project "arch-green" 0
  run_scratch "$PROJECT_DIR" archive done-folder

  (( SCRATCH_EXIT == 0 )) || { echo "  exit=$SCRATCH_EXIT"; echo "$SCRATCH_STDOUT"; return 1; }
  assert_contains "init message" "$SCRATCH_STDOUT" "Creating archive branch (first-time setup)" || return 1
  assert_contains "success message" "$SCRATCH_STDOUT" "Folder archived successfully" || return 1
  local main_tree; main_tree=$(cd "$SCRATCH_DIR" && ls | tr '\n' ' ' | sed 's/ $//')
  assert "main tree (done-folder removed)" "$main_tree" "keep-folder" || return 1
  local archive_tree; archive_tree=$(cd "$SCRATCH_DIR" && git ls-tree -r --name-only archive | LC_ALL=C sort | tr '\n' ' ' | sed 's/ $//')
  assert "archive tree" "$archive_tree" "README.md done-folder/README.md" || return 1
  local remote_refs; remote_refs=$(cd "$REMOTE_DIR" && git for-each-ref --format='%(refname:short)' | LC_ALL=C sort | tr '\n' ' ' | sed 's/ $//')
  assert "remote has main and archive" "$remote_refs" "archive main" || return 1
  return 0
}

test_archive_fresh_clone_remote_has_archive() {
  setup_project "arch-src" 1
  local src_remote="$REMOTE_DIR"
  local fresh_proj="$ROOT_TMP/arch-fresh"
  mkdir -p "$fresh_proj"
  git clone -q "$src_remote" "$fresh_proj/scratch"
  (cd "$fresh_proj/scratch" && git config user.email t@t && git config user.name t)
  run_scratch "$fresh_proj" archive done-folder

  (( SCRATCH_EXIT == 0 )) || { echo "  exit=$SCRATCH_EXIT"; echo "$SCRATCH_STDOUT"; return 1; }
  assert_contains "tracking message" "$SCRATCH_STDOUT" "creating local tracking branch" || return 1
  assert_contains "success message" "$SCRATCH_STDOUT" "Folder archived successfully" || return 1
  assert_not_contains "did NOT trigger first-time setup" "$SCRATCH_STDOUT" "first-time setup" || return 1
  local archive_tree; archive_tree=$(cd "$fresh_proj/scratch" && git ls-tree -r --name-only archive | LC_ALL=C sort | tr '\n' ' ' | sed 's/ $//')
  assert "archive preserves legacy + adds done" "$archive_tree" "README.md done-folder/README.md legacy-folder/README.md" || return 1
  return 0
}

test_archive_no_origin_bails() {
  local name="arch-no-origin"
  PROJECT_DIR="$ROOT_TMP/$name"
  SCRATCH_DIR="$PROJECT_DIR/scratch"
  mkdir -p "$SCRATCH_DIR"
  (
    cd "$SCRATCH_DIR"
    git init -q -b main && git config user.email t@t && git config user.name t
    mkdir done-folder && echo d > done-folder/README.md
    echo '{"projectName":"'"$name"'","archiveBranch":"archive"}' > .scratch-config.json
    git add -A && git commit -q -m init
  )
  run_scratch "$PROJECT_DIR" archive done-folder

  (( SCRATCH_EXIT != 0 )) || { echo "  expected non-zero exit"; return 1; }
  assert_contains "clear error" "$SCRATCH_STDOUT" 'No git remote named "origin" is configured' || return 1
  assert "no orphan branch left behind" "$(branches_at "$SCRATCH_DIR")" "* main" || return 1
  return 0
}

test_archive_unreachable_origin_bails() {
  local name="arch-unreachable"
  PROJECT_DIR="$ROOT_TMP/$name"
  SCRATCH_DIR="$PROJECT_DIR/scratch"
  mkdir -p "$SCRATCH_DIR"
  (
    cd "$SCRATCH_DIR"
    git init -q -b main && git config user.email t@t && git config user.name t
    git remote add origin "$ROOT_TMP/does-not-exist.git"
    mkdir done-folder && echo d > done-folder/README.md
    echo '{"projectName":"'"$name"'","archiveBranch":"archive"}' > .scratch-config.json
    git add -A && git commit -q -m init
  )
  run_scratch "$PROJECT_DIR" archive done-folder

  (( SCRATCH_EXIT != 0 )) || { echo "  expected non-zero exit"; return 1; }
  assert_contains "reachability error" "$SCRATCH_STDOUT" "Cannot reach origin" || return 1
  assert_contains "mentions divergence risk" "$SCRATCH_STDOUT" "would diverge from remote" || return 1
  assert "no orphan branch left behind" "$(branches_at "$SCRATCH_DIR")" "* main" || return 1
  return 0
}

test_archive_second_reuses_local_branch() {
  setup_project "arch-second" 0
  run_scratch "$PROJECT_DIR" archive done-folder
  (( SCRATCH_EXIT == 0 )) || { echo "  first archive failed"; echo "$SCRATCH_STDOUT"; return 1; }
  (
    cd "$SCRATCH_DIR"
    mkdir -p second-done && echo "second" > second-done/README.md
    git add -A && git commit -q -m "add second"
    git push -q origin main
  )
  run_scratch "$PROJECT_DIR" archive second-done
  (( SCRATCH_EXIT == 0 )) || { echo "  second archive failed"; echo "$SCRATCH_STDOUT"; return 1; }
  assert_not_contains "did NOT trigger first-time setup" "$SCRATCH_STDOUT" "first-time setup" || return 1
  local archive_tree; archive_tree=$(cd "$SCRATCH_DIR" && git ls-tree -r --name-only archive | LC_ALL=C sort | tr '\n' ' ' | sed 's/ $//')
  assert "archive has both folders" "$archive_tree" "README.md done-folder/README.md second-done/README.md" || return 1
  return 0
}

test_archive_uncommitted_folder() {
  setup_project "arch-uncommitted" 0
  (
    cd "$SCRATCH_DIR"
    mkdir -p draft-folder && echo "draft" > draft-folder/README.md
  )
  run_scratch "$PROJECT_DIR" archive draft-folder
  (( SCRATCH_EXIT == 0 )) || { echo "  archive failed"; echo "$SCRATCH_STDOUT"; return 1; }
  assert_contains "uncommitted path" "$SCRATCH_STDOUT" "uncommitted" || return 1
  [[ ! -e "$SCRATCH_DIR/draft-folder" ]] || { echo "  draft-folder still in working tree"; return 1; }
  local archive_tree; archive_tree=$(cd "$SCRATCH_DIR" && git ls-tree -r --name-only archive | LC_ALL=C sort | tr '\n' ' ' | sed 's/ $//')
  assert_contains "archive contains draft-folder" "$archive_tree" "draft-folder/README.md" || return 1
  return 0
}

# ── save tests ─────────────────────────────────────────────────────────────

test_save_new_uncommitted_folder() {
  setup_project "save-new" 0
  (
    cd "$SCRATCH_DIR"
    mkdir -p draft && echo "draft" > draft/README.md
  )
  run_scratch "$PROJECT_DIR" save draft
  (( SCRATCH_EXIT == 0 )) || { echo "  save failed"; echo "$SCRATCH_STDOUT"; return 1; }
  assert_contains "success message" "$SCRATCH_STDOUT" "Folder saved successfully" || return 1
  [[ -d "$SCRATCH_DIR/draft" ]] || { echo "  draft folder missing after save"; return 1; }
  local main_tree; main_tree=$(cd "$SCRATCH_DIR" && git ls-tree -r --name-only main | LC_ALL=C sort | tr '\n' ' ' | sed 's/ $//')
  assert_contains "draft committed to main" "$main_tree" "draft/README.md" || return 1
  local remote_tree; remote_tree=$(cd "$REMOTE_DIR" && git ls-tree -r --name-only main | LC_ALL=C sort | tr '\n' ' ' | sed 's/ $//')
  assert_contains "draft pushed to remote" "$remote_tree" "draft/README.md" || return 1
  return 0
}

test_save_already_committed_warns() {
  # done-folder is already committed by setup; save with no changes should
  # emit a "no new changes" warning and NOT create an extra commit.
  setup_project "save-noop" 0
  local before_sha; before_sha=$(cd "$SCRATCH_DIR" && git rev-parse HEAD)
  run_scratch "$PROJECT_DIR" save done-folder
  (( SCRATCH_EXIT == 0 )) || { echo "  save exit=$SCRATCH_EXIT"; echo "$SCRATCH_STDOUT"; return 1; }
  assert_contains "no-changes warning" "$SCRATCH_STDOUT" "already saved, no new changes" || return 1
  local after_sha; after_sha=$(cd "$SCRATCH_DIR" && git rev-parse HEAD)
  assert "no new commit created" "$after_sha" "$before_sha" || return 1
  return 0
}

test_save_modified_committed_folder() {
  setup_project "save-modified" 0
  (
    cd "$SCRATCH_DIR"
    echo "updated" > done-folder/README.md
  )
  local before_sha; before_sha=$(cd "$SCRATCH_DIR" && git rev-parse HEAD)
  run_scratch "$PROJECT_DIR" save done-folder
  (( SCRATCH_EXIT == 0 )) || { echo "  save failed"; echo "$SCRATCH_STDOUT"; return 1; }
  assert_contains "success message" "$SCRATCH_STDOUT" "Folder saved successfully" || return 1
  local after_sha; after_sha=$(cd "$SCRATCH_DIR" && git rev-parse HEAD)
  if [[ "$after_sha" == "$before_sha" ]]; then
    echo "  expected new commit after modifying and saving"
    return 1
  fi
  return 0
}

# ── list tests ─────────────────────────────────────────────────────────────

test_list_shows_committed_and_uncommitted() {
  setup_project "list-mixed" 0
  (
    cd "$SCRATCH_DIR"
    mkdir -p draft-folder && echo "draft" > draft-folder/README.md
  )
  run_scratch "$PROJECT_DIR" list
  (( SCRATCH_EXIT == 0 )) || { echo "  list exit=$SCRATCH_EXIT"; echo "$SCRATCH_STDOUT"; return 1; }
  assert_contains "header" "$SCRATCH_STDOUT" "Active folders" || return 1
  assert_contains "keep-folder listed" "$SCRATCH_STDOUT" "keep-folder" || return 1
  assert_contains "done-folder listed" "$SCRATCH_STDOUT" "done-folder" || return 1
  assert_contains "draft-folder listed" "$SCRATCH_STDOUT" "draft-folder" || return 1
  assert_contains "saved label" "$SCRATCH_STDOUT" "[saved]" || return 1
  assert_contains "uncommitted label" "$SCRATCH_STDOUT" "[uncommitted]" || return 1
  return 0
}

test_list_excludes_archived() {
  setup_project "list-after-archive" 0
  run_scratch "$PROJECT_DIR" archive done-folder
  (( SCRATCH_EXIT == 0 )) || { echo "  prep archive failed"; return 1; }
  run_scratch "$PROJECT_DIR" list
  (( SCRATCH_EXIT == 0 )) || { echo "  list exit=$SCRATCH_EXIT"; return 1; }
  assert_contains "keep-folder still listed" "$SCRATCH_STDOUT" "keep-folder" || return 1
  assert_not_contains "done-folder removed from list" "$SCRATCH_STDOUT" "done-folder" || return 1
  return 0
}

# ── archived tests ─────────────────────────────────────────────────────────

test_archived_before_archive_branch_exists() {
  setup_project "archived-empty" 0
  run_scratch "$PROJECT_DIR" archived
  (( SCRATCH_EXIT == 0 )) || { echo "  archived exit=$SCRATCH_EXIT"; echo "$SCRATCH_STDOUT"; return 1; }
  assert_contains "not-yet-created message" "$SCRATCH_STDOUT" "Archive branch not yet created" || return 1
  return 0
}

test_archived_lists_archived_folders() {
  setup_project "archived-populated" 0
  run_scratch "$PROJECT_DIR" archive done-folder
  (( SCRATCH_EXIT == 0 )) || { echo "  prep archive failed"; return 1; }
  run_scratch "$PROJECT_DIR" archived
  (( SCRATCH_EXIT == 0 )) || { echo "  archived exit=$SCRATCH_EXIT"; echo "$SCRATCH_STDOUT"; return 1; }
  assert_contains "header" "$SCRATCH_STDOUT" "Archived folders" || return 1
  assert_contains "done-folder shown" "$SCRATCH_STDOUT" "done-folder" || return 1
  # README.md is the archive-branch marker file — must be filtered out of the listing
  assert_not_contains "README.md filtered" "$SCRATCH_STDOUT" "  - README.md" || return 1
  return 0
}

# ── config tests ───────────────────────────────────────────────────────────

test_config_shows_project_and_branch() {
  setup_project "cfg-show" 0
  run_scratch "$PROJECT_DIR" config
  (( SCRATCH_EXIT == 0 )) || { echo "  config exit=$SCRATCH_EXIT"; echo "$SCRATCH_STDOUT"; return 1; }
  assert_contains "header" "$SCRATCH_STDOUT" "Current configuration" || return 1
  assert_contains "project name" "$SCRATCH_STDOUT" "cfg-show" || return 1
  assert_contains "archive branch" "$SCRATCH_STDOUT" "archive" || return 1
  assert_contains "config file path" "$SCRATCH_STDOUT" ".scratch-config.json" || return 1
  return 0
}

# ── run ────────────────────────────────────────────────────────────────────

printf '%sscratch-management e2e — tmp root: %s%s\n' "$C_DIM" "$ROOT_TMP" "$C_RESET"
if (( ${#FILTERS[@]} > 0 )); then
  printf '%sfilters: %s%s\n' "$C_CYAN" "${FILTERS[*]}" "$C_RESET"
fi
printf '\n'

record archive  "greenfield first archive"                test_archive_greenfield
record archive  "fresh clone, remote has archive"         test_archive_fresh_clone_remote_has_archive
record archive  "no origin configured — aborts cleanly"   test_archive_no_origin_bails
record archive  "unreachable origin — aborts cleanly"     test_archive_unreachable_origin_bails
record archive  "second archive reuses local branch"      test_archive_second_reuses_local_branch
record archive  "uncommitted folder archives correctly"   test_archive_uncommitted_folder

record save     "new uncommitted folder commits + pushes" test_save_new_uncommitted_folder
record save     "already-saved folder warns"              test_save_already_committed_warns
record save     "modified committed folder saves"         test_save_modified_committed_folder

record list     "shows saved and uncommitted folders"     test_list_shows_committed_and_uncommitted
record list     "excludes archived folders"               test_list_excludes_archived

record archived "reports not-yet-created before archive"  test_archived_before_archive_branch_exists
record archived "lists archived folders, filters README"  test_archived_lists_archived_folders

record config   "shows project + archive-branch + path"   test_config_shows_project_and_branch

printf '\n%d passed, %d failed, %d skipped\n' "$PASS" "$FAIL" "$SKIP"
if (( FAIL > 0 )); then
  printf 'failures:\n'
  printf '  - %s\n' "${FAIL_NAMES[@]}"
  exit 1
fi
exit 0
