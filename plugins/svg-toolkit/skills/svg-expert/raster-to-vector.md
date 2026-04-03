# Raster-to-Vector Tracing Pipeline

Convert PNG/raster images to optimized multi-color SVG using vtracer + SVGO + manual color consolidation.

## Tool Selection

| Tool | Color Support | Output | Best For |
|------|--------------|--------|----------|
| **vtracer** | Full color (direct) | Multi-color SVG | Color artwork, icons, gems |
| **potrace** | Black/white only | Single-color paths | Line art, silhouettes, text |
| **Inkscape trace** | Limited | Variable | Simple shapes |

**Use vtracer for color artwork.** Potrace requires manual threshold stacking for color and produces self-intersecting paths that leave holes at complex intersections.

## Prerequisites

### vtracer Installation (WSL2 recommended on Windows)

vtracer Python bindings segfault on Python 3.14 Windows. Use WSL2:

```bash
# In WSL2 Ubuntu
pip install vtracer
```

### Input Format Gotcha: JPEG-as-PNG

AI image generators (Gemini, DALL-E) often output JPEG with `.png` extension. vtracer requires real PNG:

```bash
# Check actual format
file input.png
# If "JPEG image data" → convert:
magick input.png PNG:output-real.png
```

## Pipeline: PNG → Optimized SVG

### Step 1: Trace with vtracer

```python
import vtracer

vtracer.convert_image_to_svg_py(
    image_path='/tmp/input.png',     # NOT input_path
    out_path='/tmp/output.svg',      # NOT output_path
    colormode='color',
    hierarchical='stacked',
    filter_speckle=16,       # Edge cleanliness (higher = cleaner silhouette, fewer slivers)
    color_precision=8,        # Interior detail (higher = more facets, more color zones)
    path_precision=1,         # Coordinate decimal places
    mode='polygon',           # polygon produces smaller files than default (spline)
    corner_threshold=60,
    length_threshold=4.0,
    splice_threshold=45,
    max_iterations=10,
)
```

**Two-knob tuning system** — `color_precision` and `filter_speckle` are the primary controls:

| Setting | Controls | Lower → | Higher → |
|---------|----------|---------|----------|
| `color_precision` | Interior detail/facets | Fewer colors, larger flat zones, smaller file | More facets, more detail, larger file |
| `filter_speckle` | Edge cleanliness | More tiny sliver paths (jagged edges) | Cleaner silhouette, fewer artifacts |
| `mode` | Path type | — | `polygon` = smaller, `spline` = smoother |
| `path_precision` | Coordinate decimals | Blockier, smaller | Smoother, larger |

**Recommended presets:**

| Use Case | `color_precision` | `filter_speckle` | Result |
|----------|-------------------|-------------------|--------|
| Clean low-poly icons (flat source) | 8 | 16 | ~50 paths, clean edges, max detail |
| Moderate detail icons | 5-6 | 6 | ~40-70 paths, good balance |
| Simple shapes/logos | 5 | 6 | ~20-40 paths, minimal |

**Source image quality matters most:** Flat-shaded PNGs (one solid color per facet, no gradients) produce clean polygon edges. If source has gradients, regenerate with flat shading first.

**WSL2 file access:** NTFS-mounted paths work fine for vtracer. `/tmp` copy only needed if you encounter path issues:

```bash
cp /mnt/d/project/image.png /tmp/
# Run vtracer on /tmp/image.png
cp /tmp/output.svg /mnt/d/project/
```

### Step 2: SVGO Optimization

Run SVGO **before** color consolidation (SVGO merges same-color paths, which destroys color info if you consolidate first):

```bash
npx svgo input.svg -o output-svgo.svg --multipass
```

Expected: 30-50% reduction.

### Step 3: Color Consolidation

vtracer produces near-duplicate colors (e.g., `#8444e2` vs `#8444e1`, `#5f22c1` vs `#5f22c0`). Consolidate to a clean palette:

**Algorithm (Python — use euclidean RGB distance, most-frequent member):**

```python
import re, math
from collections import Counter

svg = open("input-svgo.svg").read()
fills = re.findall(r'fill="(#[0-9A-Fa-f]{6})"', svg)
freq = Counter(fills)

def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0,2,4))

def rgb_dist(a, b):
    return math.sqrt(sum((x-y)**2 for x,y in zip(a,b)))

# Group colors within distance threshold (20 works well for traced icons)
colors = list(freq.keys())
groups, used = [], set()
for c in sorted(colors, key=lambda x: -freq[x]):  # start from most frequent
    if c in used: continue
    group = [c]
    used.add(c)
    for c2 in colors:
        if c2 not in used and rgb_dist(hex_to_rgb(c), hex_to_rgb(c2)) < 20:
            group.append(c2)
            used.add(c2)
    groups.append(group)

# Replace each group member with the MOST FREQUENT member (NOT average — averaging washes out)
for group in groups:
    rep = max(group, key=lambda x: freq[x])
    for c in group:
        if c != rep:
            svg = svg.replace(f'fill="{c}"', f'fill="{rep}"')
```

**Distance threshold guide:**

| Palette Type | Threshold | Example |
|-------------|-----------|---------|
| Subtle gradations (grays, skin tones) | 8-12 | Gray sphere with 49 shades — threshold=20 merges to 13, destroying depth |
| Distinct color zones (gems, icons) | 15-20 | Purple gem with 5-8 distinct hues — threshold=20 works well |
| Very few colors needed | 25-30 | Simple logo with 3 brand colors |

**Warning:** Monochrome palettes (all grays, all blues) are especially sensitive — many shades fall within threshold=20 distance. Always compare before/after color counts. If consolidation drops >50% of colors, the threshold is too aggressive — lower it or skip consolidation entirely (bg removal only).

**Critical:** Use most-frequent member as representative, not RGB average — averaging shifts colors lighter/desaturated, destroying contrast.

**Important:** Do NOT re-run SVGO after color consolidation — it will merge all paths sharing a fill into one giant path, losing the layered structure.

### Step 4: Remove Background

If the source had a solid background, remove the background rect/path:

```python
import re

# ONLY remove simple full-canvas rect (d attribute is JUST the rect, nothing else)
svg = re.sub(r'<path[^>]*d="M0 0h1024v1024H0Z"[^>]*/>', '', svg, count=1)
```

**Do NOT blindly remove near-white paths** — `#fefefe` or `#ffffff` paths may be highlight layers or compound paths that provide fill coverage inside the shape. Removing them creates transparency holes.

**Gap-fill pattern:** Traced SVGs often have gaps between facet paths. The full-canvas background rect fills those gaps. After removing it, add a shape-sized backdrop to fill the gaps:

```python
# After removing bg rect, add shaped backdrop with the bg color
# Determine shape bounds from remaining paths, then:
svg = svg.replace(
    '<path',  # insert before first path
    f'<circle fill="{bg_color}" cx="512" cy="512" r="440"/><path',
    1  # only first occurrence
)
```

Choose backdrop shape to match the icon (circle for spheres, rect for squares, etc.). The backdrop color should match the original background rect's fill.

**Compound background gotcha:** Sometimes background is compound with shape (`M0 0h1024v1024H0Zm514 86...`). The `Z` ends the background rect, then `m` starts the shape cutout. This path draws background color everywhere EXCEPT inside the shape — it's a mask, not a simple background. Do NOT remove it. If you must make the exterior transparent, replace the compound path with a shape-clipped fill that covers only the interior.

### Step 5: Add viewBox (Required for Component Usage)

SVGs from vtracer have `width` and `height` but no `viewBox`. Without `viewBox`, the SVG coordinate system stays at full pixel dimensions (e.g., 1024×1024) and CSS scaling clips content to nothing.

```python
# Add viewBox matching width/height
svg = svg.replace('width="1024" height="1024"',
                  'width="1024" height="1024" viewBox="0 0 1024 1024"')
```

This is required when using SVGs as React components (vite-plugin-svgr `?react` imports), `<img>` tags, or any context where CSS controls rendered size.

### Step 6: Visual Fidelity Verification

Compare each pipeline stage against the source PNG to catch regressions. Issues like missing shapes, transparency holes, and color loss are often invisible in code diffs but obvious visually.

**Quick check** — compare path/color counts across stages:

```bash
for f in raw-trace.svg svgo.svg final.svg; do
  paths=$(grep -o '<path' "$f" | wc -l)
  colors=$(grep -oP 'fill="#[^"]*"' "$f" | sort -u | wc -l)
  echo "$f: $paths paths, $colors colors"
done
```

If path count drops unexpectedly between stages, a step removed something it shouldn't have.

**Canvas-based pixel diff** — render both source PNG and SVG to canvas, compare pixel-by-pixel to find mismatches:

```html
<!-- Serve via local HTTP server to avoid CORS/taint issues with SVG -->
<canvas id="diff" width="400" height="400"></canvas>
<script>
async function diffImages(pngUrl, svgUrl) {
  // Load PNG
  const pngImg = await loadImage(pngUrl);
  const c1 = Object.assign(document.createElement('canvas'), {width:400, height:400});
  c1.getContext('2d').drawImage(pngImg, 0, 0, 400, 400);
  const d1 = c1.getContext('2d').getImageData(0, 0, 400, 400);

  // Load SVG via data URL (avoids canvas taint)
  const svgText = await (await fetch(svgUrl)).text();
  const svgDataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgText)));
  const svgImg = await loadImage(svgDataUrl);
  const c2 = Object.assign(document.createElement('canvas'), {width:400, height:400});
  c2.getContext('2d').drawImage(svgImg, 0, 0, 400, 400);
  const d2 = c2.getContext('2d').getImageData(0, 0, 400, 400);

  // Pixel diff — red = significant mismatch
  const ctx = document.getElementById('diff').getContext('2d');
  const out = ctx.createImageData(400, 400);
  for (let i = 0; i < d1.data.length; i += 4) {
    const diff = (Math.abs(d1.data[i]-d2.data[i]) +
                  Math.abs(d1.data[i+1]-d2.data[i+1]) +
                  Math.abs(d1.data[i+2]-d2.data[i+2])) / 3;
    const amp = Math.min(255, diff * 5);  // 5x amplification
    out.data[i]   = amp > 15 ? 255 : d2.data[i];    // red channel
    out.data[i+1] = amp > 15 ? 0   : d2.data[i+1];  // green
    out.data[i+2] = amp > 15 ? 0   : d2.data[i+2];  // blue
    out.data[i+3] = 255;
  }
  ctx.putImageData(out, 0, 0);
}
</script>
```

**Must use local HTTP server** (`python -m http.server 8888`) — `file://` URLs cause canvas taint errors with SVG `getImageData()`.

**What to look for in the diff:**

| Visual Symptom | Root Cause | Fix |
|---------------|------------|-----|
| Red patches inside shape | Color consolidation too aggressive | Lower threshold or skip consolidation |
| Checkerboard/transparency holes | Background removal deleted a layer | Add shaped backdrop or keep compound path |
| Red outline around shape | Edge paths removed by filter_speckle | Lower filter_speckle |
| Large solid-color areas in SVG where PNG has variation | color_precision too low | Increase color_precision |
| White square behind shape | Background rect not removed | Remove simple `M0 0...Z` rect |

**Compare across pipeline stages, not just final vs source.** If SVGO output looks correct but final doesn't, the problem is in consolidation or bg removal — not tracing.

## Output: Color-Traced SVG Type

The result is a **color-traced** SVG — between clean-vector and traced-artwork:

| Property | Clean Vector | Color-Traced | Traced Artwork |
|----------|-------------|--------------|----------------|
| Paths | 5-20 | 15-50 | 100s-1000s |
| Colors | Solid fills | 3-8 palette | 100s of variations |
| File size | <5KB | 3-15KB | 50KB-1MB |
| Edit fills? | Yes | Yes (consolidated) | No (use CSS filters) |
| Simplify? | Yes | Carefully | No |

## Common Pitfalls

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| JPEG-as-PNG | vtracer errors or bad output | `magick input.png PNG:real.png` |
| Gradient source PNG | Jagged edges on traced silhouette | Regenerate with flat shading (one solid color per facet) |
| Jagged outer edges | Tiny sliver paths along boundary | Increase `filter_speckle` (try 12-16) |
| SVGO after consolidation | All same-color paths merge into one | Run SVGO first, consolidate after |
| Color averaging | Washed-out/desaturated palette | Use most-frequent member, not RGB average |
| Compound bg paths | Background merged with shape path | Keep compound path (it's a mask); add shaped backdrop instead |
| Too many colors | 20+ near-duplicate shades | Lower `color_precision` or consolidate (threshold=20) |
| Consolidation too aggressive | Subtle palette (grays) loses depth | Lower threshold (8-12) or skip consolidation for monochrome palettes |
| Missing viewBox | SVG clips to nothing in React/CSS | Add `viewBox="0 0 W H"` matching width/height |
| Gap-fill holes after bg removal | Transparency between facet paths | Add shaped backdrop (`<circle>` or `<rect>`) with bg color |
| Removed highlight layer | Holes where near-white facets were | Don't regex-remove `#fefefe` paths — they may be shape highlights, not background |
| Potrace for color | Self-intersecting paths, holes | Use vtracer instead |
| vtracer on Windows | Segfault with Python 3.14 | Use WSL2 Ubuntu (`pip3 install vtracer`) |
| Wrong vtracer params | "unexpected keyword argument" | Use `image_path`/`out_path` (NOT `input_path`/`output_path`) |

## Checklist: Raster-to-Vector Tracing

### Pre-Tracing
- [ ] Verified input is real PNG (`file input.png` shows "PNG image data")
- [ ] Converted JPEG-as-PNG if needed (`magick input.png PNG:real.png`)
- [ ] Chosen tool: vtracer (color) or potrace (B&W line art)
- [ ] WSL2 available if on Windows

### Tracing
- [ ] vtracer ran without errors
- [ ] Output SVG opens in browser/viewer
- [ ] Visual comparison against source PNG at 1x and zoomed
- [ ] Path count is reasonable (15-50 for icons, higher for illustrations)

### Optimization
- [ ] SVGO `--multipass` applied (before color consolidation)
- [ ] File size reduction noted (expect 30-50%)
- [ ] No visual degradation after SVGO

### Color Consolidation
- [ ] Extracted unique colors (`grep -oP 'fill="#[^"]*"' | sort -u`)
- [ ] Grouped near-duplicates to target palette (3-8 colors typical)
- [ ] Applied sed replacements
- [ ] Verified color counts match expectations (`sort | uniq -c`)
- [ ] Did NOT re-run SVGO after consolidation

### Background & viewBox
- [ ] Simple background rect removed (only `d="M0 0...Z"` with no continuation)
- [ ] Compound paths preserved (near-white paths with shape cutouts kept intact)
- [ ] Shaped backdrop added if facet gaps visible after bg removal
- [ ] `viewBox="0 0 W H"` added matching width/height attributes

### Visual Fidelity Verification
- [ ] Compared path/color counts across pipeline stages (trace → SVGO → final)
- [ ] No unexpected path count drops between stages
- [ ] Pixel diff shows no transparency holes inside shape
- [ ] Pixel diff shows no large solid-color areas where source has variation
- [ ] Final SVG renders correctly in target context (browser, React component)
- [ ] Final file size is reasonable (<10KB icons, <50KB illustrations)
- [ ] Source PNG preserved alongside final SVG
