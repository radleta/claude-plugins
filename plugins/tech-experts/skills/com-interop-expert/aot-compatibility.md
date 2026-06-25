---
tags: [com-interop-expert/aot]
summary: "NativeAOT COM interop: classic ComImport is incompatible with AOT; use GeneratedComInterface (.NET 8+) with PreserveSig and in/out parameter modifiers"
---

# .NET AOT Compatibility

## Classic ComImport (non-AOT)

The `[ComImport]` attribute works with standard .NET but is **incompatible with NativeAOT** because it generates IL stubs at runtime.

## GeneratedComInterface (.NET 8+, AOT-compatible)

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
