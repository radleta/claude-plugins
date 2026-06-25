---
tags: [com-interop-expert/core-principles]
summary: "Navigation hub for the 5 core COM Interop principles governing version awareness, API fragility, lifetime discipline, STA threading, and error handling"
---

# Core Principles

Five principles that govern correct COM Interop integration in .NET applications.

## Pages

- [Version-Aware Interface Selection](version-aware-interface-selection.md) — Select GUIDs based on detected Windows version; hardcoded GUIDs break on version upgrades
- [Undocumented API Fragility](undocumented-api-fragility.md) — Only IVirtualDesktopManager is documented; all internal interfaces can change without notice
- [COM Lifetime Discipline](com-lifetime-discipline.md) — RCW lifetime management; when to use Marshal.ReleaseComObject vs GC release
- [STA Thread Requirement](sta-thread-requirement.md) — Shell COM objects require STA initialization; MTA threads fail or deadlock
- [Defensive Error Handling](defensive-error-handling.md) — Virtual desktop service can become unavailable; catch COMException on every call
