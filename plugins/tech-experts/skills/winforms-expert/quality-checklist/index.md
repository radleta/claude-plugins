---
tags: [winforms-expert/quality-checklist]
summary: "Quality checklists for WinForms tray apps: lifecycle, thread safety, icons, notifications, architecture"
---

# Quality Checklist

Pre-ship verification checklists covering all critical aspects of a NotifyIcon system tray application.

## Pages

- [Lifecycle and Disposal](lifecycle-disposal.md) — 12-item checklist: NotifyIcon.Visible, DestroyIcon, GDI objects, Mutex
- [Thread Safety](thread-safety.md) — 8-item checklist: UI thread creation, WinForms Timer, Invoke patterns
- [Icon Rendering](icon-rendering.md) — 8-item checklist: DPI awareness, AntiAlias, icon cache, high DPI
- [Notifications and UX](notifications-ux.md) — 8-item checklist: BalloonTip, tooltip, context menu, single-instance
- [Architecture](architecture.md) — 6-item checklist: ApplicationContext, STAThread, visual styles, DPI mode
- [Success Indicators](success-indicators.md) — 8-item success criteria: startup icon, menus, GDI handles, balloons, exit, single-instance, DPI, threading
