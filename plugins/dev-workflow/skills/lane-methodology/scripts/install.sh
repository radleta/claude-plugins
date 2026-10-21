#!/usr/bin/env bash
# install.sh — Install the lane CLI wrapper to ~/.local/bin/
#
# Usage: bash install.sh [--check]
# Idempotent: safe to re-run anytime.

set -euo pipefail

case "${1:-}" in
  -h|--help)
    echo "Usage: bash install.sh [--check]"
    echo ""
    echo "Creates a local-prefer walker wrapper at ~/.local/bin/lane, for typing"
    echo "'lane open <slug>' and 'lane remove <slug>'. The wrapper walks up from CWD"
    echo "for a project-local lane.mjs and falls back to the path baked at install."
    echo ""
    echo "Options:"
    echo "  --check   Report drift status of the installed wrapper (read-only, exits 0 always)"
    exit 0
    ;;
  --check) _DO_CHECK=true ;;
  "")      _DO_CHECK=false ;;
  *)
    echo "ERROR: unknown argument: $1" >&2
    exit 1
    ;;
esac

# Resolve the script directory through symlinks (MSYS-safe).
_resolve_script() {
  local source="${BASH_SOURCE[0]}" dir
  while [ -L "$source" ]; do
    dir="$(cd -P "$(dirname "$source")" && pwd)"
    source="$(readlink "$source")"
    [[ "$source" != /* ]] && source="$dir/$source"
  done
  cd -P "$(dirname "$source")" && pwd
}

SCRIPT_DIR="$(_resolve_script)"
BIN_DIR="$HOME/.local/bin"
EXPECTED_TARGET="$SCRIPT_DIR/lane.mjs"

# The wrapper's text for <target_rel_path> <runner> <baked_abs_path>.
_wrapper_text() {
  # Single-quoted, so a \$, backtick or " in the skill folder's path stays literal in the wrapper.
  local baked
  baked="$(printf '%s' "$3" | sed "s/'/'\\\\''/g")"
  cat <<WALKER
#!/usr/bin/env bash
# Local-prefer wrapper. Walks up from CWD looking for a project-local install
# of this script; falls back to the baked absolute path when none is found.
# Pattern reference: .claude/skills/wiki-memory/scripts/install.sh _install_wrapper()
TARGET_REL_PATH="$1"
dir=\$(pwd)
while [ -n "\$dir" ]; do
  if [ -f "\$dir/\$TARGET_REL_PATH" ]; then
    exec $2 "\$dir/\$TARGET_REL_PATH" "\$@"
  fi
  parent=\$(dirname "\$dir")
  [ "\$parent" = "\$dir" ] && break
  dir=\$parent
done
exec $2 '${baked}' "\$@"
WALKER
}

_install_wrapper() {
  local cmd_name="$1" wrapper="$BIN_DIR/$1" desired
  desired="$(_wrapper_text "$2" "$3" "$4")"
  if [ -f "$wrapper" ] && [ "$(cat "$wrapper")" = "$desired" ]; then
    echo "  $cmd_name: already correct"
    return 0
  fi
  local verb=created
  [ -e "$wrapper" ] && verb=updated
  printf '%s\n' "$desired" > "$wrapper"
  chmod +x "$wrapper"
  echo "  $cmd_name: $verb"
}

# One line tagged [OK], [DRIFT], [MISSING] or [OTHER]; writes nothing.
_check_wrapper() {
  local cmd_name="$1" wrapper="$BIN_DIR/$1" desired actual baked_line
  desired="$(_wrapper_text "$2" "$3" "$4")"
  if [ ! -e "$wrapper" ]; then
    echo "[MISSING] $cmd_name: not installed at ~/.local/bin/$cmd_name"
    return 0
  fi
  actual="$(cat "$wrapper" 2>/dev/null || true)"
  if [ "$actual" = "$desired" ]; then
    echo "[OK] $cmd_name: correct (worktree=$4)"
    return 0
  fi
  baked_line="$(grep '^exec ' "$wrapper" 2>/dev/null | tail -n1 || true)"
  if [ -n "$baked_line" ] && echo "$actual" | grep -q 'Local-prefer wrapper'; then
    echo "[DRIFT] $cmd_name: baked=$(echo "$baked_line" | sed "s/^exec [^ ]* ['\"]\(.*\)['\"] \"\\\$@\"\$/\1/") expected=$4"
  else
    echo "[OTHER] $cmd_name: present but not a recognizable wrapper"
  fi
}

if [ "$_DO_CHECK" = true ]; then
  _check_wrapper \
    "lane" \
    ".claude/skills/lane-methodology/scripts/lane.mjs" \
    "node" \
    "$EXPECTED_TARGET"
  exit 0
fi

if [[ ! -f "$EXPECTED_TARGET" ]]; then
  echo "ERROR: Source not found: $EXPECTED_TARGET" >&2
  exit 1
fi

mkdir -p "$BIN_DIR"

_install_wrapper \
  "lane" \
  ".claude/skills/lane-methodology/scripts/lane.mjs" \
  "node" \
  "$EXPECTED_TARGET"

case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *)
    echo ""
    echo "WARNING: ~/.local/bin is NOT on PATH."
    echo "  Add to your shell profile (~/.bashrc or ~/.profile):"
    echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
    ;;
esac
