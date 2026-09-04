---
tags: [com-interop-expert/patterns]
summary: "Two-strategy window movement pattern: documented API for owned windows, undocumented IApplicationView path for cross-process window movement"
---

# Window Movement Pattern

Moving a window to another desktop uses a two-strategy approach:

```csharp
public void MoveWindowToDesktop(IntPtr hWnd, Guid targetDesktopId,
    IVirtualDesktopManager vdm,
    IVirtualDesktopManagerInternal vdmi,
    IApplicationViewCollection viewCollection)
{
    // Strategy 1: Documented API (works for windows you own)
    try
    {
        vdm.MoveWindowToDesktop(hWnd, ref targetDesktopId);
        return;
    }
    catch (COMException)
    {
        // Fails for windows owned by other processes
    }

    // Strategy 2: Undocumented API via IApplicationView (works for any window)
    try
    {
        viewCollection.GetViewForHwnd(hWnd, out var view);
        var targetDesktop = vdmi.FindDesktop(ref targetDesktopId);
        vdmi.MoveViewToDesktop(view, targetDesktop);
    }
    catch (COMException ex)
    {
        // Log and handle — desktop service may be unavailable
        throw new InvalidOperationException(
            $"Failed to move window to desktop: {ex.ErrorCode:X8}", ex);
    }
}
```

**Key distinction**: `IVirtualDesktopManager.MoveWindowToDesktop` only works for windows your process owns. For cross-process window movement (the common case for a system tray tool), you must use `IVirtualDesktopManagerInternal.MoveViewToDesktop` with an `IApplicationView` obtained from `IApplicationViewCollection.GetViewForHwnd`.
