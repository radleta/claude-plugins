---
summary: "Manual symlink-following loop for MSYS where `readlink -f` and `realpath` fail silently."
tags: [scripts-expert/windows-msys]
---

# Resolve Script Directory Through Symlinks

`readlink -f` and `realpath` fail silently on MSYS. Use a manual loop to find the real script directory.

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
