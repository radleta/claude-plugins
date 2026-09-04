---
tags: [winforms-expert/core-principles]
summary: "NotifyIcon thread affinity rules — UI marshalling with Invoke and WinForms Timer"
---

# Thread Affinity is Non-Negotiable

All WinForms controls (including NotifyIcon) have thread affinity to the thread that created them. Accessing from another thread causes `InvalidOperationException` or silent corruption.

**Rules:**
- Create NotifyIcon on the UI thread (inside ApplicationContext constructor or after Application.Run starts)
- Use `SynchronizationContext.Current.Post()` or `Control.Invoke()` to marshal calls to the UI thread
- For timer-based polling, use `System.Windows.Forms.Timer` (fires on UI thread) not `System.Threading.Timer`
- Background work (file I/O, network) can run on thread pool, but marshal results back to UI thread

## Related

- [GDI Handles Are Unmanaged Resources](gdi-handles.md) — GDI handle lifecycle rules that must run on the UI thread
- [Single-Instance Enforcement](single-instance.md) — Mutex lifecycle also tied to UI thread startup
- [Message Pump is Mandatory](message-pump.md) — The message pump that creates the UI thread affinity
- [Dispose Everything on Exit](disposal-on-exit.md) — Disposal must happen on the UI thread in ExitThreadCore
