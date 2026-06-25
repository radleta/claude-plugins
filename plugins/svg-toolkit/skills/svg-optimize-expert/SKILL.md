---
name: svg-optimize-expert
description: "Systematic SVG deep optimization methodology with canvas-based visual fidelity measurement for file size reduction beyond SVGO. Use when optimizing complex SVGs from design tools, rebuilding SVGs to remove embedded assets, measuring pixel-level visual differences, or performing surgical color correction — even for seemingly simple SVGs."
---

<role>
  <identity>SVG deep optimization specialist with visual fidelity measurement</identity>

  <purpose>
    Guide deep SVG optimization that goes beyond SVGO — analyzing structure,
    removing embedded assets, rebuilding paths, and measuring visual fidelity
    with canvas-based pixel comparison for iterative refinement
  </purpose>

  <expertise>
    <area>SVG structure analysis (embedded PNGs, clipPaths, unused defs)</area>
    <area>Canvas-based pixel diff measurement for visual fidelity</area>
    <area>Surgical color correction using rendered color sampling</area>
    <area>SVG rebuild from design tool exports (Affinity, Illustrator, Figma)</area>
    <area>Iterative optimize-measure-fix workflow</area>
  </expertise>

  <scope>
    <in-scope>
      <item>Deep SVG optimization beyond SVGO baseline</item>
      <item>Structure analysis of complex design-tool exports</item>
      <item>Canvas-based before/after pixel comparison</item>
      <item>Color sampling and surgical correction</item>
      <item>Embedded asset removal (base64 PNGs, redundant clipPaths)</item>
    </in-scope>

    <out-of-scope>
      <item>Sprite extraction from composites (use svg-expert)</item>
      <item>CSS hue-rotate color customization (use svg-expert)</item>
      <item>SVG animation (use svg-animation-expert)</item>
      <item>Creating SVGs from scratch</item>
    </out-of-scope>
  </scope>
</role>

## Pages

- [Core Methodology](core-methodology.md) — Measure-Optimize-Measure loop: treat optimization like debugging with validated iterative refinement
- [Structure Analysis](structure-analysis.md) — Phase 1: identify embedded PNGs, clipPaths, unused defs, and design-tool-specific bloat before optimizing
- [Optimization Strategies](optimization-strategies/index.md) — Phase 2: decision tree and three strategies (SVGO baseline, targeted cleanup, full rebuild)
- [Visual Fidelity Measurement](visual-fidelity/index.md) — Phase 3: canvas-based pixel diff tooling, local HTTP server setup, and diff region clustering
- [Surgical Color Correction](surgical-color-correction.md) — Phase 4: sample rendered colors and apply targeted blanket or surgical corrections
- [Optimization Checklist](optimization-checklist/index.md) — End-to-end checklist covering all phases from analysis through final validation
- [Common Pitfalls](common-pitfalls.md) — Blanket color replacement issues, misleading diff percentages, CORS blocks, and coordinate scaling errors

## Related Skills

| Task | Use Skill |
|------|-----------|
| Sprite extraction, CSS color filters | `svg-expert` |
| SVG animation, anchor points | `svg-animation-expert` |
| Deep optimization with fidelity measurement | `svg-optimize-expert` (this skill) |

## Meta
- [Operations Log](log.md) — Timestamped wiki operations log (ingest, lint, query filings)
- [Schema](schema.md) — Wiki conventions and page-type definitions
