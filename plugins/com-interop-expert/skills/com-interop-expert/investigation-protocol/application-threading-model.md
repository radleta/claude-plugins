---
tags: [com-interop-expert/investigation-protocol]
summary: "Checklist for determining application threading model and STA requirements before implementing COM interop"
---

# Application Threading Model

- [ ] Is the application a console app, WinForms, WPF, or service?
- [ ] What thread will make COM calls? (UI thread, background, timer)
- [ ] Is `[STAThread]` already applied?

**Why it matters**: STA requirement affects architecture. Services and console apps need explicit STA thread management.
