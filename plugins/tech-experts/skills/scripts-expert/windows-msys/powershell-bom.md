---
summary: "PowerShell 5.1 Set-Content adds a BOM that breaks Node.js JSON.parse — use WriteAllText with UTF8Encoding($false) instead."
tags: [scripts-expert/windows-msys]
---

# PowerShell 5.1 BOM Corrupts JSON IPC

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

See also: [atomic-file-writes.md](atomic-file-writes.md) for safe multi-process file sharing patterns.
