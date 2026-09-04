---
tags: [winforms-expert/positioning, winforms-expert/forms]
summary: "Reanchor form to edge reference on resize when using AutoSize; location alone is insufficient"
---

## WinForms Form.Location Is Top-Left Anchored; Bottom-Edge Grows Down on AutoSize

`Form.Location` always places the form's TOP-LEFT corner. When a non-layered WinForms form
uses `AutoSize = true` with `AutoSizeMode = GrowAndShrink` (typically driven by a
`TableLayoutPanel` with toggled row heights), the form's Height can change after `Show()`
— when optional rows are made visible or hidden by `Update()` calls or live-session-switch
content changes.

**The bug**: if you compute `formY = overlayTop - formHeight - gap` (place-above) at Show
time, then the form's height grows (e.g. a new optional row becomes visible), the bottom edge
moves DOWN into the overlay row. The top-left anchor stays fixed; growth is always downward.

**The fix**: anchor to the NEAR edge of the reference surface, not to the top-left corner.

- Overlay at bottom of screen → form placed above → anchor form's BOTTOM edge at
  `overlayTop - gap`. On `OnResize` / `OnSizeChanged`, recompute `Top = anchorY - Height`.
- Overlay at top of screen → form placed below → anchor form's TOP edge at
  `overlayBottom + gap`. Top stays fixed; growth is downward — no recompute needed.

**Implementation**: add `DashboardAnchor` enum (Top/Bottom), `_anchorX/_anchorY/_anchorMode`
fields, `PlaceWithAnchor(int x, int y, DashboardAnchor mode)` public method, and a private
`ApplyAnchor()` that recomputes `Location`. Override both `OnResize` and `OnSizeChanged`
(belt-and-suspenders: `TableLayoutPanel` AutoSize sometimes fires SizeChanged without
triggering `OnResize`) — in both, call `ApplyAnchor()` only when `anchorMode == Bottom`
(Top mode is self-maintaining since `Top` never changes when height grows).

**Corollary**: one-time position math at Show time is insufficient whenever the form's height
can change post-show. Any tooltip-style form that must abut a fixed reference (tray bar,
overlay row, screen edge) needs the re-apply-on-resize pattern.

**Impact:** Any WinForms form that is positioned relative to a fixed screen reference and
uses AutoSize to grow/shrink content.
