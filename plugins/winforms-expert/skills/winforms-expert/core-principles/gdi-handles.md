---
tags: [winforms-expert/core-principles]
summary: "GDI+ handle lifecycle: DestroyIcon, clone-and-destroy pattern, 10,000 handle limit"
---

# GDI Handles Are Unmanaged Resources

Every `Bitmap`, `Graphics`, `Pen`, `Brush`, `Font`, and `Icon` wraps a GDI/GDI+ handle. Windows limits each process to 10,000 GDI objects. System tray apps that update icons frequently (timers, status changes) hit this limit fast.

**Rules:**
- Wrap every GDI+ object in `using` statements or dispose explicitly in `finally`
- After `bitmap.GetHicon()`, you own the HICON — call `DestroyIcon(hIcon)` via P/Invoke after creating the Icon
- `Icon.FromHandle(hIcon)` does NOT take ownership — `icon.Dispose()` will NOT call DestroyIcon
- Clone pattern: `var icon = (Icon)Icon.FromHandle(hIcon).Clone(); DestroyIcon(hIcon);` — the clone owns its handle
- Cache icons when possible; do not recreate on every poll tick
- Monitor handle count during development: Task Manager > Details > add "GDI Objects" column

**DestroyIcon P/Invoke:**
```csharp
[DllImport("user32.dll", SetLastError = true)]
static extern bool DestroyIcon(IntPtr hIcon);
```

## Related

- [Icon Updates](../notifyicon-lifecycle/icon-updates.md) — Worked example of the clone-and-destroy pattern applied to NotifyIcon updates
- [Circle Icon](../gdi-icon-rendering/circle-icon.md) — Worked example of the clone-and-destroy pattern applied to GDI+ icon rendering
- [Thread Affinity is Non-Negotiable](thread-affinity.md) — GDI calls must happen on the UI thread
- [Dispose Everything on Exit](disposal-on-exit.md) — GDI objects disposed in ExitThreadCore
- [Single-Instance Enforcement](single-instance.md) — Co-principle for robust tray app lifecycle
- [Message Pump is Mandatory](message-pump.md) — The message loop that drives GDI update cycles
