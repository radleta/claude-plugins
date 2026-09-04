---
tags: [com-interop-expert/com-interface-definitions]
summary: "Stable CLSIDs and version-dependent IID reference table across Windows 10, Windows 11, and Windows 11 24H2"
---

# Version-Dependent GUIDs

The following interface GUIDs change across Windows versions. The CLSIDs (service identifiers) remain stable.

**Stable CLSIDs (all versions)**:

| Name | CLSID |
|------|-------|
| ImmersiveShell | `C2F03A33-21F5-47FA-B4BB-156362A2F239` |
| VirtualDesktopManagerInternal (service) | `C5E0CDCA-7B6E-41B2-9FC4-D93975CC467B` |
| VirtualDesktopManager | `AA509086-5CA9-4C25-8F95-589D3C07B48A` |
| VirtualDesktopPinnedApps (service) | `B5A399E7-1C87-46B8-88E9-FC5747B171BD` |

**Version-dependent IIDs (interface identifiers)**:

| Interface | Windows 10 | Windows 11 (pre-24H2) | Windows 11 24H2 |
|-----------|-----------|----------------------|-----------------|
| IVirtualDesktop | `FF72FFDD-BE7E-43FC-9C03-AD81681E88E4` | varies by build | `3F07F4BE-B107-441A-AF0F-39D82529072C` |
| IVirtualDesktopManagerInternal | `F31574D6-B682-4CDC-BD56-1827860ABEC6` | `53F5CA0B-158F-4124-900C-057158060B27` | `53F5CA0B-158F-4124-900C-057158060B27` |
| IApplicationView | `372E1D3B-38D3-42E4-A15B-8AB2B178F513` | `372E1D3B-38D3-42E4-A15B-8AB2B178F513` | `372E1D3B-38D3-42E4-A15B-8AB2B178F513` |
| IApplicationViewCollection | `1841C6D7-4F9D-42C0-AF41-8747538F10E5` | `1841C6D7-4F9D-42C0-AF41-8747538F10E5` | `1841C6D7-4F9D-42C0-AF41-8747538F10E5` |
