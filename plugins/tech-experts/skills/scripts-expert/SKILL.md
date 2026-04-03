---
name: scripts-expert
description: "Validated patterns for writing portable shell and Node.js scripts with install.sh centralization, Windows/MSYS compatibility, argument validation, and PATH exposure via ~/.local/bin/. Use when creating shell scripts, writing install scripts, exposing scripts on PATH, handling Windows symlink issues, or adding --help to CLI tools — even for simple single-file scripts."
---

# Scripts Expert

Patterns for writing scripts that work reliably across platforms, especially Windows/MSYS, and for centralizing scripts via `~/.local/bin/`.

## Windows/MSYS Gotchas

| Task | Wrong Approach | Correct Approach |
|------|---------------|-----------------|
| Create symlink | `ln -sf` (silently copies on MSYS) | `cmd //c mklink` + `cygpath -w` (elevated) |
| Expose script as CLI | Symlink to .mjs/.sh | Exec wrapper in `~/.local/bin/` |
| Check elevation | At script top unconditionally | Pre-check targets; elevate only if changes needed |
| User binary path | `~/bin/local/` | `~/.local/bin/` (XDG standard) |
| Detect Windows | `$OS` or `$OSTYPE` | `case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*)` |
| Check admin | Guessing | `net session >/dev/null 2>&1` |
| Resolve script dir | `readlink -f` or `realpath` (fail on MSYS) | Manual symlink loop (see below) |
| Write JSON from PowerShell | `Set-Content -Encoding UTF8` (adds BOM) | `[IO.File]::WriteAllText($path, $json, (New-Object System.Text.UTF8Encoding $false))` |
| Get PID in Node.js | MSYS PID translation | `process.pid` is already native Windows PID |
| pandoc resource-path | `--resource-path="$A:$B"` (`:` fails on Windows) | Use `;` on Windows: `--resource-path="$A;$B"` |
| git status in hot paths | `git status --porcelain` (default `-uall` is slow) | `git status --porcelain -unormal --no-optional-locks` |

### MSYS `ln -sf` Creates Copies

On Windows/MSYS, `ln -sf` silently creates file copies, not symlinks. `MSYS=winsymlinks:nativestrict` fails with "Operation not permitted" even with developer mode enabled.

**Working symlink creation on Windows:**
```bash
win_src="$(cygpath -w "$src")"
win_dest="$(cygpath -w "$dest")"
[ -e "$dest" ] && rm -f "$dest"
cmd //c mklink "$win_dest" "$win_src" >/dev/null 2>&1
```

Requires elevated terminal. Use exec wrappers instead when elevation is not available.

### Resolve Script Directory Through Symlinks

`readlink -f` and `realpath` fail silently on MSYS. Use a manual loop:

```bash
_resolve_script() {
  local src="${BASH_SOURCE[0]}"
  while [[ -L "$src" ]]; do
    local dir="$(cd "$(dirname "$src")" && pwd)"
    src="$(readlink "$src")"
    [[ "$src" != /* ]] && src="$dir/$src"
  done
  cd "$(dirname "$src")" && pwd
}
SCRIPT_DIR="$(_resolve_script)"
```

Use this when scripts need to find sibling files (templates, configs, assets) and may be invoked via symlink.

### PowerShell 5.1 BOM Corrupts JSON IPC

PowerShell 5.1's `Set-Content -Encoding UTF8` writes a BOM (EF BB BF). Node's `JSON.parse` cannot parse BOM-prefixed JSON — cross-process IPC silently breaks.

**Write JSON without BOM (PowerShell):**
```powershell
[IO.File]::WriteAllText($path, $content, (New-Object System.Text.UTF8Encoding $false))
```

**Strip BOM if received (Node.js):**
```javascript
const str = readFileSync(path, 'utf-8');
const clean = str.charCodeAt(0) === 0xFEFF ? str.slice(1) : str;
```

### Atomic File Writes for IPC

When multiple processes share state via files (hooks writing, monitors polling), use write-to-temp-then-rename to prevent partial reads:

```bash
# Bash
echo "$data" > "$dir/.tmp-$id"
mv "$dir/.tmp-$id" "$dir/$id.json"
```

```javascript
// Node.js
writeFileSync(join(dir, `.tmp-${id}`), JSON.stringify(state), 'utf-8');
renameSync(join(dir, `.tmp-${id}`), join(dir, `${id}.json`));
```

## Exec Wrapper Pattern

For Node.js or bash scripts exposed via `~/.local/bin/`, use an exec wrapper instead of symlinks. No elevation needed, works on all platforms.

```bash
#!/usr/bin/env bash
exec node "/absolute/path/to/script.mjs" "$@"
```

**When to use which:**

| Method | Elevation | Auto-reflects edits | Works for .mjs |
|--------|-----------|--------------------|----|
| Real symlink (`mklink`) | Yes (Windows) | Yes | No (can't run .mjs as bare command) |
| Exec wrapper | No | Yes (exec'd at runtime) | Yes |
| Copy | No | No (must re-copy) | N/A |

**Idempotency check — symlinks vs wrappers:**

| Install method | Correctness check |
|---------------|-------------------|
| Symlink | `readlink "$dest"` equals `"$src"` (with path normalization for Windows) |
| Exec wrapper | `grep -q "$src_path" "$wrapper"` (wrapper contains target path) |

## install.sh Pattern

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
- **Status reporting** — print "created", "updated", or "already correct" per item
- **PATH verification** — warn if `~/.local/bin` is not on PATH

## Argument Validation Guard

Every script exposed via PATH must handle `-h`/`--help` and reject invalid arguments. Without this, flags get silently misinterpreted as positional args.

```bash
# Add at top of every PATH-exposed script
case "${1:-}" in
  -h|--help)
    echo "Usage: $(basename "$0") [args...]"
    echo ""
    echo "Description of what this script does."
    exit 0
    ;;
  -*)
    echo "ERROR: unknown option: $1" >&2
    echo "Usage: $(basename "$0") [args...]" >&2
    exit 1
    ;;
esac

if [ $# -gt N ]; then
  echo "ERROR: too many arguments (expected 0-N)" >&2
  echo "Usage: $(basename "$0") [args...]" >&2
  exit 1
fi
```

**Why this matters:** `git-state --help` without this guard created a file literally named `--help` (the script treated it as the output file argument).

## Script Header Convention

```bash
#!/usr/bin/env bash
# script-name.sh — One-line description
#
# Usage: script-name [args]
# Purpose or context notes

set -euo pipefail
```

- Use `#!/usr/bin/env bash` (portable shebang)
- `set -euo pipefail` (strict mode — exit on error, undefined vars, pipe failures)
- Usage comment reflects the bare command name, not the full path
