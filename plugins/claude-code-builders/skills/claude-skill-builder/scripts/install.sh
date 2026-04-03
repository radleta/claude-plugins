#!/usr/bin/env bash
# install.sh — Install skill-edit CLI wrapper to ~/.local/bin/
# Idempotent — safe to re-run anytime

set -euo pipefail

case "${1:-}" in
  -h|--help) echo "Usage: bash install.sh"; exit 0 ;;
  -*) echo "ERROR: unknown option: $1" >&2; exit 1 ;;
esac

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BIN_DIR="$HOME/.local/bin"
WRAPPER="$BIN_DIR/skill-edit"
SOURCE_SCRIPT="$SCRIPT_DIR/skill-edit.sh"

mkdir -p "$BIN_DIR"

if [[ -f "$WRAPPER" ]] && grep -q "$SOURCE_SCRIPT" "$WRAPPER" 2>/dev/null; then
  echo "  skill-edit: already correct"
else
  cat > "$WRAPPER" <<WRAPPER_EOF
#!/usr/bin/env bash
exec "$SOURCE_SCRIPT" "\$@"
WRAPPER_EOF
  chmod +x "$WRAPPER"
  if [[ -f "$WRAPPER" ]]; then
    echo "  skill-edit: created"
  else
    echo "  skill-edit: updated"
  fi
fi

# Verify PATH
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
