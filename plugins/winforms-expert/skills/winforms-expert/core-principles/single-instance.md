---
tags: [winforms-expert/core-principles]
summary: "Named Mutex single-instance enforcement with GC.KeepAlive to prevent duplicate tray icons"
---

# Single-Instance Enforcement

System tray apps should only run one instance. Without enforcement, each launch creates another icon.

**Rules:**
- Use a named Mutex with a unique name (include a GUID)
- Check `new Mutex(true, name, out bool createdNew)` — if `!createdNew`, exit
- Call `GC.KeepAlive(mutex)` after `Application.Run()` to prevent GC during the app lifetime
- Optionally signal the existing instance via named pipe or window message to bring it to front

## Related

- [Message Pump is Mandatory](message-pump.md) — The message pump that the single instance must establish
- [Thread Affinity is Non-Negotiable](thread-affinity.md) — Mutex must be held on the UI thread through Application.Run
- [GDI Handles Are Unmanaged Resources](gdi-handles.md) — GDI handle lifecycle for the running instance
- [Dispose Everything on Exit](disposal-on-exit.md) — Mutex disposal in ExitThreadCore after Application.Run
