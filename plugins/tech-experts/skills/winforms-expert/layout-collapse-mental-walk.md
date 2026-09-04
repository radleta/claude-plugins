---
tags: [winforms-expert/layout]
summary: "Mental-walk protocol to detect layout-collapse regressions that unit tests miss"
---

## Layout-Collapse Regressions Require a Per-Fixture Mental-Walk Before READY_FOR_REVIEW

When a WinForms layout change is made to fix a visual issue (e.g., shrink the form to content),
the fix can silently collapse the entire content area to zero while all unit tests still pass.
Verifiers catch static bugs; they cannot catch "form renders only two rows when the fixture has
10 slots of content." Only a fixture mental-walk or a visual gate can catch this class of bug.

### When to apply the mental-walk

Apply this gate before declaring READY_FOR_REVIEW any time a coder:
- Changes layout panel properties (Dock, AutoSize, AutoSizeMode, Height, Margin)
- Adds or removes visibility logic (`.Visible = X`)
- Changes the form's height-calculation method

### The mental-walk protocol

For each fixture, trace which sections are visible and verify they match the spec table:

1. List every section (panel/control) added to the content area.
2. For each section, trace the `Update(vm)` code path for the fixture's data and determine whether
   it is visible or hidden.
3. Sum visible section heights; add fleet strip + footer. Verify the total is plausible.
4. Cross-check against the spec fixture table ("Y = visible, N = hidden").

If any "Y" row in the spec resolves to "hidden" in your trace, the layout is broken.

### The specific Dock=Fill + AutoSize=true conflict

`FlowLayoutPanel` (or any Panel) with both `Dock = DockStyle.Fill` AND `AutoSize = true` is
contradictory in WinForms:
- `Dock=Fill` says "let the parent decide my size"
- `AutoSize=true` says "let my children decide my size"

WinForms resolves this conflict by zeroing out the control's size during the layout pass — the
panel and all its children render at height=0. This is a silent failure: no exception, no warning,
no failing test. The form renders with only the Dock=Top and Dock=Bottom strips visible (fleet and
footer in the DashboardForm case).

**The fix:** Never combine `Dock=Fill` with `AutoSize=true`. Use one or the other:
- If form-height is driven by `AdjustFormHeight()`, use `Dock=Fill` only — no AutoSize.
- If the container must auto-size to children, use `AutoSize=true` without `Dock=Fill` (use
  `AutoSize=true` + `Width=explicit` for the TopDown flow direction).

## Related

- [TableLayoutPanel GetRowHeights Type](tablelayoutpanel-getrowheights-type.md) — Related layout gotcha: GetRowHeights() returns int[], relevant when measuring heights during the mental walk
