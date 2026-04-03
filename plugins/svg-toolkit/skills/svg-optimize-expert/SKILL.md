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

## Related Skills

| Task | Use Skill |
|------|-----------|
| Sprite extraction, CSS color filters | `svg-expert` |
| SVG animation, anchor points | `svg-animation-expert` |
| Deep optimization with fidelity measurement | `svg-optimize-expert` (this skill) |

---

## Core Methodology: Measure-Optimize-Measure

The key insight: most SVG optimization is "run SVGO and hope." Deep optimization
treats it like debugging — measure the diff, identify top contributors, fix
surgically, re-measure. Every change is validated against the original.

```
Analyze Structure → SVGO Baseline → Measure Diff → Identify Issues
    → Fix Surgically → Re-Measure → Iterate Until Acceptable
```

---

## Phase 1: Structure Analysis

Before optimizing, understand what the SVG contains. Design tool exports often
include hidden complexity that inflates file size.

**What to look for:**

| Element | Why It Matters | Typical Savings |
|---------|---------------|-----------------|
| Embedded base64 PNGs (`<image href="data:image/png..."`) | Texture overlays from design tools; often 30-60% of file size | 40-70% |
| Redundant clipPaths (`<clipPath>`) | Design tools create clip regions for every texture | 5-15% |
| Unused `<defs>` | Gradients, filters, symbols never referenced | 2-10% |
| Duplicate paths | Same shape defined multiple times | 5-15% |
| `<use>` references | Can sometimes be inlined and deduplicated | 1-5% |
| High-precision coordinates | `M116.21478` vs `M116.215` — excess decimals | 5-10% |

**Investigation approach:**

```bash
# Count embedded images
grep -c 'data:image/png' input.svg

# Count clipPaths
grep -c '<clipPath' input.svg

# Count total paths
grep -c '<path' input.svg

# File size breakdown (approximate)
wc -c input.svg
```

**Design tool export patterns:**

| Tool | Common Bloat | Approach |
|------|-------------|----------|
| **Affinity Designer** | ClipPath + PNG texture layering: each region has (1) clipPath def, (2) visible fill path, (3) clipped PNG overlay | Rebuild: extract visible paths, strip clipPaths and PNGs |
| **Adobe Illustrator** | Excessive `<g>` nesting, unused defs, metadata | SVGO handles most; check for embedded rasters |
| **Figma** | Clean exports but may include unused components | SVGO usually sufficient |
| **Inkscape** | Sodipodi/Inkscape namespace attributes, editor metadata | SVGO strips metadata; check for traced artwork bloat |

---

## Phase 2: Optimization Strategy Selection

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

### Strategy A: SVGO Baseline (20-40% reduction)

For clean SVGs or when embedded assets aren't the problem:

```bash
npx svgo input.svg -o output.svg --multipass
```

### Strategy B: Targeted Cleanup + SVGO (40-60% reduction)

Remove specific bloat sources, then run SVGO:

1. Strip unused `<defs>` elements
2. Remove unreferenced `<clipPath>` definitions
3. Inline simple `<use>` references
4. Run SVGO with `--multipass`

### Strategy C: Full Rebuild (60-80% reduction)

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

---

## Phase 3: Visual Fidelity Measurement

After any optimization, measure the pixel-level difference between original and
optimized SVGs. This requires a local HTTP server for CORS-safe canvas rendering.

### Setup: Local HTTP Server

SVGs must be served from the same origin for canvas pixel access:

```javascript
// Simple server (save as server.mjs, run with: node server.mjs)
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { extname } from 'path';

const MIME = { '.html': 'text/html', '.svg': 'image/svg+xml', '.js': 'text/javascript' };

createServer((req, res) => {
  const file = '.' + (req.url === '/' ? '/index.html' : req.url);
  if (!existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(3456, () => console.log('http://localhost:3456'));
```

### Canvas Pixel Diff Tool

Render both SVGs to canvas at 2x resolution, compare every pixel:

```javascript
async function measureDiff(refUrl, testUrl, size = 864) {
  const render = (url) => new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      c.getContext('2d').drawImage(img, 0, 0, size, size);
      resolve(c.getContext('2d').getImageData(0, 0, size, size));
    };
    img.src = url;
  });

  const [ref, test] = await Promise.all([render(refUrl), render(testUrl)]);
  let diffCount = 0, significantDiffs = [];

  for (let i = 0; i < ref.data.length; i += 4) {
    const maxD = Math.max(
      Math.abs(ref.data[i] - test.data[i]),
      Math.abs(ref.data[i+1] - test.data[i+1]),
      Math.abs(ref.data[i+2] - test.data[i+2]),
      Math.abs(ref.data[i+3] - test.data[i+3])
    );
    if (maxD > 2) diffCount++;
    // Collect significant diffs for analysis
    if (maxD > 10) {
      const px = (i/4) % size, py = Math.floor((i/4) / size);
      significantDiffs.push({ x: px, y: py, maxD });
    }
  }

  return {
    totalPixels: size * size,
    diffPixels: diffCount,
    diffPercent: (diffCount / size / size * 100).toFixed(2),
    significantDiffs: significantDiffs.length
  };
}
```

**Fidelity thresholds:**

| Diff % | Assessment | Action |
|--------|-----------|--------|
| < 1% | Excellent | Ship it |
| 1-3% | Acceptable | Check visually at display size; likely fine |
| 3-5% | Fair | Investigate top diff regions; fix if visible at display size |
| > 5% | Poor | Major issues; identify and fix before shipping |

### Diff Region Clustering

Cluster diff pixels into spatial regions to identify where problems are:

```javascript
// Bucket diff pixels into 20x20 grid cells (in viewBox coordinates)
const clusters = {};
for (const p of significantDiffs) {
  const cx = Math.floor(p.x / size * viewBoxWidth / 20) * 20;
  const cy = Math.floor(p.y / size * viewBoxHeight / 20) * 20;
  const key = `${cx},${cy}`;
  if (!clusters[key]) clusters[key] = { x: cx, y: cy, count: 0, totalDiff: 0 };
  clusters[key].count++;
  clusters[key].totalDiff += p.maxD;
}
// Sort by count to find top problem areas
const sorted = Object.values(clusters).sort((a, b) => b.count - a.count);
```

---

## Phase 4: Surgical Color Correction

When diff analysis reveals color mismatches (common after removing PNG texture overlays),
sample the original's rendered colors and apply targeted fixes.

### Color Sampling

Render the original SVG to canvas and sample specific pixel coordinates:

```javascript
function sampleColor(imageData, x, y, size, viewBoxSize) {
  // Scale viewBox coordinates to canvas coordinates
  const sx = Math.round(x * size / viewBoxSize);
  const sy = Math.round(y * size / viewBoxSize);
  const i = (sy * size + sx) * 4;
  return {
    r: imageData.data[i], g: imageData.data[i+1],
    b: imageData.data[i+2], a: imageData.data[i+3],
    hex: '#' + [imageData.data[i], imageData.data[i+1], imageData.data[i+2]]
      .map(v => v.toString(16).padStart(2, '0')).join('')
  };
}
```

### Blanket vs Surgical Replacement

**Blanket** (replace all instances of a color):
```javascript
svg = svg.replaceAll('#e48476', '#eec7c3');
```

**Surgical** (target specific paths by their `d` attribute start):
```javascript
// Only change color on the face path, not the neck path using the same color
svg = svg.replace(
  /(<path d="M116\.215,178\.908[^"]*"[^>]*)#e48476/,
  '$1#eec7c3'
);
```

**When to use which:**
- **Blanket**: When all instances of a color need the same correction
- **Surgical**: When the same source color appears in different regions that need
  different rendered colors (e.g., face vs neck use same fill but render differently
  due to removed texture overlays)

---

## Checklist: Deep SVG Optimization

### Analysis (5 items)
- [ ] Counted embedded PNGs, clipPaths, unused defs
- [ ] Identified SVG type and design tool origin
- [ ] Measured original file size (raw + gzipped)
- [ ] Selected optimization strategy (A/B/C)
- [ ] Identified which clipped paths to keep vs remove (for rebuilds)

### Optimization (4 items)
- [ ] Applied chosen strategy
- [ ] Ran SVGO with `--multipass` on output
- [ ] Measured optimized file size (raw + gzipped)
- [ ] Calculated reduction percentage

### Fidelity Measurement (5 items)
- [ ] Set up local HTTP server for same-origin canvas access
- [ ] Measured pixel diff percentage at 2x resolution
- [ ] Clustered diff regions to identify top problem areas
- [ ] Assessed whether diffs are visible at actual display size
- [ ] Decided if color correction is needed (diff > 3%)

### Color Correction (4 items)
- [ ] Sampled original rendered colors at problem coordinates
- [ ] Determined blanket vs surgical replacement per color
- [ ] Applied corrections and re-measured diff
- [ ] Verified corrections didn't worsen other areas

### Final Validation (3 items)
- [ ] Compared at actual display size (not just pixel-level)
- [ ] Verified file size meets target
- [ ] Saved backup of pre-correction version

---

## Common Pitfalls

| Pitfall | Why It Happens | Solution |
|---------|---------------|----------|
| Blanket color replace breaks some areas | Same hex color used for different visual purposes (face vs neck) | Use surgical replacement targeting paths by `d` attribute |
| Diff percentage misleading | Tiny per-pixel differences across large areas inflate percentage | Check avg diff magnitude, not just pixel count; verify at display size |
| Rebuild removes too much | Skipping all clipped groups removes visible fills (faces, skin) | Keep paths inside clipped groups; only remove the clip-path attr and images |
| CORS blocks canvas pixel access | SVGs loaded from `file://` can't be read by canvas | Serve from local HTTP server (`localhost:3456`) |
| Color sampling wrong coordinates | ViewBox → canvas coordinate scaling errors | Scale: `canvasX = viewBoxX * canvasSize / viewBoxWidth` |
| Changed correct color to wrong value | Original's rendered color differs from SVG source color due to compositing | Always sample the RENDERED pixel color, not the SVG source hex value |
