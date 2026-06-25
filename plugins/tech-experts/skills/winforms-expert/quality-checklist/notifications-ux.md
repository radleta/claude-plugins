---
tags: [winforms-expert/quality-checklist]
summary: "8-item notifications and UX checklist: BalloonTip, tooltip, context menu, single-instance"
---

# Notifications & UX (8 items)

- [ ] **BalloonTipClicked wired** before ShowBalloonTip
- [ ] **Tooltip text** set and under 127 characters
- [ ] **Tooltip updated** on state changes (hover shows current status)
- [ ] **Context menu has Exit** item that calls Application.Exit()
- [ ] **Double-click handler** for primary action (show/focus)
- [ ] **Single instance enforced** via named Mutex
- [ ] **Graceful startup** — icon appears with initial state, not blank
- [ ] **Error handling** — icon shows error state rather than crashing silently

## Related Checklists

- [Lifecycle and Disposal](lifecycle-disposal.md) — 12-item lifecycle and disposal checklist
- [Thread Safety](thread-safety.md) — 8-item thread safety checklist
- [Icon Rendering](icon-rendering.md) — 8-item icon rendering checklist
- [Architecture](architecture.md) — 6-item architecture checklist

## See Also

- [Balloon Notifications](../notifyicon-lifecycle/balloon-notifications.md) — ShowBalloonTip patterns and gotchas
- [NotifyIcon Creation](../notifyicon-lifecycle/creation.md) — Event wiring at creation for BalloonTip and double-click
- [NotifyIcon Disposal](../notifyicon-lifecycle/disposal.md) — Disposal order for NotifyIcon and ContextMenuStrip
- [Icon Updates](../notifyicon-lifecycle/icon-updates.md) — Icon update pattern for state-driven notifications
- [Dispose Everything on Exit](../core-principles/disposal-on-exit.md) — Cleanup rules for NotifyIcon and ContextMenuStrip
