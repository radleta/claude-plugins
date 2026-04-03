---
name: com-interop-expert
description: "Validated COM Interop patterns for C#/.NET including IVirtualDesktopManager, undocumented shell interfaces, P/Invoke window management, RCW lifecycle, and STA threading. Use when integrating COM objects in .NET, working with Windows virtual desktop APIs, calling undocumented shell interfaces, or managing native interop lifetime — even for simple P/Invoke declarations or single COM interface consumption."
---

<role>
  <identity>COM Interop and Windows Virtual Desktop API expert for C#/.NET</identity>

  <purpose>
    Provide investigation-driven, agent-executable guidance for correct COM Interop
    integration in .NET applications, with deep coverage of the Windows Virtual Desktop
    COM interfaces (documented and undocumented), P/Invoke patterns for window management,
    and native interop lifetime management
  </purpose>

  <expertise>
    <area>IVirtualDesktopManager (documented) — GetWindowDesktopId, MoveWindowToDesktop, IsWindowOnCurrentVirtualDesktop</area>
    <area>IVirtualDesktopManagerInternal (undocumented) — SwitchDesktop, CreateDesktop, GetCount, MoveViewToDesktop</area>
    <area>IApplicationView / IApplicationViewCollection — window-to-view mapping for move operations</area>
    <area>COM activation in C# (ComImport, CoCreateInstance, IServiceProvider, Guid attributes)</area>
    <area>GeneratedComInterface source generator (.NET 8+) for AOT-compatible COM</area>
    <area>RCW lifecycle, Marshal.ReleaseComObject patterns, preventing COM leaks</area>
    <area>STA thread apartment model requirements for shell COM objects</area>
    <area>P/Invoke for User32 window management (SetForegroundWindow, EnumWindows, FindWindow, etc.)</area>
    <area>Windows 10 vs Windows 11 vs 24H2 GUID differences and version detection</area>
    <area>Process tree walking and terminal window detection</area>
  </expertise>

  <scope>
    <in-scope>
      <item>COM interface definitions for virtual desktop management</item>
      <item>COM activation and service provider patterns</item>
      <item>P/Invoke declarations for User32/Kernel32 window functions</item>
      <item>RCW lifecycle and COM object release patterns</item>
      <item>STA/MTA threading for COM objects</item>
      <item>Windows version detection and GUID selection</item>
      <item>GeneratedComInterface for AOT scenarios</item>
      <item>Error handling for COM failures (COMException, E_FAIL, shell restart)</item>
      <item>Fallback patterns when virtual desktop APIs are unavailable</item>
      <item>Window focus management during desktop switching</item>
    </in-scope>

    <out-of-scope>
      <item>WinRT/UWP virtual desktop APIs (use Windows.UI.* instead)</item>
      <item>Azure Virtual Desktop / Remote Desktop Services</item>
      <item>General UI framework guidance (WPF, WinForms — use respective experts)</item>
      <item>COM server authoring (this skill covers COM client consumption only)</item>
    </out-of-scope>
  </scope>
</role>

## Core Principles

### 1. Version-Aware Interface Selection

**What it means**: The undocumented virtual desktop COM interfaces change GUIDs across Windows builds. A single set of interface definitions will not work across Windows 10, Windows 11, and Windows 11 24H2.

**Why it matters**: Hardcoded GUIDs cause `COMException` or `InvalidCastException` on mismatched Windows versions. Applications silently fail or crash on version upgrades.

**How to implement**:
- Detect the Windows build number at startup via `Environment.OSVersion` or registry
- Select the correct interface GUIDs based on detected version
- Provide graceful fallback when the version is unrecognized
- Consider a version-strategy pattern that encapsulates GUID selection

### 2. Undocumented API Fragility

**What it means**: Only `IVirtualDesktopManager` is officially documented by Microsoft. All internal interfaces (`IVirtualDesktopManagerInternal`, `IApplicationView`, `IVirtualDesktop`) are reverse-engineered and can change without notice.

**Why it matters**: Windows updates can break COM interface definitions overnight. Applications must handle failures gracefully rather than assuming interfaces are stable.

**How to implement**:
- Wrap all undocumented API calls in try-catch for `COMException`
- Provide fallback behavior when internal interfaces are unavailable
- Log interface failures with build number for diagnostics
- Keep interface definitions isolated for easy replacement

### 3. COM Lifetime Discipline

**What it means**: COM objects obtained through interop have reference-counted lifetimes managed by Runtime Callable Wrappers (RCWs). Mismanagement causes leaks or use-after-release crashes.

**Why it matters**: COM leaks prevent the shell from releasing desktop objects. Use-after-release causes `InvalidComObjectException` crashes at unpredictable times.

**How to implement**:
- Prefer letting the GC handle RCW release in most cases
- Use `Marshal.ReleaseComObject` only when you must control release timing
- Never call `ReleaseComObject` on objects that may be referenced elsewhere
- Consider `Marshal.FinalReleaseComObject` only for complete ownership scenarios

### 4. STA Thread Requirement

**What it means**: Shell COM objects (ImmersiveShell, VirtualDesktopManager) require Single-Threaded Apartment (STA) initialization. MTA threads will fail or deadlock.

**Why it matters**: Console apps default to MTA. Background threads are MTA. COM calls from wrong apartment cause marshaling failures or silent deadlocks.

**How to implement**:
- Mark entry point with `[STAThread]` attribute
- For background operations, create a dedicated STA thread
- Never call shell COM from ThreadPool threads
- Use `Thread.SetApartmentState(ApartmentState.STA)` before starting dedicated threads

### 5. Defensive Error Handling

**What it means**: The virtual desktop service can become unavailable when Explorer restarts, during Fast User Switching, or when the desktop service is disabled.

**Why it matters**: `COMException` with `E_FAIL` (0x80004005) or `RPC_E_DISCONNECTED` can occur at any time. Unhandled exceptions crash the application.

**How to implement**:
- Catch `COMException` on every COM call
- Re-initialize COM objects after Explorer restart
- Detect service unavailability and enter a polling/retry mode
- Provide meaningful degraded behavior when VD APIs are down

---

## Investigation Protocol

Before implementing COM interop for virtual desktops, gather these facts:

### Windows Version & Build
- [ ] What is the target Windows version? (10, 11, 11 24H2, Server)
- [ ] What is the minimum supported build number?
- [ ] Must the application support multiple Windows versions simultaneously?
- [ ] Is Windows Insider / preview build support required?

**Why it matters**: Interface GUIDs change across major builds. Multi-version support requires a version-detection strategy.

### .NET Target & AOT Requirements
- [ ] What .NET version? (.NET Framework 4.x, .NET 8, .NET 9, .NET 10)
- [ ] Is NativeAOT publishing required?
- [ ] Is IL trimming enabled?

**Why it matters**: NativeAOT requires `GeneratedComInterface` instead of `ComImport`. Legacy .NET Framework requires the classic `ComImport` pattern.

### Application Threading Model
- [ ] Is the application a console app, WinForms, WPF, or service?
- [ ] What thread will make COM calls? (UI thread, background, timer)
- [ ] Is `[STAThread]` already applied?

**Why it matters**: STA requirement affects architecture. Services and console apps need explicit STA thread management.

### Required Capabilities
- [ ] Check if window is on current desktop? (documented API)
- [ ] Get desktop ID for a window? (documented API)
- [ ] Move window to desktop? (documented API, with undocumented fallback)
- [ ] Switch active desktop? (undocumented API only)
- [ ] Enumerate all desktops? (undocumented API only)
- [ ] Get/set desktop names? (undocumented API only)
- [ ] Pin/unpin windows across desktops? (undocumented API only)
- [ ] Create/remove desktops? (undocumented API only)

**Why it matters**: If only documented operations are needed, the implementation is simpler and more stable. Undocumented operations increase fragility.

---

## COM Interface Definitions

### Documented Interface: IVirtualDesktopManager

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

### Undocumented Interfaces: Shell Internal APIs

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

### Version-Dependent GUIDs

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

---

## P/Invoke Declarations

### Window Management

```csharp
public static class NativeMethods
{
    [DllImport("user32.dll")]
    public static extern IntPtr FindWindow(string? lpClassName, string? lpWindowName);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out int processId);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo,
        [MarshalAs(UnmanagedType.Bool)] bool fAttach);

    [DllImport("kernel32.dll")]
    public static extern uint GetCurrentThreadId();

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    public const int SW_SHOW = 5;
    public const int SW_RESTORE = 9;
    public const int SW_MINIMIZE = 6;
}
```

### Process Tree Walking for Terminal Windows

To find a terminal window (e.g., Windows Terminal, cmd, PowerShell) hosting a specific process:

1. Get the target process ID
2. Walk the parent process chain to find the terminal host
3. Use `EnumWindows` to find visible windows belonging to terminal PIDs
4. Filter by window class name (`CASCADIA_HOSTING_WINDOW_CLASS` for Windows Terminal)

```csharp
/// <summary>
/// Find the top-level window for a process, walking up the parent chain
/// to find terminal host windows.
/// </summary>
public static IntPtr FindTerminalWindow(int processId)
{
    IntPtr result = IntPtr.Zero;

    // Try the process itself first
    EnumWindows((hWnd, _) =>
    {
        GetWindowThreadProcessId(hWnd, out int pid);
        if (pid == processId && IsWindowVisible(hWnd))
        {
            result = hWnd;
            return false; // stop enumeration
        }
        return true;
    }, IntPtr.Zero);

    if (result != IntPtr.Zero) return result;

    // Walk parent process chain for terminal hosts
    try
    {
        var process = Process.GetProcessById(processId);
        // Use WMI or NtQueryInformationProcess to find parent PID
        // Then search for windows belonging to parent
    }
    catch (ArgumentException)
    {
        // Process exited
    }

    return result;
}
```

---

## Desktop Switching Pattern

Switching desktops requires careful focus management to avoid taskbar icon flashing:

```csharp
public void SwitchToDesktop(IVirtualDesktopManagerInternal manager,
    IVirtualDesktop targetDesktop, IntPtr hWndOrMon, bool animate = true)
{
    try
    {
        if (animate)
        {
            manager.SwitchDesktopWithAnimation(hWndOrMon, targetDesktop);
        }
        else
        {
            manager.SwitchDesktop(hWndOrMon, targetDesktop);
        }
    }
    catch (COMException ex)
    {
        // Fall back to non-animated switch
        if (animate)
        {
            try { manager.SwitchDesktop(hWndOrMon, targetDesktop); }
            catch (COMException) { /* Desktop service unavailable */ }
        }
    }
}
```

### Focus Management During Switch

```csharp
/// <summary>
/// Make a window visible and focused after switching desktops.
/// Uses thread input attachment to prevent taskbar flashing.
/// </summary>
public static void MakeWindowVisible(IntPtr hWnd)
{
    uint foregroundThreadId = GetWindowThreadProcessId(GetForegroundWindow(), out _);
    uint currentThreadId = GetCurrentThreadId();
    uint targetThreadId = GetWindowThreadProcessId(hWnd, out _);

    // Attach to foreground thread to get SetForegroundWindow permission
    if (foregroundThreadId != currentThreadId)
        AttachThreadInput(currentThreadId, foregroundThreadId, true);
    if (targetThreadId != currentThreadId)
        AttachThreadInput(currentThreadId, targetThreadId, true);

    try
    {
        ShowWindow(hWnd, SW_RESTORE);
        SetForegroundWindow(hWnd);
    }
    finally
    {
        if (foregroundThreadId != currentThreadId)
            AttachThreadInput(currentThreadId, foregroundThreadId, false);
        if (targetThreadId != currentThreadId)
            AttachThreadInput(currentThreadId, targetThreadId, false);
    }
}
```

---

## Window Movement Pattern

Moving a window to another desktop uses a two-strategy approach:

```csharp
public void MoveWindowToDesktop(IntPtr hWnd, Guid targetDesktopId,
    IVirtualDesktopManager vdm,
    IVirtualDesktopManagerInternal vdmi,
    IApplicationViewCollection viewCollection)
{
    // Strategy 1: Documented API (works for windows you own)
    try
    {
        vdm.MoveWindowToDesktop(hWnd, ref targetDesktopId);
        return;
    }
    catch (COMException)
    {
        // Fails for windows owned by other processes
    }

    // Strategy 2: Undocumented API via IApplicationView (works for any window)
    try
    {
        viewCollection.GetViewForHwnd(hWnd, out var view);
        var targetDesktop = vdmi.FindDesktop(ref targetDesktopId);
        vdmi.MoveViewToDesktop(view, targetDesktop);
    }
    catch (COMException ex)
    {
        // Log and handle — desktop service may be unavailable
        throw new InvalidOperationException(
            $"Failed to move window to desktop: {ex.ErrorCode:X8}", ex);
    }
}
```

**Key distinction**: `IVirtualDesktopManager.MoveWindowToDesktop` only works for windows your process owns. For cross-process window movement (the common case for a system tray tool), you must use `IVirtualDesktopManagerInternal.MoveViewToDesktop` with an `IApplicationView` obtained from `IApplicationViewCollection.GetViewForHwnd`.

---

## .NET AOT Compatibility

### Classic ComImport (non-AOT)

The `[ComImport]` attribute works with standard .NET but is **incompatible with NativeAOT** because it generates IL stubs at runtime.

### GeneratedComInterface (.NET 8+, AOT-compatible)

```csharp
[GeneratedComInterface]
[Guid("A5CD92FF-29BE-454C-8D04-D82879FB3F1B")]
internal partial interface IVirtualDesktopManager
{
    [PreserveSig]
    int IsWindowOnCurrentVirtualDesktop(IntPtr topLevelWindow, out bool onCurrentDesktop);

    [PreserveSig]
    int GetWindowDesktopId(IntPtr topLevelWindow, out Guid desktopId);

    [PreserveSig]
    int MoveWindowToDesktop(IntPtr topLevelWindow, ref Guid desktopId);
}
```

**Key differences from ComImport**:
- Interface must be `partial` and `internal` or `public`
- Only `IUnknown`-based interfaces supported (not `IDispatch`)
- Use `[PreserveSig]` to handle HRESULT manually (recommended for error handling)
- No method shadowing needed for derived interfaces — use normal C# inheritance
- `[In]`/`[Out]` attributes only allowed on arrays; use `in`/`out` parameter modifiers instead
- Marshalling defaults differ from built-in COM (all types have `[In]` semantics)

**Limitation for undocumented interfaces**: `GeneratedComInterface` works well for interfaces you activate via `CoCreateInstance`. For interfaces obtained via `QueryService` from the Immersive Shell, you may still need `ComImport` or manual `ComWrappers` implementation because the activation pattern does not go through standard COM creation.

---

## Error Handling Reference

| HRESULT | Constant | Meaning | Recovery |
|---------|----------|---------|----------|
| `0x80004005` | E_FAIL | Generic failure — desktop service may be restarting | Retry after delay, re-initialize COM objects |
| `0x800706BA` | RPC_S_SERVER_UNAVAILABLE | Explorer.exe crashed or restarted | Re-create all COM objects from scratch |
| `0x80010108` | RPC_E_DISCONNECTED | COM object disconnected | Re-create all COM objects |
| `0x80040154` | REGDB_E_CLASSNOTREG | COM class not registered (wrong Windows version) | Check version, fall back gracefully |
| `0x80004002` | E_NOINTERFACE | Interface not supported (wrong GUID for version) | Try alternate version GUIDs |

### Re-initialization Pattern

```csharp
public class VirtualDesktopService : IDisposable
{
    private IVirtualDesktopManager? _vdm;
    private IVirtualDesktopManagerInternal? _vdmi;
    private bool _disposed;

    public void EnsureInitialized()
    {
        if (_vdm != null) return;

        try
        {
            _vdm = (IVirtualDesktopManager)Activator.CreateInstance(
                Type.GetTypeFromCLSID(CLSID_VirtualDesktopManager)!)!;

            var shell = (IServiceProvider10)Activator.CreateInstance(
                Type.GetTypeFromCLSID(CLSID_ImmersiveShell)!)!;

            var serviceGuid = CLSID_VirtualDesktopManagerInternal;
            var iid = GetVersionAppropriateIID();
            _vdmi = (IVirtualDesktopManagerInternal)shell.QueryService(
                ref serviceGuid, ref iid);
        }
        catch (COMException)
        {
            _vdm = null;
            _vdmi = null;
            throw;
        }
    }

    public void HandleComFailure()
    {
        // Force re-initialization on next call
        _vdm = null;
        _vdmi = null;
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        // Let GC handle RCW release — safer than manual release
        _vdm = null;
        _vdmi = null;
    }
}
```

---

## COM Interop Checklist

### Interface Definition (12 items)

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

### Activation & Lifecycle (10 items)

- [ ] **STA thread for all COM activation** — `[STAThread]` on Main or explicit STA thread creation
- [ ] **Activator.CreateInstance for documented interfaces** — Using `Type.GetTypeFromCLSID`
- [ ] **IServiceProvider10.QueryService for internal interfaces** — Not direct `CoCreateInstance`
- [ ] **ImmersiveShell CLSID correct** — `C2F03A33-21F5-47FA-B4BB-156362A2F239`
- [ ] **COM objects re-initialized after Explorer restart** — Null check + re-create pattern
- [ ] **No Marshal.ReleaseComObject unless lifetime is fully controlled** — Prefer GC release
- [ ] **Try-catch on every COM method call** — `COMException` can happen at any time
- [ ] **Graceful degradation when service unavailable** — App continues without VD features
- [ ] **No COM calls from ThreadPool/Task.Run** — STA requirement violated
- [ ] **Dispose pattern clears COM references** — Nulls fields to allow GC collection

### Window Management (8 items)

- [ ] **Two-strategy window move** — Try documented API first, fall back to IApplicationView
- [ ] **Thread input attachment for SetForegroundWindow** — Prevents taskbar icon flashing
- [ ] **AttachThreadInput cleaned up in finally block** — Leaked attachment causes input issues
- [ ] **EnumWindows callback returns bool correctly** — `false` stops enumeration, `true` continues
- [ ] **GetWindowThreadProcessId out parameter handled** — Process ID is an `out int`, not return value
- [ ] **Window visibility checked before operations** — `IsWindowVisible` filter on enumeration
- [ ] **StringBuilder pre-allocated for GetWindowText** — Size 256+ characters
- [ ] **Process.GetProcessById wrapped in try-catch** — Process may have exited

### Version Compatibility (8 items)

- [ ] **Windows build number detected at startup** — `Environment.OSVersion.Version.Build`
- [ ] **GUID lookup table for known build ranges** — Maps build number to interface GUIDs
- [ ] **Unknown version falls back gracefully** — Does not crash on unrecognized builds
- [ ] **Version info logged for diagnostics** — Build number included in error messages
- [ ] **Separate interface definitions per version** — Or dynamic GUID injection pattern
- [ ] **Windows 10 lacks hWndOrMon parameter** — Methods have different signatures
- [ ] **IVirtualDesktopManagerInternal2 for Win10 2004+** — SetName added in extension interface
- [ ] **Testing on multiple Windows versions** — Cannot rely on single-version testing

---

## Common Pitfalls

**Vtable slot mismatch** — The most dangerous mistake. If you declare an `IApplicationView` interface with 28 methods but the native interface has 30, every method after slot 28 calls the wrong native function. This causes corrupted state, access violations, or silent data corruption. Always count vtable slots against a reference implementation.

**Wrong apartment model** — Console apps and background threads default to MTA. All shell COM objects require STA. Symptoms: `COMException` with obscure codes, random hangs, or methods that silently return wrong data.

**Hardcoded GUIDs** — Works on your machine, breaks on customers' machines with different Windows versions. Always detect and select GUIDs at runtime.

**Marshal.ReleaseComObject abuse** — Calling `ReleaseComObject` on a COM object that is still referenced by managed code (e.g., stored in a variable, passed to another method, or captured in a closure) causes `InvalidComObjectException` at a random future point. For virtual desktop objects, GC release is almost always sufficient.

**Forgetting to re-initialize after Explorer restart** — Users press Ctrl+Shift+Esc and restart Explorer, or Explorer crashes. All COM interface pointers become invalid. The next COM call throws `RPC_E_DISCONNECTED`. Your service must detect this and re-initialize.

**MoveWindowToDesktop failing silently for other-process windows** — The documented `IVirtualDesktopManager.MoveWindowToDesktop` only works for windows your process owns. For a system tray tool managing other applications' windows, you must use the undocumented `MoveViewToDesktop` path.

---

## Reference Projects

For complete, tested implementations with all vtable slots, consult these projects:

- **MScholtes/VirtualDesktop** — C# command-line tool with separate files per Windows version. The most comprehensive reference for COM interface definitions and version-specific GUIDs.
- **Grabacr07/VirtualDesktop** — C# wrapper library for Windows 11 with NuGet packages. Cleaner API surface but may lag behind Windows updates.

These projects are the authoritative source for current GUIDs when Microsoft changes them in new builds.

---

## Success Indicators

You have correctly applied this skill when:
- All COM interfaces have version-appropriate GUIDs
- Vtable slot counts match a reference implementation exactly
- COM activation happens on an STA thread
- Every COM call is wrapped in try-catch for `COMException`
- Window movement uses the two-strategy fallback pattern
- The application gracefully degrades when virtual desktop APIs are unavailable
- Explorer restart triggers COM re-initialization
- Focus management uses thread input attachment
