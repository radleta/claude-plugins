---
tags: [com-interop-expert/com-interop-checklist]
summary: "8-item window management checklist covering two-strategy move, thread input attachment, EnumWindows correctness, and process ID handling"
---

# Window Management Checklist (8 items)

- [ ] **Two-strategy window move** — Try documented API first, fall back to IApplicationView
- [ ] **Thread input attachment for SetForegroundWindow** — Prevents taskbar icon flashing
- [ ] **AttachThreadInput cleaned up in finally block** — Leaked attachment causes input issues
- [ ] **EnumWindows callback returns bool correctly** — `false` stops enumeration, `true` continues
- [ ] **GetWindowThreadProcessId out parameter handled** — Process ID is an `out int`, not return value
- [ ] **Window visibility checked before operations** — `IsWindowVisible` filter on enumeration
- [ ] **StringBuilder pre-allocated for GetWindowText** — Size 256+ characters
- [ ] **Process.GetProcessById wrapped in try-catch** — Process may have exited
