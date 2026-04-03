#!/usr/bin/env bash
# install.sh — Install scratch CLI wrapper to ~/.local/bin/
#
# Usage: bash install.sh
# Idempotent: safe to re-run anytime.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BIN_DIR="$HOME/.local/bin"

# Help and argument validation
case "${1:-}" in
  -h|--help)
    echo "Usage: bash install.sh"
    echo ""
    echo "Creates an exec wrapper at ~/.local/bin/scratch that delegates"
    echo "to scratch.mjs in this skill directory."
    exit 0
    ;;
  -*)
    echo "ERROR: unknown option: $1" >&2
    exit 1
    ;;
esac

mkdir -p "$BIN_DIR"

WRAPPER="$BIN_DIR/scratch"
EXPECTED_TARGET="$SCRIPT_DIR/scratch.mjs"

# Check if wrapper already exists and is correct
if [ -f "$WRAPPER" ] && grep -q "$EXPECTED_TARGET" "$WRAPPER" 2>/dev/null; then
  echo "  scratch: already correct"
else
  existed=false
  [ -e "$WRAPPER" ] && existed=true

  cat > "$WRAPPER" <<WRAPPER_EOF
#!/usr/bin/env bash
exec node "$EXPECTED_TARGET" "\$@"
WRAPPER_EOF
  chmod +x "$WRAPPER"

  if [ "$existed" = true ]; then
    echo "  scratch: updated"
  else
    echo "  scratch: created"
  fi
fi

# Verify ~/.local/bin is on PATH
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
