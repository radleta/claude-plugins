---
tags: [winforms-expert/aot]
summary: ".NET 10 AOT compatibility considerations for WinForms tray apps — supported APIs, trim warnings, fallback patterns"
---

# .NET 10 and AOT Considerations

- **WinForms AOT is experimental** in .NET 10. The `WinFormsComInterop` library provides COM wrappers needed for AOT compilation, but not all controls work.
- **NotifyIcon works** with AOT because it uses simple Win32 shell APIs, not heavy COM automation.
- **GDI+ works** with AOT — `System.Drawing.Common` is supported on Windows.
- **Trimming warnings**: `System.Drawing` may produce trim warnings. Suppress with `<TrimmerRootAssembly>` or use `[DynamicallyAccessedMembers]` attributes where needed.
- **PublishAot** in `.csproj`: `<PublishAot>true</PublishAot>` — test thoroughly, especially ContextMenuStrip event wiring which uses reflection internally.
- **Fallback**: If AOT causes issues, use `<PublishSingleFile>true</PublishSingleFile>` with `<SelfContained>true</SelfContained>` for a single-exe deployment without AOT restrictions.
