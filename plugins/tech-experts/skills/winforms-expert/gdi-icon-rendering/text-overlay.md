---
tags: [winforms-expert/gdi-icon-rendering]
summary: "Draw centered text on a 16px tray icon with MeasureString for pixel-perfect alignment"
---

# Text Overlay on Icon

```csharp
Icon CreateTextIcon(string text, Color bg, Color fg, int size = 16)
{
    using var bmp = new Bitmap(size, size);
    using var g = Graphics.FromImage(bmp);
    g.SmoothingMode = SmoothingMode.AntiAlias;
    g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;

    using var bgBrush = new SolidBrush(bg);
    g.FillEllipse(bgBrush, 0, 0, size - 1, size - 1);

    using var font = new Font("Segoe UI", size * 0.55f, FontStyle.Bold, GraphicsUnit.Pixel);
    using var fgBrush = new SolidBrush(fg);
    var measure = g.MeasureString(text, font);
    float x = (size - measure.Width) / 2f;
    float y = (size - measure.Height) / 2f;
    g.DrawString(text, font, fgBrush, x, y);

    IntPtr hIcon = bmp.GetHicon();
    var icon = (Icon)Icon.FromHandle(hIcon).Clone();
    DestroyIcon(hIcon);
    return icon;
}
```

## Related

- [GDI Handles Are Unmanaged Resources](../core-principles/gdi-handles.md) — Rationale for the clone-and-destroy pattern and the 10,000 handle limit
- [Circle Icon](circle-icon.md) — Same pattern for circle-only icons
- [Icon Updates](../notifyicon-lifecycle/icon-updates.md) — Same pattern applied to NotifyIcon updates with the try/finally guard
- [Color Aging](color-aging.md) — Apply AgeColor to the background color before calling CreateTextIcon for stale states

## See Also

- [Icon Rendering](../quality-checklist/icon-rendering.md) — Icon rendering checklist: DPI, AntiAlias, text centering, cache
- [NotifyIcon Disposal](../notifyicon-lifecycle/disposal.md) — Dispose icons created by CreateTextIcon in ExitThreadCore
- [Dispose Everything on Exit](../core-principles/disposal-on-exit.md) — Dispose text icons in ExitThreadCore
- [Lifecycle and Disposal](../quality-checklist/lifecycle-disposal.md) — Disposal checklist for text icon objects
- [Thread Affinity is Non-Negotiable](../core-principles/thread-affinity.md) — Text icon rendering must occur on the UI thread
