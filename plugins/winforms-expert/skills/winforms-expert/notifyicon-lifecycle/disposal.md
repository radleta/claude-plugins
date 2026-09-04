---
tags: [winforms-expert/notifyicon-lifecycle]
summary: "ExitThreadCore disposal order: Visible=false first, then dispose icon/menu/context"
---

# NotifyIcon Disposal

```csharp
protected override void ExitThreadCore()
{
    notifyIcon.Visible = false;   // Remove from tray immediately
    notifyIcon.Icon?.Dispose();
    notifyIcon.ContextMenuStrip?.Dispose();
    notifyIcon.Dispose();

    // Dispose any cached Icon objects
    foreach (var icon in iconCache.Values)
        icon.Dispose();

    base.ExitThreadCore();  // Exits the message loop
}
```

## Related

- [Dispose Everything on Exit](../core-principles/disposal-on-exit.md) — Disposal rules and rationale: Visible=false first, safety net handlers
- [NotifyIcon Creation](creation.md) — Creation pattern — pair with this disposal pattern for full lifecycle
- [Icon Updates](icon-updates.md) — Icon update pattern — correct disposal of old icons during updates
- [Balloon Notifications](balloon-notifications.md) — Notification patterns in the same NotifyIcon lifecycle

## See Also

- [Thread Affinity is Non-Negotiable](../core-principles/thread-affinity.md) — Disposal must run on the UI thread in ExitThreadCore
- [GDI Handles Are Unmanaged Resources](../core-principles/gdi-handles.md) — GDI objects disposed in ExitThreadCore after NotifyIcon
- [Single-Instance Enforcement](../core-principles/single-instance.md) — Mutex disposal after Application.Run returns (outside ExitThreadCore)
- [Message Pump is Mandatory](../core-principles/message-pump.md) — ExitThreadCore exits the message pump via base.ExitThreadCore()
