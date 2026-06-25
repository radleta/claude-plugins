---
tags: [winforms-expert/notifyicon-lifecycle]
summary: "Safe GDI+ icon update pattern with clone-and-destroy to prevent GDI handle leaks"
---

# Icon Updates (Safe Pattern)

```csharp
void UpdateIcon(Color color, string label)
{
    const int size = 16;
    using var bmp = new Bitmap(size, size);
    using var g = Graphics.FromImage(bmp);
    g.SmoothingMode = SmoothingMode.AntiAlias;

    using var brush = new SolidBrush(color);
    g.FillEllipse(brush, 1, 1, size - 2, size - 2);

    IntPtr hIcon = bmp.GetHicon();
    try
    {
        var newIcon = Icon.FromHandle(hIcon);
        var oldIcon = notifyIcon.Icon;
        notifyIcon.Icon = (Icon)newIcon.Clone();
        oldIcon?.Dispose();
    }
    finally
    {
        DestroyIcon(hIcon);  // CRITICAL: prevent GDI handle leak
    }

    notifyIcon.Text = label.Length > 127 ? label[..127] : label;
}
```

## Related

- [GDI Handles Are Unmanaged Resources](../core-principles/gdi-handles.md) — Rationale for the clone-and-destroy pattern and the 10,000 handle limit
- [Circle Icon](../gdi-icon-rendering/circle-icon.md) — Same clone-and-destroy pattern applied to standalone icon creation
- [Text Overlay](../gdi-icon-rendering/text-overlay.md) — Same pattern for text-rendered icons
- [NotifyIcon Creation](creation.md) — Creation pattern — icons are first assigned here
- [NotifyIcon Disposal](disposal.md) — Disposal pattern — dispose icons in ExitThreadCore
- [Balloon Notifications](balloon-notifications.md) — Notification patterns in the same NotifyIcon lifecycle

## See Also

- [Thread Affinity is Non-Negotiable](../core-principles/thread-affinity.md) — Icon updates must happen on the UI thread
- [Single-Instance Enforcement](../core-principles/single-instance.md) — Mutex ensures only one instance runs icon updates
- [Message Pump is Mandatory](../core-principles/message-pump.md) — Message pump delivers timer/event triggers for icon updates
- [Dispose Everything on Exit](../core-principles/disposal-on-exit.md) — Dispose the icon update timer and cached icons in ExitThreadCore
