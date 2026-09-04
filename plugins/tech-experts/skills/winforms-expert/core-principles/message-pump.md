---
tags: [winforms-expert/core-principles]
summary: "ApplicationContext + Application.Run required for tray event delivery — console Main blocks events"
---

# Message Pump is Mandatory

NotifyIcon relies on a Win32 window to receive shell notification messages. Without a message pump, the icon appears but context menus, balloon clicks, and double-click events never fire.

**Rules:**
- Always use `Application.Run(context)` with a custom `ApplicationContext` for tray-only apps
- Never use a console app `Main` that blocks on `Console.ReadLine()` — no message pump
- The ApplicationContext creates an internal hidden window that processes WM_NOTIFYICON messages
- Call `Application.EnableVisualStyles()` and `Application.SetHighDpiMode(HighDpiMode.SystemAware)` before `Application.Run`

## Related

- [Thread Affinity is Non-Negotiable](thread-affinity.md) — Thread affinity established by the message pump
- [Single-Instance Enforcement](single-instance.md) — Mutex checked before Application.Run is called
- [GDI Handles Are Unmanaged Resources](gdi-handles.md) — GDI lifecycle managed within the message loop
- [Dispose Everything on Exit](disposal-on-exit.md) — ExitThreadCore fires when Application.Run exits
