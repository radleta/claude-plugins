---
tags: [winforms-expert/quality-checklist]
summary: "8-item thread safety checklist: UI thread, WinForms Timer, Invoke, SynchronizationContext"
---

# Thread Safety (8 items)

- [ ] **NotifyIcon created on UI thread** (in ApplicationContext constructor)
- [ ] **System.Windows.Forms.Timer** used for polling (not System.Threading.Timer)
- [ ] **Invoke/BeginInvoke** used for cross-thread UI updates
- [ ] **No direct UI access** from background threads or async continuations
- [ ] **SynchronizationContext captured** if using async/await patterns
- [ ] **ContextMenuStrip.Opening** used for dynamic menu updates (runs on UI thread)
- [ ] **File I/O on background thread** with results marshalled to UI
- [ ] **Lock or concurrent collection** for shared state between threads

## Related Checklists

- [Lifecycle and Disposal](lifecycle-disposal.md) — 12-item lifecycle and disposal checklist
- [Icon Rendering](icon-rendering.md) — 8-item icon rendering checklist
- [Notifications and UX](notifications-ux.md) — 8-item notifications and UX checklist
- [Architecture](architecture.md) — 6-item architecture checklist

## See Also

- [Icon Updates](../notifyicon-lifecycle/icon-updates.md) — Safe icon update pattern using UI-thread-safe GDI operations
- [NotifyIcon Creation](../notifyicon-lifecycle/creation.md) — NotifyIcon created on UI thread in ApplicationContext constructor
- [NotifyIcon Disposal](../notifyicon-lifecycle/disposal.md) — Disposal on UI thread in ExitThreadCore
- [Thread Affinity is Non-Negotiable](../core-principles/thread-affinity.md) — Core principle underlying this thread safety checklist
- [Balloon Notifications](../notifyicon-lifecycle/balloon-notifications.md) — Balloon handler wiring on UI thread
