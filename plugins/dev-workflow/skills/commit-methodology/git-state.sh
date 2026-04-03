#!/usr/bin/env bash
# git-state.sh — Gather git repository state for commit analysis
#
# Usage: git-state [OUTPUT_FILE]
# Output: Writes sectioned git state to file, prints summary + path to stdout
#
# Sections: STATUS, STAGED_STAT, STAGED_SHORTSTAT, STAGED_FILES, RECENT_COMMITS
# Agent can Read or Grep the output file instead of parsing inline.

set -euo pipefail

# Help and argument validation
case "${1:-}" in
  -h|--help)
    echo "Usage: git-state [OUTPUT_FILE]"
    echo ""
    echo "Gather git repository state for commit analysis."
    echo "Writes sectioned output (STATUS, STAGED_STAT, STAGED_SHORTSTAT,"
    echo "STAGED_FILES, RECENT_COMMITS) to OUTPUT_FILE."
    echo ""
    echo "  OUTPUT_FILE  Path to write state (default: .git/claude-git-state.txt)"
    exit 0
    ;;
  -*)
    echo "ERROR: unknown option: $1" >&2
    echo "Usage: git-state [OUTPUT_FILE]" >&2
    exit 1
    ;;
esac

if [ $# -gt 1 ]; then
  echo "ERROR: too many arguments (expected 0 or 1)" >&2
  echo "Usage: git-state [OUTPUT_FILE]" >&2
  exit 1
fi

# Default to .git/ so it's auto-ignored and accessible by both Bash and Read tool
OUTFILE="${1:-.git/claude-git-state.txt}"

# Verify we're in a git repo
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: not a git repository" >&2
  exit 1
fi

# Capture key fields for inline summary
SHORTSTAT=$(git diff --cached --shortstat 2>/dev/null || true)
STAGED_FILES=$(git diff --cached --name-only 2>/dev/null || true)

{
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
