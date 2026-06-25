---
tags: [winforms-expert/layout]
summary: "TableLayoutPanel.GetRowHeights() returns int[], not float[] despite RowStyle.Height being float"
---

## TableLayoutPanel.GetRowHeights() Returns int[], Not float[]

`TableLayoutPanel.GetRowHeights()` returns `int[]` (pixel heights as integers), not `float[]` — even though `RowStyle.Height` is a `float`. The method computes actual pixel allocations from the layout engine, which snaps to whole pixels, so the return type is integral.

**Why the type mismatch?**

`RowStyle.Height` stores a logical height (in pixels or percentage, as a float). But `GetRowHeights()` returns the *rendered* heights after the layout engine snaps logical coordinates to the display grid. This snapping produces integers, making the method signature `int[]` rather than `float[]`.

**Code pattern:**

```csharp
// WRONG — CS0029 compile error
float[] rowHeights = tlp.GetRowHeights();  // Cannot implicitly convert int[] to float[]

// CORRECT
int[] rowHeights = tlp.GetRowHeights();
```

If you need heights as floats (e.g., to compute percentages), cast explicitly:

```csharp
int[] rowHeights = tlp.GetRowHeights();
float[] percentages = rowHeights.Select(h => h / (float)totalHeight).ToArray();
```

**Discovered:** During step-04 InspectService implementation — initial `float[]` type annotation caused a build failure.
**Impact:** Any code walking a TableLayoutPanel and calling GetRowHeights must use `int[]`.

## Related

- [Layout-Collapse Mental Walk](layout-collapse-mental-walk.md) — Related layout gotcha: mental-walk protocol for detecting Dock=Fill + AutoSize=true collapse bugs
