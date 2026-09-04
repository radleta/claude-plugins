---
tags: [com-interop-expert/com-interop-checklist]
summary: "10-item COM activation and lifecycle checklist covering STA threads, activation patterns, re-initialization after Explorer restart, and disposal"
---

# Activation and Lifecycle Checklist (10 items)

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
