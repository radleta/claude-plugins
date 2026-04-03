#!/usr/bin/env bash
# install.sh — Install commit-methodology scripts to ~/.local/bin/ as symlinks
#
# Usage: bash install.sh
# Requires: elevated/admin terminal on Windows (only when symlinks need creating)
# Idempotent: safe to re-run anytime. No elevation needed if symlinks already correct.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BIN_DIR="$HOME/.local/bin"

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
      echo "    2. Run: bash \"$SCRIPT_DIR/install.sh\"" >&2
      echo "" >&2
      exit 1
    fi
  fi
}

# --- Scripts to install: source_file -> command_name ---

declare -A SCRIPTS=(
  ["git-state.sh"]="git-state"
  ["git-status-all.sh"]="git-status-all"
)

# --- Pre-check: are all symlinks already correct? ---

ALL_CORRECT=true
for src_file in "${!SCRIPTS[@]}"; do
  src_path="$SCRIPT_DIR/$src_file"
  dest_path="$BIN_DIR/${SCRIPTS[$src_file]}"
  if [ ! -f "$src_path" ] || ! is_correct_symlink "$dest_path" "$src_path"; then
    ALL_CORRECT=false
    break
  fi
done

if [ "$ALL_CORRECT" = true ]; then
  for src_file in "${!SCRIPTS[@]}"; do
    echo "  ${SCRIPTS[$src_file]}: already correct"
  done
else
  # Symlinks need creating/updating — require elevation on Windows
  require_elevation
  mkdir -p "$BIN_DIR"

  ERRORS=0
  for src_file in "${!SCRIPTS[@]}"; do
    cmd_name="${SCRIPTS[$src_file]}"
    src_path="$SCRIPT_DIR/$src_file"
    dest_path="$BIN_DIR/$cmd_name"

    if [ ! -f "$src_path" ]; then
      echo "ERROR: Source not found: $src_path" >&2
      ERRORS=$((ERRORS + 1))
      continue
    fi

    if is_correct_symlink "$dest_path" "$src_path"; then
      echo "  $cmd_name: already correct"
      continue
    fi

    existed=false
    [ -e "$dest_path" ] && existed=true

    if ! create_symlink "$src_path" "$dest_path"; then
      echo "ERROR: Failed to create symlink: $dest_path -> $src_path" >&2
      ERRORS=$((ERRORS + 1))
      continue
    fi

    if [ "$existed" = true ]; then
      echo "  $cmd_name: updated"
    else
      echo "  $cmd_name: created"
    fi
  done

  if [ "$ERRORS" -gt 0 ]; then
    echo ""
    echo "Completed with $ERRORS error(s)." >&2
    exit 1
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
