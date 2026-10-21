---
tags: [verify-fix-loop/visual-seal, ui-verification, winforms]
summary: "An optional visual seal for WinForms UI loops: run imrdy render --all and read every PNG, because source-reading verifiers cannot see a layout collapse"
last-verified: "2026-10-04"
---

# Visual Seal for UI-Bearing Verify-Fix Loops

## The Problem

Code-reading verifiers are not sufficient for iterations that modify WinForms layout or rendering. During overlay-dashboard-context step-05, both iter-3 and iter-4 were APPROVED by all three verifiers despite producing a 60px-tall `DashboardForm` output — the form rendered as a near-blank sliver due to a layout-collapse bug.

Code-reading verifiers analyze source code. They check for stubs, convention violations, and security issues. They cannot see rendered output. A layout-collapse bug — where controls exist in source but render at zero or near-zero size — passes them cleanly. The only way to detect it is to look at the actual rendered output.

## The Visual Seal

A loop whose change touches a WinForms form, overlay, tray icon, or menu rendering may add one check
after the build, the tests and the code-reading verifiers pass: **run `imrdy render --all` and read
every output PNG**. Choose it when a layout collapse is possible, because an APPROVED verdict from a
verifier that reads source says nothing about how the form renders. Nothing makes it a gate every
UI iteration must pass.

## Implementation

When the seal is chosen, run the render command after each deploy cycle:

```bash
imrdy render dashboard --all --output-dir scratch/views/dashboard/
```

After a successful render, read each PNG using the Read tool (Claude Code displays images inline) and confirm:
- Form height is reasonable (not a sliver — expect 400–800px for the dashboard)
- Content panels are visible and populated
- Fonts render at expected sizes
- No controls are clipped or hidden
- Sparkline shows data points, not a blank canvas

## Cheapest Integration-Test Proxy

A size-floor assertion on rendered output is the cheapest integration test that would have caught the F4 regression:

```csharp
Assert.True(result.Image.Height > 100,
    $"DashboardForm rendered as sliver: {result.Image.Height}px");
```

This does not replace visual inspection, but it catches regressions automatically in CI where no human reviews PNGs. Add a size-floor assertion to any render integration test as a backstop.

## Scope

The seal fits a code change that touches:
- `DashboardForm` or any `DashboardForm` child control
- `SparklineControl` or other custom UserControls
- `OverlayWindowBase` or its subclasses
- Tray icon rendering (`ParametricShapeRenderer`, `PackIconRenderer`)
- Any WinForms form used by the render verb

It buys nothing on non-rendering changes (state machine logic, hook processing, config loading, CLI commands with no UI surface).

## The Render Verb

`imrdy render` is the reusable capture tool. It is registered in `RenderRegistry` and extensible to new components. It:
- Renders forms in-process (no screen, no running tray required)
- Uses `Form.DrawToBitmap` on the main STA thread
- Writes deterministic PNGs suitable for inspection and diff
- Works while the live tray is running (mutex bypassed by design)

Note: DWM mica/acrylic backdrops do NOT render in `DrawToBitmap` output — PNGs show the standard WinForms background color. This is expected and does not indicate a bug.

## Root Cause of the F4 Regression

The 60px sliver occurred because `DashboardForm` child controls were added to panels but the panels' `AutoSize`/`MinimumSize` was not set correctly. The form's preferred size computed to 60px because no control had a pinned size or anchor. This was invisible in code review — the child controls existed, the panels existed, the layout code ran — but the rendered output revealed the collapse immediately.

## Place Among the Platform-Boundary Checks

Platform-boundary work runs three checks — code-reading verifiers, a manual runtime check, and reading Debug-level diagnostic logs — and the visual seal, when chosen, is a step **inside the manual check**, for WinForms rendering. It runs before the rest of the manual check, so a layout collapse surfaces before a human reproduces the workflow. For the case where the logs caught what the verifiers and the manual check both missed, see [.NET 10: IInspectable Out-Parameter Marshaling Limitation](../com-interop-expert/net10-iinspectable-marshaling.md).

## Related

- [Diagnostic-Only Iteration Protocol](diagnostic-only-iter-protocol.md) — When manual gate reveals ambiguous symptom, use diagnostics-only iteration before attempting fixes
- imrdy render-verb-architecture (imrdy-expert wiki in [radleta/imrdy](https://github.com/radleta/imrdy)) — imrdy-expert page describing the render verb implementation
