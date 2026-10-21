#!/usr/bin/env bash
# git-state.sh — Gather git repository state for commit analysis
#
# Usage: git-state [-C DIR] [OUTPUT_FILE]
# Output: Writes sectioned git state to file, prints repo root + summary + path to stdout
#
# Sections: REPO_ROOT, STATUS, STAGED_STAT, STAGED_SHORTSTAT, STAGED_FILES, RECENT_COMMITS
# Agent can Read or Grep the output file instead of parsing inline.

set -euo pipefail

usage() {
  echo "Usage: git-state [-C DIR] [OUTPUT_FILE]"
  echo ""
  echo "Gather git repository state for commit analysis."
  echo "Writes sectioned output (REPO_ROOT, STATUS, STAGED_STAT, STAGED_SHORTSTAT,"
  echo "STAGED_FILES, RECENT_COMMITS) to OUTPUT_FILE."
  echo ""
  echo "  -C DIR       Gather state for the repo at DIR instead of the current directory."
  echo "               Prefer this over 'cd DIR && git-state' — a path with spaces that"
  echo "               loses its quoting makes cd fail, and the run then silently reports"
  echo "               the WRONG repo. Passing it here keeps the path a single argument."
  echo "  OUTPUT_FILE  Path to write state (default: \$(git rev-parse --git-dir)/claude-git-state.txt)"
}

# Argument parsing
REPO_DIR=""
while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    -C|--repo)
      if [ $# -lt 2 ]; then
        echo "ERROR: $1 requires a directory argument" >&2
        usage >&2
        exit 1
      fi
      REPO_DIR="$2"
      shift 2
      ;;
    -*)
      echo "ERROR: unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
    *)
      break
      ;;
  esac
done

if [ $# -gt 1 ]; then
  echo "ERROR: too many arguments (expected 0 or 1 output file)" >&2
  usage >&2
  exit 1
fi

if [ -n "$REPO_DIR" ]; then
  if ! cd "$REPO_DIR" 2>/dev/null; then
    echo "ERROR: cannot enter directory: $REPO_DIR" >&2
    exit 1
  fi
fi

# Verify we're in a git repo BEFORE asking git anything else, so a bad -C target
# reports this error rather than git's less obvious one
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: not a git repository: $(pwd)" >&2
  exit 1
fi

# Resolve the per-worktree git directory so this works in both normal repos and worktrees
# (in a worktree .git is a FILE, not a directory, so .git/... writes fail)
GIT_DIR=$(git rev-parse --git-dir)
OUTFILE="${1:-$GIT_DIR/claude-git-state.txt}"

# Reported in the output file and on stdout so the caller can confirm which repo was
# actually read. Landing in the wrong repo is otherwise silent, and yields a confident
# commit message describing a changeset that belongs to a different repository.
REPO_ROOT=$(git rev-parse --show-toplevel)

# Capture key fields for inline summary
SHORTSTAT=$(git diff --cached --shortstat 2>/dev/null || true)
STAGED_FILES=$(git diff --cached --name-only 2>/dev/null || true)

{
  echo "=== REPO_ROOT ==="
  echo "$REPO_ROOT"

  echo ""
  echo "=== STATUS ==="
  git status

  echo ""
  echo "=== STAGED_STAT ==="
  git diff --cached --stat || true

  echo ""
  echo "=== STAGED_SHORTSTAT ==="
  echo "$SHORTSTAT"

  echo ""
  echo "=== STAGED_FILES ==="
  echo "$STAGED_FILES"

  echo ""
  echo "=== RECENT_COMMITS ==="
  git log --oneline --format='%h %s' -10 || true
} > "$OUTFILE"

# Inline summary: agent gets quick triage info without reading the file
echo "Repo: $REPO_ROOT"
FILE_COUNT=$(echo "$STAGED_FILES" | grep -c . 2>/dev/null || echo 0)
if [ -n "$SHORTSTAT" ]; then
  echo "$SHORTSTAT"
  if [ "$FILE_COUNT" -le 100 ]; then
    echo "$STAGED_FILES"
  else
    echo "$STAGED_FILES" | head -100
    echo "... and $((FILE_COUNT - 100)) more (see STAGED_FILES in output file)"
  fi
else
  echo "(nothing staged)"
fi
echo "Full state (STATUS, STAGED_STAT, STAGED_FILES, RECENT_COMMITS) written to: $OUTFILE"
