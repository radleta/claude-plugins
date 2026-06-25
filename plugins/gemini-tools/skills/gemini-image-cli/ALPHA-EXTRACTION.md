# Alpha Extraction Protocol: Gemini Images to Transparent PNGs

Gemini cannot generate transparent backgrounds. These are the validated extraction paths, ordered by recommendation.

## Decision table

| Content type | Default approach | Command |
|---|---|---|
| Logo, icon, illustration (with or without text) | **rembg + birefnet-general** | `rembg -m birefnet-general in.png out.png` |
| Portrait, product photo, any single-subject photo | **rembg + birefnet-general** | `rembg -m birefnet-general in.png out.png` |
| Composed scene — extract one object from many | **SAM2 (point-prompted)** | Python snippet below |
| Fresh pixel art where you control generation | Magenta + flood-fill (legacy) | See bottom section |

Validated by comparison experiment across 5 tools (u2net, birefnet-general, bria-rmbg, isnet-general-use, SAM2) on logo / pixel-art / portrait content. `birefnet-general` won or tied in every category except multi-object pixel art scenes, where SAM2's point-prompted segmentation wins.

## Setup

### rembg (default tool)

```bash
pip install "rembg[cpu,cli]"
```

First run of a given model downloads its weights (birefnet-general ≈ 400 MB), cached after.

### SAM2 (for composed scenes)

```bash
pip install ultralytics
```

First use downloads `sam2.1_b.pt` (≈ 155 MB) to the current directory.

## Default recipe 1: rembg + birefnet-general

One-shot:

```bash
rembg i -m birefnet-general input.png output.png
```

**Why birefnet-general over rembg's default (`u2net`):**
- Preserves text in logos (u2net strips it as a separate object)
- Cleaner edges on hair and fine detail
- Fewer halo artifacts than `bria-rmbg`

Verify the alpha visually. If ImageMagick 7+ is installed:

```bash
w=$(magick identify -format '%w' output.png)
h=$(magick identify -format '%h' output.png)
magick -size ${w}x${h} pattern:checkerboard output.png -composite review.png
```

If ImageMagick isn't available, PIL (installed via rembg) works:

```python
from PIL import Image, ImageDraw

def checkerboard(w, h, sq=16):
    img = Image.new('RGB', (w, h), 'white')
    d = ImageDraw.Draw(img)
    for y in range(0, h, sq):
        for x in range(0, w, sq):
            if ((x // sq) + (y // sq)) % 2 == 0:
                d.rectangle([x, y, x+sq, y+sq], fill=(200, 200, 200))
    return img

fg = Image.open('output.png').convert('RGBA')
bg = checkerboard(fg.width, fg.height)
bg.paste(fg, (0, 0), fg)
bg.save('review.png')
```

## Default recipe 2: SAM2 for composed scenes

Use when the image contains multiple semantic objects and you want to extract just one (e.g., a character with a decorative moon in the background).

```python
from ultralytics import SAM
from PIL import Image
import numpy as np

model = SAM("sam2.1_b.pt")

src = "input.png"
img = Image.open(src).convert("RGB")
w, h = img.size

# Positive-click coordinates on the subject you want to keep.
# Use multiple points across large/irregular subjects.
points = [[w // 2, h // 2]]
labels = [1] * len(points)  # 1 = positive (include)

results = model(src, points=points, labels=labels, verbose=False)
mask = results[0].masks.data.cpu().numpy()
combined = np.any(mask, axis=0).astype(np.uint8) * 255
mask_img = Image.fromarray(combined, mode='L').resize((w, h), Image.LANCZOS)

# SAM2 sometimes returns the background as the "object." Auto-invert if coverage > 70%.
coverage = (np.array(mask_img) > 128).sum() / (w * h) * 100
if coverage > 70:
    mask_img = Image.eval(mask_img, lambda v: 255 - v)

rgba = img.convert("RGBA")
rgba.putalpha(mask_img)
rgba.save("output.png")
```

**Tips:**
- For irregular subjects, pass several positive points spread across the whole shape
- Point prompts fail on thin features like text strokes; use a box prompt (`bboxes=[[x1,y1,x2,y2]]`) for rectangular regions of interest
- The >70% coverage auto-invert handles SAM2's common failure mode where it segments the largest connected region (often the background)

## Alternative rembg models (backups)

Tested in the comparison experiment. Use when birefnet-general doesn't fit your content:

| Model | When to reach for it |
|---|---|
| `isnet-general-use` | Scenes with decorative background elements that birefnet keeps — isnet was the only automatic model to exclude a moon from a ghost composition |
| `u2net` (rembg default) | Simple portraits; do **not** use on logos (strips text) |
| `bria-rmbg` | Rarely — tends to keep unwanted objects (table legs, purple halos) |
| `silueta`, `u2netp` | Faster/smaller variants when batch throughput matters more than edge quality |

Full list: `rembg i --help`.

## Legacy recipe: Magenta + flood-fill (pixel art, fresh generations)

Use this when you're generating fresh pixel art or illustration where you control the prompt, and want edges that are guaranteed perfect (not ML-approximated). Requires ImageMagick 7+.

### Why this still exists alongside the ML path

ML models give one-shot convenience but approximate edges — bad for pixel art (anti-aliased mush) and asset pipelines where you need bit-perfect cutouts. When you can specify the background at generation time, magenta + flood-fill gives deterministic, pixel-perfect results.

### Step 1: Generate with magenta background

Include "on a solid magenta (#FF00FF) background" in every Gemini prompt for assets that need transparency.

```bash
gemini-image "a cute ghost character on a solid magenta (#FF00FF) background, clean pixel art, bold dark outlines" -o ghost.png
```

For sprite sheets, also specify "NO labels, NO text" and even spacing between sprites.

### Step 2: Slice sprite sheets (if applicable)

```bash
magick sprite-sheet.png -crop 5x2@ +repage tile_%02d.png
```

If sprites are unevenly placed, use manual crops instead:

```bash
magick sprite-sheet.png -crop 300x300+10+10 +repage sprite_01.png
```

### Step 3: Flood-fill corners to transparent

Flood-fill from all 4 corners. The fill spreads through the background and stops at the artwork's dark outline.

```bash
w=$(magick identify -format '%w' input.png)
h=$(magick identify -format '%h' input.png)

magick input.png \
  -fuzz 20% \
  -fill none \
  -draw "color 0,0 floodfill" \
  -draw "color $((w-1)),0 floodfill" \
  -draw "color 0,$((h-1)) floodfill" \
  -draw "color $((w-1)),$((h-1)) floodfill" \
  output-step3.png
```

**Fuzz tuning:**
- **20%** — default. Handles Gemini's magenta shade variation without bleeding through thin gaps.
- **15%** — artwork has thin gaps between elements (hand holding pencil with gap between fingers).
- **30%** — single solid outline with no thin gaps. Catches more magenta variants.

Diagnostic: if elements vanish after flood-fill, fuzz is too high and the fill bled through an outline gap. Lower fuzz for that sprite.

### Step 4: Edge erode to remove fringe

```bash
magick output-step3.png \
  \( +clone -alpha extract -morphology erode disk:1 \) \
  -compose CopyOpacity -composite \
  -trim +repage \
  output-final.png
```

1. `+clone -alpha extract` — grayscale alpha mask
2. `-morphology erode disk:1` — shrink mask by 1px
3. `-compose CopyOpacity -composite` — apply the eroded mask
4. `-trim +repage` — crop to content

### Step 5: Visual verification (required)

Always show results to the user for approval at each visual step:

```bash
# Single image
magick -size 300x300 tile:pattern:checkerboard output-final.png -gravity center -composite review.png

# Multi-sprite review sheet
magick montage sprites/*.png \
  -tile 7x1 -geometry 250x260+10+10 \
  -background none PNG32:review-alpha.png
magick -size 1850x290 tile:pattern:checkerboard review-alpha.png -gravity center -composite review.png
```

**Checklist:**
- [ ] No magenta fringe visible on any edge
- [ ] No interior pixels knocked out (check held items, thin appendages)
- [ ] Checkerboard visible through all background areas
- [ ] Artwork colors unchanged from original

If fringe remains: re-run step 3 with higher fuzz, or step 4 with `disk:2` (erodes 2px, use sparingly).

If interior pixels are missing: re-run step 3 with lower fuzz on that specific sprite.

### Step 6: Scale for target use (optional)

For tray icons and other small targets, use nearest-neighbor to preserve pixel-art crispness:

```bash
magick master.png -filter point -resize 32x32 icon-32.png
magick master.png -filter point -resize 16x16 icon-16.png
```

Keep the full-size masters as source-of-truth.

### Troubleshooting (magenta protocol)

| Symptom | Cause | Fix |
|---------|-------|-----|
| Elements vanish after flood-fill | Fuzz too high, fill bled through outline gap | Lower fuzz to 15% for that sprite |
| Magenta fringe remains after erode | Anti-alias pixels too wide | `disk:2` erode, or raise fuzz slightly |
| Entire image goes transparent | No dark outline on artwork | Re-generate with "bold dark outlines" |
| Colors shifted after processing | Used hue-based removal instead of flood-fill | Use flood-fill (preserves all non-background pixels) |
| Scaled icon looks blurry | Used default (bilinear) interpolation | Use `-filter point` |
| Artifacts inside artwork | Flood-fill entered through thin gap | Process that sprite with lower fuzz; re-generate with thicker outlines |

## Related

- Kdenlive's background remover uses SAM2 — see kdenlive wiki for context on why this approach was investigated
