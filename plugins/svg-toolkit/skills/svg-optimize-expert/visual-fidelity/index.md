---
tags: [svg-optimize-expert/visual-fidelity]
summary: Phase 3 — canvas-based pixel-level visual fidelity measurement after optimization, including local HTTP server setup, pixel diff tooling, and diff region clustering.
---

# Phase 3: Visual Fidelity Measurement

After any optimization, measure the pixel-level difference between original and
optimized SVGs. This requires a local HTTP server for CORS-safe canvas rendering.

**Fidelity thresholds:**

| Diff % | Assessment | Action |
|--------|-----------|--------|
| < 1% | Excellent | Ship it |
| 1-3% | Acceptable | Check visually at display size; likely fine |
| 3-5% | Fair | Investigate top diff regions; fix if visible at display size |
| > 5% | Poor | Major issues; identify and fix before shipping |

## Pages

- [Local HTTP Server Setup](local-http-server.md) — CORS-safe serving of SVGs for canvas pixel access
- [Canvas Pixel Diff Tool](canvas-pixel-diff.md) — Render both SVGs to canvas at 2x resolution and compare every pixel
- [Diff Region Clustering](diff-region-clustering.md) — Bucket diff pixels into spatial clusters to identify problem areas
