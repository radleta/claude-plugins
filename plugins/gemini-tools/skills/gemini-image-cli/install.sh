#!/usr/bin/env bash
# install.sh — Install gemini-image CLI symlink to ~/.local/bin/
#
# Usage: bash install.sh
# Requires: elevated/admin terminal on Windows (only when symlink needs creating)
# Idempotent: safe to re-run anytime. No elevation needed if symlink already correct.

set -euo pipefail

# Help and argument validation
case "${1:-}" in
  -h|--help)
    echo "Usage: bash install.sh"
    echo ""
    echo "Creates a symlink at ~/.local/bin/gemini-image pointing to"
    echo "the gemini-image.sh source script."
    exit 0
    ;;
  -*)
    echo "ERROR: unknown option: $1" >&2
    exit 1
    ;;
esac

BIN_DIR="$HOME/.local/bin"

# Source script location
SOURCE_SCRIPT="/d/dev/akn/akn-dotnet-master/gemini-image.sh"

# --- Detect OS ---

IS_WINDOWS=false
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) IS_WINDOWS=true ;;
esac

# --- Helper functions ---

is_correct_symlink() {
  local dest="$1"
  local expected_src="$2"

  if [ -L "$dest" ]; then
    local target
    target="$(readlink "$dest")"
    if [ "$target" = "$expected_src" ]; then
      return 0
    fi
    # Compare resolved absolute paths (handles Windows path variations)
    local resolved_target resolved_expected
    resolved_target="$(cd "$(dirname "$dest")" && cd "$(dirname "$target")" && pwd)/$(basename "$target")" 2>/dev/null || true
    resolved_expected="$(cd "$(dirname "$expected_src")" && pwd)/$(basename "$expected_src")" 2>/dev/null || true
    if [ "$resolved_target" = "$resolved_expected" ]; then
      return 0
    fi
  fi
  return 1
}

create_symlink() {
  local src="$1"
  local dest="$2"

  if [ "$IS_WINDOWS" = true ]; then
    local win_src win_dest
    win_src="$(cygpath -w "$src")"
    win_dest="$(cygpath -w "$dest")"
    [ -e "$dest" ] && rm -f "$dest"
    cmd //c mklink "$win_dest" "$win_src" >/dev/null 2>&1
  else
    ln -sf "$src" "$dest"
  fi
}

require_elevation() {
  if [ "$IS_WINDOWS" = true ]; then
    if ! net session >/dev/null 2>&1; then
      echo "ERROR: This script requires an elevated (Administrator) terminal on Windows." >&2
      echo "" >&2
      echo "  Windows needs admin privileges to create real symlinks." >&2
      echo "  Please re-run from an elevated terminal:" >&2
      echo "" >&2
      echo "    1. Right-click Git Bash (or your terminal) → 'Run as administrator'" >&2
      echo "    2. Run: bash \"$(cd "$(dirname "$0")" && pwd)/install.sh\"" >&2
      echo "" >&2
      exit 1
    fi
  fi
}

# --- Verify source exists ---

if [ ! -f "$SOURCE_SCRIPT" ]; then
  echo "ERROR: Source script not found: $SOURCE_SCRIPT" >&2
  echo "  Expected at: D:\\dev\\akn\\akn-dotnet-master\\gemini-image.sh" >&2
  exit 1
fi

# --- Install symlink ---

DEST="$BIN_DIR/gemini-image"

if is_correct_symlink "$DEST" "$SOURCE_SCRIPT"; then
  echo "  gemini-image: already correct"
else
  require_elevation
  mkdir -p "$BIN_DIR"

  existed=false
  [ -e "$DEST" ] && existed=true

  if ! create_symlink "$SOURCE_SCRIPT" "$DEST"; then
    echo "ERROR: Failed to create symlink: $DEST -> $SOURCE_SCRIPT" >&2
    exit 1
  fi

  if [ "$existed" = true ]; then
    echo "  gemini-image: updated"
  else
    echo "  gemini-image: created"
  fi
fi

# --- Verify ~/.local/bin is on PATH ---

case ":$PATH:" in
  *":$BIN_DIR:"*)
    echo ""
    echo "PATH: ~/.local/bin is on PATH"
    ;;
  *)
    echo ""
    echo "WARNING: ~/.local/bin is NOT on PATH."
    echo "  Add to your shell profile (~/.bashrc or ~/.profile):"
    echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
    ;;
esac
