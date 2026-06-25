---
tags: [winforms-expert/core-principles]
summary: "Core WinForms tray app principles: message pump, GDI handles, thread affinity, disposal, single-instance"
---

# Core Principles

Five foundational rules for building correct NotifyIcon system tray applications.

## Pages

- [Message Pump is Mandatory](message-pump.md) — ApplicationContext + Application.Run required for tray event delivery
- [GDI Handles Are Unmanaged Resources](gdi-handles.md) — DestroyIcon, clone pattern, and handle lifecycle rules
- [Thread Affinity is Non-Negotiable](thread-affinity.md) — UI thread marshalling rules for NotifyIcon and controls
- [Dispose Everything on Exit](disposal-on-exit.md) — Correct disposal order to prevent ghost icons and leaks
- [Single-Instance Enforcement](single-instance.md) — Named Mutex pattern with GC.KeepAlive guard
