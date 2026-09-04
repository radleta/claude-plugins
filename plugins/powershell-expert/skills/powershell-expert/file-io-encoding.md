---
summary: "PowerShell file I/O patterns and encoding pitfalls: UTF-8 BOM trap in PS 5.1, atomic write pattern (write-to-temp + rename), and Get-Content equivalents in C#."
tags: [powershell-expert/file-io]
---

# File I/O and Encoding

## The UTF-8 BOM Trap

PowerShell 5.1's `Set-Content -Encoding UTF8` writes a UTF-8 BOM (`EF BB BF`). This breaks interop with tools that expect BOM-less UTF-8 (Node.js `JSON.parse`, most Unix tools).

```powershell
# BAD — writes BOM in PS 5.1:
Set-Content -Path $file -Value $json -Encoding UTF8

# GOOD — no BOM:
[IO.File]::WriteAllText($path, $content, (New-Object System.Text.UTF8Encoding $false))
```

**C# equivalent**: `File.WriteAllText(path, content, new UTF8Encoding(false))` — but .NET's default `Encoding.UTF8` already omits BOM since .NET Core, so this is mainly a concern when the C# code must interop with PS 5.1 output.

## Atomic File Writes

```powershell
$tmp = "$path.tmp"
[IO.File]::WriteAllText($tmp, $json, $utf8NoBom)
Move-Item -Path $tmp -Destination $path -Force
```

**C# equivalent**: Same pattern — write to temp, then `File.Move(tmp, path, overwrite: true)`.

## Get-Content Patterns

```powershell
$text = Get-Content -Path $file -Raw           # Entire file as single string
$lines = Get-Content -Path $file               # Array of lines
$json = Get-Content -Path $file -Raw | ConvertFrom-Json
```

**C# equivalent**: `File.ReadAllText()`, `File.ReadAllLines()`, `JsonSerializer.Deserialize<T>(File.ReadAllText(path))`.
