---
tags: [winforms-expert/core-principles]
summary: "Correct disposal order in ExitThreadCore to prevent ghost icons and GDI leaks"
---

# Dispose Everything on Exit

NotifyIcon is a Win32 shell component. If you do not explicitly clean up, the icon persists in the tray as a ghost until the user hovers over it (Windows only removes it on mouse-over after the owning process dies).

**Rules:**
- Set `notifyIcon.Visible = false` before disposing
- Override `ExitThreadCore()` in your ApplicationContext to dispose NotifyIcon
- Dispose the ContextMenuStrip and all dynamically created icons
- Handle `Application.ApplicationExit` as a safety net
- Handle `AppDomain.CurrentDomain.ProcessExit` for unexpected termination

## Related

- [NotifyIcon Disposal](../notifyicon-lifecycle/disposal.md) — Code pattern for ExitThreadCore disposal order
- [GDI Handles Are Unmanaged Resources](gdi-handles.md) — GDI handle disposal rules applied during cleanup
- [Thread Affinity is Non-Negotiable](thread-affinity.md) — Disposal must run on the UI thread
- [Message Pump is Mandatory](message-pump.md) — ExitThreadCore fires when Application.Run exits
- [Single-Instance Enforcement](single-instance.md) — Mutex disposal after Application.Run returns
