---
tags: [winforms-expert/gdi-icon-rendering]
summary: "CreateCircleIcon with AntiAlias, optional border, and clone-and-destroy handle pattern"
---

# Circle Icon with Color

```csharp
Icon CreateCircleIcon(Color fill, int size = 16)
{
    using var bmp = new Bitmap(size, size);
    using var g = Graphics.FromImage(bmp);
    g.SmoothingMode = SmoothingMode.AntiAlias;
    g.Clear(Color.Transparent);

    using var brush = new SolidBrush(fill);
    g.FillEllipse(brush, 1, 1, size - 2, size - 2);

    // Optional: border for visibility on both light and dark taskbars
    using var pen = new Pen(Color.FromArgb(80, 0, 0, 0), 1f);
    g.DrawEllipse(pen, 1, 1, size - 2, size - 2);

    IntPtr hIcon = bmp.GetHicon();
    var icon = (Icon)Icon.FromHandle(hIcon).Clone();
    DestroyIcon(hIcon);
    return icon;  // Caller owns this icon and must dispose it
}
```

## Related

- [GDI Handles Are Unmanaged Resources](../core-principles/gdi-handles.md) — Rationale for the clone-and-destroy pattern and the 10,000 handle limit
- [Icon Updates](../notifyicon-lifecycle/icon-updates.md) — Same pattern applied to NotifyIcon updates with the try/finally guard
- [Text Overlay](text-overlay.md) — Same pattern for text-rendered icons
- [Color Aging](color-aging.md) — Apply AgeColor to the fill color before calling CreateCircleIcon for stale states

## See Also

- [Icon Rendering](../quality-checklist/icon-rendering.md) — Icon rendering checklist: AntiAlias, DPI, border, cache
- [NotifyIcon Disposal](../notifyicon-lifecycle/disposal.md) — Dispose icons created by CreateCircleIcon in ExitThreadCore
- [Dispose Everything on Exit](../core-principles/disposal-on-exit.md) — Dispose circle icons in ExitThreadCore
- [Lifecycle and Disposal](../quality-checklist/lifecycle-disposal.md) — Disposal checklist for circle icon objects
- [Thread Affinity is Non-Negotiable](../core-principles/thread-affinity.md) — Circle icon rendering must occur on the UI thread
