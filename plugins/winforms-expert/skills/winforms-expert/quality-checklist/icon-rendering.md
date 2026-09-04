---
tags: [winforms-expert/quality-checklist]
summary: "8-item icon rendering checklist: DPI awareness, AntiAlias, icon cache, high-DPI testing"
---

# Icon Rendering (8 items)

- [ ] **Icon size matches SystemInformation.SmallIconSize** for DPI awareness
- [ ] **SmoothingMode.AntiAlias** set for circle/shape rendering
- [ ] **Transparent background** cleared before drawing
- [ ] **Border or outline** for visibility on both light and dark taskbars
- [ ] **Font size proportional** to icon size for text overlays
- [ ] **Text centered** using MeasureString for proper alignment
- [ ] **Icon cache** used for static/repeated icons to avoid GDI churn
- [ ] **High DPI tested** — icons render correctly at 100%, 125%, 150%, 200% scaling

## Related Checklists

- [Lifecycle and Disposal](lifecycle-disposal.md) — 12-item lifecycle and disposal checklist
- [Thread Safety](thread-safety.md) — 8-item thread safety checklist
- [Notifications and UX](notifications-ux.md) — 8-item notifications and UX checklist
- [Architecture](architecture.md) — 6-item architecture checklist

## See Also

- [Icon Updates](../notifyicon-lifecycle/icon-updates.md) — Safe GDI+ icon update pattern applying these checklist items
- [NotifyIcon Disposal](../notifyicon-lifecycle/disposal.md) — Dispose icon cache objects in ExitThreadCore
- [GDI Handles Are Unmanaged Resources](../core-principles/gdi-handles.md) — GDI handle rules underlying the icon cache checklist item
- [Dispose Everything on Exit](../core-principles/disposal-on-exit.md) — Dispose icon cache and GDI objects on exit
- [Thread Affinity is Non-Negotiable](../core-principles/thread-affinity.md) — Icon updates must happen on UI thread
