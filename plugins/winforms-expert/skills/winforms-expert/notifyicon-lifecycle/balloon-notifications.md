---
tags: [winforms-expert/notifyicon-lifecycle]
summary: "ShowBalloonTip patterns and gotchas — timeout ignored on Windows 10+, wire handlers before show"
---

# Balloon Notifications

```csharp
// Wire handler BEFORE calling ShowBalloonTip
notifyIcon.BalloonTipClicked += (s, e) => OnBalloonAction();
notifyIcon.BalloonTipClosed += (s, e) => OnBalloonDismissed();

notifyIcon.BalloonTipTitle = "Status Changed";
notifyIcon.BalloonTipText = "Session is now idle.";
notifyIcon.BalloonTipIcon = ToolTipIcon.Info;
notifyIcon.ShowBalloonTip(5000);  // timeout in ms (Windows may ignore this)
```

**Gotchas:**
- `ShowBalloonTip` timeout is a *suggestion* — Windows 10+ ignores it and uses its own duration
- BalloonTipClicked only fires if the user clicks the balloon body, not the X button
- BalloonTipClosed fires on both timeout and explicit close
- Only one balloon can show at a time per NotifyIcon; new calls replace the previous

## Related

- [NotifyIcon Creation](creation.md) — Creation pattern — wire BalloonTipClicked before Visible=true
- [NotifyIcon Disposal](disposal.md) — Disposal pattern — balloon handler cleanup on exit
- [Icon Updates](icon-updates.md) — Icon update pattern in the same NotifyIcon lifecycle

## See Also

- [Thread Affinity is Non-Negotiable](../core-principles/thread-affinity.md) — BalloonTip handlers run on the UI thread via the message pump
- [GDI Handles Are Unmanaged Resources](../core-principles/gdi-handles.md) — GDI handle management for icon updates triggered by balloon actions
- [Single-Instance Enforcement](../core-principles/single-instance.md) — Single instance prevents duplicate balloon notifications
- [Message Pump is Mandatory](../core-principles/message-pump.md) — Message pump required for BalloonTip events to fire
- [Dispose Everything on Exit](../core-principles/disposal-on-exit.md) — Unsubscribe BalloonTip handlers in ExitThreadCore
