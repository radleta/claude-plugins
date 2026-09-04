---
tags: [com-interop-expert/core-principles]
summary: "Only IVirtualDesktopManager is documented; all internal shell interfaces are reverse-engineered and can change without notice"
---

# Undocumented API Fragility

**What it means**: Only `IVirtualDesktopManager` is officially documented by Microsoft. All internal interfaces (`IVirtualDesktopManagerInternal`, `IApplicationView`, `IVirtualDesktop`) are reverse-engineered and can change without notice.

**Why it matters**: Windows updates can break COM interface definitions overnight. Applications must handle failures gracefully rather than assuming interfaces are stable.

**How to implement**:
- Wrap all undocumented API calls in try-catch for `COMException`
- Provide fallback behavior when internal interfaces are unavailable
- Log interface failures with build number for diagnostics
- Keep interface definitions isolated for easy replacement
