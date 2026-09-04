---
tags: [com-interop-expert/core-principles]
summary: "Virtual desktop service can become unavailable; catch COMException on every call and implement graceful degradation and re-initialization"
---

# Defensive Error Handling

**What it means**: The virtual desktop service can become unavailable when Explorer restarts, during Fast User Switching, or when the desktop service is disabled.

**Why it matters**: `COMException` with `E_FAIL` (0x80004005) or `RPC_E_DISCONNECTED` can occur at any time. Unhandled exceptions crash the application.

**How to implement**:
- Catch `COMException` on every COM call
- Re-initialize COM objects after Explorer restart
- Detect service unavailability and enter a polling/retry mode
- Provide meaningful degraded behavior when VD APIs are down
