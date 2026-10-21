#!/usr/bin/env bash
# ai-lint.sh — entrypoint wrapper for ai-lint.mjs
#
# Thin bash wrapper so the command surface is a plain executable while the
# detection logic stays in ai-lint.mjs (unit-tested via ai-lint.test.mjs).
# All arguments pass straight through to node.

set -euo pipefail

# Resolve this script's directory through symlinks (MSYS-safe).
_resolve_dir() {
  local source="${BASH_SOURCE[0]}"
  while [ -L "$source" ]; do
    local dir
    dir="$(cd -P "$(dirname "$source")" && pwd)"
    source="$(readlink "$source")"
    [[ "$source" != /* ]] && source="$dir/$source"
  done
  cd -P "$(dirname "$source")" && pwd
}

SCRIPT_DIR="$(_resolve_dir)"
exec node "$SCRIPT_DIR/ai-lint.mjs" "$@"
