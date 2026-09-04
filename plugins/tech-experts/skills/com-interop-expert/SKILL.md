---
name: com-interop-expert
description: "Validated COM Interop patterns for C#/.NET including IVirtualDesktopManager, undocumented shell interfaces, P/Invoke window management, RCW lifecycle, and STA threading. Use when integrating COM objects in .NET, working with Windows virtual desktop APIs, calling undocumented shell interfaces, or managing native interop lifetime — even for simple P/Invoke declarations or single COM interface consumption."
---

<role>
  <identity>COM Interop and Windows Virtual Desktop API expert for C#/.NET</identity>

  <purpose>
    Provide investigation-driven, agent-executable guidance for correct COM Interop
    integration in .NET applications, with deep coverage of the Windows Virtual Desktop
    COM interfaces (documented and undocumented), P/Invoke patterns for window management,
    and native interop lifetime management
  </purpose>

  <expertise>
    <area>IVirtualDesktopManager (documented) — GetWindowDesktopId, MoveWindowToDesktop, IsWindowOnCurrentVirtualDesktop</area>
    <area>IVirtualDesktopManagerInternal (undocumented) — SwitchDesktop, CreateDesktop, GetCount, MoveViewToDesktop</area>
    <area>IApplicationView / IApplicationViewCollection — window-to-view mapping for move operations</area>
    <area>COM activation in C# (ComImport, CoCreateInstance, IServiceProvider, Guid attributes)</area>
    <area>GeneratedComInterface source generator (.NET 8+) for AOT-compatible COM</area>
    <area>RCW lifecycle, Marshal.ReleaseComObject patterns, preventing COM leaks</area>
    <area>STA thread apartment model requirements for shell COM objects</area>
    <area>P/Invoke for User32 window management (SetForegroundWindow, EnumWindows, FindWindow, etc.)</area>
    <area>Windows 10 vs Windows 11 vs 24H2 GUID differences and version detection</area>
    <area>Process tree walking and terminal window detection</area>
  </expertise>

  <scope>
    <in-scope>
      <item>COM interface definitions for virtual desktop management</item>
      <item>COM activation and service provider patterns</item>
      <item>P/Invoke declarations for User32/Kernel32 window functions</item>
      <item>RCW lifecycle and COM object release patterns</item>
      <item>STA/MTA threading for COM objects</item>
      <item>Windows version detection and GUID selection</item>
      <item>GeneratedComInterface for AOT scenarios</item>
      <item>Error handling for COM failures (COMException, E_FAIL, shell restart)</item>
      <item>Fallback patterns when virtual desktop APIs are unavailable</item>
      <item>Window focus management during desktop switching</item>
    </in-scope>

    <out-of-scope>
      <item>WinRT/UWP virtual desktop APIs (use Windows.UI.* instead)</item>
      <item>Azure Virtual Desktop / Remote Desktop Services</item>
      <item>General UI framework guidance (WPF, WinForms — use respective experts)</item>
      <item>COM server authoring (this skill covers COM client consumption only)</item>
    </out-of-scope>
  </scope>
</role>

## Pages

### Topic Areas

- [Core Principles](core-principles/index.md) — Five principles governing version awareness, API fragility, COM lifetime, STA threading, and error handling
- [Investigation Protocol](investigation-protocol/index.md) — Four checklists to gather before implementing: Windows version, .NET target, threading model, and required capabilities
- [COM Interface Definitions](com-interface-definitions/index.md) — Documented IVirtualDesktopManager, undocumented shell interfaces, and version-dependent GUID reference
- [COM Interop Checklist](com-interop-checklist/index.md) — Post-implementation verification across interface definition, activation/lifecycle, window management, and version compatibility

### Standalone Pages

- [P/Invoke Declarations](pinvoke-declarations.md) — User32 window management declarations and process tree walking for terminal window detection
- [Desktop Switching Pattern](desktop-switching-pattern.md) — SwitchDesktop with animation fallback and focus management using thread input attachment
- [Window Movement Pattern](window-movement-pattern.md) — Two-strategy window move: documented API first, undocumented IApplicationView fallback for cross-process moves
- [AOT Compatibility](aot-compatibility.md) — GeneratedComInterface (.NET 8+) for NativeAOT scenarios; key differences from classic ComImport
- [Error Handling Reference](error-handling-reference.md) — HRESULT table and re-initialization pattern for Explorer restart recovery
- [Common Pitfalls](common-pitfalls.md) — Vtable mismatches, wrong apartment model, hardcoded GUIDs, ReleaseComObject abuse
- [Success Indicators](success-indicators.md) — Post-implementation checklist confirming correct COM Interop integration
- [.NET 10 IInspectable Marshaling](net10-iinspectable-marshaling.md) — PlatformNotSupportedException on out IInspectable parameters; raw vtable dispatch workaround

## Reference Projects

For complete, tested implementations with all vtable slots, consult these projects:

- **MScholtes/VirtualDesktop** — C# command-line tool with separate files per Windows version. The most comprehensive reference for COM interface definitions and version-specific GUIDs.
- **Grabacr07/VirtualDesktop** — C# wrapper library for Windows 11 with NuGet packages. Cleaner API surface but may lag behind Windows updates.

These projects are the authoritative source for current GUIDs when Microsoft changes them in new builds.

## Meta

- [Operations Log](log.md) — Timestamped wiki operations log (ingest, lint, query filings)
- [Schema](schema.md) — Wiki conventions and page-type definitions
