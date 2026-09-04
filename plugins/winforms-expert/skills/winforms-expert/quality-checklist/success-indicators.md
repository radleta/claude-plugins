---
tags: [winforms-expert/quality-checklist]
summary: "Success criteria for production-ready WinForms tray apps — startup, menus, GDI handles, balloons, exit, single-instance, DPI, threading"
---

# Success Indicators

You have successfully built a system tray app when:
- The icon appears immediately on startup with correct initial state
- Context menu responds to right-click with all items functional
- Icon updates do not leak GDI handles (verify in Task Manager over 30+ minutes)
- BalloonTip clicks navigate to the correct action
- The icon disappears cleanly on exit (no ghost)
- Only one instance can run at a time
- The app works correctly at 150% DPI scaling
- No cross-thread exceptions under any code path
