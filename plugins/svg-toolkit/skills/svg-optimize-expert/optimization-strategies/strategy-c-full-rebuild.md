---
tags: [svg-optimize-expert/optimization-strategies]
summary: Strategy C — full SVG rebuild for design-tool exports with embedded PNGs/textures (60-80% reduction), extracting only visible path elements.
---

# Strategy C: Full Rebuild (60-80% reduction)

For design tool exports with embedded PNGs/textures:

1. Parse SVG token-by-token
2. Extract only visible `<path>` elements (skip `<clipPath>`, `<defs>`, `<image>`, `<rect>`)
3. Strip `clip-path` attributes from `<g>` groups
4. Preserve `<svg>` root with viewBox
5. Run SVGO on rebuilt output

**Critical decision for rebuilds:** Paths inside `<g clip-path="...">` groups may be
shadow/shading fills meant to be clipped by PNG overlays. Decide per-SVG:
- **Keep clipped paths**: preserves more visual detail (faces, skin, shadows)
- **Skip clipped paths**: smaller file but may lose important fills
