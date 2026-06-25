---
summary: "Standard bash script header with portable shebang, usage comment, and strict mode (set -euo pipefail)."
tags: [scripts-expert/script-header]
---

# Script Header Convention

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

See also: [argument-validation.md](argument-validation.md) for the `-h`/`--help` guard to add after the header.
