#!/usr/bin/env bash
# handoff-validate.sh — PostToolUse hook: validate HANDOFF.md after Edit/Write
#
# Usage: handoff-validate.sh [--help]
#        echo '{"tool_name":"Edit","tool_input":{"file_path":"/path/scratch/S-foo/HANDOFF.md"}}' | handoff-validate.sh
#
# Path gate: only fires on Edit or Write events whose file_path matches
# */scratch/S-*/HANDOFF.md. All other events exit 0 silently.
#
# Exit codes (Claude Code PostToolUse contract):
#   0  silent success (path-gate miss OR validate passed)
#   1  non-blocking warning (CLI infra/env error, exit 2 from scratch-memory)
#   2  blocking feedback (HANDOFF.md has validation findings — Claude should react)

set -euo pipefail

# --- Argument guard ---
case "${1:-}" in
  -h|--help)
    cat <<'EOF'
Usage: handoff-validate.sh [--help]

PostToolUse validation hook for HANDOFF.md files.

Reads a Claude Code PostToolUse JSON event from stdin. If the event is an
Edit or Write on a scratch/S-*/HANDOFF.md path, delegates to:
  scratch-memory handoff validate --loose <session-id>

Exit codes:
  0  silent success (path-gate miss, or file validated clean)
  1  non-blocking warning (scratch-memory CLI returned exit 2 — infra error)
  2  blocking feedback (scratch-memory CLI returned exit 1 — validation findings)
EOF
    exit 0
    ;;
  -*)
    printf 'ERROR: unknown option: %s\n' "$1" >&2
    printf 'Usage: handoff-validate.sh [--help]\n' >&2
    exit 1
    ;;
esac

# --- Read stdin (Claude Code hook JSON input) ---
INPUT="$(cat)"

# --- Require jq ---
if ! command -v jq >/dev/null 2>&1; then
  printf 'ERROR: jq is required but not found on PATH\n' >&2
  exit 1
fi

# --- Parse tool_name and file_path ---
tool_name="$(printf '%s' "$INPUT" | jq -r '.tool_name // empty')"
file_path="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty')"

# --- Path gate: only Edit or Write on scratch/S-*/HANDOFF.md ---
if [[ "$tool_name" != "Edit" && "$tool_name" != "Write" ]]; then
  exit 0
fi

if [[ -z "$file_path" ]]; then
  exit 0
fi

# Match */scratch/S-*/HANDOFF.md  (S- prefix + any slug + /HANDOFF.md)
if [[ "$file_path" != */scratch/S-*/HANDOFF.md ]]; then
  exit 0
fi

# --- Resolve session id from folder name (strip trailing HANDOFF.md, get S-* dir, drop S- prefix) ---
# e.g. /path/scratch/S-my-session/HANDOFF.md → "my-session"
folder_name="$(basename "$(dirname "$file_path")")"
session_id="${folder_name#S-}"

if [[ -z "$session_id" ]]; then
  printf 'ERROR: could not extract session id from path: %s\n' "$file_path" >&2
  exit 1
fi

# Guard against path-traversal via crafted S-../HANDOFF.md folder names (CWE-22)
if [[ ! "$session_id" =~ ^[a-zA-Z0-9._-]+$ ]]; then
  printf 'ERROR: invalid session id extracted from path: %s\n' "$session_id" >&2
  exit 1
fi

# --- Delegate to scratch-memory CLI ---
# Capture stderr separately so only CLI findings (not stdout) reach Claude.
# mktemp temp file is cleaned up on any exit via trap.
cli_stderr_file="$(mktemp)"
trap 'rm -f "$cli_stderr_file"' EXIT

cli_exit=0
scratch-memory handoff validate --loose "$session_id" 2>"$cli_stderr_file" >/dev/null || cli_exit=$?
cli_stderr="$(cat "$cli_stderr_file")"

# --- Exit code translation (P5) ---
# CLI exit 0: clean validation  → hook exit 0 (silent success)
# CLI exit 1: findings          → hook exit 2 (blocking: Claude sees stderr and reacts)
# CLI exit 2: infra/env error   → hook exit 1 (non-blocking warning)

if [[ "$cli_exit" -eq 0 ]]; then
  exit 0
elif [[ "$cli_exit" -eq 1 ]]; then
  # Findings: forward CLI stderr to stderr so Claude can react
  printf '%s\n' "$cli_stderr" >&2
  exit 2
else
  # Infra error (exit 2 or unexpected): non-blocking warning
  printf 'scratch-memory handoff validate error (exit %s): %s\n' "$cli_exit" "$cli_stderr" >&2
  exit 1
fi
