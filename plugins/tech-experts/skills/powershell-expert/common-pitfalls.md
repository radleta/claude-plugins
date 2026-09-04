---
summary: "Common PowerShell-to-C# porting pitfalls: PS 5.1 vs 7+ differences (UTF-8 BOM, ternary), strict mode variable ordering, single-element array unwrapping, and hashtable case sensitivity."
tags: [powershell-expert/pitfalls]
---

# Common Pitfalls

## PowerShell 5.1 vs 7+ Differences

| Behavior | PS 5.1 | PS 7+ | C# Impact |
|---|---|---|---|
| UTF-8 BOM | `Set-Content -Encoding UTF8` writes BOM | No BOM by default | Use `UTF8Encoding(false)` |
| JSON depth | Default 2, no warning | Default 2, warns | Always specify depth or use typed deserialization |
| Ternary | Not supported | `$x ? $a : $b` | Standard `? :` |
| Null-coalescing | Not supported | `$x ?? $default` | Standard `??` |
| Pipeline parallelism | No | `ForEach-Object -Parallel` | `Parallel.ForEachAsync` |

## Strict Mode Gotchas

With `Set-StrictMode -Version Latest`:
- Accessing non-existent properties throws (unlike normal PS which returns `$null`)
- Accessing uninitialized variables throws
- Calling non-existent methods throws
- **Variable ordering matters**: if a variable is referenced in a scriptblock before it is assigned in the main flow, it throws when the scriptblock executes. This can cause UI objects to be created but not tracked (orphaned resources).

## The Single-Element Array Unwrap

PowerShell automatically unwraps single-element arrays:
```powershell
$items = @("only-one")
$items.GetType()  # String, NOT Object[]
```
Force array with `@()` wrapper or `[array]` cast. In C#, arrays are always arrays — no unwrapping occurs.

## Hashtable Key Casing

PowerShell hashtable keys are case-insensitive by default. C# `Dictionary<string, T>` is case-sensitive by default. Use `StringComparer.OrdinalIgnoreCase` when porting.
