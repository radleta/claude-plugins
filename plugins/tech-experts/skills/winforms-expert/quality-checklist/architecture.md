---
tags: [winforms-expert/quality-checklist]
summary: "6-item architecture checklist: ApplicationContext, STAThread, EnableVisualStyles, DPI mode, atomic writes"
---

# Architecture (6 items)

- [ ] **ApplicationContext pattern** used (no invisible Form hack)
- [ ] **[STAThread]** attribute on Main method
- [ ] **EnableVisualStyles** called before Application.Run
- [ ] **SetHighDpiMode** called before Application.Run
- [ ] **State file I/O** uses atomic write (write temp, rename) to prevent partial reads
- [ ] **Logging** for debugging tray icon issues (icon creation, disposal, state transitions)

## Related Checklists

- [Lifecycle and Disposal](lifecycle-disposal.md) — 12-item lifecycle and disposal checklist
- [Thread Safety](thread-safety.md) — 8-item thread safety checklist
- [Icon Rendering](icon-rendering.md) — 8-item icon rendering checklist
- [Notifications and UX](notifications-ux.md) — 8-item notifications and UX checklist

## See Also

- [NotifyIcon Disposal](../notifyicon-lifecycle/disposal.md) — ExitThreadCore disposal pattern — core of the ApplicationContext pattern
- [Icon Updates](../notifyicon-lifecycle/icon-updates.md) — Icon update pattern inside the ApplicationContext
- [Message Pump is Mandatory](../core-principles/message-pump.md) — ApplicationContext + Application.Run — foundation of the architecture checklist
- [Dispose Everything on Exit](../core-principles/disposal-on-exit.md) — ExitThreadCore disposal — the exit path of the ApplicationContext
- [Single-Instance Enforcement](../core-principles/single-instance.md) — Mutex pattern that completes the architecture checklist
