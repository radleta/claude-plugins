---
tags: [verify-fix-loop/visual-seal, ui-verification, winforms]
summary: "Mandatory fourth visual seal for WinForms UI iterations: run imrdy render --all and inspect every PNG — verifier APPROVED votes cannot detect layout-collapse bugs"
---

# Visual Seal: Fourth Gate for UI-Bearing Verify-Fix Loops

## The Problem

The standard hybrid verifier wave (completeness + quality + security) is not sufficient for iterations that modify WinForms layout or rendering. During overlay-dashboard-context step-05, both iter-3 and iter-4 were APPROVED by all three verifiers despite producing a 60px-tall `DashboardForm` output — the form rendered as a near-blank sliver due to a layout-collapse bug.

Hybrid verifiers analyze source code. They check for stubs, convention violations, and security issues. They cannot see rendered output. A layout-collapse bug — where controls exist in source but render at zero or near-zero size — passes all three verifier gates cleanly. The only way to detect it is to look at the actual rendered output.

## The Fourth Seal

For any iteration that modifies a WinForms form, overlay, tray icon, or menu rendering:

1. Build succeeds (existing gate)
2. Tests pass (existing gate)
3. Completeness/quality/security verifiers APPROVED (existing gate)
4. **Run `imrdy render --all` and read every output PNG** (fourth seal — mandatory)

The fourth seal is mandatory. A passing verifier wave is not a substitute for visual verification.

## Implementation

Run the render command after each deploy cycle:

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

Apply the fourth seal whenever a code change touches:
- `DashboardForm` or any `DashboardForm` child control
- `SparklineControl` or other custom UserControls
- `OverlayWindowBase` or its subclasses
- Tray icon rendering (`ParametricShapeRenderer`, `PackIconRenderer`)
- Any WinForms form used by the render verb

Do NOT apply to non-rendering changes (state machine logic, hook processing, config loading, CLI commands with no UI surface).

## The Render Verb

`imrdy render` is the reusable capture tool. It is registered in `RenderRegistry` and extensible to new components. It:
- Renders forms in-process (no screen, no running tray required)
- Uses `Form.DrawToBitmap` on the main STA thread
- Writes deterministic PNGs suitable for inspection and diff
- Works while the live tray is running (mutex bypassed by design)

Note: DWM mica/acrylic backdrops do NOT render in `DrawToBitmap` output — PNGs show the standard WinForms background color. This is expected and does not indicate a bug.

## Root Cause of the F4 Regression

The 60px sliver occurred because `DashboardForm` child controls were added to panels but the panels' `AutoSize`/`MinimumSize` was not set correctly. The form's preferred size computed to 60px because no control had a pinned size or anchor. This was invisible in code review — the child controls existed, the panels existed, the layout code ran — but the rendered output revealed the collapse immediately.

## Interaction With Three-Seal Gate

The three-seal gate (Platform Boundary Three-Seal Gate, platform-boundary-three-seal-gate.md) covers:
1. Unit verifier seal — code structure and consistency
2. Integration verifier seal — hook-to-state pipeline
3. Manual verifier seal — cross-desktop + runtime UX

The visual seal is an additional mandatory step **within the manual-UX tier** for WinForms rendering specifically. It runs before the full manual gate to catch layout problems early — before a human has to reproduce the workflow manually.

## Related

- [Diagnostic-Only Iteration Protocol](diagnostic-only-iter-protocol.md) — When manual gate reveals ambiguous symptom, use diagnostics-only iteration before attempting fixes
- imrdy render-verb-architecture (imrdy-expert wiki, D:\dev\github\imrdy) — imrdy-expert page describing the render verb implementation
