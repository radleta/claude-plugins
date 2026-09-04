---
tags: [svg-optimize-expert/surgical-color-correction]
summary: Phase 4 — sample rendered colors from the original SVG and apply targeted blanket or surgical color corrections after removing texture overlays.
---

# Phase 4: Surgical Color Correction

When diff analysis reveals color mismatches (common after removing PNG texture overlays),
sample the original's rendered colors and apply targeted fixes.

## Color Sampling

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

## Blanket vs Surgical Replacement

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
