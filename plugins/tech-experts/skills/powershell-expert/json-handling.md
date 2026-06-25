---
summary: "PowerShell JSON handling patterns and pitfalls: ConvertFrom-Json depth limits, array unwrapping, PSObject output, and C# System.Text.Json equivalents."
tags: [powershell-expert/json]
---

# JSON Handling

## ConvertFrom-Json / ConvertTo-Json

```powershell
$data = Get-Content -Path $file -Raw | ConvertFrom-Json
$data | ConvertTo-Json -Depth 10 | Set-Content -Path $file
```

**Critical pitfalls**:
- **Depth limit**: `ConvertTo-Json` defaults to depth 2. Deeper objects silently flatten to `@{Key=Value}` strings. Always specify `-Depth`.
- **Array unwrapping**: `ConvertFrom-Json` on a JSON array sends items individually through the pipeline. Use `@()` wrapper or `-NoEnumerate` to preserve the array.
- **PSObject output**: `ConvertFrom-Json` returns `PSCustomObject`, not `Hashtable`. Property access via `.PropertyName`, not `["key"]`.

**C# equivalent**: Use `System.Text.Json.JsonSerializer.Deserialize<T>()` with typed models or `JsonDocument` for dynamic access. No depth limit issues.
