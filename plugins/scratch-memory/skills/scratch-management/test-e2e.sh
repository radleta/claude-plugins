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

# The script beside this test, not the `scratch` on PATH, whose fallback is another checkout's copy
SCRATCH_MJS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/scratch.mjs"

run_scratch() {
  local dir="$1"; shift
  SCRATCH_STDOUT=$(cd "$dir" && node "$SCRATCH_MJS" "$@" 2>&1)
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

# ref_at <repo> <branch> — the branch's commit, or empty when it does not exist
ref_at() {
  git -C "$1" rev-parse -q --verify "refs/heads/$2" 2>/dev/null
}

# local_state <repo> — every local branch ref plus every index entry, the
# state a refused archive must leave unchanged
local_state() {
  git -C "$1" for-each-ref --format='%(refname) %(objectname)' refs/heads
  git -C "$1" ls-files -s
}

# commit_on_remote_archive <remote> <path> <content> <push:0|1> — commits a
# file onto the remote's archive branch from a separate clone; sets OTHER_DIR
commit_on_remote_archive() {
  OTHER_DIR="$(dirname "$1")/other-clone"
  git clone -q -b archive "$1" "$OTHER_DIR"
  (
    cd "$OTHER_DIR"
    git config user.email o@o && git config user.name o
    mkdir -p "$(dirname "$2")" && echo "$3" > "$2"
    git add -A && git commit -q -m "other clone"
    (( $4 )) && git push -q origin archive
    true
  )
}

# ── archive tests ──────────────────────────────────────────────────────────

test_archive_greenfield() {
  setup_project "arch-green" 0
  local remote_main; remote_main=$(git -C "$REMOTE_DIR" rev-parse main)
  run_scratch "$PROJECT_DIR" archive done-folder

  (( SCRATCH_EXIT == 0 )) || { echo "  exit=$SCRATCH_EXIT"; echo "$SCRATCH_STDOUT"; return 1; }
  assert_contains "success message" "$SCRATCH_STDOUT" "Folder archived successfully" || return 1
  local main_tree; main_tree=$(cd "$SCRATCH_DIR" && ls | tr '\n' ' ' | sed 's/ $//')
  assert "main tree (done-folder removed)" "$main_tree" "keep-folder" || return 1
  local archive_tree; archive_tree=$(cd "$SCRATCH_DIR" && git ls-tree -r --name-only archive | LC_ALL=C sort | tr '\n' ' ' | sed 's/ $//')
  assert "archive tree is exactly the folder" "$archive_tree" "done-folder/README.md" || return 1
  assert "archive commit is parentless" "$(cd "$SCRATCH_DIR" && git rev-list --count archive)" "1" || return 1
  local remote_refs; remote_refs=$(cd "$REMOTE_DIR" && git for-each-ref --format='%(refname:short)' | LC_ALL=C sort | tr '\n' ' ' | sed 's/ $//')
  assert "remote has main and archive" "$remote_refs" "archive main" || return 1
  assert "local archive matches remote" "$(ref_at "$SCRATCH_DIR" archive)" "$(ref_at "$REMOTE_DIR" archive)" || return 1
  assert "local main holds the removal commit" "$(git -C "$SCRATCH_DIR" log -1 --format=%s main)" "Archived done-folder to archive branch" || return 1
  assert "origin/main did not move" "$(git -C "$REMOTE_DIR" rev-parse main)" "$remote_main" || return 1
  assert_contains "reports main unpushed" "$SCRATCH_STDOUT" "Local main holds unpushed commits, the removal commit among them" || return 1
  return 0
}

test_archive_fresh_clone_remote_has_archive() {
  setup_project "arch-src" 1
  local src_remote="$REMOTE_DIR"
  local prev_archive; prev_archive=$(ref_at "$src_remote" archive)
  local remote_main; remote_main=$(git -C "$src_remote" rev-parse main)
  local fresh_proj="$ROOT_TMP/arch-fresh"
  mkdir -p "$fresh_proj"
  git clone -q "$src_remote" "$fresh_proj/scratch"
  (cd "$fresh_proj/scratch" && git config user.email t@t && git config user.name t)
  run_scratch "$fresh_proj" archive done-folder

  (( SCRATCH_EXIT == 0 )) || { echo "  exit=$SCRATCH_EXIT"; echo "$SCRATCH_STDOUT"; return 1; }
  assert_contains "success message" "$SCRATCH_STDOUT" "Folder archived successfully" || return 1
  local archive_tree; archive_tree=$(cd "$fresh_proj/scratch" && git ls-tree -r --name-only archive | LC_ALL=C sort | tr '\n' ' ' | sed 's/ $//')
  assert "archive preserves legacy + adds done" "$archive_tree" "README.md done-folder/README.md legacy-folder/README.md" || return 1
  assert "parent is the previous origin/archive" "$(cd "$fresh_proj/scratch" && git rev-parse archive^)" "$prev_archive" || return 1
  assert "local archive matches remote" "$(ref_at "$fresh_proj/scratch" archive)" "$(ref_at "$src_remote" archive)" || return 1
  assert "origin/main did not move" "$(git -C "$src_remote" rev-parse main)" "$remote_main" || return 1
  return 0
}

test_archive_lane_branch_no_remote() {
  local name="arch-lane-no-remote"
  PROJECT_DIR="$ROOT_TMP/$name"
  SCRATCH_DIR="$PROJECT_DIR/scratch"
  mkdir -p "$SCRATCH_DIR"
  (
    cd "$SCRATCH_DIR"
    git init -q -b main && git config user.email t@t && git config user.name t
    mkdir keep-folder && echo k > keep-folder/README.md
    echo '{"projectName":"'"$name"'","archiveBranch":"archive"}' > .scratch-config.json
    git add -A && git commit -q -m init
    git switch -q -c lane/foo
    mkdir done-folder && echo d > done-folder/README.md
    git add -A && git commit -q -m "lane work"
  )
  local main_before; main_before=$(ref_at "$SCRATCH_DIR" main)
  run_scratch "$PROJECT_DIR" archive done-folder

  (( SCRATCH_EXIT == 0 )) || { echo "  exit=$SCRATCH_EXIT"; echo "$SCRATCH_STDOUT"; return 1; }
  assert_contains "prints the lane branch" "$SCRATCH_STDOUT" "Branch: lane/foo" || return 1
  assert "archive holds the folder" "$(git -C "$SCRATCH_DIR" ls-tree -r --name-only archive)" "done-folder/README.md" || return 1
  assert "lane branch holds the removal commit" "$(git -C "$SCRATCH_DIR" log -1 --format=%s lane/foo)" "Archived done-folder to archive branch" || return 1
  assert_contains "the lane's push carries it" "$SCRATCH_STDOUT" "the removal commit among them; the lane's plain push carries it" || return 1
  assert "main did not move" "$(ref_at "$SCRATCH_DIR" main)" "$main_before" || return 1
  assert "still on the lane branch" "$(git -C "$SCRATCH_DIR" branch --show-current)" "lane/foo" || return 1
  return 0
}

test_archive_lane_branch_no_upstream() {
  setup_project "arch-lane-no-upstream" 0
  (
    cd "$SCRATCH_DIR"
    git switch -q -c lane/foo
    mkdir lane-folder && echo l > lane-folder/README.md
    git add -A && git commit -q -m "lane work"
  )
  local remote_main; remote_main=$(git -C "$REMOTE_DIR" rev-parse main)
  run_scratch "$PROJECT_DIR" archive lane-folder

  (( SCRATCH_EXIT == 0 )) || { echo "  exit=$SCRATCH_EXIT"; echo "$SCRATCH_STDOUT"; return 1; }
  assert_contains "prints the lane branch" "$SCRATCH_STDOUT" "Branch: lane/foo" || return 1
  assert "archive published" "$(ref_at "$REMOTE_DIR" archive)" "$(ref_at "$SCRATCH_DIR" archive)" || return 1
  assert "lane branch holds the removal commit" "$(git -C "$SCRATCH_DIR" log -1 --format=%s lane/foo)" "Archived lane-folder to archive branch" || return 1
  assert "origin/main did not move" "$(git -C "$REMOTE_DIR" rev-parse main)" "$remote_main" || return 1
  assert "lane branch not pushed" "$(ref_at "$REMOTE_DIR" lane/foo)" "" || return 1
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

test_archive_network_timeout() {
  setup_project "arch-timeout" 0
  local stub="$PROJECT_DIR/stub-bin"
  mkdir -p "$stub"
  # The default GIT_SSH_COMMAND resolves `ssh` from PATH, so this stub stands in for a stalled ssh.
  printf '#!/bin/sh\necho "$@" > "%s/ssh-args"\necho $$ > "%s/ssh-pid"\nexec sleep 30\n' "$stub" "$stub" > "$stub/ssh"
  chmod +x "$stub/ssh"
  git -C "$SCRATCH_DIR" remote set-url origin "ssh://git@stalled.invalid/x.git"
  local start=$SECONDS
  SCRATCH_STDOUT=$(cd "$PROJECT_DIR" && env -u GIT_SSH_COMMAND GIT_CONFIG_GLOBAL=/dev/null PATH="$stub:$PATH" \
    SCRATCH_NET_TIMEOUT=2 node "$SCRATCH_MJS" archive done-folder 2>&1)
  SCRATCH_EXIT=$?
  (( SCRATCH_EXIT != 0 )) || { echo "  expected non-zero exit"; return 1; }
  assert_contains "prints the timeout line" "$SCRATCH_STDOUT" "ERROR: git ls-remote timed out after 2s" || return 1
  (( SECONDS - start < 10 )) || { echo "  took $((SECONDS - start))s"; return 1; }
  assert_contains "non-interactive ssh" "$(cat "$stub/ssh-args")" "BatchMode=yes" || return 1
  sleep 1
  ! kill -0 "$(cat "$stub/ssh-pid")" 2>/dev/null || { echo "  ssh left running"; return 1; }
  assert "nothing archived" "$(branches_at "$SCRATCH_DIR")" "* main" || return 1
  return 0
}

test_archive_interrupt_kills_network_call() {
  setup_project "arch-interrupt" 0
  local stub="$PROJECT_DIR/stub-bin"
  mkdir -p "$stub"
  printf '#!/bin/sh\necho $$ > "%s/ssh-pid"\nexec sleep 30\n' "$stub" > "$stub/ssh"
  chmod +x "$stub/ssh"
  git -C "$SCRATCH_DIR" remote set-url origin "ssh://git@stalled.invalid/x.git"
  (cd "$PROJECT_DIR" && exec env -u GIT_SSH_COMMAND GIT_CONFIG_GLOBAL=/dev/null PATH="$stub:$PATH" \
    node "$SCRATCH_MJS" archive done-folder >/dev/null 2>&1) &
  local node_pid=$! i
  for i in $(seq 50); do [[ -s "$stub/ssh-pid" ]] && break; sleep 0.1; done
  [[ -s "$stub/ssh-pid" ]] || { echo "  stub ssh never started"; return 1; }
  kill -INT "$node_pid"
  wait "$node_pid"
  local rc=$?
  assert "exits 130 on SIGINT" "$rc" "130" || return 1
  sleep 1
  ! kill -0 "$(cat "$stub/ssh-pid")" 2>/dev/null || { echo "  ssh left running after Ctrl+C"; return 1; }
  return 0
}

test_archive_bad_net_timeout_refused() {
  setup_project "arch-bad-timeout" 0
  local v
  for v in abc 0 2147484; do
    SCRATCH_STDOUT=$(cd "$PROJECT_DIR" && SCRATCH_NET_TIMEOUT=$v node "$SCRATCH_MJS" archive done-folder 2>&1)
    SCRATCH_EXIT=$?
    (( SCRATCH_EXIT != 0 )) || { echo "  expected non-zero exit for $v"; return 1; }
    assert_contains "names the value $v" "$SCRATCH_STDOUT" "SCRATCH_NET_TIMEOUT must be a whole number of seconds from 1 to 2147483, not '$v'" || return 1
  done
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
  local archive_tree; archive_tree=$(cd "$SCRATCH_DIR" && git ls-tree -r --name-only archive | LC_ALL=C sort | tr '\n' ' ' | sed 's/ $//')
  assert "archive has both folders" "$archive_tree" "done-folder/README.md second-done/README.md" || return 1
  return 0
}

test_archive_uncommitted_folder() {
  setup_project "arch-uncommitted" 0
  (
    cd "$SCRATCH_DIR"
    mkdir -p draft-folder && echo "draft" > draft-folder/README.md
    echo "untracked" > done-folder/extra.md
  )
  local before; before=$(local_state "$SCRATCH_DIR")
  local folder
  for folder in draft-folder done-folder; do
    run_scratch "$PROJECT_DIR" archive "$folder"
    (( SCRATCH_EXIT == 1 )) || { echo "  $folder: exit=$SCRATCH_EXIT"; echo "$SCRATCH_STDOUT"; return 1; }
    assert_contains "$folder: tells user to save" "$SCRATCH_STDOUT" "scratch save $folder" || return 1
    [[ -f "$SCRATCH_DIR/$folder/README.md" ]] || { echo "  $folder removed from disk"; return 1; }
    run_scratch "$PROJECT_DIR" archive "$folder" --force
    (( SCRATCH_EXIT == 1 )) || { echo "  $folder --force: exit=$SCRATCH_EXIT"; echo "$SCRATCH_STDOUT"; return 1; }
    assert_contains "$folder --force: still tells user to save" "$SCRATCH_STDOUT" "scratch save $folder" || return 1
  done
  assert "no local branch ref or index entry changed" "$(local_state "$SCRATCH_DIR")" "$before" || return 1
  assert "remote archive not created" "$(ref_at "$REMOTE_DIR" archive)" "" || return 1
  return 0
}

# setup_ignored_file <name> — project whose done-folder holds one git-ignored file
setup_ignored_file() {
  setup_project "$1" 0
  (
    cd "$SCRATCH_DIR"
    echo '*.local.md' > .gitignore
    git add .gitignore && git commit -q -m "ignore local notes" && git push -q origin main
    echo "scratchpad" > done-folder/notes.local.md
  )
}

test_archive_ignored_files_refused() {
  setup_ignored_file "arch-ignored"
  local before; before=$(local_state "$SCRATCH_DIR")
  run_scratch "$PROJECT_DIR" archive done-folder
  (( SCRATCH_EXIT == 1 )) || { echo "  exit=$SCRATCH_EXIT"; echo "$SCRATCH_STDOUT"; return 1; }
  assert_contains "lists the ignored file" "$SCRATCH_STDOUT" "git-ignored files: done-folder/notes.local.md" || return 1
  assert_contains "offers git add -f" "$SCRATCH_STDOUT" "add -f" || return 1
  assert_contains "offers --force" "$SCRATCH_STDOUT" "scratch archive done-folder --force" || return 1
  [[ -f "$SCRATCH_DIR/done-folder/notes.local.md" ]] || { echo "  ignored file deleted"; return 1; }
  assert "no local branch ref or index entry changed" "$(local_state "$SCRATCH_DIR")" "$before" || return 1
  return 0
}

test_archive_force_deletes_ignored_files() {
  setup_ignored_file "arch-ignored-force"
  run_scratch "$PROJECT_DIR" archive done-folder --force
  (( SCRATCH_EXIT == 0 )) || { echo "  exit=$SCRATCH_EXIT"; echo "$SCRATCH_STDOUT"; return 1; }
  assert_contains "lists what it deletes" "$SCRATCH_STDOUT" "Deleting git-ignored files (--force): done-folder/notes.local.md" || return 1
  assert_contains "success message" "$SCRATCH_STDOUT" "Folder archived successfully" || return 1
  [[ ! -e "$SCRATCH_DIR/done-folder" ]] || { echo "  done-folder still on disk"; ls -la "$SCRATCH_DIR/done-folder"; return 1; }
  local archive_tree; archive_tree=$(cd "$SCRATCH_DIR" && git ls-tree -r --name-only archive | tr '\n' ' ' | sed 's/ $//')
  assert "archive holds only committed files" "$archive_tree" "done-folder/README.md" || return 1
  return 0
}

test_archive_force_folder_level_gitignore() {
  setup_project "arch-ignored-folder-rule" 0
  (
    cd "$SCRATCH_DIR"
    printf '*.log\ncache/\n' > done-folder/.gitignore
    git add done-folder/.gitignore && git commit -q -m "folder ignore rules" && git push -q origin main
    echo "log" > done-folder/x.log
    mkdir -p done-folder/cache/deep && echo "c" > done-folder/cache/deep/a.txt
  )
  run_scratch "$PROJECT_DIR" archive done-folder --force
  (( SCRATCH_EXIT == 0 )) || { echo "  exit=$SCRATCH_EXIT"; echo "$SCRATCH_STDOUT"; return 1; }
  [[ ! -e "$SCRATCH_DIR/done-folder" ]] || { echo "  done-folder still on disk:"; find "$SCRATCH_DIR/done-folder"; return 1; }
  assert "scratch tree clean" "$(cd "$SCRATCH_DIR" && git status --porcelain --ignored)" "" || return 1
  local archive_tree; archive_tree=$(cd "$SCRATCH_DIR" && git ls-tree -r --name-only archive | LC_ALL=C sort | tr '\n' ' ' | sed 's/ $//')
  assert "archive holds only committed files" "$archive_tree" "done-folder/.gitignore done-folder/README.md" || return 1
  return 0
}

test_archive_dirty_outside_folder() {
  setup_project "arch-dirty-outside" 0
  (
    cd "$SCRATCH_DIR"
    mkdir -p other && echo "notes" > other/notes.md
    git add -A && git commit -q -m "add other" && git push -q origin main
    echo "edited" >> other/notes.md
    echo "staged" > other/staged.md && git add other/staged.md
  )
  local before; before=$(cd "$SCRATCH_DIR" && git status --porcelain -- other)
  run_scratch "$PROJECT_DIR" archive done-folder
  (( SCRATCH_EXIT == 0 )) || { echo "  exit=$SCRATCH_EXIT"; echo "$SCRATCH_STDOUT"; return 1; }
  assert "other/ still modified and staged" "$(cd "$SCRATCH_DIR" && git status --porcelain -- other)" "$before" || return 1
  assert "removal commit holds only the folder" "$(cd "$SCRATCH_DIR" && git show --name-only --format= HEAD)" "done-folder/README.md" || return 1
  assert "still on main" "$(cd "$SCRATCH_DIR" && git branch --show-current)" "main" || return 1
  assert "archive holds the folder" "$(cd "$SCRATCH_DIR" && git show archive:done-folder/README.md)" "done" || return 1
  return 0
}

test_archive_lfs_raw_blob_elsewhere() {
  if ! git lfs version >/dev/null 2>&1; then
    echo "  SKIP: git lfs not installed"
    return 0
  fi
  setup_project "arch-lfs" 0
  (
    cd "$SCRATCH_DIR"
    git lfs install --local >/dev/null
    mkdir -p other && printf '\x89PNG raw blob' > other/raw.png
    git add -A && git commit -q -m "raw blob before lfs routing" && git push -q origin main
    echo '*.png filter=lfs diff=lfs merge=lfs -text' > .gitattributes
    printf '\x89PNG lfs image' > done-folder/img.png
    git add -A && git commit -q -m "lfs image"
  ) || return 1
  local pointer; pointer=$(cd "$SCRATCH_DIR" && git cat-file -p main:done-folder/img.png)
  assert_contains "img.png stored as lfs pointer" "$pointer" "git-lfs.github.com/spec" || return 1
  local oid; oid=$(printf '%s\n' "$pointer" | sed -n 's/^oid sha256://p')
  local before; before=$(cd "$SCRATCH_DIR" && git status --porcelain)
  run_scratch "$PROJECT_DIR" archive done-folder
  (( SCRATCH_EXIT == 0 )) || { echo "  exit=$SCRATCH_EXIT"; echo "$SCRATCH_STDOUT"; return 1; }
  assert "git status unchanged" "$(cd "$SCRATCH_DIR" && git status --porcelain)" "$before" || return 1
  [[ -f "$REMOTE_DIR/lfs/objects/${oid:0:2}/${oid:2:2}/$oid" ]] || { echo "  lfs object $oid not on remote"; return 1; }
  return 0
}

test_archive_different_tree_refused() {
  setup_project "arch-diff-tree" 1
  commit_on_remote_archive "$REMOTE_DIR" done-folder/README.md "older contents" 1
  local remote_before; remote_before=$(ref_at "$REMOTE_DIR" archive)
  local archived_tree; archived_tree=$(git -C "$REMOTE_DIR" rev-parse archive:done-folder)
  local main_tree; main_tree=$(git -C "$SCRATCH_DIR" rev-parse main:done-folder)
  run_scratch "$PROJECT_DIR" archive done-folder
  (( SCRATCH_EXIT == 1 )) || { echo "  exit=$SCRATCH_EXIT"; echo "$SCRATCH_STDOUT"; return 1; }
  assert_contains "names archived tree" "$SCRATCH_STDOUT" "$archived_tree" || return 1
  assert_contains "names main tree" "$SCRATCH_STDOUT" "$main_tree" || return 1
  assert "origin/archive did not move" "$(ref_at "$REMOTE_DIR" archive)" "$remote_before" || return 1
  assert "done-folder still on main" "$(git -C "$SCRATCH_DIR" rev-parse main:done-folder)" "$main_tree" || return 1
  return 0
}

test_archive_rerun_same_tree() {
  setup_project "arch-rerun" 0
  local published
  published=$(
    cd "$SCRATCH_DIR"
    tree=$(printf '040000 tree %s\tdone-folder\n' "$(git rev-parse main:done-folder)" | git mktree)
    c=$(git commit-tree "$tree" -m "Archive: done-folder")
    git push -q origin "$c:refs/heads/archive" && echo "$c"
  )
  local remote_main; remote_main=$(git -C "$REMOTE_DIR" rev-parse main)
  run_scratch "$PROJECT_DIR" archive done-folder
  (( SCRATCH_EXIT == 0 )) || { echo "  exit=$SCRATCH_EXIT"; echo "$SCRATCH_STDOUT"; return 1; }
  assert_contains "skips the push" "$SCRATCH_STDOUT" "already on origin/archive" || return 1
  assert "origin/main did not move" "$(git -C "$REMOTE_DIR" rev-parse main)" "$remote_main" || return 1
  assert "origin/archive unchanged" "$(ref_at "$REMOTE_DIR" archive)" "$published" || return 1
  assert "local archive moved to origin" "$(ref_at "$SCRATCH_DIR" archive)" "$published" || return 1
  [[ ! -e "$SCRATCH_DIR/done-folder" ]] || { echo "  done-folder still on disk"; return 1; }
  return 0
}

test_archive_leaves_unapproved_main_unpushed() {
  setup_project "arch-unpushed" 0
  (
    cd "$SCRATCH_DIR"
    echo one >> keep-folder/README.md && git commit -q -am "local one"
    echo two >> keep-folder/README.md && git commit -q -am "local two"
  )
  local remote_main; remote_main=$(git -C "$REMOTE_DIR" rev-parse main)
  run_scratch "$PROJECT_DIR" archive done-folder
  (( SCRATCH_EXIT == 0 )) || { echo "  exit=$SCRATCH_EXIT"; echo "$SCRATCH_STDOUT"; return 1; }
  assert_contains "reports main unpushed" "$SCRATCH_STDOUT" "Local main holds unpushed commits, the removal commit among them" || return 1
  assert_not_contains "reported at Info, not as a warning" "$SCRATCH_STDOUT" "[WARN]" || return 1
  assert_not_contains "prints no push command" "$SCRATCH_STDOUT" "git -C scratch push" || return 1
  assert "origin/main did not move" "$(git -C "$REMOTE_DIR" rev-parse main)" "$remote_main" || return 1
  assert "archive still published" "$(ref_at "$REMOTE_DIR" archive)" "$(ref_at "$SCRATCH_DIR" archive)" || return 1
  return 0
}

test_archive_origin_without_main() {
  setup_project "arch-no-remote-main" 0
  git -C "$REMOTE_DIR" update-ref -d refs/heads/main
  run_scratch "$PROJECT_DIR" archive done-folder
  (( SCRATCH_EXIT == 0 )) || { echo "  exit=$SCRATCH_EXIT"; echo "$SCRATCH_STDOUT"; return 1; }
  assert_contains "reports main unpushed" "$SCRATCH_STDOUT" "Local main holds unpushed commits, the removal commit among them" || return 1
  assert "origin still has no main" "$(git -C "$REMOTE_DIR" rev-parse --verify -q main)" "" || return 1
  assert "archive published" "$(ref_at "$REMOTE_DIR" archive)" "$(ref_at "$SCRATCH_DIR" archive)" || return 1
  return 0
}

test_archive_push_race_rejected() {
  setup_project "arch-race" 1
  commit_on_remote_archive "$REMOTE_DIR" race-folder/README.md "from another clone" 0
  # The hook runs after preflight's fetch, so origin/archive moves between fetch and push.
  cat > "$SCRATCH_DIR/.git/hooks/pre-push" <<EOF
#!/bin/sh
cat >/dev/null
rm -f "\$0"
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE
git -C "$OTHER_DIR" push -q origin archive
EOF
  chmod +x "$SCRATCH_DIR/.git/hooks/pre-push"
  local main_before; main_before=$(ref_at "$SCRATCH_DIR" main)
  local remote_main; remote_main=$(git -C "$REMOTE_DIR" rev-parse main)
  local archive_before; archive_before=$(ref_at "$SCRATCH_DIR" archive)
  run_scratch "$PROJECT_DIR" archive done-folder
  (( SCRATCH_EXIT == 1 )) || { echo "  exit=$SCRATCH_EXIT"; echo "$SCRATCH_STDOUT"; return 1; }
  assert_contains "says to rerun" "$SCRATCH_STDOUT" "Run: scratch archive done-folder" || return 1
  assert "main has no removal commit" "$(ref_at "$SCRATCH_DIR" main)" "$main_before" || return 1
  assert "local archive did not move" "$(ref_at "$SCRATCH_DIR" archive)" "$archive_before" || return 1
  assert "origin/main did not move" "$(git -C "$REMOTE_DIR" rev-parse main)" "$remote_main" || return 1
  [[ -f "$SCRATCH_DIR/done-folder/README.md" ]] || { echo "  done-folder removed"; return 1; }
  return 0
}

test_archive_local_archive_ahead_refused() {
  setup_project "arch-local-ahead" 1
  (
    cd "$SCRATCH_DIR"
    git checkout -q archive
    echo "local only" > legacy-folder/local.md
    git add -A && git commit -q -m "local archive commit"
    git checkout -q main
  )
  local remote_archive; remote_archive=$(ref_at "$REMOTE_DIR" archive)
  run_scratch "$PROJECT_DIR" archive done-folder
  (( SCRATCH_EXIT == 1 )) || { echo "  exit=$SCRATCH_EXIT"; echo "$SCRATCH_STDOUT"; return 1; }
  assert_contains "names the cause" "$SCRATCH_STDOUT" "Local archive holds 1 commit(s) origin/archive lacks" || return 1
  assert_not_contains "prints no push command" "$SCRATCH_STDOUT" "git -C scratch push" || return 1
  assert "origin/archive did not move" "$(ref_at "$REMOTE_DIR" archive)" "$remote_archive" || return 1
  [[ -f "$SCRATCH_DIR/done-folder/README.md" ]] || { echo "  done-folder removed"; return 1; }
  return 0
}

# ── save tests ─────────────────────────────────────────────────────────────

test_save_new_uncommitted_folder() {
  setup_project "save-new" 0
  (
    cd "$SCRATCH_DIR"
    mkdir -p draft && echo "draft" > draft/README.md
  )
  local remote_main; remote_main=$(git -C "$REMOTE_DIR" rev-parse main)
  run_scratch "$PROJECT_DIR" save draft
  (( SCRATCH_EXIT == 0 )) || { echo "  save failed"; echo "$SCRATCH_STDOUT"; return 1; }
  assert_contains "success message" "$SCRATCH_STDOUT" "Folder saved successfully" || return 1
  assert_contains "says committed, not pushed" "$SCRATCH_STDOUT" "Committed on local main, not pushed; the push is the user's" || return 1
  [[ -d "$SCRATCH_DIR/draft" ]] || { echo "  draft folder missing after save"; return 1; }
  local main_tree; main_tree=$(cd "$SCRATCH_DIR" && git ls-tree -r --name-only main | LC_ALL=C sort | tr '\n' ' ' | sed 's/ $//')
  assert_contains "draft committed to main" "$main_tree" "draft/README.md" || return 1
  assert "origin/main did not move" "$(git -C "$REMOTE_DIR" rev-parse main)" "$remote_main" || return 1
  return 0
}

# setup_lane <name> — setup_project, then put the parent repo and scratch on lane/foo with its
# record pushed, and local main one commit ahead of the lane's fork
setup_lane() {
  setup_project "$1" 0
  git -C "$PROJECT_DIR" init -q -b lane/foo
  (
    cd "$SCRATCH_DIR"
    git switch -q -c lane/foo
    mkdir L-foo && printf -- '---\nprimary: foo\nbranch: lane/foo\n---\n' > L-foo/README.md
    git add -A && git commit -q -m "lane record" && git push -q -u origin lane/foo
    git switch -q main
    echo "main moved" > keep-folder/main.md
    git add -A && git commit -q -m "main ahead"
    git switch -q lane/foo
  )
}

test_save_on_lane_branch() {
  setup_lane "save-lane"
  mkdir -p "$SCRATCH_DIR/P" && echo "p" > "$SCRATCH_DIR/P/README.md"
  local main_before; main_before=$(ref_at "$SCRATCH_DIR" main)
  run_scratch "$PROJECT_DIR" save P
  (( SCRATCH_EXIT == 0 )) || { echo "  save failed"; echo "$SCRATCH_STDOUT"; return 1; }
  assert "lane tip is the save commit" "$(git -C "$SCRATCH_DIR" log -1 --format=%s lane/foo)" "chore(scratch): save P" || return 1
  assert "save commit holds P only" "$(git -C "$SCRATCH_DIR" show --name-only --format= lane/foo)" "P/README.md" || return 1
  git -C "$SCRATCH_DIR" merge-base --is-ancestor "$main_before" lane/foo || { echo "  main not merged into lane/foo"; return 1; }
  assert "origin/lane/foo equals the local tip" "$(ref_at "$REMOTE_DIR" lane/foo)" "$(ref_at "$SCRATCH_DIR" lane/foo)" || return 1
  assert_contains "prints the pushed branch" "$SCRATCH_STDOUT" "and pushed to origin/lane/foo" || return 1
  assert "main did not move" "$(ref_at "$SCRATCH_DIR" main)" "$main_before" || return 1
  return 0
}

test_save_on_lane_scratch_on_main() {
  setup_lane "save-lane-scratch-main"
  (
    cd "$SCRATCH_DIR"
    git switch -q main
    mkdir L-foo && printf -- '---\nprimary: foo\nbranch: lane/foo\n---\n' > L-foo/README.md
    git add -A && git commit -q -m "stray record on main"
  )
  mkdir -p "$SCRATCH_DIR/P" && echo "p" > "$SCRATCH_DIR/P/README.md"
  local main_before; main_before=$(ref_at "$SCRATCH_DIR" main)
  local origin_main_before; origin_main_before=$(ref_at "$REMOTE_DIR" main)
  run_scratch "$PROJECT_DIR" save P
  (( SCRATCH_EXIT != 0 )) || { echo "  save on scratch main should refuse"; return 1; }
  assert_contains "names both branches" "$SCRATCH_STDOUT" "on main, not the lane branch lane/foo" || return 1
  assert "main did not move" "$(ref_at "$SCRATCH_DIR" main)" "$main_before" || return 1
  assert "origin main not pushed" "$(ref_at "$REMOTE_DIR" main)" "$origin_main_before" || return 1
  return 0
}

test_save_on_lane_catch_up_conflict() {
  setup_lane "save-lane-conflict"
  (
    cd "$SCRATCH_DIR"
    echo "lane side" > keep-folder/main.md && git add -A && git commit -q -m "lane edit"
    mkdir -p P && echo "p" > P/README.md
  )
  local lane_before; lane_before=$(ref_at "$SCRATCH_DIR" lane/foo)
  run_scratch "$PROJECT_DIR" save P
  (( SCRATCH_EXIT != 0 )) || { echo "  expected non-zero exit"; return 1; }
  assert_contains "names the conflicting file" "$SCRATCH_STDOUT" "conflicts in: keep-folder/main.md" || return 1
  [[ ! -e "$SCRATCH_DIR/.git/MERGE_HEAD" ]] || { echo "  merge left in progress"; return 1; }
  assert "nothing committed" "$(ref_at "$SCRATCH_DIR" lane/foo)" "$lane_before" || return 1
  assert "P still uncommitted" "$(git -C "$SCRATCH_DIR" status --porcelain -- P/)" "?? P/" || return 1
  return 0
}

test_save_on_lane_push_rejected() {
  setup_lane "save-lane-push-rejected"
  local other="$PROJECT_DIR/other"
  git clone -q -b lane/foo "$REMOTE_DIR" "$other"
  git -C "$other" -c user.name=o -c user.email=o@o commit -q --allow-empty -m "other clone"
  git -C "$other" push -q origin lane/foo
  mkdir -p "$SCRATCH_DIR/P" && echo "p" > "$SCRATCH_DIR/P/README.md"
  run_scratch "$PROJECT_DIR" save P
  (( SCRATCH_EXIT != 0 )) || { echo "  expected non-zero exit"; return 1; }
  assert_contains "names the branch" "$SCRATCH_STDOUT" "Push of lane/foo to origin was rejected" || return 1
  assert "commit kept locally" "$(git -C "$SCRATCH_DIR" log -1 --format=%s lane/foo)" "chore(scratch): save P" || return 1
  return 0
}

test_save_on_lane_with_staged_elsewhere() {
  setup_lane "save-lane-staged"
  (
    cd "$SCRATCH_DIR"
    echo "staged elsewhere" > keep-folder/staged.md && git add keep-folder/staged.md
    mkdir -p P && echo "p" > P/README.md
  )
  local lane_before; lane_before=$(ref_at "$SCRATCH_DIR" lane/foo)
  run_scratch "$PROJECT_DIR" save P
  (( SCRATCH_EXIT != 0 )) || { echo "  expected non-zero exit"; return 1; }
  assert_contains "names the staged path" "$SCRATCH_STDOUT" "block the catch-up merge of main: keep-folder/staged.md" || return 1
  assert "nothing committed" "$(ref_at "$SCRATCH_DIR" lane/foo)" "$lane_before" || return 1
  assert "outside file still staged" "$(git -C "$SCRATCH_DIR" diff --cached --name-only)" "keep-folder/staged.md" || return 1
  return 0
}

test_save_on_lane_with_folder_staged() {
  setup_lane "save-lane-folder-staged"
  (
    cd "$SCRATCH_DIR"
    mkdir -p P && echo "p" > P/README.md && echo "q" > P/notes.md
    git add P/README.md
  )
  run_scratch "$PROJECT_DIR" save P
  (( SCRATCH_EXIT == 0 )) || { echo "  save failed"; echo "$SCRATCH_STDOUT"; return 1; }
  assert "save commit holds the whole folder" "$(git -C "$SCRATCH_DIR" show --name-only --format= lane/foo | LC_ALL=C sort | tr '\n' ' ')" "P/README.md P/notes.md " || return 1
  assert "origin/lane/foo equals the local tip" "$(ref_at "$REMOTE_DIR" lane/foo)" "$(ref_at "$SCRATCH_DIR" lane/foo)" || return 1
  return 0
}

test_save_commits_folder_paths_only() {
  setup_project "save-pathspec" 0
  (
    cd "$SCRATCH_DIR"
    mkdir -p draft && echo "draft" > draft/README.md
    echo "staged elsewhere" > keep-folder/staged.md && git add keep-folder/staged.md
  )
  run_scratch "$PROJECT_DIR" save draft
  (( SCRATCH_EXIT == 0 )) || { echo "  save failed"; echo "$SCRATCH_STDOUT"; return 1; }
  assert "commit holds only the folder" "$(git -C "$SCRATCH_DIR" show --name-only --format= HEAD)" "draft/README.md" || return 1
  assert "outside file still staged" "$(git -C "$SCRATCH_DIR" diff --cached --name-only)" "keep-folder/staged.md" || return 1
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
record archive  "lane branch, no remote, archives locally" test_archive_lane_branch_no_remote
record archive  "lane branch with no upstream archives"   test_archive_lane_branch_no_upstream
record archive  "unreachable origin — aborts cleanly"     test_archive_unreachable_origin_bails
record archive  "network stall times out, ssh killed"     test_archive_network_timeout
record archive  "Ctrl+C kills the network call's tree"    test_archive_interrupt_kills_network_call
record archive  "bad SCRATCH_NET_TIMEOUT refused"         test_archive_bad_net_timeout_refused
record archive  "second archive reuses local branch"      test_archive_second_reuses_local_branch
record archive  "uncommitted folder refused"              test_archive_uncommitted_folder
record archive  "ignored files refused, listed"           test_archive_ignored_files_refused
record archive  "--force deletes ignored files, archives" test_archive_force_deletes_ignored_files
record archive  "--force honours folder-level .gitignore" test_archive_force_folder_level_gitignore
record archive  "dirty files outside folder untouched"    test_archive_dirty_outside_folder
record archive  "lfs raw blob elsewhere does not block"   test_archive_lfs_raw_blob_elsewhere
record archive  "different archived tree refused"         test_archive_different_tree_refused
record archive  "rerun after publish skips the push"      test_archive_rerun_same_tree
record archive  "unapproved main commits stay unpushed"   test_archive_leaves_unapproved_main_unpushed
record archive  "archive push race rejected, main intact" test_archive_push_race_rejected
record archive  "origin without main archives, no push"   test_archive_origin_without_main
record archive  "local archive ahead refused, no command" test_archive_local_archive_ahead_refused

record save     "new uncommitted folder commits, no push" test_save_new_uncommitted_folder
record save     "lane save catches up, commits, pushes"   test_save_on_lane_branch
record save     "lane save refuses with scratch on main"  test_save_on_lane_scratch_on_main
record save     "lane catch-up conflict aborts, no commit" test_save_on_lane_catch_up_conflict
record save     "lane push rejected keeps the commit"     test_save_on_lane_push_rejected
record save     "lane save refuses with other paths staged" test_save_on_lane_with_staged_elsewhere
record save     "lane save with its own folder staged"     test_save_on_lane_with_folder_staged
record save     "save commits folder paths only"          test_save_commits_folder_paths_only
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
