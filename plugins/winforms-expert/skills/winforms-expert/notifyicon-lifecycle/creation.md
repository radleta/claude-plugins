---
tags: [winforms-expert/notifyicon-lifecycle]
summary: "Wire events before visible; NotifyIcon initialization pattern inside ApplicationContext"
---

# NotifyIcon Creation

```csharp
// Inside ApplicationContext constructor or setup method
notifyIcon = new NotifyIcon
{
    Icon = LoadOrCreateIcon(),
    Text = "My Tray App — Initializing",  // Tooltip, max 127 chars
    Visible = true,
    ContextMenuStrip = BuildContextMenu()
};

// Wire events BEFORE showing
notifyIcon.DoubleClick += OnTrayDoubleClick;
notifyIcon.BalloonTipClicked += OnBalloonClicked;
notifyIcon.BalloonTipClosed += OnBalloonClosed;
```

## Related

- [NotifyIcon Disposal](disposal.md) — Disposal counterpart — pair with this creation pattern
- [Icon Updates](icon-updates.md) — Safe GDI+ icon update pattern after creation
- [Balloon Notifications](balloon-notifications.md) — BalloonTip patterns for notifications wired at creation

## See Also

- [Thread Affinity is Non-Negotiable](../core-principles/thread-affinity.md) — NotifyIcon must be created on the UI thread
- [GDI Handles Are Unmanaged Resources](../core-principles/gdi-handles.md) — Initial icon must be disposed correctly; use clone-and-destroy for GDI+ icons
- [Single-Instance Enforcement](../core-principles/single-instance.md) — Mutex checked before NotifyIcon is created in ApplicationContext
- [Message Pump is Mandatory](../core-principles/message-pump.md) — ApplicationContext + Application.Run required before NotifyIcon receives events
- [Dispose Everything on Exit](../core-principles/disposal-on-exit.md) — ExitThreadCore disposes what this creation pattern sets up
