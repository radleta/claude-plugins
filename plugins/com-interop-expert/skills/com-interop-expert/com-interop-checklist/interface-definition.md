---
tags: [com-interop-expert/com-interop-checklist]
summary: "12-item COM interface definition checklist covering GUIDs, vtable order, ComImport attributes, marshaling, and version detection strategy"
---

# Interface Definition Checklist (12 items)

- [ ] **Correct GUIDs for target Windows version** — Verified against known-good reference (MScholtes/VirtualDesktop)
- [ ] **Vtable order matches native layout exactly** — Every method slot declared even if unused (placeholder methods)
- [ ] **ComImport + InterfaceType attributes present** — `[ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]`
- [ ] **No missing vtable slots** — Skipped methods cause all subsequent methods to call wrong native function
- [ ] **MarshalAs attributes on string parameters** — `UnmanagedType.HString` for WinRT strings, `UnmanagedType.LPWStr` for LPWSTR
- [ ] **PreserveSig on methods where you handle HRESULT** — Without it, failed HRESULT throws automatically
- [ ] **ref parameters for in/out GUIDs** — COM passes GUIDs by pointer; C# needs `ref Guid`
- [ ] **IntPtr for HWND and HMONITOR parameters** — Never use `int` or `uint` for handles
- [ ] **IObjectArray for array-returning methods** — Not `object[]` or `IVirtualDesktop[]`
- [ ] **Version detection strategy implemented** — Runtime GUID selection based on build number
- [ ] **Placeholder methods for IApplicationView** — This interface has 30+ vtable slots; every one must be declared
- [ ] **Interface inheritance not used for COM interfaces** — Each interface stands alone with `[ComImport]`; C# inheritance does not affect COM vtable
