---
summary: "Why `ln -sf` silently copies on MSYS and the `cmd //c mklink` workaround for real Windows symlinks."
tags: [scripts-expert/windows-msys]
---

# MSYS `ln -sf` Creates Copies

On Windows/MSYS, `ln -sf` silently creates file copies, not symlinks. `MSYS=winsymlinks:nativestrict` fails with "Operation not permitted" even with developer mode enabled.

**Working symlink creation on Windows:**
```bash
win_src="$(cygpath -w "$src")"
win_dest="$(cygpath -w "$dest")"
[ -e "$dest" ] && rm -f "$dest"
cmd //c mklink "$win_dest" "$win_src" >/dev/null 2>&1
```

Requires elevated terminal. Use exec wrappers instead when elevation is not available.

See also: [exec-wrapper.md](../exec-wrapper.md) for the elevation-free alternative.
