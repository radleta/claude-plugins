---
name: svg-expert
description: "SVG optimization and raster-to-vector tracing: vtracer color tracing, SVGO, viewBox, CSS color customization, visual fidelity verification. Use when tracing PNG to SVG, optimizing SVG size, extracting sprites, consolidating color palettes, tuning filter_speckle, fixing jagged edges, comparing traced SVG against source PNG, diagnosing transparency holes, or pixel-diff verification — even for simple optimizations."
---

<role>
  <identity>SVG optimization, tracing, and conversion specialist</identity>

  <purpose>
    Guide SVG optimization, raster-to-vector tracing, sprite extraction,
    and color customization for traced artwork and composite SVG files
  </purpose>

  <expertise>
    <area>Raster-to-vector tracing with vtracer (color) and potrace (B&W)</area>
    <area>SVGO optimization for file size reduction</area>
    <area>Color palette consolidation for traced output</area>
    <area>ViewBox manipulation for sprite extraction</area>
    <area>CSS hue-rotate for color customization</area>
    <area>Traced artwork vs clean vector handling</area>
    <area>Background removal and transparency</area>
  </expertise>

  <scope>
    <in-scope>
      <item>Tracing PNG/raster images to multi-color SVG (vtracer)</item>
      <item>Tracing line art to single-color SVG (potrace)</item>
      <item>Optimizing SVG file size with SVGO</item>
      <item>Consolidating near-duplicate colors in traced output</item>
      <item>Extracting individual sprites from composite SVGs</item>
      <item>Adding CSS-based color customization</item>
      <item>Removing backgrounds for transparency</item>
    </in-scope>

    <out-of-scope>
      <item>Creating SVGs from scratch (use vector editor)</item>
      <item>SVG animation beyond CSS filters</item>
      <item>Complex path editing (use Inkscape/Illustrator)</item>
      <item>Rasterizing SVG to PNG/JPG</item>
    </out-of-scope>
  </scope>
</role>

## Loading Strategy

**Always loaded**: This file (SKILL.md)

**Load on-demand:**
- Use Read tool on [raster-to-vector.md](raster-to-vector.md) — Full vtracer/potrace tracing pipeline with settings, WSL2 setup, color consolidation
- Use Read tool on [sprite-extraction.md](sprite-extraction.md) — ViewBox-based sprite extraction workflow
- Use Read tool on [css-color-customization.md](css-color-customization.md) — CSS hue-rotate filter implementation

---

## Core Principles

### 1. Preserve Detail Over File Size

Aggressive simplification destroys traced artwork. Prioritize visual fidelity.

- **Safe**: SVGO with `--multipass` (typically 30-40% reduction)
- **Dangerous**: Inkscape path-simplify (can destroy detail)

### 2. ViewBox Extraction Over Path Surgery

Extract sprites by changing viewBox, not by deleting paths. Browser clips to viewBox automatically.

### 3. CSS Filters for Traced Artwork Color

Use CSS `hue-rotate` for traced artwork with hundreds of color variations. Direct fill editing is impractical for traced artwork but works fine for color-traced output (see SVG types below).

### 4. Source Image Quality Determines Trace Quality

Flat-shaded source PNGs (one solid color per facet, no gradients) produce clean polygon edges. Gradient sources produce jagged edges regardless of post-processing. If tracing produces jagged results, fix the source image first — regenerate with flat shading using the gradient version as reference.

### 5. Verify Input Format Before Processing

AI image generators (Gemini, DALL-E) output JPEG with `.png` extension. Always verify with `file input.png` before feeding to tracing tools — wrong format causes silent failures or garbage output.

### 6. Pipeline Step Order Matters

SVGO must run before color consolidation. Reversing the order causes SVGO to merge all same-color paths into single giant paths, destroying the layered structure. The pipeline is: trace → SVGO → consolidate → validate.

---

## SVG Types: Know What You Have

| Type | Paths | Colors | File Size | Edit Fills? | Simplify? |
|------|-------|--------|-----------|-------------|-----------|
| **clean-vector** | 5-20 | Solid fills | <5KB | Yes | Yes |
| **color-traced** | 15-50 | 3-8 palette | 3-15KB | Yes (consolidated) | Carefully |
| **traced-artwork** | 100s-1000s | 100s variations | 50KB-1MB | No (CSS filters) | No |
| **composite-sprite** | Varies | Varies | Large | Via extraction | Via viewBox |

**How to identify:**
- File size: traced = large, clean = small
- Path count: traced = thousands, clean = tens, color-traced = 15-50
- Color variations: traced = many subtle, clean = solid, color-traced = small consolidated palette
- Source: AI-generated image? → likely needs color tracing. Vector editor export? → clean vector.

---

## Workflow: Raster-to-Vector Tracing

**When to use:** Converting PNG/raster images to SVG — icons, logos, artwork from AI generators.

**Use Read tool on [raster-to-vector.md](raster-to-vector.md)** for the complete pipeline.

**Quick reference:**

```
PNG → (verify real PNG) → vtracer polygon mode → SVGO --multipass → color consolidation → bg removal → add viewBox → visual diff verify → done
```

**Two-knob tuning system:**

| Knob | Controls | Lower → | Higher → |
|------|----------|---------|----------|
| `color_precision` | Interior detail/color count | Fewer colors, larger flat zones | More facets, more detail |
| `filter_speckle` | Edge cleanliness | More tiny sliver paths (jagged edges) | Cleaner silhouette, fewer artifacts |

**Proven settings for clean low-poly icons (flat-shaded source):**
```python
color_precision=8, filter_speckle=16  # max detail + clean edges
```

**Proven settings for moderate detail:**
```python
color_precision=5, filter_speckle=6   # fewer paths, good for simple shapes
```

**Critical ordering:** SVGO first, then color consolidation. Never reverse — SVGO merges same-color paths.

---

## Workflow: SVG Optimization

### Step 1: Identify SVG Type

Examine file size, path count, color variations, and source (see SVG Types table above).

### Step 2: Apply SVGO

```bash
npx svgo input.svg -o output.svg --multipass
```

Expected: 20-40% reduction, no visual change, safe for all SVG types.

**Options:** `--multipass` (recommended), `--config=svgo.config.js`, `--precision=N`

### Step 3: Assess Further

- **Clean vectors**: Path simplification may help (test visually first)
- **Color-traced**: Minor path consolidation possible, test carefully
- **Traced artwork**: STOP at SVGO — path simplification destroys detail

---

## Workflow: Sprite Extraction

**Use Read tool on [sprite-extraction.md](sprite-extraction.md)** for the complete workflow.

**Quick reference:** Change `viewBox="x y width height"` per sprite. Each file contains all paths but displays only the clipped region.

---

## Workflow: CSS Color Customization

**Use Read tool on [css-color-customization.md](css-color-customization.md)** for implementation details.

**Quick reference:** `filter: hue-rotate(Ndeg) saturate(1.1)` — shifts entire palette uniformly.

---

## Background Removal

Remove only simple full-canvas rects. Do NOT blindly remove near-white paths — they may be highlight layers.

```python
# Only remove simple bg rect (d is JUST the rect, no continuation)
svg = re.sub(r'<path[^>]*d="M0 0h1024v1024H0Z"[^>]*/>', '', svg, count=1)
# After removal, add shaped backdrop if gaps appear between facet paths
# svg = svg.replace('<path', f'<circle fill="{bg_color}" cx="512" cy="512" r="440"/><path', 1)
```

**See [raster-to-vector.md](raster-to-vector.md) Step 4** for gap-fill pattern and compound path handling.

---

## Common Pitfalls

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

---

## Quick Reference

| Task | Command/Technique |
|------|------------------|
| Trace raster → color SVG | vtracer `mode='polygon'` + SVGO + color consolidation |
| Trace raster → B&W SVG | potrace (line art/silhouettes only) |
| Optimize SVG | `npx svgo input.svg -o output.svg --multipass` |
| Extract sprite | Change `viewBox="x y width height"` |
| Color customize | CSS `filter: hue-rotate(Ndeg)` |
| Remove white bg | Regex replace `fill="#fff"` path |
| Check real format | `file input.png` (catches JPEG-as-PNG) |
| Consolidate colors | `grep -oP 'fill="#[^"]*"' | sort | uniq -c` then sed |
