---
tags: [winforms-expert/agent-mistakes]
summary: "Top 10 mistakes AI agents make when building NotifyIcon system tray apps"
---

# Top 10 System Tray Agent Mistakes

These are the errors AI agents make most often when building NotifyIcon apps. Every rule in this skill exists to prevent one of these.

| # | Mistake | Consequence |
|---|---------|-------------|
| 1 | **No DestroyIcon after GetHicon** | GDI handle leak; app crashes at 10,000 handles |
| 2 | **NotifyIcon without hidden form/context** | No message pump; icon appears but events never fire |
| 3 | **Forgetting NotifyIcon.Visible = false on exit** | Ghost icon stays in tray until mouse hovers over it |
| 4 | **Updating UI from background thread** | Cross-thread exception or silent corruption |
| 5 | **Icon.FromHandle without ownership awareness** | Dispose does nothing; handle leaks silently |
| 6 | **No Mutex for single-instance** | Multiple tray icons from duplicate launches |
| 7 | **Disposing Bitmap before NotifyIcon uses it** | Blank or corrupt icon in tray |
| 8 | **BalloonTip click handler not wired before Show** | Click events silently lost |
| 9 | **ContextMenuStrip items modified from wrong thread** | Menu corruption or InvalidOperationException |
| 10 | **No GC.KeepAlive(mutex) after Application.Run** | Mutex GC'd; second instance launches freely |
