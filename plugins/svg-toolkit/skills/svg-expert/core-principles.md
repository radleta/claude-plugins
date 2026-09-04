---
summary: Six foundational SVG principles covering fidelity-over-size, viewBox extraction, CSS filters, source quality, format verification, and pipeline order.
tags: [svg-expert/principles]
---

# Core Principles

## 1. Preserve Detail Over File Size

Aggressive simplification destroys traced artwork. Prioritize visual fidelity.

- **Safe**: SVGO with `--multipass` (typically 30-40% reduction)
- **Dangerous**: Inkscape path-simplify (can destroy detail)

## 2. ViewBox Extraction Over Path Surgery

Extract sprites by changing viewBox, not by deleting paths. Browser clips to viewBox automatically.

## 3. CSS Filters for Traced Artwork Color

Use CSS `hue-rotate` for traced artwork with hundreds of color variations. Direct fill editing is impractical for traced artwork but works fine for color-traced output (see SVG types).

## 4. Source Image Quality Determines Trace Quality

Flat-shaded source PNGs (one solid color per facet, no gradients) produce clean polygon edges. Gradient sources produce jagged edges regardless of post-processing. If tracing produces jagged results, fix the source image first — regenerate with flat shading using the gradient version as reference.

## 5. Verify Input Format Before Processing

AI image generators (Gemini, DALL-E) output JPEG with `.png` extension. Always verify with `file input.png` before feeding to tracing tools — wrong format causes silent failures or garbage output.

## 6. Pipeline Step Order Matters

SVGO must run before color consolidation. Reversing the order causes SVGO to merge all same-color paths into single giant paths, destroying the layered structure. The pipeline is: trace → SVGO → consolidate → validate.
