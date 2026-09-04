---
tags: [com-interop-expert/investigation-protocol]
summary: "Checklist of documented vs undocumented virtual desktop capabilities to identify which APIs are needed"
---

# Required Capabilities

- [ ] Check if window is on current desktop? (documented API)
- [ ] Get desktop ID for a window? (documented API)
- [ ] Move window to desktop? (documented API, with undocumented fallback)
- [ ] Switch active desktop? (undocumented API only)
- [ ] Enumerate all desktops? (undocumented API only)
- [ ] Get/set desktop names? (undocumented API only)
- [ ] Pin/unpin windows across desktops? (undocumented API only)
- [ ] Create/remove desktops? (undocumented API only)

**Why it matters**: If only documented operations are needed, the implementation is simpler and more stable. Undocumented operations increase fragility.
