---
tags: [com-interop-expert/com-interface-definitions]
summary: "IVirtualDesktopManager — the only officially documented COM interface for virtual desktops, stable across all Windows versions"
---

# Documented Interface: IVirtualDesktopManager

This is the only officially documented interface. Stable across Windows versions.

```csharp
// CLSID for CoCreateInstance
// {AA509086-5CA9-4C25-8F95-589D3C07B48A}
[ComImport]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
[Guid("A5CD92FF-29BE-454C-8D04-D82879FB3F1B")]
public interface IVirtualDesktopManager
{
    bool IsWindowOnCurrentVirtualDesktop(IntPtr topLevelWindow);
    Guid GetWindowDesktopId(IntPtr topLevelWindow);
    void MoveWindowToDesktop(IntPtr topLevelWindow, ref Guid desktopId);
}
```

**Activation**:
```csharp
var vdm = (IVirtualDesktopManager)Activator.CreateInstance(
    Type.GetTypeFromCLSID(new Guid("AA509086-5CA9-4C25-8F95-589D3C07B48A"))!);
```
