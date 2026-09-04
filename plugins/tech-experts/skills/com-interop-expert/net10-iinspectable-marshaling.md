---
tags: [com-interop-expert/dotnet-compat]
summary: ".NET 10 built-in COM marshaler refuses to handle out IInspectable parameters; use raw vtable dispatch instead"
---

# .NET 10: IInspectable Out-Parameter Marshaling Limitation

## The Limitation

When a `[ComImport][InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]` interface declares a method with an `out` parameter typed as another `[ComImport][InterfaceIsIInspectable]` interface, **.NET 10's built-in COM marshaler throws `PlatformNotSupportedException` at the first call**.

The exception fires inside the generated dispatch stub — not at parse time, not at interface resolution, but at the call site. This makes debugging difficult because the error appears unrelated to the parameter type.

## Root Cause

The `IInspectable` → WinRT-type conversion requires WinRT projection machinery. In .NET 10 single-file publish mode, this machinery is not included for non-WinRT callers (projects that don't target `net10.0-windows` with full WinRT support). The marshaler detects the unsupported conversion and refuses at runtime.

The same limitation applies to **any** COM method that returns an object whose interface carries `[InterfaceIsIInspectable]`, even if the caller never invokes methods on it.

## Code Pattern That Breaks

```csharp
[ComImport][InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
private interface IApplicationViewCollection
{
    int GetViewForHwnd(IntPtr hwnd, out IApplicationView view);
    // IApplicationView is [InterfaceIsIInspectable]
    // First call throws: System.PlatformNotSupportedException
}

[ComImport][InterfaceType(ComInterfaceType.InterfaceIsIInspectable)]
private interface IApplicationView
{
    // This interface type triggers the limitation
}
```

**When it fails:** At the call site in user code, inside the CLR-generated dispatch stub. Stacktrace points to the method call line, not to interface resolution or type checking.

## Solution: Raw Vtable Dispatch

Treat the output pointer as an opaque `IntPtr` end-to-end. Use `Marshal.GetDelegateForFunctionPointer<T>` and declare the delegate with `out IntPtr` instead of `out IApplicationView`.

### Pattern (Working Code)

```csharp
// Declare the delegate with opaque IntPtr
[UnmanagedFunctionPointer(CallingConvention.StdCall)]
private delegate int GetViewForHwndDelegate(IntPtr @this, IntPtr hwnd, out IntPtr view);

// Retrieve the vtable slot
private static T GetVtableDelegate<T>(IntPtr comPtr, int slot) where T : class
{
    var vtable = Marshal.ReadIntPtr(comPtr);
    var methodPtr = Marshal.ReadIntPtr(vtable, slot * IntPtr.Size);
    return Marshal.GetDelegateForFunctionPointer<T>(methodPtr);
}

// Call via raw vtable
var getView = GetVtableDelegate<GetViewForHwndDelegate>(collectionPtr, 6);
var hr = getView(collectionPtr, hwnd, out var viewPtr);
if (hr >= 0)  // S_OK and success codes
{
    try
    {
        // Use viewPtr as opaque IntPtr
        // Never cast it to IApplicationView
    }
    finally
    {
        Marshal.Release(viewPtr);  // Critical: release the ref-count
    }
}
```

**Key invariants:**
- Declare the delegate parameter as `out IntPtr` (not `out IApplicationView`)
- Never cast `viewPtr` to an `[InterfaceIsIInspectable]` type
- Call `Marshal.Release(viewPtr)` in a `finally` block on every path that received the pointer

### BOOL Handling on Raw Vtable

Win32 `BOOL` is 4 bytes (a 32-bit int), not a 1-byte CLR `bool`. When marshaling `out BOOL` on raw vtable delegates, use `out int` and test the result for non-zero:

```csharp
[UnmanagedFunctionPointer(CallingConvention.StdCall)]
private delegate int IsViewPinnedDelegate(IntPtr @this, IntPtr view, out int isPinned);
// out int, not out bool

var isPinned = IsViewPinnedDelegate(..., out var pinnedInt);
if (pinnedInt != 0)  // non-zero means true
{
    // ...
}
```

## Scope of the Limitation

**Applies to:**
- Any `[ComImport][InterfaceIsIUnknown]` method with an `out [ComImport][InterfaceIsIInspectable]` parameter
- Any method that returns (not out, just returns) an `[InterfaceIsIInspectable]` type
- Any project targeting `.NET 10` in single-file publish mode

**Does NOT apply to:**
- Methods on `[InterfaceIsIInspectable]` interfaces themselves (those are already WinRT-projected)
- `[ComImport][InterfaceIsIUnknown]` methods with simple types (IntPtr, int, string)
- Projects targeting `net10.0-windows` with full WinRT support (rare)

## Observable Signature in Logs

When this limitation hits, the exception appears at runtime with a simple message:

```
System.PlatformNotSupportedException: This platform does not support passing objects of a type that implements IInspectable via method parameters.
```

This message only appears at call time, not at startup. All verifiers and static analysis pass the code — only runtime diagnostics surface it.

## Prevention Checklist

When writing COM interop for undocumented Windows Shell APIs (IVirtualDesktop*, IApplicationView*, IVirtualDesktopPinnedApps):

- [ ] Check if any `[InterfaceIsIInspectable]` types are involved
- [ ] If yes, use raw vtable dispatch from the start (don't try built-in marshaling)
- [ ] Enable Debug-level logging in `ServiceRegistration` (check for `.dev-build` marker)
- [ ] Test on actual runtime (verifiers + manual gate are insufficient for this limitation)
- [ ] In diagnostics logs, grep for `PlatformNotSupportedException` and `PlatformNotSupported`
