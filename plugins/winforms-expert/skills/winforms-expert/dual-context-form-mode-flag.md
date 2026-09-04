---
tags: [winforms-expert/form-lifecycle]
summary: "Use explicit mode flags for forms with dual execution contexts, not runtime detection"
---

## WinForms Forms Serving Two Roles Need an Explicit Mode Flag, Not Runtime Detection

When a WinForms `Form` is used in two distinct execution contexts — as the main form of an
`Application.Run` loop (e.g., a preview/dev harness) and as a child form managed by a controller
(e.g., a hover dashboard) — behavior that is context-dependent (specifically: what Escape does)
must be governed by an explicit constructor parameter, not runtime detection.

### Why runtime detection fails

Checking `Application.OpenForms.Count == 1 && this == Application.OpenForms[0]` seems
plausible but is fragile: the count can vary during show/hide cycles and in the hover path,
the form is the only open form anyway. The check gives a misleading answer.

### The correct pattern: ctor mode flag

```csharp
public DashboardForm(DashboardViewModel vm, ILoggerFactory loggerFactory,
    bool isPinned = false, bool isPreviewMode = false)
```

In `OnKeyDown`:
```csharp
if (e.KeyCode == Keys.Escape && _isPinned)
{
    e.Handled = true;
    if (_isPreviewMode)
        Application.Exit();    // terminates Application.Run cleanly
    else
        { Unpin(); Hide(); }   // hover path: return to idle state
}
```

The caller injects the mode at construction time — `PreviewDashboardCommand` passes
`isPreviewMode: true`; `HoverDashboardController.TryShowForm` passes the default `false`.

### Why `Application.Exit()` and not `Close()`

`Close()` on a form started via `Application.Run(form)` does exit the message loop cleanly
(WinForms wires `FormClosed` to `Application.Exit()` for the main form). However,
`Application.Exit()` is explicit and communicates intent at the call site. Either works;
prefer the explicit form.
