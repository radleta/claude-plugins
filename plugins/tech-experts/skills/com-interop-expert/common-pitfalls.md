---
tags: [com-interop-expert/pitfalls]
summary: "Common COM Interop pitfalls: vtable slot mismatches, wrong apartment model, hardcoded GUIDs, Marshal.ReleaseComObject abuse, Explorer restart not handled, and cross-process window moves"
---

# Common Pitfalls

**Vtable slot mismatch** — The most dangerous mistake. If you declare an `IApplicationView` interface with 28 methods but the native interface has 30, every method after slot 28 calls the wrong native function. This causes corrupted state, access violations, or silent data corruption. Always count vtable slots against a reference implementation.

**Wrong apartment model** — Console apps and background threads default to MTA. All shell COM objects require STA. Symptoms: `COMException` with obscure codes, random hangs, or methods that silently return wrong data.

**Hardcoded GUIDs** — Works on your machine, breaks on customers' machines with different Windows versions. Always detect and select GUIDs at runtime.

**Marshal.ReleaseComObject abuse** — Calling `ReleaseComObject` on a COM object that is still referenced by managed code (e.g., stored in a variable, passed to another method, or captured in a closure) causes `InvalidComObjectException` at a random future point. For virtual desktop objects, GC release is almost always sufficient.

**Forgetting to re-initialize after Explorer restart** — Users press Ctrl+Shift+Esc and restart Explorer, or Explorer crashes. All COM interface pointers become invalid. The next COM call throws `RPC_E_DISCONNECTED`. Your service must detect this and re-initialize.

**MoveWindowToDesktop failing silently for other-process windows** — The documented `IVirtualDesktopManager.MoveWindowToDesktop` only works for windows your process owns. For a system tray tool managing other applications' windows, you must use the undocumented `MoveViewToDesktop` path (see [window-movement-pattern.md](window-movement-pattern.md)).
