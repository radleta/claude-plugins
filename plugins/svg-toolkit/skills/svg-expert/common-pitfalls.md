---
summary: Common SVG pitfalls covering over-simplification, fill editing on traced artwork, path surgery, format mismatches, and pipeline ordering errors.
tags: [svg-expert/pitfalls]
---

# Common Pitfalls

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| Over-simplification | Traced artwork becomes "blobby" | SVGO `--multipass` only, no path simplification |
| Editing traced fills | Hours changing individual fill attributes | Use CSS hue-rotate filter |
| Path surgery | Deleting paths to extract sprites | Use viewBox clipping instead |
| JPEG-as-PNG | vtracer errors or bad output | `magick input.png PNG:real.png` |
| SVGO after consolidation | Same-color paths merge into one | Run SVGO first, consolidate after |
| vtracer on Windows | Segfault with Python 3.14 | Use WSL2 Ubuntu (`pip3 install vtracer`) |
| Potrace for color | Self-intersecting paths, holes | Use vtracer instead |
| Gradient source PNG | Jagged edges on traced SVG silhouette | Regenerate source with flat shading (one solid color per facet) |
| Jagged outer edges | Tiny sliver paths along boundary | Increase `filter_speckle` (try 12-16) |
| Color averaging | Washed-out/desaturated palette | Use most-frequent member color, not RGB average |
| Compound bg paths | Background merged with shape (`M0 0...Zm514 86...`) | Keep compound path; add shaped backdrop for gap-fill |
| Removed highlight layer | Transparency holes inside shape | Don't regex-remove near-white paths — verify they're background first |
| Missing viewBox | SVG clips to nothing in React/CSS | Add `viewBox="0 0 W H"` matching width/height |
| Gap-fill holes | Transparency between facet paths after bg removal | Add shaped backdrop (`<circle>` / `<rect>`) with bg color |
