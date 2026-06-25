---
summary: "Argument validation guard for PATH-exposed scripts — handles -h/--help and rejects unknown flags before they silently become positional args."
tags: [scripts-expert/argument-validation]
---

# Argument Validation Guard

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

See also: [script-header-convention.md](script-header-convention.md) for the full script header template that includes this guard.
