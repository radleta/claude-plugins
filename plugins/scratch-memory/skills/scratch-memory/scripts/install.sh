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
# _cmd_shim_body — the Windows .cmd companion for a bash wrapper.
#
# Why this exists: the bash wrapper has no extension and is not executable to
# Windows, so cmd.exe cannot resolve it. Anything spawning the command from
# Node with `shell: true` therefore fails on Windows, whatever shell launched
# it -- Node uses ComSpec. A globally npm-installed CLI never hits this because
# `npm install -g` generates .cmd and .ps1 shims automatically; a hand-rolled
# wrapper has to supply that piece itself.
#
# Why it delegates rather than reimplementing: the bash wrapper's value is the
# local-prefer walk up the directory tree, and writing that walk a second time
# in batch would mean two implementations to keep in step for the one behavior
# that matters. Delegating keeps exactly one. The cost is a hard dependency on
# bash for Windows-native callers, which is already true of every .sh in the
# repos this serves.
# _wrapper_body — the bash wrapper's text, for both the writer and the drift
# check. It lives in one place because those two compare against it: a second
# copy edited alone does not fail loudly, it makes --check report [OK] on a
# wrapper that no longer matches what the installer would write.
_wrapper_body() {
  local target_rel_path="$1"
  local runner="$2"
  local baked_abs_path="$3"
  cat <<WALKER
#!/usr/bin/env bash
# Local-prefer wrapper. Walks up from CWD looking for a project-local install
# of this script; falls back to the baked absolute path when none is found.
# Pattern reference: .claude/skills/wiki-memory/scripts/install.sh _install_wrapper()
TARGET_REL_PATH="${target_rel_path}"
dir=\$(pwd)
while [ -n "\$dir" ]; do
  if [ -f "\$dir/\$TARGET_REL_PATH" ]; then
    exec ${runner} "\$dir/\$TARGET_REL_PATH" "\$@"
  fi
  parent=\$(dirname "\$dir")
  [ "\$parent" = "\$dir" ] && break
  dir=\$parent
done
exec ${runner} "${baked_abs_path}" "\$@"
WALKER
}

_cmd_shim_body() {
  local cmd_name="$1"
  cat <<CMDSHIM
@ECHO off
REM Windows companion to the bash wrapper of the same name. Delegates rather
REM than reimplementing the local-prefer walk, so there is one implementation
REM of it. Written by scratch-memory/scripts/install.sh -- do not hand-edit.
bash "%~dp0${cmd_name}" %*
CMDSHIM
}

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
  desired="$(_wrapper_body "$target_rel_path" "$runner" "$baked_abs_path")"

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

# _install_cmd_shim — converge the Windows .cmd companion, independently of the
# bash wrapper. Deliberately NOT folded into _install_wrapper: that function
# returns early when the bash wrapper is already correct, which is the state of
# every machine that installed before this shim existed. Sharing that early
# return would mean the .cmd is only ever written when the wrapper also happens
# to change -- so it would never appear on exactly the machines that need it.
_install_cmd_shim() {
  local cmd_name="$1"
  local cmd_shim="$BIN_DIR/$cmd_name.cmd"

  local desired
  desired="$(_cmd_shim_body "$cmd_name")"

  if [[ -f "$cmd_shim" ]] && [[ "$(cat "$cmd_shim")" = "$desired" ]]; then
    echo "  $cmd_name.cmd: already correct"
    return 0
  fi

  local existed=false
  [[ -e "$cmd_shim" ]] && existed=true

  printf '%s\n' "$desired" > "$cmd_shim"

  if [[ "$existed" == true ]]; then
    echo "  $cmd_name.cmd: updated"
  else
    echo "  $cmd_name.cmd: created"
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
  desired="$(_wrapper_body "$target_rel_path" "$runner" "$baked_abs_path")"

  local cmd_shim="$BIN_DIR/$cmd_name.cmd"
  if [ ! -e "$cmd_shim" ]; then
    echo "[MISSING] $cmd_name.cmd: no Windows companion at ~/.local/bin/$cmd_name.cmd"
  elif [ "$(cat "$cmd_shim" 2>/dev/null || true)" = "$(_cmd_shim_body "$cmd_name")" ]; then
    echo "[OK] $cmd_name.cmd: correct"
  else
    echo "[DRIFT] $cmd_name.cmd: present but does not match the generated shim"
  fi

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

_install_cmd_shim "scratch-memory"

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
