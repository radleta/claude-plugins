# CSS Color Customization Workflow

Apply color customization to traced artwork using CSS hue-rotate filter.

## Why CSS Filters?

Traced artwork contains hundreds of color variations (gradients, highlights, shadows, anti-aliasing edges). Editing individual fill colors is impractical. CSS `hue-rotate` shifts the entire color palette uniformly while preserving relative color relationships.

## Implementation

**HTML/CSS:**
```css
:root {
  --sprite-hue: 0deg;
}

.sprite-display img {
  filter: hue-rotate(var(--sprite-hue)) saturate(1.1);
  transition: filter 0.3s ease;
}
```

**Color Presets (starting from teal/cyan base):**
```javascript
const COLOR_PRESETS = [
  { name: 'teal',   hue: 0 },    // Original
  { name: 'cyan',   hue: 10 },
  { name: 'blue',   hue: 45 },
  { name: 'purple', hue: 90 },
  { name: 'pink',   hue: 130 },
  { name: 'red',    hue: 160 },
  { name: 'orange', hue: 190 },
  { name: 'yellow', hue: 220 },
  { name: 'green',  hue: -30 },  // Negative wraps around
];
```

**JavaScript to change color:**
```javascript
function setColor(hueDegrees) {
  document.documentElement.style.setProperty(
    '--sprite-hue',
    `${hueDegrees}deg`
  );
}
```

## Hue-Rotate Value Guide

Hue-rotate shifts colors around the color wheel:
- `0deg`: No change (original)
- `90deg`: Shift 90 degrees (teal → purple)
- `180deg`: Opposite color
- `-30deg` or `330deg`: Same result (negative wraps)

**Finding good presets:**
1. Start with the original artwork's dominant color
2. Calculate offsets to reach target colors
3. Test visually - some colors work better than others
4. Add `saturate(1.1)` to maintain vibrancy
