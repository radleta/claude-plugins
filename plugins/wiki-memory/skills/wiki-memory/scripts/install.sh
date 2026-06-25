#!/usr/bin/env bash
# install.sh — Install wiki-resolve, wiki-health, and wiki-write CLI wrappers to ~/.local/bin/
#
# Usage: bash install.sh
# Idempotent: safe to re-run anytime. No elevation needed.

set -euo pipefail

case "${1:-}" in
  -h|--help)
    echo "Usage: bash install.sh [--check]"
    echo ""
    echo "Options:"
    echo "  --check   Report drift status of installed wrappers (read-only, exits 0 always)"
    exit 0
    ;;
  --check) _DO_CHECK=true ;;
  -*) echo "ERROR: unknown option: $1" >&2; exit 1 ;;
  *) _DO_CHECK=false ;;
esac

# Resolve this script's directory through symlinks (MSYS-safe)
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
DATA_DIR="$HOME/.local/share/wiki-memory"
REGISTRY="$DATA_DIR/paths.env"

# --- Install local-prefer walker wrapper helper ---
# Usage: _install_wrapper <cmd-name> <target-rel-path> <runner> <baked-abs-path>
# Inline helper (not shared): each install.sh is self-contained per plugin encapsulation rules.
# This is the canonical reference implementation for the walker pattern.
_install_wrapper() {
  local cmd_name="$1"
  local target_rel_path="$2"  # relative from repo root
  local runner="$3"            # node or bash
  local baked_abs_path="$4"   # absolute path baked at install time
  local wrapper="$BIN_DIR/$cmd_name"

  if [[ ! -f "$baked_abs_path" ]]; then
    echo "ERROR: Source not found: $baked_abs_path" >&2
    exit 1
  fi

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

# --- Check/Install wrappers ---

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

  if [[ ! -e "$wrapper" ]]; then
    echo "[MISSING] $cmd_name: not installed at ~/.local/bin/$cmd_name"
    return 0
  fi

  local actual
  actual="$(cat "$wrapper" 2>/dev/null || true)"

  if [[ "$actual" = "$desired" ]]; then
    echo "[OK] $cmd_name: correct (worktree=$baked_abs_path)"
    return 0
  fi

  local baked_line
  baked_line="$(grep -m1 '^exec ' "$wrapper" 2>/dev/null || true)"
  if [[ -n "$baked_line" ]] && echo "$actual" | grep -q 'Local-prefer wrapper'; then
    local other_path
    other_path="$(echo "$baked_line" | sed 's/^exec [^ ]* "\([^"]*\)" .*/\1/')"
    echo "[DRIFT] $cmd_name: baked=$other_path expected=$baked_abs_path"
  else
    echo "[OTHER] $cmd_name: present but not a recognizable wrapper"
  fi
  return 0
}

# Single source of truth — both --check and install branches iterate this array
WRAPPERS=(
  "wiki-resolve:.claude/skills/wiki-memory/scripts/wiki-resolve.sh"
  "wiki-health:.claude/skills/wiki-memory/scripts/wiki-health.sh"
  "wiki-write:.claude/skills/wiki-memory/scripts/wiki-write.sh"
)

if [[ "$_DO_CHECK" == true ]]; then
  for entry in "${WRAPPERS[@]}"; do
    name="${entry%%:*}"
    rel="${entry#*:}"
    _check_wrapper "$name" "$rel" "bash" "$SCRIPT_DIR/$(basename "$rel")"
  done
  if [[ -f $REGISTRY ]]; then
    echo "[DEPRECATED] ~/.local/share/wiki-memory/paths.env exists and is no longer consulted — safe to delete with: rm ~/.local/share/wiki-memory/paths.env"
  fi
  exit 0
fi

mkdir -p "$BIN_DIR"

for entry in "${WRAPPERS[@]}"; do
  name="${entry%%:*}"
  rel="${entry#*:}"
  _install_wrapper "$name" "$rel" "bash" "$SCRIPT_DIR/$(basename "$rel")"
done

# --- Verify PATH ---
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
