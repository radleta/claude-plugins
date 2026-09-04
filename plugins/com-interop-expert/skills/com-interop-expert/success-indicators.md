---
tags: [com-interop-expert/qa]
summary: "Post-implementation success indicators confirming correct COM Interop integration: version-aware GUIDs, STA activation, error handling, and graceful degradation"
---

# Success Indicators

You have correctly applied this skill when:
- All COM interfaces have version-appropriate GUIDs
- Vtable slot counts match a reference implementation exactly
- COM activation happens on an STA thread
- Every COM call is wrapped in try-catch for `COMException`
- Window movement uses the two-strategy fallback pattern (see [window-movement-pattern.md](window-movement-pattern.md))
- The application gracefully degrades when virtual desktop APIs are unavailable
- Explorer restart triggers COM re-initialization (see [error-handling-reference.md](error-handling-reference.md))
- Focus management uses thread input attachment (see [desktop-switching-pattern.md](desktop-switching-pattern.md))
