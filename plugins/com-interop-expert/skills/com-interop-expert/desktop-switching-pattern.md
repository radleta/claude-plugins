---
tags: [com-interop-expert/patterns]
summary: "Desktop switching pattern with animation fallback and focus management using thread input attachment to prevent taskbar flashing"
---

# Desktop Switching Pattern

Switching desktops requires careful focus management to avoid taskbar icon flashing:

```csharp
public void SwitchToDesktop(IVirtualDesktopManagerInternal manager,
    IVirtualDesktop targetDesktop, IntPtr hWndOrMon, bool animate = true)
{
    try
    {
        if (animate)
        {
            manager.SwitchDesktopWithAnimation(hWndOrMon, targetDesktop);
        }
        else
        {
            manager.SwitchDesktop(hWndOrMon, targetDesktop);
        }
    }
    catch (COMException ex)
    {
        // Fall back to non-animated switch
        if (animate)
        {
            try { manager.SwitchDesktop(hWndOrMon, targetDesktop); }
            catch (COMException) { /* Desktop service unavailable */ }
        }
    }
}
```

## Focus Management During Switch

```csharp
/// <summary>
/// Make a window visible and focused after switching desktops.
/// Uses thread input attachment to prevent taskbar flashing.
/// </summary>
public static void MakeWindowVisible(IntPtr hWnd)
{
    uint foregroundThreadId = GetWindowThreadProcessId(GetForegroundWindow(), out _);
    uint currentThreadId = GetCurrentThreadId();
    uint targetThreadId = GetWindowThreadProcessId(hWnd, out _);

    // Attach to foreground thread to get SetForegroundWindow permission
    if (foregroundThreadId != currentThreadId)
        AttachThreadInput(currentThreadId, foregroundThreadId, true);
    if (targetThreadId != currentThreadId)
        AttachThreadInput(currentThreadId, targetThreadId, true);

    try
    {
        ShowWindow(hWnd, SW_RESTORE);
        SetForegroundWindow(hWnd);
    }
    finally
    {
        if (foregroundThreadId != currentThreadId)
            AttachThreadInput(currentThreadId, foregroundThreadId, false);
        if (targetThreadId != currentThreadId)
            AttachThreadInput(currentThreadId, targetThreadId, false);
    }
}
```
