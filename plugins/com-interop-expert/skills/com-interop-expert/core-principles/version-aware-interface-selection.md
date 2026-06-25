---
tags: [com-interop-expert/core-principles]
summary: "Select COM interface GUIDs based on detected Windows version to avoid COMException on version upgrades"
---

# Version-Aware Interface Selection

**What it means**: The undocumented virtual desktop COM interfaces change GUIDs across Windows builds. A single set of interface definitions will not work across Windows 10, Windows 11, and Windows 11 24H2.

**Why it matters**: Hardcoded GUIDs cause `COMException` or `InvalidCastException` on mismatched Windows versions. Applications silently fail or crash on version upgrades.

**How to implement**:
- Detect the Windows build number at startup via `Environment.OSVersion` or registry
- Select the correct interface GUIDs based on detected version
- Provide graceful fallback when the version is unrecognized
- Consider a version-strategy pattern that encapsulates GUID selection
