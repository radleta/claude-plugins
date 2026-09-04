---
tags: [winforms-expert/overlay, winforms-expert/input]
summary: "Rectangle.Contains is insufficient for hover detection; gate with WindowFromPoint for z-order"
---

## Rectangle.Contains Is Insufficient for Hover-Intent Detection — Use WindowFromPoint for Z-Order Gating

`Rectangle.Contains(cursor)` tells you whether a cursor's screen X,Y falls inside a window's screen rectangle, but it says nothing about whether your window is actually visible to the user at that point. On Windows, any of the following can cover your window geometrically while your window is behind them:

- A topmost taskbar context menu or system popup
- Another `TopMost=true` window (shell, systray, IME, game overlay)
- Win+Tab task switcher
- A dragged window passing through

`Form.TopMost = true` is only a relative guarantee (above non-topmost windows). Other topmost windows defeat it.

**The fix**: gate hover-intent on BOTH geometric containment AND `WindowFromPoint` z-order identity:

```csharp
// One P/Invoke call per tick; branch in C#.
var topHwndAtCursor = PInvokeOverlay.WindowAtPoint(cursor);
var cursorOverOverlay = overlayBounds.Contains(cursor) && topHwndAtCursor == overlayHwnd;
var cursorOverForm    = formHwnd != IntPtr.Zero && topHwndAtCursor == formHwnd;
```

Use `cursorOverOverlay` (not `overlayBounds.Contains(cursor)`) for dwell accumulation and post-interaction cooldown exit. Use `cursorOverEither` for the grace-corridor keep-alive check.

**Bridge-gap edge case**: between a layered overlay and a standard form anchored N pixels below it, there is an N-pixel vertical band where `WindowFromPoint` returns neither HWND. Handle with a short grace (2 ticks) using the geometric union as a secondary anchor:

```csharp
if (cursorOverEither)
    _outsideTicks = 0;
else if (unionBounds.Contains(cursor) && _outsideTicks < BridgeTraversalGraceTicks)
    /* hold — HWND-less traversal gap, don't increment yet */;
else
    _outsideTicks++;
```

**P/Invoke declaration** (use a dedicated struct to avoid name collisions with existing `POINT` used by `UpdateLayeredWindow`/`ScreenToClient`):

```csharp
[StructLayout(LayoutKind.Sequential)]
private struct POINT_WFP { public int X; public int Y; }

[DllImport("user32.dll", EntryPoint = "WindowFromPoint")]
private static extern IntPtr WindowFromPoint(POINT_WFP pt);

public static IntPtr WindowAtPoint(Point screenPoint) =>
    WindowFromPoint(new POINT_WFP { X = screenPoint.X, Y = screenPoint.Y });
```

**Diagnostic pattern**: track `_wasGeometricallyInOverlayLastTick` (set to `overlayBounds.Contains(cursor)` at end of tick) and log when the transition `geometric-in → z-order-blocked` fires:

```csharp
if (overlayBounds.Contains(cursor) && !cursorOverOverlay && _wasGeometricallyInOverlayLastTick)
    _logger.LogDebug("cursor geometrically in overlay but topHwnd != overlayHwnd — overlay covered");
```

This log line is the smoking-gun evidence for the ghost-dwell symptom.

**Impact:** Any WinForms overlay or floating window that uses cursor-position polling for hover detection. Rectangle.Contains alone is a correctness bug whenever other topmost windows exist on the same monitor.
