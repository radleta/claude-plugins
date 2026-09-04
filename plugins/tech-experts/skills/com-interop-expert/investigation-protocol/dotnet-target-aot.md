---
tags: [com-interop-expert/investigation-protocol]
summary: "Checklist for identifying .NET target version and whether NativeAOT or IL trimming is required"
---

# .NET Target and AOT Requirements

- [ ] What .NET version? (.NET Framework 4.x, .NET 8, .NET 9, .NET 10)
- [ ] Is NativeAOT publishing required?
- [ ] Is IL trimming enabled?

**Why it matters**: NativeAOT requires `GeneratedComInterface` instead of `ComImport`. Legacy .NET Framework requires the classic `ComImport` pattern.
