#!/usr/bin/env bash
# install.sh — Install visual-companion CLI to ~/.local/bin/ as exec wrapper
#
# Usage: bash install.sh
# Idempotent: safe to re-run anytime. No elevation needed.

set -euo pipefail

case "${1:-}" in
  -h|--help) echo "Usage: bash install.sh"; exit 0 ;;
  -*) echo "ERROR: unknown option: $1" >&2; exit 1 ;;
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
CMD_NAME="visual-companion"
SOURCE_SCRIPT="$SCRIPT_DIR/visual-companion.sh"
WRAPPER="$BIN_DIR/$CMD_NAME"

# Verify source exists
if [[ ! -f "$SOURCE_SCRIPT" ]]; then
  echo "ERROR: Source not found: $SOURCE_SCRIPT" >&2
  exit 1
fi

# Check if wrapper exists and is correct
if [[ -f "$WRAPPER" ]] && grep -q "$SOURCE_SCRIPT" "$WRAPPER" 2>/dev/null; then
  echo "  $CMD_NAME: already correct"
else
  mkdir -p "$BIN_DIR"

  existed=false
  [[ -e "$WRAPPER" ]] && existed=true

  cat > "$WRAPPER" <<WRAPPER_SCRIPT
#!/usr/bin/env bash
exec "$SOURCE_SCRIPT" "\$@"
WRAPPER_SCRIPT
  chmod +x "$WRAPPER"

  if [[ "$existed" == true ]]; then
    echo "  $CMD_NAME: updated"
  else
    echo "  $CMD_NAME: created"
  fi
fi

# Verify PATH
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
