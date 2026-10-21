#!/usr/bin/env bash
# learned-check.sh — exec wrapper for learned-check.mjs
# Delegates all arguments to the Node.js script in the same directory.
set -euo pipefail

# Resolve script directory through symlinks (MSYS-safe)
_resolve_script() {
  local source="${BASH_SOURCE[0]}"
  while [ -L "$source" ]; do
    local dir
    dir="$(cd -P "$(dirname "$source")" && pwd)"
    source="$(readlink "$source")"
    [[ "$source" != /* ]] && source="$dir/$source"
  done
  cd -P "$(dirname "$source")" && pwd
}

SCRIPT_DIR="$(_resolve_script)"
exec node "$SCRIPT_DIR/learned-check.mjs" "$@"
