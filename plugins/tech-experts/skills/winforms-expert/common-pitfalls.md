---
tags: [winforms-expert/pitfalls]
summary: "Top WinForms tray app pitfalls — ghost icons, GDI handle exhaustion, BalloonTip in Windows 10+, AOT and ContextMenuStrip, PowerShell BOM"
---

# Common Pitfalls

**Ghost icons after crash:**
The OS only removes tray icons when the mouse hovers over them after the owning process dies. Always set `Visible = false` before exiting, and handle `ProcessExit` for unexpected termination (see [disposal.md](notifyicon-lifecycle/disposal.md)).

**GDI handle exhaustion:**
A tray app updating icons every second leaks 1 GDI handle per update without proper DestroyIcon. At 10,000 handles (~2.7 hours), the app crashes. Always use the clone-and-destroy pattern (see [gdi-handles.md](core-principles/gdi-handles.md)).

**BalloonTip on Windows 10+:**
`ShowBalloonTip` creates an Action Center toast, not the classic balloon. The timeout parameter is ignored. The toast may be suppressed by Focus Assist / Do Not Disturb mode (see [balloon-notifications.md](notifyicon-lifecycle/balloon-notifications.md)).

**AOT and ContextMenuStrip:**
ContextMenuStrip uses reflection internally for event routing. Test thoroughly under AOT — event handlers may not fire if the linker trims the reflection targets. Use `[DynamicDependency]` attributes if needed (see [contextmenu-patterns.md](notifyicon-lifecycle/contextmenu-patterns.md)).

**PowerShell 5.1 UTF-8 BOM:**
If the tray app reads JSON state files written by PowerShell 5.1, be aware that `Set-Content -Encoding UTF8` writes a BOM. Use `[IO.File]::WriteAllText()` with `UTF8Encoding(false)` on the PowerShell side, or strip BOM bytes on the C# reader side.
