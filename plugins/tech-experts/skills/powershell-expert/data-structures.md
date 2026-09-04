---
summary: "PowerShell data structure patterns and C# equivalents: hashtables to Dictionary, PSCustomObject to records/classes, and ordered dictionaries."
tags: [powershell-expert/data-structures]
---

# Data Structures

## Hashtable → Dictionary

```powershell
$colors = @{
    "busy"   = [Color]::FromArgb(230, 40, 40)
    "idle"   = [Color]::FromArgb(40, 200, 40)
}
$colors["busy"]                    # Index access
$colors.ContainsKey("idle")        # Key check
$colors.Keys | ForEach-Object { }  # Iterate keys
```

**C# equivalent**:
```csharp
var colors = new Dictionary<string, Color>
{
    ["busy"] = Color.FromArgb(230, 40, 40),
    ["idle"] = Color.FromArgb(40, 200, 40),
};
colors["busy"];                    // Index access
colors.ContainsKey("idle");        // Key check
foreach (var key in colors.Keys) { } // Iterate keys
```

**Key gotcha**: PowerShell hashtable keys are case-insensitive by default. C# `Dictionary<string, T>` is case-sensitive by default. Use `StringComparer.OrdinalIgnoreCase` when porting.

## PSCustomObject → Record/Class

```powershell
[pscustomobject]@{ MaxAge = 60; Factor = 1.0 }
$obj.MaxAge        # Property access
$obj.PSObject.Properties["MaxAge"]  # Dynamic property check (strict-mode safe)
```

**C# equivalent**:
```csharp
record AgingTier(int MaxAge, double Factor);
// or for mutable state:
class SessionState { public int MaxAge { get; set; } public double Factor { get; set; } }
```

**Critical gotcha**: In PS strict mode, `$obj.NonExistentProp` throws. Use `$obj.PSObject.Properties["name"]` for safe dynamic access. In C#, use `Dictionary.TryGetValue()` or null-conditional access.

## Ordered Dictionary

```powershell
$config = [ordered]@{ First = 1; Second = 2; Third = 3 }
```

**C# equivalent**: `OrderedDictionary` or simply rely on `Dictionary<K,V>` insertion order (.NET Core+).
