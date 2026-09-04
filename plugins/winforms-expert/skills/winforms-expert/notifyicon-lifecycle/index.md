---
tags: [winforms-expert/notifyicon-lifecycle]
summary: "NotifyIcon creation, icon updates, balloon notifications, and disposal patterns"
---

# NotifyIcon Lifecycle

Complete patterns for managing a NotifyIcon from creation through disposal.

## Pages

- [Before You Start](before-you-start.md) — Investigation checklist before building a NotifyIcon system tray app
- [Creation](creation.md) — Wire events before visible; NotifyIcon initialization pattern
- [Icon Updates](icon-updates.md) — Safe GDI+ icon update with clone-and-destroy pattern
- [Balloon Notifications](balloon-notifications.md) — ShowBalloonTip patterns and gotchas (Windows 10+)
- [Disposal](disposal.md) — ExitThreadCore disposal order: Visible=false before Dispose
- [ContextMenu Patterns](contextmenu-patterns.md) — Static and dynamic ContextMenuStrip patterns for system tray apps
