#!/usr/bin/env bash
# install.sh — One-time machine setup for scratch-memory.
#
# Installs the `scratch-memory` CLI wrapper to ~/.local/bin/ so you can run
# `scratch-memory add` from any project directory to register the MCP.
#
# The MCP server script (server.mjs) is NOT copied — it stays in this skill
# directory and is referenced by absolute path at MCP registration time.
# That way, edits to server.mjs take effect on the next server spawn.
#
# Idempotent: safe to re-run anytime.

set -euo pipefail

case "${1:-}" in
  -h|--help)
    echo "Usage: bash install.sh [--check]"
    echo ""
    echo "Options:"
    echo "  --check   Report drift status of installed wrapper (read-only, exits 0 always)"
    exit 0
    ;;
  --check) _DO_CHECK=true ;;
  -*) echo "ERROR: unknown option: $1" >&2; exit 1 ;;
  *) _DO_CHECK=false ;;
esac

# --- Resolve this script's directory through symlinks (MSYS-safe) ---

_resolve_script() {
  local src="${BASH_SOURCE[0]}"
  while [[ -L "$src" ]]; do
    local dir
    dir="$(cd "$(dirname "$src")" && pwd)"
    src="$(readlink "$src")"
    [[ "$src" != /* ]] && src="$dir/$src"
  done
  cd "$(dirname "$src")" && pwd
}
SCRIPT_DIR="$(_resolve_script)"

BIN_DIR="$HOME/.local/bin"
CLI_SRC="$SCRIPT_DIR/scratch-memory.mjs"
SERVER_SRC="$SCRIPT_DIR/server.mjs"
CLI_WRAPPER="$BIN_DIR/scratch-memory"

# --- Verify sources and deps (skipped in --check mode; check is read-only) ---

if [[ "$_DO_CHECK" != true ]]; then
  if [[ ! -f "$CLI_SRC" ]]; then
    echo "ERROR: CLI source not found: $CLI_SRC" >&2
    exit 1
  fi

  if [[ ! -f "$SERVER_SRC" ]]; then
    echo "ERROR: server source not found: $SERVER_SRC" >&2
    exit 1
  fi

  missing=()
  for dep in node claude; do
    if ! command -v "$dep" &>/dev/null; then
      missing+=("$dep")
    fi
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    echo "ERROR: missing required dependencies: ${missing[*]}" >&2
    echo "  - node: https://nodejs.org (v18+)" >&2
    echo "  - claude: Claude Code CLI" >&2
    exit 2
  fi
fi

# --- Install CLI wrapper (local-prefer walker) ---
# _install_wrapper — write a local-prefer walker wrapper to ~/.local/bin/<name>
# Inline helper (not shared): each install.sh is self-contained per plugin encapsulation rules.
# Pattern reference: .claude/skills/wiki-memory/scripts/install.sh _install_wrapper()

mkdir -p "$BIN_DIR"

_install_wrapper() {
  local cmd_name="$1"
  local target_rel_path="$2"  # relative from repo root
  local runner="$3"            # node or bash
  local baked_abs_path="$4"   # absolute path baked at install time
  local wrapper="$BIN_DIR/$cmd_name"

  local desired
  desired="$(cat <<WALKER
#!/usr/bin/env bash
# Local-prefer wrapper. Walks up from CWD looking for a project-local install
# of this script; falls back to the baked absolute path when none is found.
# Pattern reference: .claude/skills/wiki-memory/scripts/install.sh _install_wrapper()
TARGET_REL_PATH="${target_rel_path}"
dir=\$(pwd)
while [ "\$dir" != "/" ]; do
  if [ -f "\$dir/\$TARGET_REL_PATH" ]; then
    exec ${runner} "\$dir/\$TARGET_REL_PATH" "\$@"
  fi
  dir=\$(dirname "\$dir")
done
exec ${runner} "${baked_abs_path}" "\$@"
WALKER
)"

  if [[ -f "$wrapper" ]] && [[ "$(cat "$wrapper")" = "$desired" ]]; then
    echo "  $cmd_name: already correct"
    return 0
  fi

  local existed=false
  [[ -e "$wrapper" ]] && existed=true

  printf '%s\n' "$desired" > "$wrapper"
  chmod +x "$wrapper"

  if [[ "$existed" == true ]]; then
    echo "  $cmd_name: updated"
  else
    echo "  $cmd_name: created"
  fi
}

# _check_wrapper — report drift status of a local-prefer walker wrapper (read-only)
# Output: one line with [OK], [DRIFT], [MISSING], or [OTHER] prefix tag.
# Inline helper (not shared): each install.sh is self-contained per plugin encapsulation rules.
_check_wrapper() {
  local cmd_name="$1"
  local target_rel_path="$2"
  local runner="$3"
  local baked_abs_path="$4"
  local wrapper="$BIN_DIR/$cmd_name"

  local desired
  desired="$(cat <<WALKER
#!/usr/bin/env bash
# Local-prefer wrapper. Walks up from CWD looking for a project-local install
# of this script; falls back to the baked absolute path when none is found.
# Pattern reference: .claude/skills/wiki-memory/scripts/install.sh _install_wrapper()
TARGET_REL_PATH="${target_rel_path}"
dir=\$(pwd)
while [ "\$dir" != "/" ]; do
  if [ -f "\$dir/\$TARGET_REL_PATH" ]; then
    exec ${runner} "\$dir/\$TARGET_REL_PATH" "\$@"
  fi
  dir=\$(dirname "\$dir")
done
exec ${runner} "${baked_abs_path}" "\$@"
WALKER
)"

  if [ ! -e "$wrapper" ]; then
    echo "[MISSING] $cmd_name: not installed at ~/.local/bin/$cmd_name"
    return 0
  fi

  local actual
  actual="$(cat "$wrapper" 2>/dev/null || true)"

  if [ "$actual" = "$desired" ]; then
    echo "[OK] $cmd_name: correct (worktree=$baked_abs_path)"
    return 0
  fi

  local baked_line
  baked_line="$(grep -m1 '^exec ' "$wrapper" 2>/dev/null || true)"
  if [ -n "$baked_line" ] && echo "$actual" | grep -q 'Local-prefer wrapper'; then
    local other_path
    other_path="$(echo "$baked_line" | sed 's/^exec [^ ]* "\([^"]*\)" .*/\1/')"
    echo "[DRIFT] $cmd_name: baked=$other_path expected=$baked_abs_path"
  else
    echo "[OTHER] $cmd_name: present but not a recognizable wrapper"
  fi
  return 0
}

if [[ "$_DO_CHECK" == true ]]; then
  _check_wrapper \
    "scratch-memory" \
    ".claude/skills/scratch-memory/scripts/scratch-memory.mjs" \
    "node" \
    "$CLI_SRC"
  exit 0
fi

_install_wrapper \
  "scratch-memory" \
  ".claude/skills/scratch-memory/scripts/scratch-memory.mjs" \
  "node" \
  "$CLI_SRC"

# --- Ensure server.mjs is executable (not strictly required since it's invoked via `node`, but avoids surprises) ---

if [[ -x "$SERVER_SRC" ]]; then
  echo "  server.mjs: already executable"
else
  chmod +x "$SERVER_SRC" 2>/dev/null || true
  echo "  server.mjs: chmod +x"
fi

# --- PATH verification ---

echo ""
case ":$PATH:" in
  *":$BIN_DIR:"*)
    echo "PATH: ~/.local/bin is on PATH"
    ;;
  *)
    echo "WARNING: ~/.local/bin is NOT on PATH."
    echo "  Add to your shell profile (~/.bashrc or ~/.profile):"
    echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
    ;;
esac

echo ""
echo "One-time machine setup complete."
echo ""
echo "To enable in a project:"
echo "  cd /path/to/project"
echo "  scratch-memory add"
echo ""
echo "To unregister from a project:"
echo "  scratch-memory remove"
