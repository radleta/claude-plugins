---
summary: "PowerShell error handling patterns and C# equivalents: $ErrorActionPreference, strict mode, -ErrorAction SilentlyContinue, and the optional-dependency feature flag pattern."
tags: [powershell-expert/error-handling]
---

# Error Handling

## $ErrorActionPreference and Strict Mode

```powershell
Set-StrictMode -Version Latest      # Uninitialized vars throw
$ErrorActionPreference = "Stop"     # Non-terminating errors become terminating

try {
    Import-Module VirtualDesktop -ErrorAction Stop
    $script:hasVirtualDesktop = $true
} catch {
    # Silently continue — module is optional
}
```

**C# equivalent**: Strict mode maps to compiler warnings/errors (nullable reference types, uninitialized field warnings). `$ErrorActionPreference = "Stop"` maps to throwing exceptions instead of returning error codes. `-ErrorAction SilentlyContinue` maps to a try/catch with empty catch block.

## Common Error Pattern: Optional Dependencies

```powershell
$script:hasFeature = $false
try {
    Import-Module SomeModule -ErrorAction Stop
    $script:hasFeature = $true
} catch {}
# Later: if ($script:hasFeature) { Use-Feature }
```

**C# equivalent**: Feature flag pattern with try/catch around assembly loading or capability detection.
