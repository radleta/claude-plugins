---
tags: [winforms-expert/gdi-icon-rendering]
summary: "Lerp color toward gray to dim icons for stale or inactive session states"
---

# Color Aging / Darkening

To dim icons for stale/aging sessions, lerp toward gray:

```csharp
Color AgeColor(Color original, double ageFactor)
{
    // ageFactor: 0.0 = fresh, 1.0 = fully aged
    ageFactor = Math.Clamp(ageFactor, 0.0, 1.0);
    int r = (int)(original.R + (128 - original.R) * ageFactor);
    int g = (int)(original.G + (128 - original.G) * ageFactor);
    int b = (int)(original.B + (128 - original.B) * ageFactor);
    int a = (int)(original.A * (1.0 - ageFactor * 0.5));
    return Color.FromArgb(a, r, g, b);
}
```

## Related

- [Circle Icon](circle-icon.md) — Circle icon rendered with a fill color; apply AgeColor to the fill before rendering
- [Text Overlay](text-overlay.md) — Text icon rendered with background color; apply AgeColor to the background for stale states

## See Also

- [Icon Updates](../notifyicon-lifecycle/icon-updates.md) — Icon update pattern — apply AgeColor to the fill before UpdateIcon
- [NotifyIcon Disposal](../notifyicon-lifecycle/disposal.md) — Disposal pattern for icon objects returned by color-aging functions
- [GDI Handles Are Unmanaged Resources](../core-principles/gdi-handles.md) — GDI handle management for icons rendered with AgeColor
- [Icon Rendering](../quality-checklist/icon-rendering.md) — Icon rendering checklist covering DPI, AntiAlias, caching
- [Dispose Everything on Exit](../core-principles/disposal-on-exit.md) — Dispose color-aged icon objects in ExitThreadCore
