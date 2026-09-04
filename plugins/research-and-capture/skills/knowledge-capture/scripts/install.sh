#!/usr/bin/env bash
# install.sh — Install learned-check CLI wrapper to ~/.local/bin/
#
# Usage: bash install.sh
# Idempotent: safe to re-run anytime.

set -euo pipefail

# ─── Help and argument validation ────────────────────────────────────────────

case "${1:-}" in
  -h|--help)
    echo "Usage: bash install.sh [--check]"
    echo ""
    echo "Creates a local-prefer walker wrapper at ~/.local/bin/learned-check."
    echo "The wrapper walks up from CWD for a project-local install; falls back to"
    echo "the baked absolute path when none is found."
    echo ""
    echo "Options:"
    echo "  --check   Report drift status of installed wrapper (read-only, exits 0 always)"
    echo ""
    echo "Idempotent: safe to re-run at any time."
    exit 0
    ;;
  --check)
    _DO_CHECK=true
    ;;
  -*)
    echo "ERROR: unknown option: $1" >&2
    exit 1
    ;;
  *)
    _DO_CHECK=false
    ;;
esac

# ─── Resolve script directory through symlinks (MSYS-safe) ──────────────────

_resolve_script() {
  local source="${BASH_SOURCE[0]}"
  while [ -L "$source" ]; do
    local dir
    dir="$(cd -P "$(dirname "$source")" && pwd)"
    source="$(readlink "$source")"
    # Handle relative symlinks
    [[ "$source" != /* ]] && source="$dir/$source"
  done
  cd -P "$(dirname "$source")" && pwd
}

SCRIPT_DIR="$(_resolve_script)"
BIN_DIR="$HOME/.local/bin"
EXPECTED_TARGET="$SCRIPT_DIR/learned-check.mjs"

# ─── Install wrapper (local-prefer walker) ───────────────────────────────────
# _install_wrapper — write a local-prefer walker wrapper to ~/.local/bin/<name>
# Inline helper (not shared): each install.sh is self-contained per plugin encapsulation rules.
# Pattern reference: .claude/skills/wiki-memory/scripts/install.sh _install_wrapper()

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
)"

  if [ -f "$wrapper" ] && [ "$(cat "$wrapper")" = "$desired" ]; then
    echo "  $cmd_name: already correct"
    return 0
  fi

  local existed=false
  [ -e "$wrapper" ] && existed=true

  printf '%s\n' "$desired" > "$wrapper"
  chmod +x "$wrapper"

  if [ "$existed" = true ]; then
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

if [ "$_DO_CHECK" = true ]; then
  _check_wrapper \
    "learned-check" \
    ".claude/skills/knowledge-capture/scripts/learned-check.mjs" \
    "node" \
    "$EXPECTED_TARGET"
  exit 0
fi

# ─── Guard: source must exist (install path only) ────────────────────────────

if [[ ! -f "$EXPECTED_TARGET" ]]; then
  echo "ERROR: Source not found: $EXPECTED_TARGET" >&2
  exit 1
fi

# ─── Create bin dir ──────────────────────────────────────────────────────────

mkdir -p "$BIN_DIR"

_install_wrapper \
  "learned-check" \
  ".claude/skills/knowledge-capture/scripts/learned-check.mjs" \
  "node" \
  "$EXPECTED_TARGET"

# ─── PATH verification ───────────────────────────────────────────────────────

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
