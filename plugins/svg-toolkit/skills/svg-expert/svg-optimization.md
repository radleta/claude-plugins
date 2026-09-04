---
summary: SVGO-based SVG optimization workflow with type-specific guidance for clean-vector, color-traced, and traced-artwork files.
tags: [svg-expert/optimization]
---

# SVG Optimization Workflow

## Step 1: Identify SVG Type

Examine file size, path count, color variations, and source (see SKILL.md SVG Types table).

## Step 2: Apply SVGO

```bash
npx svgo input.svg -o output.svg --multipass
```

Expected: 20-40% reduction, no visual change, safe for all SVG types.

**Options:** `--multipass` (recommended), `--config=svgo.config.js`, `--precision=N`

## Step 3: Assess Further

- **Clean vectors**: Path simplification may help (test visually first)
- **Color-traced**: Minor path consolidation possible, test carefully
- **Traced artwork**: STOP at SVGO — path simplification destroys detail
