---
tags: [svg-optimize-expert/optimization-strategies]
summary: Phase 2 — decision tree and three optimization strategies (SVGO baseline, targeted cleanup, full rebuild) based on SVG content analysis.
---

# Phase 2: Optimization Strategy Selection

<decision-tree>
  <condition test="Has embedded base64 PNGs?">
    <yes>Rebuild approach — extract visible vector paths, remove all raster assets</yes>
    <no>
      <condition test="Has excessive clipPaths or unused defs?">
        <yes>Targeted cleanup + SVGO</yes>
        <no>SVGO baseline is likely sufficient</no>
      </condition>
    </no>
  </condition>
</decision-tree>

## Pages

- [Strategy A: SVGO Baseline](strategy-a-svgo-baseline.md) — 20-40% reduction for clean SVGs
- [Strategy B: Targeted Cleanup + SVGO](strategy-b-targeted-cleanup.md) — 40-60% reduction for specific bloat
- [Strategy C: Full Rebuild](strategy-c-full-rebuild.md) — 60-80% reduction for design-tool exports with embedded PNGs
