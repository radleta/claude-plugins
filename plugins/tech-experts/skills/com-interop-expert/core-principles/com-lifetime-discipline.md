---
tags: [com-interop-expert/core-principles]
summary: "RCW lifetime management patterns — prefer GC release, use Marshal.ReleaseComObject only when controlling release timing explicitly"
---

# COM Lifetime Discipline

**What it means**: COM objects obtained through interop have reference-counted lifetimes managed by Runtime Callable Wrappers (RCWs). Mismanagement causes leaks or use-after-release crashes.

**Why it matters**: COM leaks prevent the shell from releasing desktop objects. Use-after-release causes `InvalidComObjectException` crashes at unpredictable times.

**How to implement**:
- Prefer letting the GC handle RCW release in most cases
- Use `Marshal.ReleaseComObject` only when you must control release timing
- Never call `ReleaseComObject` on objects that may be referenced elsewhere
- Consider `Marshal.FinalReleaseComObject` only for complete ownership scenarios
