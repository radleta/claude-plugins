---
tags: [winforms-expert/layered-windows]
summary: "SetBounds after UpdateLayeredWindow syncs managed Bounds; defense-in-depth pattern"
---

## WinForms Layered Windows: UpdateLayeredWindow Does Not Update Form.Bounds

`UpdateLayeredWindow` (via `PInvokeOverlay.SetBitmap`) positions and sizes the native HWND in Win32 screen coordinates, but does NOT update WinForms' managed `Form.Bounds` property. Any code that reads `this.Bounds` — including code in other classes passed a reference to the form — sees the WinForms default `{X=0,Y=0,Width=300,Height=300}` for the entire process lifetime.

**Why this matters:** Win32 mouse routing uses HWND hit-test, not `Form.Bounds`. So the window renders and receives clicks at the correct screen position (via `UpdateLayeredWindow`), while any managed code checking `Bounds` for cursor containment or geometry sees a stale default and behaves incorrectly.

**Partial mitigation:** After each `UpdateLayeredWindow` call, call `SetBounds(x, y, width, height)` to sync the managed property. This issues a `SetWindowPos` at the same coordinates — WinForms collapses it via `WM_WINDOWPOSCHANGING` when position/size are unchanged, so it's cheap on subsequent identical calls.

```csharp
PInvokeOverlay.SetBitmap(Handle, composite, position);
// Sync managed Form.Bounds — UpdateLayeredWindow positions the HWND via Win32
// but does NOT update the managed Bounds property. Callers reading Bounds see
// the WinForms default (0,0,300,300) without this call.
SetBounds(position.X, position.Y, totalWidth, _config.Size);
```

**Pattern:** This must be called after EVERY `UpdateLayeredWindow` invocation that changes the window's position or size. It is not called when the window is hidden (`items.Count == 0` → `Visible = false` early return).

**Important caveat:** `SetBounds` alone does NOT guarantee `Form.Bounds` stays current on all Windows builds. For geometry/containment checks, prefer [layered-window-bounds-cache-staleness.md](layered-window-bounds-cache-staleness.md) which uses `GetWindowRect` for live reads. Keep `SetBounds` as defense-in-depth so at least external read-once callers see *something* closer to reality.

**Impact:** Any WinForms `Form` subclass that uses `UpdateLayeredWindow` for positioning (instead of `SetWindowPos` or WinForms layout), and whose `Bounds` is read by external code for geometry/containment checks.
