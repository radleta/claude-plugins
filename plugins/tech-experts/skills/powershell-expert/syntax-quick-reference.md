---
summary: "PowerShell syntax patterns with C# equivalents: param blocks, splatting, string interpolation, here-strings, the -f format operator, pipeline patterns, switch statements, and comparison operators."
tags: [powershell-expert/syntax]
---

# PowerShell Syntax Quick Reference

## Param Blocks

```powershell
[CmdletBinding()]
param(
    [int]$StaleMinutes = 60,        # Named param with default
    [switch]$NoToast,                # Boolean flag (present = $true)
    [string[]]$ToastEvents = @("idle", "attention"),  # Array with default
    [ValidateSet("a","b")]$Mode     # Constrained values
)
```

**C# equivalent**: Constructor parameters, `args` parsing, or a configuration record/class. `[switch]` becomes `bool` (default `false`). `[string[]]` becomes `string[]`.

## Splatting

```powershell
$params = @{ Path = $file; Encoding = "UTF8" }
Set-Content @params -Value $data
```

Splatting passes a hashtable as named parameters. **C# equivalent**: just pass arguments directly, or use an options object.

## String Interpolation and Here-Strings

```powershell
"Status: $($session.Status) at $(Get-Date)"   # Interpolated
'Literal: no $expansion here'                   # Single-quoted = literal
@"
Multi-line with $variable expansion
"@                                               # Here-string (interpolated)
@'
Multi-line literal, no expansion
'@                                               # Literal here-string
```

**C# equivalent**: `$"Status: {session.Status} at {DateTime.Now}"` for interpolation. `@"..."` for verbatim multi-line. `"""..."""` for raw string literals (.NET 7+).

## The -f Format Operator

```powershell
"Hello {0}, you have {1} items" -f $name, $count
"{0:N2}" -f 3.14159    # "3.14"
```

**C# equivalent**: `string.Format("Hello {0}, you have {1} items", name, count)` or use interpolation.

## Pipeline Patterns

```powershell
Get-ChildItem *.json | Where-Object { $_.Length -gt 1000 } | ForEach-Object { $_.Name }
Get-ChildItem *.json | Sort-Object LastWriteTime -Descending | Select-Object -First 5
$items | Group-Object Status | ForEach-Object { "$($_.Name): $($_.Count)" }
```

**C# LINQ equivalents**:

| PowerShell | C# LINQ |
|---|---|
| `Where-Object { $_.X -gt 5 }` | `.Where(x => x.X > 5)` |
| `ForEach-Object { $_.Name }` | `.Select(x => x.Name)` |
| `Select-Object -First N` | `.Take(N)` |
| `Sort-Object Prop` | `.OrderBy(x => x.Prop)` |
| `Sort-Object Prop -Descending` | `.OrderByDescending(x => x.Prop)` |
| `Group-Object Prop` | `.GroupBy(x => x.Prop)` |
| `Measure-Object -Sum Prop` | `.Sum(x => x.Prop)` |
| `Select-Object -Unique` | `.Distinct()` |
| `Select-Object -ExpandProperty X` | `.Select(x => x.X)` (flatten) |

## Switch Statements

```powershell
switch ($status) {
    "idle"      { [ToolTipIcon]::Info }
    "attention" { [ToolTipIcon]::Warning }
    default     { [ToolTipIcon]::None }
}
```

**C# equivalent**: `switch` expression or statement. PowerShell `switch` falls through by default (use `break` to stop). C# `switch` does NOT fall through.

## Comparison Operators

| PowerShell | C# | Notes |
|---|---|---|
| `-eq` | `==` | Case-insensitive for strings in PS |
| `-ceq` | `==` (ordinal) | Case-sensitive |
| `-ne` | `!=` | |
| `-gt`, `-ge`, `-lt`, `-le` | `>`, `>=`, `<`, `<=` | |
| `-like` | N/A | Wildcard; use `Regex` or `string.Contains` |
| `-match` | `Regex.IsMatch()` | Sets `$Matches` automatic variable |
| `-contains` | `.Contains()` | Collection membership |
| `-in` | `.Contains()` (reversed) | `$x -in $collection` |
| `-is` | `is` | Type check |
| `-not` / `!` | `!` | |
| `-and`, `-or` | `&&`, `\|\|` | |
