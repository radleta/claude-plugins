---
name: powershell-expert
description: "Validated PowerShell patterns for script analysis, .NET interop, WinForms system tray apps, and PS1-to-C# porting. Use when reading PowerShell scripts, translating PS1 to C#, understanding Add-Type/P-Invoke patterns, debugging script-scope issues, or porting WinForms tray monitors — even for simple param blocks or hashtable lookups."
---

<role>
  <identity>PowerShell scripting expert with deep knowledge of .NET interop, WinForms integration, and PS1-to-C# translation</identity>

  <purpose>
    Help agents accurately read, understand, and port PowerShell scripts to C# by providing pattern-level knowledge of PS1 idioms and their .NET equivalents
  </purpose>

  <expertise>
    <area>PowerShell syntax (param blocks, splatting, pipelines, scopes, strict mode)</area>
    <area>.NET interop via Add-Type (assembly loading, P/Invoke, inline C# compilation)</area>
    <area>WinForms in PowerShell (NotifyIcon, Timer, ContextMenuStrip, event handlers)</area>
    <area>Data structures (hashtables, PSCustomObject, ordered dictionaries, JSON handling)</area>
    <area>Process management (Get-Process, WMI/CIM, PID resolution, process trees)</area>
    <area>Error handling ($ErrorActionPreference, strict mode, try/catch patterns)</area>
    <area>File I/O (encoding pitfalls, BOM issues, atomic writes)</area>
    <area>PS1-to-C# translation (scope mapping, pipeline-to-LINQ, scriptblock-to-delegate)</area>
  </expertise>

  <scope>
    <in-scope>
      <item>Reading and understanding PS1 scripts for porting</item>
      <item>PowerShell syntax patterns and their C# equivalents</item>
      <item>.NET interop patterns (Add-Type, assembly loading, P/Invoke)</item>
      <item>WinForms usage in PowerShell (system tray, timers, event handling)</item>
      <item>Data structure translation (hashtables, PSCustomObject to C# types)</item>
      <item>Error handling and strict mode behavior</item>
      <item>File I/O and encoding (UTF-8 BOM pitfalls)</item>
      <item>Process and module management patterns</item>
    </in-scope>

    <out-of-scope>
      <item>PowerShell module authoring (psd1/psm1 publishing)</item>
      <item>DSC (Desired State Configuration)</item>
      <item>PowerShell remoting and JEA</item>
      <item>Azure/AWS PowerShell modules</item>
      <item>General C# architecture (use csharp-expert for that)</item>
    </out-of-scope>
  </scope>
</role>

## Loading Strategy

**Always loaded**: This SKILL.md (patterns, translation tables, checklists)

**Load on demand**:
- Use Read tool on @TRANSLATION.md for detailed PS1-to-C# pattern mappings with code examples
- Use Read tool on @WINFORMS.md for WinForms/system-tray-specific patterns and timer guidance

## Core Principles

### 1. Everything Is an Object

PowerShell wraps everything in objects. Even simple strings are `System.String`. Cmdlet output is always `object[]` or a specific .NET type. When porting, identify the underlying .NET type — the C# equivalent is often the same class.

### 2. Pipeline Is Lazy Enumeration

The PowerShell pipeline (`|`) processes items one at a time (streaming). This maps to C# `IEnumerable<T>` and LINQ. Key difference: PowerShell auto-unwraps single-element arrays, which C# does not. Always check whether pipeline output is treated as scalar or collection in the original script.

### 3. Script Scope Is Module-Level State

`$script:` variables persist for the script's lifetime and are visible to all functions in that script. They are the PowerShell equivalent of **C# static fields** in the enclosing class. When porting, collect all `$script:` variables and promote them to static fields (or instance fields on a long-lived service class).

### 4. Hashtables Are the Universal Container

PowerShell hashtables (`@{}`) serve as dictionaries, configuration objects, and even argument bags (splatting). In C#, map them to `Dictionary<string, T>`, configuration classes, or anonymous objects depending on usage context.

### 5. Loose Typing Requires Explicit Translation

PowerShell silently coerces types (`"5" + 2` yields `"52"`, `2 + "5"` yields `7`). When porting, every variable needs an explicit C# type. Look at how the variable is used (arithmetic, string interpolation, comparison) to determine the correct type.

### 6. Error Handling Is Mode-Based

PowerShell's error behavior depends on `$ErrorActionPreference` and per-cmdlet `-ErrorAction`. With `Set-StrictMode -Version Latest`, uninitialized variable access throws. Port these to C# try/catch with explicit null checks and consider what was silent vs. terminating in the original.

### 7. Investigate Before Translating

Before porting any PS1 script, investigate its structure: what assemblies it loads, what `$script:` state it maintains, what .NET types it creates via `Add-Type`, and what event-driven patterns it uses. This determines the C# architecture (single class vs. multi-service, sync vs. async, WinForms vs. WPF).

## Investigation Protocol

Before porting a PS1 script, discover:

- [ ] **Assembly dependencies** — what does `Add-Type -AssemblyName` load? (maps to C# project references)
- [ ] **Inline C# via Add-Type** — any `-TypeDefinition` blocks? (extract as proper C# classes)
- [ ] **Script-scope variables** — grep for `$script:` to find all shared state (becomes class fields)
- [ ] **Timer patterns** — `System.Windows.Forms.Timer` vs `System.Timers.Timer` (thread affinity matters)
- [ ] **Event handlers** — `.add_EventName({...})` scriptblocks (become C# delegates/lambdas)
- [ ] **External modules** — `Import-Module` calls (need C# NuGet or COM equivalents)
- [ ] **Process management** — Get-Process, WMI queries, PID lookups (use System.Diagnostics.Process)
- [ ] **File I/O patterns** — encoding, BOM handling, atomic writes (critical for IPC)
- [ ] **JSON handling** — `ConvertFrom-Json`/`ConvertTo-Json` depth limits (use System.Text.Json)
- [ ] **P/Invoke signatures** — `[DllImport]` in Add-Type blocks (copy directly to C#)

## PowerShell Syntax Quick Reference

### Param Blocks

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

### Splatting

```powershell
$params = @{ Path = $file; Encoding = "UTF8" }
Set-Content @params -Value $data
```

Splatting passes a hashtable as named parameters. **C# equivalent**: just pass arguments directly, or use an options object.

### String Interpolation and Here-Strings

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

### The -f Format Operator

```powershell
"Hello {0}, you have {1} items" -f $name, $count
"{0:N2}" -f 3.14159    # "3.14"
```

**C# equivalent**: `string.Format("Hello {0}, you have {1} items", name, count)` or use interpolation.

### Pipeline Patterns

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

### Switch Statements

```powershell
switch ($status) {
    "idle"      { [ToolTipIcon]::Info }
    "attention" { [ToolTipIcon]::Warning }
    default     { [ToolTipIcon]::None }
}
```

**C# equivalent**: `switch` expression or statement. PowerShell `switch` falls through by default (use `break` to stop). C# `switch` does NOT fall through.

### Comparison Operators

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

## Data Structures

### Hashtable → Dictionary

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

### PSCustomObject → Record/Class

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

### Ordered Dictionary

```powershell
$config = [ordered]@{ First = 1; Second = 2; Third = 3 }
```

**C# equivalent**: `OrderedDictionary` or simply rely on `Dictionary<K,V>` insertion order (.NET Core+).

## JSON Handling

### ConvertFrom-Json / ConvertTo-Json

```powershell
$data = Get-Content -Path $file -Raw | ConvertFrom-Json
$data | ConvertTo-Json -Depth 10 | Set-Content -Path $file
```

**Critical pitfalls**:
- **Depth limit**: `ConvertTo-Json` defaults to depth 2. Deeper objects silently flatten to `@{Key=Value}` strings. Always specify `-Depth`.
- **Array unwrapping**: `ConvertFrom-Json` on a JSON array sends items individually through the pipeline. Use `@()` wrapper or `-NoEnumerate` to preserve the array.
- **PSObject output**: `ConvertFrom-Json` returns `PSCustomObject`, not `Hashtable`. Property access via `.PropertyName`, not `["key"]`.

**C# equivalent**: Use `System.Text.Json.JsonSerializer.Deserialize<T>()` with typed models or `JsonDocument` for dynamic access. No depth limit issues.

## Error Handling

### $ErrorActionPreference and Strict Mode

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

### Common Error Pattern: Optional Dependencies

```powershell
$script:hasFeature = $false
try {
    Import-Module SomeModule -ErrorAction Stop
    $script:hasFeature = $true
} catch {}
# Later: if ($script:hasFeature) { Use-Feature }
```

**C# equivalent**: Feature flag pattern with try/catch around assembly loading or capability detection.

## File I/O and Encoding

### The UTF-8 BOM Trap

PowerShell 5.1's `Set-Content -Encoding UTF8` writes a UTF-8 BOM (`EF BB BF`). This breaks interop with tools that expect BOM-less UTF-8 (Node.js `JSON.parse`, most Unix tools).

```powershell
# BAD — writes BOM in PS 5.1:
Set-Content -Path $file -Value $json -Encoding UTF8

# GOOD — no BOM:
[IO.File]::WriteAllText($path, $content, (New-Object System.Text.UTF8Encoding $false))
```

**C# equivalent**: `File.WriteAllText(path, content, new UTF8Encoding(false))` — but .NET's default `Encoding.UTF8` already omits BOM since .NET Core, so this is mainly a concern when the C# code must interop with PS 5.1 output.

### Atomic File Writes

```powershell
$tmp = "$path.tmp"
[IO.File]::WriteAllText($tmp, $json, $utf8NoBom)
Move-Item -Path $tmp -Destination $path -Force
```

**C# equivalent**: Same pattern — write to temp, then `File.Move(tmp, path, overwrite: true)`.

### Get-Content Patterns

```powershell
$text = Get-Content -Path $file -Raw           # Entire file as single string
$lines = Get-Content -Path $file               # Array of lines
$json = Get-Content -Path $file -Raw | ConvertFrom-Json
```

**C# equivalent**: `File.ReadAllText()`, `File.ReadAllLines()`, `JsonSerializer.Deserialize<T>(File.ReadAllText(path))`.

## Process Management

### Get-Process and WMI

```powershell
$proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
$parentPid = (Get-CimInstance Win32_Process -Filter "ProcessId=$pid").ParentProcessId
```

**C# equivalent**:
```csharp
var proc = Process.GetProcessById(pid);                         // throws if not found
var searcher = new ManagementObjectSearcher(
    $"SELECT ParentProcessId FROM Win32_Process WHERE ProcessId={pid}");
```

### Process Tree Walking

PowerShell scripts often walk process trees via WMI to find parent/child relationships:

```powershell
# Walk up to find terminal window
$currentPid = $claudePid
while ($currentPid -ne 0) {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$currentPid"
    if ($proc.Name -match "WindowsTerminal|wezterm") { break }
    $currentPid = $proc.ParentProcessId
}
```

**C# equivalent**: Use `ManagementObjectSearcher` with `Win32_Process` WMI class, or use `System.Diagnostics.Process` and walk `Process.Parent` (.NET 9+). For older .NET, use P/Invoke with `NtQueryInformationProcess` or keep WMI.

## .NET Interop Patterns

### Add-Type — Assembly Loading

```powershell
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
```

**C# equivalent**: Add NuGet package references or framework references in the `.csproj`:
```xml
<FrameworkReference Include="Microsoft.WindowsDesktop.App.WindowsForms" />
```

### Add-Type — Inline C# / P/Invoke

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

### Add-Type — COM Interop

When a PS1 script uses `New-Object -ComObject`, the C# equivalent is `Type.GetTypeFromProgID()` + `Activator.CreateInstance()` or a generated COM interop assembly.

## Module Patterns

### Import-Module with Feature Detection

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

## WinForms in PowerShell

See @WINFORMS.md for detailed WinForms patterns. Key summary:

### NotifyIcon (System Tray)

```powershell
$icon = New-Object System.Windows.Forms.NotifyIcon
$icon.Icon = $myIcon
$icon.Text = "Tooltip text"
$icon.Visible = $true
$icon.add_MouseClick({ param($sender, $e)
    if ($e.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
        # Handle click
    }
})
```

**C# equivalent**: Same class, same properties. Event handler becomes `icon.MouseClick += (sender, e) => { ... };`.

### Timer Patterns

PowerShell system tray apps use `System.Windows.Forms.Timer` because it fires on the UI thread (no cross-thread issues with NotifyIcon/ContextMenu). **Never** use `System.Timers.Timer` in a WinForms tray app — its events fire on a ThreadPool thread and require `Control.Invoke` to touch UI.

```powershell
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 1000
$timer.add_Tick({ Update-AllSessions })
$timer.Start()
```

**C# equivalent**: Same class, same pattern. Or use `System.Windows.Forms.Timer` directly in the `ApplicationContext` subclass.

### Application Message Loop

```powershell
[System.Windows.Forms.Application]::EnableVisualStyles()
[System.Windows.Forms.Application]::Run()
# Script blocks here until Application.Exit() is called
```

**C# equivalent**: `Application.Run(new TrayApplicationContext())` where `TrayApplicationContext : ApplicationContext` manages the tray icon lifecycle.

## PS1-to-C# Translation Checklist

### Architecture (5 items)

- [ ] **Map script-scope to class fields** — every `$script:` variable becomes a field on the main service class
- [ ] **Map functions to methods** — PS1 `function Verb-Noun` becomes C# `VerbNoun()` method (drop the hyphen, PascalCase)
- [ ] **Map param block to configuration** — constructor params, appsettings, or CLI args
- [ ] **Identify the event loop** — `[Application]::Run()` becomes `Application.Run(context)`
- [ ] **Identify cleanup pattern** — look for `finally` blocks, `.Dispose()` calls, mutex release

### Data Flow (5 items)

- [ ] **Map hashtables to typed dictionaries** — `@{}` becomes `Dictionary<TKey, TValue>`
- [ ] **Map PSCustomObject to records/classes** — `[pscustomobject]@{...}` becomes a typed record
- [ ] **Map pipeline to LINQ** — `| Where-Object | ForEach-Object` becomes `.Where().Select()`
- [ ] **Map JSON handling** — `ConvertFrom-Json` becomes `JsonSerializer.Deserialize<T>()`
- [ ] **Handle null semantics** — PS `$null` checks vs C# nullable reference types

### .NET Interop (5 items)

- [ ] **Extract P/Invoke signatures** — copy `[DllImport]` blocks directly from Add-Type
- [ ] **Map assembly loads to project refs** — `Add-Type -AssemblyName` becomes `<PackageReference>` or `<FrameworkReference>`
- [ ] **Map COM objects** — `New-Object -ComObject` becomes `Activator.CreateInstance(Type.GetTypeFromProgID(...))`
- [ ] **Map event scriptblocks to delegates** — `.add_EventName({...})` becomes `obj.EventName += (s, e) => {...}`
- [ ] **Map static method calls** — `[ClassName]::Method()` is identical in C#

### Error Handling (5 items)

- [ ] **Map error preferences to exceptions** — `$ErrorActionPreference = "Stop"` means all errors throw
- [ ] **Map -ErrorAction SilentlyContinue** — becomes try/catch with swallowed exception (document why)
- [ ] **Map strict mode** — variable access errors become compile-time null checks
- [ ] **Map optional features** — try/catch with feature flag pattern
- [ ] **Map finally blocks** — PS `finally` maps directly to C# `finally`

### File I/O (5 items)

- [ ] **Map encoding** — ensure BOM-free UTF-8 for interop files
- [ ] **Map atomic writes** — write-to-temp + rename pattern preserved
- [ ] **Map Get-Content -Raw** — `File.ReadAllText()`
- [ ] **Map Set-Content** — `File.WriteAllText()` with explicit encoding
- [ ] **Map path construction** — `Join-Path` becomes `Path.Combine()`

### UI and Events (5 items)

- [ ] **Map timer type** — ensure `System.Windows.Forms.Timer` for UI-thread affinity
- [ ] **Map NotifyIcon lifecycle** — create in ApplicationContext, dispose on exit
- [ ] **Map context menus** — `ContextMenuStrip` with `ToolStripMenuItem` items
- [ ] **Map balloon notifications** — `ShowBalloonTip()` or modern toast via Windows.UI.Notifications
- [ ] **Map sound playback** — `SoundPlayer` or `NAudio` for more control

## Common Pitfalls

### PowerShell 5.1 vs 7+ Differences

| Behavior | PS 5.1 | PS 7+ | C# Impact |
|---|---|---|---|
| UTF-8 BOM | `Set-Content -Encoding UTF8` writes BOM | No BOM by default | Use `UTF8Encoding(false)` |
| JSON depth | Default 2, no warning | Default 2, warns | Always specify depth or use typed deserialization |
| Ternary | Not supported | `$x ? $a : $b` | Standard `? :` |
| Null-coalescing | Not supported | `$x ?? $default` | Standard `??` |
| Pipeline parallelism | No | `ForEach-Object -Parallel` | `Parallel.ForEachAsync` |

### Strict Mode Gotchas

With `Set-StrictMode -Version Latest`:
- Accessing non-existent properties throws (unlike normal PS which returns `$null`)
- Accessing uninitialized variables throws
- Calling non-existent methods throws
- **Variable ordering matters**: if a variable is referenced in a scriptblock before it is assigned in the main flow, it throws when the scriptblock executes. This can cause UI objects to be created but not tracked (orphaned resources).

### The Single-Element Array Unwrap

PowerShell automatically unwraps single-element arrays:
```powershell
$items = @("only-one")
$items.GetType()  # String, NOT Object[]
```
Force array with `@()` wrapper or `[array]` cast. In C#, arrays are always arrays — no unwrapping occurs.

### Hashtable Key Casing

PowerShell hashtable keys are case-insensitive by default. C# `Dictionary<string, T>` is case-sensitive by default. Use `StringComparer.OrdinalIgnoreCase` when porting.

## Success Indicators

You have successfully applied this skill when:
- Every `$script:` variable is mapped to a typed field in C#
- Every `Add-Type` block is extracted to proper C# classes or project references
- Pipeline chains are translated to correct LINQ equivalents
- Timer thread affinity is preserved (WinForms Timer for UI, Threading.Timer for background)
- Encoding and BOM handling matches the original behavior
- Event handlers are wired with correct delegate signatures
- Optional module dependencies have equivalent feature-flag patterns in C#

---

**Ready to read PS1 scripts and produce accurate C# translations.**
