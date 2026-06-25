---
summary: "25-item PS1-to-C# translation checklist covering architecture mapping, data flow, .NET interop extraction, error handling, file I/O, and UI/event porting."
tags: [powershell-expert/translation]
---

# PS1-to-C# Translation Checklist

## Architecture (5 items)

- [ ] **Map script-scope to class fields** — every `$script:` variable becomes a field on the main service class
- [ ] **Map functions to methods** — PS1 `function Verb-Noun` becomes C# `VerbNoun()` method (drop the hyphen, PascalCase)
- [ ] **Map param block to configuration** — constructor params, appsettings, or CLI args
- [ ] **Identify the event loop** — `[Application]::Run()` becomes `Application.Run(context)`
- [ ] **Identify cleanup pattern** — look for `finally` blocks, `.Dispose()` calls, mutex release

## Data Flow (5 items)

- [ ] **Map hashtables to typed dictionaries** — `@{}` becomes `Dictionary<TKey, TValue>`
- [ ] **Map PSCustomObject to records/classes** — `[pscustomobject]@{...}` becomes a typed record
- [ ] **Map pipeline to LINQ** — `| Where-Object | ForEach-Object` becomes `.Where().Select()`
- [ ] **Map JSON handling** — `ConvertFrom-Json` becomes `JsonSerializer.Deserialize<T>()`
- [ ] **Handle null semantics** — PS `$null` checks vs C# nullable reference types

## .NET Interop (5 items)

- [ ] **Extract P/Invoke signatures** — copy `[DllImport]` blocks directly from Add-Type
- [ ] **Map assembly loads to project refs** — `Add-Type -AssemblyName` becomes `<PackageReference>` or `<FrameworkReference>`
- [ ] **Map COM objects** — `New-Object -ComObject` becomes `Activator.CreateInstance(Type.GetTypeFromProgID(...))`
- [ ] **Map event scriptblocks to delegates** — `.add_EventName({...})` becomes `obj.EventName += (s, e) => {...}`
- [ ] **Map static method calls** — `[ClassName]::Method()` is identical in C#

## Error Handling (5 items)

- [ ] **Map error preferences to exceptions** — `$ErrorActionPreference = "Stop"` means all errors throw
- [ ] **Map -ErrorAction SilentlyContinue** — becomes try/catch with swallowed exception (document why)
- [ ] **Map strict mode** — variable access errors become compile-time null checks
- [ ] **Map optional features** — try/catch with feature flag pattern
- [ ] **Map finally blocks** — PS `finally` maps directly to C# `finally`

## File I/O (5 items)

- [ ] **Map encoding** — ensure BOM-free UTF-8 for interop files
- [ ] **Map atomic writes** — write-to-temp + rename pattern preserved
- [ ] **Map Get-Content -Raw** — `File.ReadAllText()`
- [ ] **Map Set-Content** — `File.WriteAllText()` with explicit encoding
- [ ] **Map path construction** — `Join-Path` becomes `Path.Combine()`

## UI and Events (5 items)

- [ ] **Map timer type** — ensure `System.Windows.Forms.Timer` for UI-thread affinity
- [ ] **Map NotifyIcon lifecycle** — create in ApplicationContext, dispose on exit
- [ ] **Map context menus** — `ContextMenuStrip` with `ToolStripMenuItem` items
- [ ] **Map balloon notifications** — `ShowBalloonTip()` or modern toast via Windows.UI.Notifications
- [ ] **Map sound playback** — `SoundPlayer` or `NAudio` for more control
