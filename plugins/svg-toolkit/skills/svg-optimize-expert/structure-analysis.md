---
tags: [svg-optimize-expert/structure-analysis]
summary: Phase 1 — understand what the SVG contains before optimizing, including embedded PNGs, clipPaths, unused defs, and design-tool-specific bloat patterns.
---

# Phase 1: Structure Analysis

Before optimizing, understand what the SVG contains. Design tool exports often
include hidden complexity that inflates file size.

**What to look for:**

| Element | Why It Matters | Typical Savings |
|---------|---------------|-----------------|
| Embedded base64 PNGs (`<image href="data:image/png..."`) | Texture overlays from design tools; often 30-60% of file size | 40-70% |
| Redundant clipPaths (`<clipPath>`) | Design tools create clip regions for every texture | 5-15% |
| Unused `<defs>` | Gradients, filters, symbols never referenced | 2-10% |
| Duplicate paths | Same shape defined multiple times | 5-15% |
| `<use>` references | Can sometimes be inlined and deduplicated | 1-5% |
| High-precision coordinates | `M116.21478` vs `M116.215` — excess decimals | 5-10% |

**Investigation approach:**

```bash
# Count embedded images
grep -c 'data:image/png' input.svg

# Count clipPaths
grep -c '<clipPath' input.svg

# Count total paths
grep -c '<path' input.svg

# File size breakdown (approximate)
wc -c input.svg
```

**Design tool export patterns:**

| Tool | Common Bloat | Approach |
|------|-------------|----------|
| **Affinity Designer** | ClipPath + PNG texture layering: each region has (1) clipPath def, (2) visible fill path, (3) clipped PNG overlay | Rebuild: extract visible paths, strip clipPaths and PNGs |
| **Adobe Illustrator** | Excessive `<g>` nesting, unused defs, metadata | SVGO handles most; check for embedded rasters |
| **Figma** | Clean exports but may include unused components | SVGO usually sufficient |
| **Inkscape** | Sodipodi/Inkscape namespace attributes, editor metadata | SVGO strips metadata; check for traced artwork bloat |
