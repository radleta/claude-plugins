---
tags: [com-interop-expert/error-handling]
summary: "HRESULT reference table and re-initialization pattern for COM failure recovery after Explorer restart or service disconnection"
---

# Error Handling Reference

| HRESULT | Constant | Meaning | Recovery |
|---------|----------|---------|----------|
| `0x80004005` | E_FAIL | Generic failure — desktop service may be restarting | Retry after delay, re-initialize COM objects |
| `0x800706BA` | RPC_S_SERVER_UNAVAILABLE | Explorer.exe crashed or restarted | Re-create all COM objects from scratch |
| `0x80010108` | RPC_E_DISCONNECTED | COM object disconnected | Re-create all COM objects |
| `0x80040154` | REGDB_E_CLASSNOTREG | COM class not registered (wrong Windows version) | Check version, fall back gracefully |
| `0x80004002` | E_NOINTERFACE | Interface not supported (wrong GUID for version) | Try alternate version GUIDs |

## Re-initialization Pattern

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
