---
summary: "Idempotent install.sh pattern for skills that bundle scripts — creates wrappers in ~/.local/bin/ with status reporting and PATH verification."
tags: [scripts-expert/install-sh]
---

# install.sh Pattern

Every skill that bundles scripts should include an idempotent `install.sh` that creates wrappers/symlinks in `~/.local/bin/`.

**Structure:**
```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BIN_DIR="$HOME/.local/bin"

# Help
case "${1:-}" in
  -h|--help) echo "Usage: bash install.sh"; exit 0 ;;
  -*) echo "ERROR: unknown option: $1" >&2; exit 1 ;;
esac

mkdir -p "$BIN_DIR"

# For each script: check if wrapper exists and is correct, create/update if not
# Report status: "created", "updated", or "already correct"

# Verify PATH
case ":$PATH:" in
  *":$BIN_DIR:"*) echo "PATH: ~/.local/bin is on PATH" ;;
  *) echo "WARNING: ~/.local/bin is NOT on PATH." ;;
esac
```

**Key principles:**
- **Idempotent** — safe to re-run anytime
- **Lazy elevation** — pre-check all targets before requiring admin; if all correct, exit 0 without elevation
- **Status Reporting** — print "created", "updated", or "already correct" per item (see below)
- **PATH Verification** — warn if `~/.local/bin` is not on PATH (see below)
- **Check mode** — support `--check` for read-only drift detection (see below)

## Status Reporting

Every item install.sh touches must print one of three states: `created`, `updated`, or `already correct`. Without per-item status, re-runs are silent and users cannot tell what changed.

**Wrong — silent success:**
```bash
cat > "$BIN_DIR/my-script" <<EOF
#!/usr/bin/env bash
exec /path/to/real-script.sh "\$@"
EOF
chmod +x "$BIN_DIR/my-script"
```

**Right — three explicit states per item:**
```bash
wrapper="$BIN_DIR/my-script"
target="/path/to/real-script.sh"
if [ ! -f "$wrapper" ]; then
  # write wrapper ...
  echo "created: $wrapper"
elif ! grep -q "$target" "$wrapper"; then
  # rewrite wrapper ...
  echo "updated: $wrapper"
else
  echo "already correct: $wrapper"
fi
```

**Why this matters:** idempotent scripts must be observably idempotent. On a second run, users need signal that nothing needed fixing — otherwise "install.sh silently succeeded" is indistinguishable from "install.sh silently failed to do anything". A missing `already correct` branch is the common failure: scripts print on create/update but stay silent when the item is unchanged, leaving users guessing.

## PATH Verification

After creating wrappers, install.sh must verify that `~/.local/bin` is on `$PATH` and warn the user if not. A working wrapper at an invisible location is useless.

**Wrong — install succeeds, wrapper invisible:**
```bash
mkdir -p "$BIN_DIR"
# ... create wrappers ...
echo "Done."
```

**Right — warn when PATH is missing the bin dir:**
```bash
case ":$PATH:" in
  *":$BIN_DIR:"*) echo "PATH: ~/.local/bin is on PATH" ;;
  *) echo "WARNING: ~/.local/bin is NOT on PATH. Add this to your shell RC:"
     echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
     ;;
esac
```

**Why this matters:** a wrapper in `~/.local/bin/` is only reachable if `$PATH` includes that directory. Silent success here creates "why isn't my script working" support tickets when the fix is one shell-RC line. The check is free and unambiguous — skip it only at the cost of user confusion.

## Check Mode (`--check`)

Every install.sh should support a read-only `--check` mode that reports drift without writing anything. This is consumed by `init-repo.sh`'s drift sweep and can be run standalone at any time.

Output format: one prefix-tagged line per item — `[OK]`, `[DRIFT]`, `[MISSING]`, or `[OTHER]`. Exits 0 always (non-zero would break the sweep aggregator).

```bash
WRAPPERS=(
  "tool-a:scripts/tool-a.mjs"
  "tool-b:scripts/tool-b.mjs"
)

case "${1:-}" in
  --check)
    for entry in "${WRAPPERS[@]}"; do
      name="${entry%%:*}"
      rel="${entry#*:}"
      wrapper="$BIN_DIR/$name"
      target="$SCRIPT_DIR/$rel"
      if [ ! -f "$wrapper" ]; then
        echo "[MISSING] $wrapper"
      elif ! grep -q "$target" "$wrapper" 2>/dev/null; then
        echo "[DRIFT] $wrapper → target mismatch"
      else
        echo "[OK] $wrapper"
      fi
    done
    exit 0
    ;;
  -h|--help) echo "Usage: bash install.sh [--check]"; exit 0 ;;
  -*) echo "ERROR: unknown option: $1" >&2; exit 1 ;;
esac
```

**Why this matters:** `init-repo.sh` runs every `install.sh --check` at startup and surfaces a consolidated drift summary. Without `--check`, the sweep cannot query install state without side effects — callers would have to parse the write-mode output or skip the check entirely.

## Single Source of Truth: WRAPPERS Array

When `install.sh` has both a `--check` mode and an install mode, both loops must enumerate the exact same set of wrappers. Hardcoding the list separately in each branch creates a **dual-loop drift problem**: a recent regression added a third wrapper to the install loop but not the check loop — `--check` reported `[OK]` for a wrapper that was never being created. The user had no signal that the drift check itself was incomplete.

The fix is a single `WRAPPERS=("name:relpath" ...)` array declared once and iterated by both branches:

```bash
WRAPPERS=(
  "wiki-memory:scripts/wiki-memory.mjs"
  "wiki-health:scripts/wiki-health.mjs"
  "wiki-write:scripts/wiki-write.mjs"
)

case "${1:-}" in
  --check)
    for entry in "${WRAPPERS[@]}"; do
      name="${entry%%:*}"
      rel="${entry#*:}"
      wrapper="$BIN_DIR/$name"
      target="$SCRIPT_DIR/$rel"
      if [ ! -f "$wrapper" ]; then
        echo "[MISSING] $wrapper"
      elif ! grep -q "$target" "$wrapper" 2>/dev/null; then
        echo "[DRIFT] $wrapper → target mismatch"
      else
        echo "[OK] $wrapper"
      fi
    done
    exit 0
    ;;
esac

# Install mode — same array, same entries, guaranteed symmetry
for entry in "${WRAPPERS[@]}"; do
  name="${entry%%:*}"
  rel="${entry#*:}"
  _install_wrapper "$name" "$SCRIPT_DIR/$rel"
done
```

**Parameter expansions explained:**
- `${entry%%:*}` — strip the longest suffix matching `:*` (everything from the first `:` to end), leaving the wrapper name
- `${entry#*:}` — strip the shortest prefix matching `*:` (everything up to and including the first `:`), leaving the relative path

These are POSIX parameter expansions — no `cut`, `awk`, or `sed` subprocess required.

**Alternative shape:** `commit-methodology/install.sh` uses `declare -A SCRIPTS=([source.sh]="cmd-name" ...)` — an associative array keyed by source filename. That shape works well for installs that don't need to coordinate with an external coordinated list. The colon-separated string-array shape above is preferred when the WRAPPERS list must stay in sync with another list (e.g., `init-repo.sh`'s `links=()` array) — both lists share the same parsing convention, making the cross-list drift check trivial to express.

See also: [exec-wrapper.md](exec-wrapper.md) for the exec wrapper format this script creates.
