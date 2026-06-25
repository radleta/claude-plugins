---
tags: [winforms-expert/quality-checklist]
summary: "12-item lifecycle and disposal checklist: Visible=false, DestroyIcon, GDI objects, Mutex lifetime"
---

# Lifecycle & Disposal (12 items)

- [ ] **NotifyIcon.Visible = false** before dispose — prevents ghost icon
- [ ] **ExitThreadCore override** disposes all resources in correct order
- [ ] **Application.ApplicationExit** handler as safety net
- [ ] **Every Bitmap/Graphics/Pen/Brush/Font** in using statements
- [ ] **DestroyIcon called** for every GetHicon() result
- [ ] **Icon.FromHandle cloned** before DestroyIcon (clone owns its handle)
- [ ] **Old icon disposed** when replacing NotifyIcon.Icon
- [ ] **Mutex disposed** only after Application.Run returns
- [ ] **GC.KeepAlive(mutex)** after Application.Run
- [ ] **ContextMenuStrip disposed** in ExitThreadCore
- [ ] **Timer stopped and disposed** before NotifyIcon disposal
- [ ] **No icon references held** after disposal (nulled or cleared from caches)

## Related

- [Dispose Everything on Exit](../core-principles/disposal-on-exit.md) — Disposal rules: Visible=false first, ExitThreadCore pattern, safety net handlers
- [NotifyIcon Disposal](../notifyicon-lifecycle/disposal.md) — ExitThreadCore code pattern: dispose order with Visible=false, icon, menu, cache

## Related Checklists

- [Thread Safety](thread-safety.md) — 8-item thread safety checklist
- [Icon Rendering](icon-rendering.md) — 8-item icon rendering checklist
- [Notifications and UX](notifications-ux.md) — 8-item notifications and UX checklist
- [Architecture](architecture.md) — 6-item architecture checklist

## See Also

- [Icon Updates](../notifyicon-lifecycle/icon-updates.md) — Icon update pattern with clone-and-destroy for GDI safety
- [GDI Handles Are Unmanaged Resources](../core-principles/gdi-handles.md) — GDI handle rules underlying the DestroyIcon checklist items
- [Message Pump is Mandatory](../core-principles/message-pump.md) — ApplicationContext message pump that ExitThreadCore exits
- [Single-Instance Enforcement](../core-principles/single-instance.md) — Mutex disposal rule underlying GC.KeepAlive checklist item
- [Thread Affinity is Non-Negotiable](../core-principles/thread-affinity.md) — UI thread rules applicable to disposal
