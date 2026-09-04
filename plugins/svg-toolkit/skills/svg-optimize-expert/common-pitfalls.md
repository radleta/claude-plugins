---
tags: [svg-optimize-expert/common-pitfalls]
summary: Common SVG optimization mistakes — blanket color replacement, misleading diff percentages, overly aggressive rebuilds, CORS issues, and coordinate scaling errors.
---

# Common Pitfalls

| Pitfall | Why It Happens | Solution |
|---------|---------------|----------|
| Blanket color replace breaks some areas | Same hex color used for different visual purposes (face vs neck) | Use surgical replacement targeting paths by `d` attribute |
| Diff percentage misleading | Tiny per-pixel differences across large areas inflate percentage | Check avg diff magnitude, not just pixel count; verify at display size |
| Rebuild removes too much | Skipping all clipped groups removes visible fills (faces, skin) | Keep paths inside clipped groups; only remove the clip-path attr and images |
| CORS blocks canvas pixel access | SVGs loaded from `file://` can't be read by canvas | Serve from local HTTP server (`localhost:3456`) |
| Color sampling wrong coordinates | ViewBox → canvas coordinate scaling errors | Scale: `canvasX = viewBoxX * canvasSize / viewBoxWidth` |
| Changed correct color to wrong value | Original's rendered color differs from SVG source color due to compositing | Always sample the RENDERED pixel color, not the SVG source hex value |
