---
summary: "Exec wrapper pattern for exposing Node.js or bash scripts via ~/.local/bin/ without elevation — works on all platforms."
tags: [scripts-expert/exec-wrapper]
---

# Exec Wrapper Pattern

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

See also: [windows-msys/symlink-creation.md](windows-msys/symlink-creation.md) for when real symlinks are required.
See also: [install-sh.md](install-sh.md) for the install.sh pattern that creates these wrappers.
