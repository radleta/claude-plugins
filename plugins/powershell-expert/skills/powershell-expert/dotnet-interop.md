---
summary: "PowerShell .NET interop patterns: Add-Type for assembly loading, inline C# and P/Invoke blocks, and COM interop via New-Object -ComObject — with C# project equivalents."
tags: [powershell-expert/dotnet-interop]
---

# .NET Interop Patterns

## Add-Type — Assembly Loading

```powershell
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
```

**C# equivalent**: Add NuGet package references or framework references in the `.csproj`:
```xml
<FrameworkReference Include="Microsoft.WindowsDesktop.App.WindowsForms" />
```

## Add-Type — Inline C# / P/Invoke

```powershell
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class WinApi {
    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
[WinApi]::SetForegroundWindow($hwnd)
```

**C# equivalent**: Copy the class directly — it is already valid C#. Just add the `partial` keyword or move into your namespace.

## Add-Type — COM Interop

When a PS1 script uses `New-Object -ComObject`, the C# equivalent is `Type.GetTypeFromProgID()` + `Activator.CreateInstance()` or a generated COM interop assembly.
