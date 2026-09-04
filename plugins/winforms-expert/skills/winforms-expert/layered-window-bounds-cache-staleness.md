---
tags: [winforms-expert/layered-windows]
summary: "Form.Bounds remains stale on layered windows; use GetWindowRect for geometry checks"
---

## WinForms Layered Windows: Form.Bounds Is Permanently Stale — Use GetWindowRect

`UpdateLayeredWindow` positions the native HWND in Win32 screen coordinates. WinForms' managed
`Form.Bounds` property caches position in internal `_x/_y/_width/_height` fields that only
refresh when `WM_WINDOWPOSCHANGED` is processed by `Control.WndProc`. On layered+toolwindow
forms (`WS_EX_LAYERED | WS_EX_TOOLWINDOW`), `UpdateLayeredWindow` does not fire that message in
a way WinForms catches, so `Form.Bounds` returns the WinForms constructor default `(0, 0, 300, 300)`
for the entire process lifetime.

**Calling `SetBounds(x, y, w, h)` after `UpdateLayeredWindow` is insufficient.** Deploy evidence
showed `overlayBounds=0,0,300,300` on every heartbeat tick after `SetBounds` was added — the first-tick log fired at the same values, and the "overlayBounds changed to" log fired exactly once with `0,0,300,300` and never again — even while the user clicked overlay icons successfully (Win32 routes clicks via HWND hit-test, not `Form.Bounds`). Cursor positions in screen coordinates confirm the HWND was correctly positioned by `UpdateLayeredWindow`; `Form.Bounds` was simply never updated.

**The correct fix: bypass the cache entirely with Win32 GetWindowRect.**

Add a P/Invoke for `user32.GetWindowRect` and a public property on the overlay base that reads
through it on every call:

```csharp
// PInvokeOverlay.cs
[StructLayout(LayoutKind.Sequential)]
private struct RECT { public int Left, Top, Right, Bottom; }

[DllImport("user32.dll")]
[return: MarshalAs(UnmanagedType.Bool)]
private static extern bool GetWindowRect(IntPtr hwnd, out RECT lpRect);

public static Rectangle GetActualWindowRect(IntPtr hwnd)
{
    if (hwnd == IntPtr.Zero) return Rectangle.Empty;
    if (!GetWindowRect(hwnd, out var r)) return Rectangle.Empty;
    return new Rectangle(r.Left, r.Top, r.Right - r.Left, r.Bottom - r.Top);
}

// OverlayWindowBase.cs
public Rectangle ActualScreenBounds =>
    IsHandleCreated ? PInvokeOverlay.GetActualWindowRect(Handle) : Rectangle.Empty;
```

External code that checks cursor containment must call `ActualScreenBounds`, NOT `Bounds`. Bind it once per tick to avoid multiple P/Invokes:

```csharp
var overlayBounds = _overlayWindow.ActualScreenBounds;  // once per tick; reuse below
```

**Keep the `SetBounds` call as defense-in-depth.** Any code that reads `Form.Bounds` rather
than `ActualScreenBounds` will at least see something closer to reality on the next refresh
cycle, even if the primary containment check uses the live Win32 read.

**Do NOT trust `Form.Bounds` for geometry/containment checks on layered forms.** The diagnostic
pattern — log both `Form.Bounds` and `ActualScreenBounds` in the heartbeat — makes the
discrepancy permanently visible in the log and confirms when the fix is working.

**Supersedes:** Earlier guidance that `SetBounds` alone is sufficient. Insufficient; `GetWindowRect` required.

**Impact:** Any WinForms `Form` subclass that uses `UpdateLayeredWindow` for positioning and
whose bounds are read externally for hit-testing, cursor-containment, or geometry calculations.
The `WS_EX_LAYERED | WS_EX_TOOLWINDOW` combination is the confirmed trigger; the root cause is
`WM_WINDOWPOSCHANGED` not being processed by WinForms' `Control.WndProc` in this configuration.
