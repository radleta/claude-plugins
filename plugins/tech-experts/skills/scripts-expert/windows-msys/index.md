---
summary: "Windows/MSYS compatibility patterns — symlinks, script resolution, JSON IPC, and atomic writes."
tags: [scripts-expert/windows-msys]
---

# Windows/MSYS Gotchas

Common platform traps when writing scripts that run on Windows/MSYS, and the correct approaches.

| Task | Wrong Approach | Correct Approach |
|------|---------------|-----------------|
| Create symlink | `ln -sf` (silently copies on MSYS) | `cmd //c mklink` + `cygpath -w` (elevated) |
| Expose script as CLI | Symlink to .mjs/.sh | Exec wrapper in `~/.local/bin/` |
| Check elevation | At script top unconditionally | Pre-check targets; elevate only if changes needed |
| User binary path | `~/bin/local/` | `~/.local/bin/` (XDG standard) |
| Detect Windows | `$OS` or `$OSTYPE` | `case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*)` |
| Check admin | Guessing | `net session >/dev/null 2>&1` |
| Resolve script dir | `readlink -f` or `realpath` (fail on MSYS) | Manual symlink loop (see [resolve-script-dir.md](resolve-script-dir.md)) |
| Write JSON from PowerShell | `Set-Content -Encoding UTF8` (adds BOM) | `[IO.File]::WriteAllText($path, $json, (New-Object System.Text.UTF8Encoding $false))` |
| Get PID in Node.js | MSYS PID translation | `process.pid` is already native Windows PID |
| pandoc resource-path | `--resource-path="$A:$B"` (`:` fails on Windows) | Use `;` on Windows: `--resource-path="$A;$B"` |
| git status in hot paths | `git status --porcelain` (default `-uall` is slow) | `git status --porcelain -unormal --no-optional-locks` |

## Pages

- [MSYS ln -sf Creates Copies](symlink-creation.md) — Why `ln -sf` silently copies on MSYS and the `cmd //c mklink` workaround
- [Resolve Script Directory Through Symlinks](resolve-script-dir.md) — Manual symlink-following loop for MSYS where `readlink -f` fails
- [PowerShell 5.1 BOM Corrupts JSON IPC](powershell-bom.md) — BOM-free JSON writes and Node.js BOM-strip patterns
- [Atomic File Writes for IPC](atomic-file-writes.md) — Write-to-temp-then-rename pattern for race-free inter-process file sharing
