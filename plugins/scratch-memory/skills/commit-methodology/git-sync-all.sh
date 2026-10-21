#!/usr/bin/env bash
# git-sync-all.sh — Check, then switch, the main repo and every repo in .subrepos onto
# its base branch at origin's tip: develop when origin has one, else origin/HEAD's branch.
#
# Usage: git-sync-all [--apply]
# Output: sectioned per-repo state in $(git rev-parse --git-dir)/claude-sync-state.txt;
#         stdout: one line per repo, a Result line, and the file's path
# Exit:   0 ready (check) or switched (--apply), 1 error or a failed switch,
#         2 blocked: a repo holds work a switch could strand, nothing was switched

set -uo pipefail

usage() {
  echo "Usage: git-sync-all [--apply]"
  echo ""
  echo "Fetch the main repo and every repo in .subrepos, then report, per repo, its"
  echo "branch, its target (develop if origin has one, else origin/HEAD's branch) and"
  echo "any blocker: fetch-failed, no-target, dirty, unpushed, detached-unpushed,"
  echo "in-progress, target-ahead."
  echo ""
  echo "  --apply   When no repo has a blocker, check out each target and fast-forward"
  echo "            it to origin. Never stashes, resets, rebases or discards."
  echo ""
  echo "Writes \$(git rev-parse --git-dir)/claude-sync-state.txt."
  echo "Exit: 0 ready or switched, 1 error, 2 blocked (nothing switched)."
}

APPLY=false
case "${1:-}" in
  -h|--help) usage; exit 0 ;;
  --apply) APPLY=true; shift ;;
  "") ;;
  *) echo "ERROR: unknown argument: $1" >&2; usage >&2; exit 1 ;;
esac
if [ $# -gt 0 ]; then
  echo "ERROR: unexpected arguments: $*" >&2; usage >&2; exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: not a git repository: $(pwd)" >&2
  exit 1
fi
cd "$(git rev-parse --show-toplevel)" || exit 1
OUTFILE="$(git rev-parse --absolute-git-dir)/claude-sync-state.txt"

REPOS=(".")
if [ -f .subrepos ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%%#*}"
    line="$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    [ -z "$line" ] && continue
    line="${line/#\~/$HOME}"
    REPOS+=("${line%/}")
  done < .subrepos
fi

declare -A TARGET BLOCKERS
SKIPPED=()
BLOCKED=0

check_repo() {
  local r="$1" cur target fetch_err blockers=()
  if ! git -C "$r" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    SKIPPED+=("$r")
    { echo "=== REPO: $r ==="; echo "Status: not a git repo (skipped)"; echo ""; } >> "$OUTFILE"
    return
  fi

  fetch_err=$(git -C "$r" fetch --prune origin 2>&1 >/dev/null) || blockers+=("fetch-failed")
  cur=$(git -C "$r" branch --show-current)

  if git -C "$r" rev-parse -q --verify refs/remotes/origin/develop >/dev/null; then
    target=develop
  else
    target=$(git -C "$r" symbolic-ref -q --short refs/remotes/origin/HEAD 2>/dev/null)
    target="${target#origin/}"
  fi
  [ -z "$target" ] && blockers+=("no-target")

  local dirty unpushed="" target_ahead="" in_progress=""
  dirty=$(git -C "$r" status --porcelain)
  [ -n "$dirty" ] && blockers+=("dirty")

  if [ -n "$cur" ]; then
    if git -C "$r" rev-parse -q --verify '@{u}' >/dev/null 2>&1; then
      unpushed=$(git -C "$r" log --oneline '@{u}..HEAD')
    else
      unpushed=$(git -C "$r" log --oneline HEAD --not --remotes)
    fi
    [ -n "$unpushed" ] && blockers+=("unpushed")
  else
    unpushed=$(git -C "$r" log --oneline HEAD --not --remotes)
    [ -n "$unpushed" ] && blockers+=("detached-unpushed")
  fi

  local f gd
  gd=$(git -C "$r" rev-parse --absolute-git-dir)
  for f in MERGE_HEAD rebase-merge rebase-apply CHERRY_PICK_HEAD REVERT_HEAD; do
    [ -e "$gd/$f" ] && in_progress+="$f "
  done
  [ -n "$in_progress" ] && blockers+=("in-progress")

  # On the target already, "unpushed" covers this case.
  if [ -n "$target" ] && [ "$cur" != "$target" ] \
    && git -C "$r" rev-parse -q --verify "refs/heads/$target" >/dev/null \
    && git -C "$r" rev-parse -q --verify "refs/remotes/origin/$target" >/dev/null; then
    target_ahead=$(git -C "$r" log --oneline "origin/$target..refs/heads/$target")
    [ -n "$target_ahead" ] && blockers+=("target-ahead")
  fi

  # Measured from the local target branch, the one --apply fast-forwards.
  local behind="n/a"
  if [ -n "$target" ] && git -C "$r" rev-parse -q --verify "refs/remotes/origin/$target" >/dev/null; then
    if git -C "$r" rev-parse -q --verify "refs/heads/$target" >/dev/null; then
      behind=$(git -C "$r" rev-list --count "refs/heads/$target..origin/$target")
    else
      behind="new local branch"
    fi
  fi

  TARGET[$r]="$target"
  BLOCKERS[$r]="${blockers[*]:-}"
  [ ${#blockers[@]} -gt 0 ] && BLOCKED=$((BLOCKED + 1))

  {
    echo "=== REPO: $r ==="
    echo "Branch: ${cur:-(detached)}"
    echo "Target: ${target:-(none)}"
    echo "Behind origin/target: $behind"
    echo "Blockers: ${blockers[*]:-none}"
    [ -n "$fetch_err" ] && { echo "--- FETCH_ERROR ---"; echo "$fetch_err"; }
    [ -n "$dirty" ] && { echo "--- DIRTY ---"; echo "$dirty"; }
    [ -n "$unpushed" ] && { echo "--- UNPUSHED ---"; echo "$unpushed"; }
    [ -n "$target_ahead" ] && { echo "--- TARGET_AHEAD ---"; echo "$target_ahead"; }
    [ -n "$in_progress" ] && { echo "--- IN_PROGRESS ---"; echo "$in_progress"; }
    echo ""
  } >> "$OUTFILE"

  echo "  $r: ${cur:-(detached)} -> ${target:-(none)}, behind $behind, blockers: ${blockers[*]:-none}"
}

: > "$OUTFILE"
echo "Repo: $(pwd)"
for r in "${REPOS[@]}"; do check_repo "$r"; done
[ ${#SKIPPED[@]} -gt 0 ] && echo "  skipped (not a git repo): ${SKIPPED[*]}"

if [ "$BLOCKED" -gt 0 ]; then
  echo "Result: BLOCKED ($BLOCKED repo(s)); nothing switched"
  echo "State: $OUTFILE"
  exit 2
fi
if [ "$APPLY" = false ]; then
  echo "Result: READY"
  echo "State: $OUTFILE"
  exit 0
fi

echo "=== APPLY ===" >> "$OUTFILE"
for r in "${REPOS[@]}"; do
  [ -n "${TARGET[$r]+x}" ] || continue
  t="${TARGET[$r]}"
  was=$(git -C "$r" branch --show-current)
  if [ "$was" != "$t" ]; then
    if git -C "$r" rev-parse -q --verify "refs/heads/$t" >/dev/null; then
      out=$(git -C "$r" checkout -q "$t" 2>&1)
    else
      out=$(git -C "$r" checkout -q -b "$t" --track "origin/$t" 2>&1)
    fi
    if [ $? -ne 0 ]; then
      echo "  $r: FAILED checkout $t: $out" | tee -a "$OUTFILE"
      echo "Result: FAILED at $r; repos before it were switched"
      echo "State: $OUTFILE"
      exit 1
    fi
  fi
  before=$(git -C "$r" rev-parse HEAD)
  if ! out=$(git -C "$r" merge -q --ff-only "origin/$t" 2>&1); then
    echo "  $r: FAILED fast-forward to origin/$t: $out" | tee -a "$OUTFILE"
    echo "Result: FAILED at $r; repos before it were switched"
    echo "State: $OUTFILE"
    exit 1
  fi
  n=$(git -C "$r" rev-list --count "$before..HEAD")
  echo "  $r: ${was:-(detached)} -> $t, fast-forwarded $n commit(s)" | tee -a "$OUTFILE"
done
echo "Result: SWITCHED"
echo "State: $OUTFILE"
exit 0
