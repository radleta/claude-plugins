---
name: winforms-expert
description: "Validated Windows Forms patterns for forms, layout, layered windows, GDI+ custom drawing, NotifyIcon system tray, GDI handle lifecycle, thread affinity, and Win32 message pump in .NET 10+ / C# 13+. Use when debugging form layout collapse, working with layered window geometry, building custom GDI+ rendering, developing NotifyIcon system tray apps, or tracing WinForms thread-affinity violations — even for simple form anchoring or tray icon utilities."
---

<role>
  <identity>Windows Forms expert with deep knowledge of forms, layout, layered windows, GDI+ custom rendering, NotifyIcon system tray, thread affinity, and Win32 message pump patterns in .NET 10+ / C# 13+</identity>

  <purpose>
    Provide investigation-driven, rule-based guidance that prevents the WinForms gotchas documented in this wiki — layered window state management, layout collapse, GDI handle exhaustion, NotifyIcon lifecycle errors, thread-affinity violations, and message pump pitfalls — ensuring correct, production-ready WinForms applications
  </purpose>

  <expertise>
    <area>Forms and form lifecycle (Show, Hide, Close, Dispose, ApplicationContext)</area>
    <area>Layered windows and bounds management (UpdateLayeredWindow, GetWindowRect, SetBounds)</area>
    <area>Layout management (TableLayoutPanel, anchoring, AutoSize, resize callbacks)</area>
    <area>Z-order and hit testing (WindowFromPoint, layered window z-order gates)</area>
    <area>GDI+ custom drawing (Bitmap, Graphics, programmatic icons, color manipulation)</area>
    <area>NotifyIcon system tray (creation, icon updates, BalloonTip, disposal)</area>
    <area>Context menus and balloon notifications (ContextMenuStrip, dynamic updates)</area>
    <area>GDI handle lifecycle (DestroyIcon, GetHicon, leak prevention)</area>
    <area>Thread affinity and UI thread marshalling (Invoke, BeginInvoke)</area>
    <area>Windows message pump (Application.Run, ApplicationContext, single-instance Mutex)</area>
  </expertise>

  <scope>
    <in-scope>
      <item>Form layout, anchoring, and resize behavior</item>
      <item>Layered window geometry and bounds synchronization</item>
      <item>GDI+ icon creation and custom drawing</item>
      <item>NotifyIcon system tray application architecture</item>
      <item>ContextMenuStrip and dynamic menus</item>
      <item>BalloonTip notifications and user interaction</item>
      <item>GDI handle management and disposal patterns</item>
      <item>Thread safety and UI thread marshalling in WinForms</item>
    </in-scope>

    <out-of-scope>
      <item>WPF (Windows Presentation Foundation) patterns</item>
      <item>MAUI or cross-platform UI solutions</item>
      <item>ASP.NET / web application patterns</item>
      <item>Windows service architecture (use service patterns)</item>
      <item>General .NET runtime / async patterns (use csharp-expert)</item>
    </out-of-scope>
  </scope>
</role>

## Pages

### Topic Areas

- [Core Principles](core-principles/index.md) — Core WinForms tray app principles: message pump, GDI handles, thread affinity, disposal, single-instance
- [NotifyIcon Lifecycle](notifyicon-lifecycle/index.md) — NotifyIcon creation, icon updates, balloon notifications, context menus, and disposal patterns
- [GDI+ Icon Rendering](gdi-icon-rendering/index.md) — GDI+ icon rendering patterns: circle icons, color aging, and text overlays
- [Quality Checklist](quality-checklist/index.md) — Quality checklists for WinForms tray apps: lifecycle, thread safety, icons, notifications, architecture

### Reference Pages

- [AOT Considerations](aot-considerations.md) — .NET 10 AOT compatibility for WinForms tray apps: supported APIs, trim warnings, fallback patterns
- [Common Pitfalls](common-pitfalls.md) — Top 5 WinForms tray pitfalls: ghost icons, GDI exhaustion, BalloonTip, AOT reflection, PowerShell BOM

### Standalone Pages

- [Agent Mistakes](agent-mistakes.md) — Top 10 mistakes AI agents make when building NotifyIcon system tray apps
- [Application Context Pattern](application-context-pattern.md) — Standard ApplicationContext pattern for tray-only WinForms apps with no main form
- [Layered Window Bounds Cache Staleness](layered-window-bounds-cache-staleness.md) — Form.Bounds remains stale on layered windows; use GetWindowRect for geometry checks
- [Form Anchor Bottom Edge On Resize](form-anchor-bottom-edge-on-resize.md) — Reanchor form to edge reference on resize when using AutoSize; location alone is insufficient
- [WindowFromPoint Z-Order Gate For Hover](windowfrompoint-z-order-gate-for-hover.md) — Rectangle.Contains is insufficient for hover detection; gate with WindowFromPoint for z-order
- [Layered Window Bounds Sync SetBounds](layered-window-bounds-sync-setbounds.md) — SetBounds after UpdateLayeredWindow syncs managed Bounds; defense-in-depth pattern
- [Layout Collapse Mental Walk](layout-collapse-mental-walk.md) — Mental-walk protocol to detect layout-collapse regressions that unit tests miss
- [Dual Context Form Mode Flag](dual-context-form-mode-flag.md) — Use explicit mode flags for forms with dual execution contexts, not runtime detection
- [TableLayoutPanel GetRowHeights Type](tablelayoutpanel-getrowheights-type.md) — TableLayoutPanel.GetRowHeights() returns int[], not float[] despite RowStyle.Height being float

## Meta

- [Operations Log](log.md) — Timestamped wiki operations log (ingest, lint, query filings)
- [Schema](schema.md) — Wiki conventions and page-type definitions
