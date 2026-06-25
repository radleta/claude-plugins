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

## Pages

- [Core Principles](core-principles.md) — Seven foundational principles for understanding PowerShell semantics when porting to C#
- [Syntax Quick Reference](syntax-quick-reference.md) — PowerShell syntax patterns with C# equivalents: param blocks, splatting, pipelines, switch, comparison operators
- [Data Structures](data-structures.md) — Hashtable-to-Dictionary, PSCustomObject-to-record, and ordered dictionary patterns
- [JSON Handling](json-handling.md) — ConvertFrom-Json pitfalls: depth limits, array unwrapping, PSObject output
- [Error Handling](error-handling.md) — $ErrorActionPreference, strict mode, and optional-dependency feature flag patterns
- [File I/O and Encoding](file-io-encoding.md) — UTF-8 BOM trap, atomic writes, and Get-Content equivalents
- [Process Management](process-management.md) — Get-Process, WMI queries, and process tree walking
- [.NET Interop Patterns](dotnet-interop.md) — Add-Type for assembly loading, inline C#/P/Invoke, and COM interop
- [Module Patterns](module-patterns.md) — Import-Module with feature detection; VirtualDesktop module C# mapping
- [WinForms Patterns](WINFORMS.md) — NotifyIcon, timers, context menus, GDI+ icon generation, balloon notifications, and message pump lifecycle
- [Translation Checklist](translation-checklist.md) — 25-item PS1-to-C# checklist: architecture, data flow, interop, errors, file I/O, UI/events
- [Common Pitfalls](common-pitfalls.md) — PS 5.1 vs 7+ differences, strict mode gotchas, array unwrap, hashtable case sensitivity

## Meta
- [Operations Log](log.md) — Timestamped wiki operations log (ingest, lint, query filings)
- [Schema](schema.md) — Wiki conventions and page-type definitions

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
