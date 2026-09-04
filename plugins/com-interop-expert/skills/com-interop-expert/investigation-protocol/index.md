---
tags: [com-interop-expert/investigation-protocol]
summary: "Navigation hub for the 4 investigation checklists to gather before implementing COM interop for virtual desktops"
---

# Investigation Protocol

Before implementing COM interop for virtual desktops, gather these facts.

## Pages

- [Windows Version and Build](windows-version-build.md) — Determine target Windows version, minimum build, and multi-version support requirements
- [.NET Target and AOT Requirements](dotnet-target-aot.md) — Identify .NET version and whether NativeAOT or IL trimming is required
- [Application Threading Model](application-threading-model.md) — Determine what thread will make COM calls and STA status
- [Required Capabilities](required-capabilities.md) — Identify which documented vs undocumented operations are needed
