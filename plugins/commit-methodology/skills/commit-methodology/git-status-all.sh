#!/usr/bin/env bash
# git-status-all.sh — Gather git state across all repos defined in .subrepos
#
# Usage: git-status-all
# Requires: .subrepos file in cwd (one directory per line, # comments allowed)
#
# Output:
#   .git/commit-all-summary.txt          — per-repo status overview
#   .git/commit-all-diffs/{name}.diff    — full diff per dirty repo (sectioned format)
#   stdout: inline summary for quick triage

set -euo pipefail

# Help and argument validation
case "${1:-}" in
  -h|--help)
    echo "Usage: git-status-all"
    echo ""
    echo "Gather git state across all repos defined in .subrepos."
    echo "Requires a .subrepos file in the current directory."
    echo ""
    echo "Output:"
    echo "  .git/commit-all-summary.txt        — per-repo status overview"
    echo "  .git/commit-all-diffs/{name}.diff   — full diff per dirty repo"
    exit 0
    ;;
  -*)
    echo "ERROR: unknown option: $1" >&2
    echo "Usage: git-status-all" >&2
    exit 1
    ;;
esac

if [ $# -gt 0 ]; then
  echo "ERROR: unexpected arguments: $*" >&2
  echo "Usage: git-status-all" >&2
  exit 1
fi

SUMMARY_FILE=".git/commit-all-summary.txt"
DIFF_DIR=".git/commit-all-diffs"
SUBREPOS_FILE=".subrepos"

# --- Validate ---

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: not a git repository" >&2
  exit 1
fi

if [ ! -f "$SUBREPOS_FILE" ]; then
  echo "ERROR: No .subrepos file found. Create one with sub-repo directories, one per line." >&2
  exit 1
fi

# --- Parse .subrepos ---

REPOS=()
while IFS= read -r line || [ -n "$line" ]; do
  # Strip comments
  line="${line%%#*}"
  # Trim leading/trailing whitespace
  line="$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  [ -z "$line" ] && continue
  # Strip trailing slash for consistency
  line="${line%/}"
  REPOS+=("$line")
done < "$SUBREPOS_FILE"

# Promote scratch to first position if present
ORDERED_REPOS=()
HAS_SCRATCH=false
for repo in "${REPOS[@]}"; do
  if [ "$repo" = "scratch" ]; then
    HAS_SCRATCH=true
  else
    ORDERED_REPOS+=("$repo")
  fi
done
if [ "$HAS_SCRATCH" = true ]; then
  ORDERED_REPOS=("scratch" "${ORDERED_REPOS[@]}")
fi

# Main repo is always last (implicit)
ORDERED_REPOS+=(".")

# --- Clean previous output ---

rm -rf "$DIFF_DIR"
mkdir -p "$DIFF_DIR"
> "$SUMMARY_FILE"

# --- Gather state per repo ---

DIRTY_COUNT=0
CLEAN_COUNT=0
SKIP_COUNT=0
INLINE_SUMMARY=""

gather_repo_state() {
  local repo_path="$1"
  local repo_name="$2"
  local diff_file="$DIFF_DIR/$repo_name.diff"

  # Check if repo exists
  if [ ! -d "$repo_path" ]; then
    echo "=== REPO: $repo_name ($repo_path/) ===" >> "$SUMMARY_FILE"
    echo "Status: not initialized" >> "$SUMMARY_FILE"
    echo "" >> "$SUMMARY_FILE"
    INLINE_SUMMARY+="  $repo_name: not initialized"$'\n'
    SKIP_COUNT=$((SKIP_COUNT + 1))
    return
  fi

  # Check if it's a git repo
  if ! git -C "$repo_path" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "=== REPO: $repo_name ($repo_path/) ===" >> "$SUMMARY_FILE"
    echo "Status: not a git repo" >> "$SUMMARY_FILE"
    echo "" >> "$SUMMARY_FILE"
    INLINE_SUMMARY+="  $repo_name: not a git repo"$'\n'
    SKIP_COUNT=$((SKIP_COUNT + 1))
    return
  fi

  # Gather state
  local branch
  branch=$(git -C "$repo_path" branch --show-current 2>/dev/null || echo "detached")

  local staged_shortstat
  staged_shortstat=$(git -C "$repo_path" diff --cached --shortstat 2>/dev/null || true)

  local unstaged_shortstat
  unstaged_shortstat=$(git -C "$repo_path" diff --shortstat 2>/dev/null || true)

  local untracked_count
  untracked_count=$(git -C "$repo_path" ls-files --others --exclude-standard 2>/dev/null | wc -l)
  untracked_count=$((untracked_count + 0))  # ensure integer

  local is_dirty=false
  if [ -n "$staged_shortstat" ] || [ -n "$unstaged_shortstat" ] || [ "$untracked_count" -gt 0 ]; then
    is_dirty=true
  fi

  # Write summary section
  {
    echo "=== REPO: $repo_name ($repo_path/) ==="
    echo "Branch: $branch"
    if [ "$is_dirty" = true ]; then
      echo "Status: dirty"
      [ -n "$staged_shortstat" ] && echo "Staged: $staged_shortstat"
      [ -n "$unstaged_shortstat" ] && echo "Unstaged: $unstaged_shortstat"
      [ "$untracked_count" -gt 0 ] && echo "Untracked: $untracked_count files"
    else
      echo "Status: clean"
    fi
    echo ""
  } >> "$SUMMARY_FILE"

  # Write per-repo diff file (only if dirty)
  if [ "$is_dirty" = true ]; then
    {
      echo "=== STATUS ==="
      git -C "$repo_path" status

      echo ""
      echo "=== STAGED_STAT ==="
      git -C "$repo_path" diff --cached --stat || true

      echo ""
      echo "=== STAGED_SHORTSTAT ==="
      echo "$staged_shortstat"

      echo ""
      echo "=== STAGED_FILES ==="
      git -C "$repo_path" diff --cached --name-only || true

      echo ""
      echo "=== UNSTAGED_STAT ==="
      git -C "$repo_path" diff --stat || true

      echo ""
      echo "=== UNSTAGED_FILES ==="
      git -C "$repo_path" diff --name-only || true
      git -C "$repo_path" ls-files --others --exclude-standard || true

      echo ""
      echo "=== RECENT_COMMITS ==="
      git -C "$repo_path" log --oneline --format='%h %s' -10 || true

      echo ""
      echo "=== DIFF ==="
      # Combined: staged + unstaged
      git -C "$repo_path" diff --cached || true
      git -C "$repo_path" diff || true
    } > "$diff_file"

    DIRTY_COUNT=$((DIRTY_COUNT + 1))
    INLINE_SUMMARY+="  $repo_name: dirty ($branch)"$'\n'
  else
    CLEAN_COUNT=$((CLEAN_COUNT + 1))
    INLINE_SUMMARY+="  $repo_name: clean ($branch)"$'\n'
  fi
}

for repo in "${ORDERED_REPOS[@]}"; do
  if [ "$repo" = "." ]; then
    gather_repo_state "." "main"
  else
    gather_repo_state "$repo" "$repo"
  fi
done

# --- Stdout summary ---

echo "Repos: $DIRTY_COUNT dirty, $CLEAN_COUNT clean, $SKIP_COUNT skipped"
echo "$INLINE_SUMMARY"
echo "Summary: $SUMMARY_FILE"
if [ "$DIRTY_COUNT" -gt 0 ]; then
  echo "Diffs: $DIFF_DIR/"
fi
