---
tags: [com-interop-expert/investigation-protocol]
summary: "Checklist for determining target Windows version, minimum build number, and multi-version support requirements"
---

# Windows Version and Build

- [ ] What is the target Windows version? (10, 11, 11 24H2, Server)
- [ ] What is the minimum supported build number?
- [ ] Must the application support multiple Windows versions simultaneously?
- [ ] Is Windows Insider / preview build support required?

**Why it matters**: Interface GUIDs change across major builds. Multi-version support requires a version-detection strategy.
