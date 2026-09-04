---
tags: [com-interop-expert/com-interface-definitions]
summary: "Shell internal COM interface definitions: IServiceProvider10, IVirtualDesktopManagerInternal (Win10 and Win11), IVirtualDesktop, IApplicationView, IApplicationViewCollection, IVirtualDesktopPinnedApps, IObjectArray"
---

# Undocumented Interfaces: Shell Internal APIs

These require obtaining a service from the Immersive Shell COM object.

**Service Provider (stable GUID)**:
```csharp
[ComImport]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
[Guid("6D5140C1-7436-11CE-8034-00AA006009FA")]
public interface IServiceProvider10
{
    [return: MarshalAs(UnmanagedType.IUnknown)]
    object QueryService(ref Guid service, ref Guid riid);
}
```

**Activation of internal interfaces**:
```csharp
// CLSID_ImmersiveShell — stable across versions
var shell = (IServiceProvider10)Activator.CreateInstance(
    Type.GetTypeFromCLSID(new Guid("C2F03A33-21F5-47FA-B4BB-156362A2F239"))!);

// Query for IVirtualDesktopManagerInternal
var clsid = new Guid("C5E0CDCA-7B6E-41B2-9FC4-D93975CC467B");
var iid = GetManagerInternalIID(); // version-dependent
var vdmi = (IVirtualDesktopManagerInternal)shell.QueryService(ref clsid, ref iid);
```

**IVirtualDesktopManagerInternal (Windows 11 / 24H2)**:
```csharp
[ComImport]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
[Guid("53F5CA0B-158F-4124-900C-057158060B27")]
public interface IVirtualDesktopManagerInternal
{
    int GetCount(IntPtr hWndOrMon);
    void MoveViewToDesktop(IApplicationView pView, IVirtualDesktop desktop);
    bool CanViewMoveDesktops(IApplicationView pView);
    IVirtualDesktop GetCurrentDesktop(IntPtr hWndOrMon);
    void GetDesktops(IntPtr hWndOrMon, out IObjectArray desktops);
    [PreserveSig]
    int GetAdjacentDesktop(IVirtualDesktop pDesktopReference, int uDirection,
        out IVirtualDesktop ppAdjacentDesktop);
    void SwitchDesktop(IntPtr hWndOrMon, IVirtualDesktop desktop);
    IVirtualDesktop CreateDesktop(IntPtr hWndOrMon);
    void MoveDesktop(IVirtualDesktop desktop, IntPtr hWndOrMon, int nIndex);
    void RemoveDesktop(IVirtualDesktop pRemove, IVirtualDesktop pFallbackDesktop);
    IVirtualDesktop FindDesktop(ref Guid desktopId);
    void GetDesktopSwitchIncludeExcludeViews(IVirtualDesktop desktop,
        out IObjectArray o1, out IObjectArray o2);
    void SetDesktopName(IVirtualDesktop desktop,
        [MarshalAs(UnmanagedType.HString)] string name);
    void SetDesktopWallpaper(IVirtualDesktop desktop,
        [MarshalAs(UnmanagedType.HString)] string path);
    void UpdateWallpaperPathForAllDesktops(
        [MarshalAs(UnmanagedType.HString)] string path);
    void CopyDesktopState(IApplicationView pView0, IApplicationView pView1);
    IVirtualDesktop GetDesktopByNumber(IntPtr hWndOrMon, int number);
    void GetLastActiveDesktop(out IVirtualDesktop desktop);
    void SwitchDesktopWithAnimation(IntPtr hWndOrMon, IVirtualDesktop desktop);
}
```

**IVirtualDesktopManagerInternal (Windows 10)**:
```csharp
[ComImport]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
[Guid("F31574D6-B682-4CDC-BD56-1827860ABEC6")]
public interface IVirtualDesktopManagerInternal_Win10
{
    int GetCount();
    void MoveViewToDesktop(IApplicationView pView, IVirtualDesktop desktop);
    bool CanViewMoveDesktops(IApplicationView pView);
    IVirtualDesktop GetCurrentDesktop();
    void GetDesktops(out IObjectArray desktops);
    [PreserveSig]
    int GetAdjacentDesktop(IVirtualDesktop pDesktopReference, int uDirection,
        out IVirtualDesktop ppAdjacentDesktop);
    void SwitchDesktop(IVirtualDesktop desktop);
    IVirtualDesktop CreateDesktop();
    void RemoveDesktop(IVirtualDesktop pRemove, IVirtualDesktop pFallbackDesktop);
    IVirtualDesktop FindDesktop(ref Guid desktopId);
}
```

Note: Windows 10 methods lack the `IntPtr hWndOrMon` parameter that Windows 11 added for multi-monitor awareness.

**IVirtualDesktop**:
```csharp
// Windows 10 GUID: FF72FFDD-BE7E-43FC-9C03-AD81681E88E4
// Windows 11 24H2 GUID: 3F07F4BE-B107-441A-AF0F-39D82529072C
[ComImport]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
[Guid("3F07F4BE-B107-441A-AF0F-39D82529072C")] // 24H2
public interface IVirtualDesktop
{
    bool IsViewVisible(IApplicationView pView);
    Guid GetId();
    [return: MarshalAs(UnmanagedType.HString)]
    string GetName();
    [return: MarshalAs(UnmanagedType.HString)]
    string GetWallpaperPath();
    bool IsRemote();
}
```

**IApplicationView**:
```csharp
[ComImport]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
[Guid("372E1D3B-38D3-42E4-A15B-8AB2B178F513")]
public interface IApplicationView
{
    // This interface has many methods; only the commonly used ones are shown.
    // The vtable layout must match exactly — use placeholder methods for skipped slots.
    // See MScholtes/VirtualDesktop for complete vtable definitions.

    // Slot methods — must be declared to maintain vtable order
    int GetIids(out int iidCount, out IntPtr iids);
    int GetRuntimeClassName(out IntPtr className);
    int GetTrustLevel(out int trustLevel);

    // ... additional vtable slots ...

    int GetVirtualDesktopId(out Guid desktopId);
    int SetVirtualDesktopId(ref Guid desktopId);
}
```

**IApplicationViewCollection**:
```csharp
[ComImport]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
[Guid("1841C6D7-4F9D-42C0-AF41-8747538F10E5")]
public interface IApplicationViewCollection
{
    int GetViews(out IObjectArray array);
    int GetViewsByZOrder(out IObjectArray array);
    int GetViewsByAppUserModelId(string id, out IObjectArray array);
    int GetViewForHwnd(IntPtr hwnd, out IApplicationView view);
    int GetViewForApplication(object application, out IApplicationView view);
    int GetViewForAppUserModelId(string id, out IApplicationView view);
    int GetViewInFocus(out IntPtr view);
    int Unknown1(out IntPtr view);
    void RefreshCollection();
    int RegisterForApplicationViewChanges(object listener, out int cookie);
    int UnregisterForApplicationViewChanges(int cookie);
}
```

**IVirtualDesktopPinnedApps**:
```csharp
[ComImport]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
[Guid("4CE81583-1E4C-4632-A621-07A53543148F")]
public interface IVirtualDesktopPinnedApps
{
    bool IsViewPinned(IApplicationView applicationView);
    void PinView(IApplicationView applicationView);
    void UnpinView(IApplicationView applicationView);
    bool IsAppIdPinned(string appId);
    void PinAppID(string appId);
    void UnpinAppID(string appId);
}
```

**IObjectArray** (standard shell interface):
```csharp
[ComImport]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
[Guid("92CA9DCD-5622-4BBA-A805-5E9F541BD8C9")]
public interface IObjectArray
{
    void GetCount(out int count);
    void GetAt(int index, ref Guid riid,
        [MarshalAs(UnmanagedType.Interface)] out object obj);
}
```
