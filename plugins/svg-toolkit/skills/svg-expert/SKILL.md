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

## Pages

- [Core Principles](core-principles.md) — Six foundational SVG principles covering fidelity-over-size, viewBox extraction, CSS filters, source quality, format verification, and pipeline order.
- [Raster-to-Vector Tracing](raster-to-vector.md) — Full vtracer/potrace tracing pipeline with settings, WSL2 setup, color consolidation, background removal, and visual fidelity verification.
- [SVG Optimization](svg-optimization.md) — SVGO-based SVG optimization workflow with type-specific guidance for clean-vector, color-traced, and traced-artwork files.
- [Sprite Extraction](sprite-extraction.md) — ViewBox-based sprite extraction workflow for isolating individual graphics from composite SVG files without path surgery.
- [CSS Color Customization](css-color-customization.md) — CSS hue-rotate filter implementation for applying uniform color shifts to traced artwork with hundreds of color variations.
- [Common Pitfalls](common-pitfalls.md) — Common SVG pitfalls covering over-simplification, fill editing on traced artwork, path surgery, format mismatches, and pipeline ordering errors.

## Meta
- [Operations Log](log.md) — Timestamped wiki operations log (ingest, lint, migrate filings)
- [Schema](schema.md) — Wiki conventions and page-type definitions

---

**SVG types:** `clean-vector` (5-20 paths, solid fills, <5KB) · `color-traced` (15-50 paths, 3-8 palette, 3-15KB) · `traced-artwork` (100s-1000s paths, 100s colors, 50KB-1MB, CSS-filter-only edits) · `composite-sprite` (use viewBox extraction)

**Workflow quick-refs:**
- **Trace raster → SVG**: `PNG → verify real PNG → vtracer polygon → SVGO --multipass → color consolidation → bg removal → add viewBox → visual diff` (see [raster-to-vector.md](raster-to-vector.md))
- **Optimize SVG**: `npx svgo input.svg -o output.svg --multipass` (see [svg-optimization.md](svg-optimization.md))
- **Extract sprite**: change `viewBox="x y width height"` per sprite (see [sprite-extraction.md](sprite-extraction.md))
- **Color customize**: `filter: hue-rotate(Ndeg) saturate(1.1)` (see [css-color-customization.md](css-color-customization.md))

**Two-knob tracing tuning:** `color_precision` (interior detail/color count) · `filter_speckle` (edge cleanliness). Proven: `color_precision=8, filter_speckle=16` for clean low-poly icons. Critical: SVGO before color consolidation — never reverse.
