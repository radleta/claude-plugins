---
tags: [winforms-expert/notifyicon-lifecycle]
summary: "Investigation checklist before building a NotifyIcon system tray app — .NET version, icon strategy, menu complexity, notifications, IPC, multi-monitor"
---

# Before Building a System Tray Application

Before building a system tray application, investigate:

- [ ] **Target .NET version** — .NET 10 supports WinForms but AOT has limitations (COM interop issues). Determine if AOT is required or if standard deployment suffices.
- [ ] **Icon requirements** — Static `.ico` files vs dynamic GDI+ rendering. If dynamic, determine sizes (16x16 for tray, 32x32 for balloon), color depth, and update frequency.
- [ ] **Context menu complexity** — Static items vs dynamic submenus that change at runtime. Dynamic menus need careful thread-safe update patterns.
- [ ] **Notification strategy** — BalloonTips (built-in, limited styling) vs Windows Toast Notifications (richer, requires COM). BalloonTips are simpler but deprecated in Windows 10+ (they become Action Center toasts).
- [ ] **IPC mechanism** — How the tray app receives data: file polling, named pipes, memory-mapped files, or WM_COPYDATA messages.
- [ ] **Multi-monitor / high DPI** — Icon rendering must account for DPI scaling. Use `SystemInformation.SmallIconSize` for actual tray icon dimensions.
