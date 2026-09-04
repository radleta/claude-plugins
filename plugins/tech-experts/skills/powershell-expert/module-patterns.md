---
summary: "PowerShell module patterns: Import-Module with feature detection flag, and VirtualDesktop module command-to-C#-library mapping for Windows 11 virtual desktop management."
tags: [powershell-expert/modules]
---

# Module Patterns

## Import-Module with Feature Detection

```powershell
$script:hasVirtualDesktop = $false
try {
    Import-Module VirtualDesktop -ErrorAction Stop
    $script:hasVirtualDesktop = $true
} catch {}
```

The `VirtualDesktop` module (PSVirtualDesktop) wraps undocumented Windows COM interfaces. The same author (MScholtes) provides a C# equivalent on GitHub. Key commands to map:

| PowerShell (VirtualDesktop module) | C# equivalent |
|---|---|
| `Get-DesktopCount` | `VirtualDesktop.Desktop.Count` |
| `Get-CurrentDesktop` | `VirtualDesktop.Desktop.Current` |
| `Switch-Desktop $n` | `VirtualDesktop.Desktop.FromIndex(n).MakeVisible()` |
| `Move-Window $hwnd $n` | `VirtualDesktop.Desktop.FromIndex(n).MoveWindow(hwnd)` |

**Note**: Windows 11 23H2+ changed the COM GUIDs. Use version-specific implementations or the MScholtes C# library which handles version detection.
