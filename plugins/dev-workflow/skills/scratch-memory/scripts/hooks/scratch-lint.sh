#!/usr/bin/env bash
# scratch-lint.sh — PostToolUse hook: lint scratch tasks/issues files after
# Edit/Write/MultiEdit
#
# Usage: scratch-lint.sh [--help]
#        echo '{"tool_name":"Edit","tool_input":{"file_path":"/path/scratch/S-foo/tasks/t-3f9a2c-do-the-thing.md"}}' | scratch-lint.sh
#
# Path gate: only fires on Edit, Write, or MultiEdit events whose file_path
# matches */scratch/S-*/tasks/*.md (tasks corpus) or */scratch/issues/*.md
# (issues corpus). All other events exit 0 silently.
#
# Exit codes (Claude Code PostToolUse contract):
#   0  silent success (path-gate miss, or delegate lint clean with no H1 finding)
#   1  non-blocking warning (unsafe path, missing jq/scratch-memory, or CLI infra error)
#   2  blocking feedback (H1 stale `updated:` and/or delegate lint findings — Claude should react)

set -euo pipefail

# --- Argument guard ---
case "${1:-}" in
  -h|--help)
    cat <<'EOF'
Usage: scratch-lint.sh [--help]

PostToolUse lint hook for the workstream tasks corpus (scratch/S-*/tasks/)
and the scratch/issues/ corpus.

Reads a Claude Code PostToolUse JSON event from stdin. If the event is an
Edit, Write, or MultiEdit whose tool_input.file_path matches one of:
  */scratch/S-*/tasks/*.md   (tasks corpus)
  */scratch/issues/*.md      (issues corpus)
it applies one hook-only rule (H1: tasks corpus only — the `updated:` date
must be today, since only the hook knows the file was just edited) and then
delegates to:
  scratch-memory tasks lint <file_path>

Exit codes:
  0  silent success (path-gate miss, or clean with no H1 finding)
  1  non-blocking warning (unsafe path, missing jq/scratch-memory, or a CLI
     infra error — an environment gap must never block an edit)
  2  blocking feedback (H1 stale `updated:` and/or CLI lint findings)
EOF
    exit 0
    ;;
  -*)
    printf 'ERROR: unknown option: %s\n' "$1" >&2
    printf 'Usage: scratch-lint.sh [--help]\n' >&2
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

# --- Fast-exit gates: only Edit/Write/MultiEdit on the two guarded corpora ---
if [[ "$tool_name" != "Edit" && "$tool_name" != "Write" && "$tool_name" != "MultiEdit" ]]; then
  exit 0
fi

if [[ -z "$file_path" ]]; then
  exit 0
fi

# Match */scratch/S-*/tasks/*.md (tasks) or */scratch/issues/*.md (issues).
# Everything else in the repo — every source file, every doc, every other
# scratch file — leaves through this gate silently.
if [[ "$file_path" != */scratch/S-*/tasks/*.md && "$file_path" != */scratch/issues/*.md ]]; then
  exit 0
fi

# --- Validate-before-shell-out guard (CWE-22) ---
# This hook passes a file path rather than a session id, so the charset is
# wider than validateSessionId's, but the principle is identical: reject
# before the value reaches any further command. A rejected path is
# non-blocking — a legitimate file whose path contains a space is a tooling
# limitation, not an authoring defect, and blocking the edit would be
# hostile.
#
# The allowlist permits a leading '-' (paths can legitimately contain one),
# so every downstream consumer of $file_path must still stop flag parsing
# with `--` before it (CWE-88 / argument injection) -- otherwise a value like
# "-e/scratch/S-x/tasks/foo.md" is read as an option by grep or by
# tasks.mjs's own parseSinglePositional, not as the path. See the `--` use at
# the grep call below and at the delegate call further down.
if [[ "$file_path" == *..* || ! "$file_path" =~ ^[A-Za-z0-9._/-]+$ ]]; then
  printf 'ERROR: refusing to lint path with unsafe characters: %s\n' "$file_path" >&2
  exit 1
fi

# --- H1 (tasks corpus only): `updated:` must be today ---
# Only the hook knows the file was just edited — a sweep layer applying this
# rule would flag every unmodified task in the workstream, not just the one
# that changed. This is why H1 lives here and nowhere else (spec: "Not
# enforced by sweep layers").
stale_warn=""
if [[ "$file_path" == */scratch/S-*/tasks/*.md ]]; then
  updated_line="$(grep -m1 -- '^updated:' "$file_path" 2>/dev/null || true)"
  if [[ -n "$updated_line" ]]; then
    updated_value="${updated_line#updated:}"
    # Strip surrounding whitespace, then surrounding quotes (frontmatter
    # values may or may not be quoted).
    updated_value="$(printf '%s' "$updated_value" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
    updated_value="${updated_value%\"}"
    updated_value="${updated_value#\"}"
    date_portion="${updated_value:0:10}"
    # A missing `updated:` key, or a file that could not be read, is already
    # the delegated lint's T6 finding (missing required key) — skip here to
    # avoid the double-warning D11's single-severity model forbids.
    if [[ -n "$date_portion" ]]; then
      today="$(date -u +%Y-%m-%d)"
      if [[ "$date_portion" != "$today" ]]; then
        stale_warn="WARN: $(basename "$file_path"): updated: ${updated_value} is not today (${today}) — bump updated: on every edit"
      fi
    fi
  fi
fi

# --- Delegate to scratch-memory CLI ---
# Capture stdout and stderr to separate temp files, cleaned up on any exit
# via trap. Unlike the sibling hook, findings here arrive on the CLI's
# STDOUT (Step 02a's stream contract: `tasks lint` writes WARN: lines to
# stdout and ERROR: diagnostics to stderr) — the reverse of `handoff
# validate`, which writes its findings to stderr. Getting this backwards
# produces a hook that blocks with an empty message.
#
# `--` stops flag parsing before the positional (CWE-88): the charset guard
# above still permits a leading '-', and without `--` a value like
# "-e/scratch/S-x/tasks/foo.md" would be rejected by tasks.mjs's own
# parseSinglePositional as "unknown option", written to stderr with cli_exit
# 1 -- indistinguishable from a findings result but with an empty
# cli_stdout, producing a message-less block. This mirrors the codebase
# convention at cat-sessions.mjs:639 and tasks.mjs:517-519.
out="$(mktemp)"
err="$(mktemp)"
trap 'rm -f "$out" "$err"' EXIT

cli_exit=0
scratch-memory tasks lint -- "$file_path" >"$out" 2>"$err" || cli_exit=$?
cli_stdout="$(cat "$out")"
cli_stderr="$(cat "$err")"

# --- Exit code translation ---
# CLI exit 0: clean               → hook exit 0 (silent success)
# CLI exit 1: findings            → hook exit 2 (blocking: CLI stdout forwarded to stderr)
# CLI exit 2: infra/env error     → hook exit 1 (non-blocking warning)
#
# H1 precedence: when stale_warn is non-empty the hook exits 2 regardless of
# the CLI's outcome, emitting stale_warn first and then whatever the CLI
# produced. H1 is a genuine finding discovered independently of the
# delegate, and letting a CLI infra failure suppress it would lose the one
# rule the sweep layers can never re-check.
if [[ -n "$stale_warn" ]]; then
  printf '%s\n' "$stale_warn" >&2
  if [[ "$cli_exit" -eq 0 ]]; then
    exit 2
  elif [[ "$cli_exit" -eq 1 ]]; then
    printf '%s\n' "$cli_stdout" >&2
    exit 2
  else
    printf 'scratch-memory tasks lint error (exit %s): %s\n' "$cli_exit" "$cli_stderr" >&2
    exit 2
  fi
fi

if [[ "$cli_exit" -eq 0 ]]; then
  exit 0
elif [[ "$cli_exit" -eq 1 ]]; then
  printf '%s\n' "$cli_stdout" >&2
  exit 2
else
  printf 'scratch-memory tasks lint error (exit %s): %s\n' "$cli_exit" "$cli_stderr" >&2
  exit 1
fi
