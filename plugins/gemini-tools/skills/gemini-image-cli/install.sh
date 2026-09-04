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
    echo "Usage: bash install.sh [--check]"
    echo ""
    echo "Creates a symlink at ~/.local/bin/gemini-image pointing to"
    echo "the gemini-image.sh source script."
    echo ""
    echo "Options:"
    echo "  --check   Report drift status of installed symlink (read-only, exits 0 always)"
    exit 0
    ;;
  --check) _DO_CHECK=true ;;
  -*)
    echo "ERROR: unknown option: $1" >&2
    exit 1
    ;;
  *) _DO_CHECK=false ;;
esac

BIN_DIR="$HOME/.local/bin"

# Source script location (lives alongside this install.sh in the skill folder)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_SCRIPT="$SCRIPT_DIR/gemini-image.sh"

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
  echo "  Expected alongside install.sh in the skill folder." >&2
  exit 1
fi

# --- Check mode: report drift status of symlink (read-only) ---

# _check_symlink — report drift status of a symlink (read-only)
# Output: one line with [OK], [DRIFT], [MISSING], or [OTHER] prefix tag.
# Inline helper (not shared): each install.sh is self-contained per plugin encapsulation rules.
_check_symlink() {
  local cmd_name="$1"
  local src_path="$2"
  local dest_path="$BIN_DIR/$cmd_name"

  if [ ! -e "$dest_path" ] && [ ! -L "$dest_path" ]; then
    echo "[MISSING] $cmd_name: not installed at ~/.local/bin/$cmd_name"
    return 0
  fi

  if is_correct_symlink "$dest_path" "$src_path"; then
    echo "[OK] $cmd_name: correct (worktree=$src_path)"
    return 0
  fi

  if [ -L "$dest_path" ]; then
    local other_path
    other_path="$(readlink "$dest_path" 2>/dev/null || true)"
    echo "[DRIFT] $cmd_name: baked=$other_path expected=$src_path"
  else
    echo "[OTHER] $cmd_name: present but not a recognizable symlink"
  fi
  return 0
}

if [ "$_DO_CHECK" = true ]; then
  _check_symlink "gemini-image" "$SOURCE_SCRIPT"
  exit 0
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
