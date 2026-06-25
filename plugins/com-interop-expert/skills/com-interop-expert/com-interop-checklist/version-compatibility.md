---
tags: [com-interop-expert/com-interop-checklist]
summary: "8-item version compatibility checklist covering build number detection, GUID lookup tables, Windows 10 method signature differences, and multi-version testing"
---

# Version Compatibility Checklist (8 items)

- [ ] **Windows build number detected at startup** — `Environment.OSVersion.Version.Build`
- [ ] **GUID lookup table for known build ranges** — Maps build number to interface GUIDs
- [ ] **Unknown version falls back gracefully** — Does not crash on unrecognized builds
- [ ] **Version info logged for diagnostics** — Build number included in error messages
- [ ] **Separate interface definitions per version** — Or dynamic GUID injection pattern
- [ ] **Windows 10 lacks hWndOrMon parameter** — Methods have different signatures
- [ ] **IVirtualDesktopManagerInternal2 for Win10 2004+** — SetName added in extension interface
- [ ] **Testing on multiple Windows versions** — Cannot rely on single-version testing
