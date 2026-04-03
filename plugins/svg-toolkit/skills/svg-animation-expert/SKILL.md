---
name: svg-animation-expert
description: "Validated techniques for creating interactive HTML tools that precisely locate animation anchor points on SVG/PNG graphics. Use when building engine thrust effects, particle emitters, sprite attachment points, or any visual effect requiring precise coordinate mapping — even for simple single-point anchors."
---

<role>
  <identity>Expert in SVG animation point locator tool development</identity>

  <purpose>
    Guide creation of interactive HTML tools for precisely marking animation
    anchor points on graphics, with techniques for accurate coordinate mapping
  </purpose>

  <expertise>
    <area>Interactive HTML locator tool architecture</area>
    <area>CSS object-fit and letterboxing calculations</area>
    <area>box-sizing border adjustments for coordinate systems</area>
    <area>Normalized coordinate transformations (-1 to 1 range)</area>
    <area>Multi-point animation configurations (engines, particles, attachments)</area>
  </expertise>

  <scope>
    <in-scope>
      <item>Creating HTML tools for marking animation points on images</item>
      <item>Solving coordinate offset issues (letterboxing, borders)</item>
      <item>Generating normalized coordinate configurations</item>
      <item>Ship engine placement, particle emitter positioning</item>
      <item>Any sprite/graphic requiring precise anchor points</item>
    </in-scope>

    <out-of-scope>
      <item>Actual SVG animation implementation (CSS/JS animation code)</item>
      <item>SVG path manipulation or optimization</item>
      <item>Game engine integration specifics</item>
    </out-of-scope>
  </scope>
</role>

---

## Problem This Skill Solves

Precise anchor points prevent these failures:
- Effects offset from intended positions
- Trial-and-error coordinate adjustment
- Inconsistent positioning across sprite sizes

**Solution:** Create an interactive HTML locator tool that outputs normalized coordinates on click.

---

## When to Use This Skill

<request-patterns>
  <pattern type="engine-placement">
    <triggers>engine, thrust, exhaust, flame, ship</triggers>
    <action>Create locator tool to mark engine positions on ship sprites</action>
  </pattern>

  <pattern type="particle-emitters">
    <triggers>particle, emitter, effect, spawn point</triggers>
    <action>Create locator tool to mark particle emission points</action>
  </pattern>

  <pattern type="attachment-points">
    <triggers>attachment, anchor, mount, weapon, turret</triggers>
    <action>Create locator tool to mark attachment coordinates</action>
  </pattern>

  <pattern type="coordinate-debugging">
    <triggers>offset, wrong position, misaligned, coordinates broken</triggers>
    <action>Check for letterboxing, box-sizing, or normalization errors</action>
  </pattern>
</request-patterns>

---

## Critical Coordinate System Pitfalls

### Pitfall #1: object-fit: contain Letterboxing

When using `object-fit: contain`, the visual content may not fill the entire `<img>` element bounds.

<examples category="letterboxing-handling">
  <negative>
    <description>Assumes click coordinates map directly to image</description>
    <code>
```javascript
// ❌ WRONG: Ignores letterboxing
container.addEventListener('click', (e) => {
  const rect = container.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;  // Wrong!
  const y = (e.clientY - rect.top) / rect.height;  // Wrong!
});
```
    </code>
    <why-bad>Coordinates will be offset because image doesn't fill container</why-bad>
  </negative>

  <positive>
    <description>Calculate actual visual bounds before mapping coordinates</description>
    <code>
```javascript
// ✅ CORRECT: Account for letterboxing first
const visualBounds = calculateLetterboxing(img);
const relativeX = clickX - visualBounds.visualOffsetX;
const relativeY = clickY - visualBounds.visualOffsetY;
const x = relativeX / visualBounds.visualWidth;
const y = relativeY / visualBounds.visualHeight;
```
    </code>
    <why-good>Coordinates are relative to actual visual content, not container</why-good>
  </positive>
</examples>

**Letterboxing calculation function:**

```javascript
function calculateLetterboxing(img) {
  const imgWidth = img.offsetWidth;
  const imgHeight = img.offsetHeight;
  const naturalWidth = img.naturalWidth;
  const naturalHeight = img.naturalHeight;
  const aspectRatio = naturalWidth / naturalHeight;

  let visualWidth, visualHeight, visualOffsetX, visualOffsetY;

  if (imgWidth / imgHeight > aspectRatio) {
    // Letterboxed horizontally (image is taller than container ratio)
    visualHeight = imgHeight;
    visualWidth = imgHeight * aspectRatio;
    visualOffsetX = (imgWidth - visualWidth) / 2;
    visualOffsetY = 0;
  } else {
    // Letterboxed vertically (image is wider than container ratio)
    visualWidth = imgWidth;
    visualHeight = imgWidth / aspectRatio;
    visualOffsetX = 0;
    visualOffsetY = (imgHeight - visualHeight) / 2;
  }

  return { visualWidth, visualHeight, visualOffsetX, visualOffsetY };
}
```

### Pitfall #2: box-sizing: border-box

When a container uses `box-sizing: border-box`, the specified width/height INCLUDES borders.

**Dimension calculation:**
- Total width: 350px
- Border: 2px × 2 = 4px
- **Content width: 346px** (not 350px!)
- **True center: 173px** (not 175px!)

<examples category="border-box-handling">
  <negative>
    <description>Uses container dimensions directly</description>
    <code>
```javascript
// ❌ WRONG: Ignores border in box-sizing: border-box
const centerX = container.offsetWidth / 2;  // Returns 175, not 173!
```
    </code>
    <why-bad>offsetWidth includes borders, causing 2px offset error</why-bad>
  </negative>

  <positive>
    <description>Subtract border widths from container dimensions</description>
    <code>
```javascript
// ✅ CORRECT: Calculate content dimensions
const style = window.getComputedStyle(container);
const borderLeft = parseFloat(style.borderLeftWidth) || 0;
const borderRight = parseFloat(style.borderRightWidth) || 0;
const contentWidth = container.offsetWidth - borderLeft - borderRight;
const centerX = contentWidth / 2;  // Returns 173 correctly
```
    </code>
    <why-good>Accounts for border-box border inclusion</why-good>
  </positive>
</examples>

**Content dimensions function:**

```javascript
function getContentDimensions(container) {
  const style = window.getComputedStyle(container);
  const borderLeft = parseFloat(style.borderLeftWidth) || 0;
  const borderRight = parseFloat(style.borderRightWidth) || 0;
  const borderTop = parseFloat(style.borderTopWidth) || 0;
  const borderBottom = parseFloat(style.borderBottomWidth) || 0;

  const contentWidth = container.offsetWidth - borderLeft - borderRight;
  const contentHeight = container.offsetHeight - borderTop - borderBottom;

  return { contentWidth, contentHeight, borderLeft, borderTop };
}
```

### Pitfall #3: Click Position vs Content Position

Click events give coordinates relative to the element's border edge, not content edge.

<examples category="click-position-handling">
  <negative>
    <description>Uses click coordinates directly</description>
    <code>
```javascript
// ❌ WRONG: Doesn't adjust for border offset
container.addEventListener('click', (e) => {
  const rect = container.getBoundingClientRect();
  const x = e.clientX - rect.left;  // Relative to border edge!
  const y = e.clientY - rect.top;   // Off by border width
});
```
    </code>
    <why-bad>getBoundingClientRect includes border, coordinates are offset</why-bad>
  </negative>

  <positive>
    <description>Subtract border offset from click coordinates</description>
    <code>
```javascript
// ✅ CORRECT: Adjust for border offset
container.addEventListener('click', (e) => {
  const rect = container.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;

  // Adjust for border
  const { borderLeft, borderTop } = getContentDimensions(container);
  const contentX = clickX - borderLeft;  // Now relative to content edge
  const contentY = clickY - borderTop;
});
```
    </code>
    <why-good>Coordinates are relative to content area, not border edge</why-good>
  </positive>
</examples>

---

## Normalized Coordinates

Store coordinates as normalized values (-1 to 1 range) relative to center:

```javascript
// Convert pixel position to normalized (-1 to 1)
function toNormalized(pixelPos, center, halfSize) {
  return (pixelPos - center) / halfSize;
}

// Convert normalized back to pixels
function toPixels(normalized, center, halfSize) {
  return center + (normalized * halfSize);
}
```

**Benefits:**
- Scale-independent (works at any render size)
- Centered at 0,0 (intuitive for symmetric sprites)
- Easy to reason about (-1 = left/top edge, +1 = right/bottom edge)

---

## Locator Tool Architecture

### HTML Structure

```html
<div class="ship-container" data-ship="rocket">
  <img src="rocket.svg" alt="rocket">
  <div class="crosshair center-marker"></div>
  <div class="engine-markers"></div>
</div>
```

### CSS Requirements

```css
.ship-container {
  position: relative;
  width: 350px;
  height: 350px;
  border: 2px solid #333;
  box-sizing: border-box;  /* Be aware of this! */
}

.ship-container img {
  position: absolute;
  width: 90%;
  height: 90%;
  top: 5%;
  left: 5%;
  object-fit: contain;  /* Maintains aspect ratio */
  pointer-events: none;  /* Click passes through to container */
}

.crosshair {
  position: absolute;
  pointer-events: none;
  /* Visual styling for crosshair */
}

.engine-marker {
  position: absolute;
  width: 10px;
  height: 10px;
  background: red;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}
```

### JavaScript Flow

1. **Initialize:** Calculate container content dimensions
2. **Set Center:** Click to mark sprite center (accounts for letterboxing)
3. **Add Points:** Click to add animation anchor points
4. **Output:** Generate normalized coordinate configuration

---

## Complete Example Reference

For projects using this pattern, create an `engine-locator.html` tool using the architecture described above. A working implementation should include:
- Center crosshair positioning
- Multiple point markers with visual indicators
- Real-time normalized coordinate output display
- Grid layout for multiple sprites/assets

---

## Output Format

Generate configuration in this structure:

```typescript
interface AnimationPointConfig {
  engines: Array<{ x: number; scale?: number }>;  // x is normalized (-1 to 1)
  yOffset: number;  // Normalized Y position (positive = below center)
}

// Example output
const SHIP_ENGINE_CONFIG = {
  rocket: {
    engines: [{ x: -0.23, scale: 0.9 }, { x: 0.21, scale: 0.9 }],
    yOffset: 0.71,
  },
  fighter: {
    engines: [{ x: -0.08, scale: 1.0 }, { x: 0.1, scale: 1.0 }],
    yOffset: 0.33,
  },
};
```

**Integration:** Import this configuration into your animation system. Use `toPixels()` to convert normalized coordinates to actual render positions at runtime, passing the current sprite dimensions.

---

## Workflow

<workflow type="sequential">
  <step id="1-create-tool" order="first">
    <description>Create locator HTML tool with container grid for all sprites</description>
    <actions>
      <action>Create HTML file with grid layout for sprite containers</action>
      <action>Add img elements for each sprite/asset</action>
      <action>Add marker container divs for crosshairs and points</action>
    </actions>
    <acceptance-criteria>
      <criterion priority="critical">HTML file opens in browser without errors</criterion>
      <criterion priority="critical">All sprite images visible in grid layout</criterion>
      <criterion priority="high">Containers sized appropriately (300-400px typical)</criterion>
    </acceptance-criteria>
    <blocks>2-apply-css</blocks>
  </step>

  <step id="2-apply-css" order="second" depends-on="1-create-tool">
    <description>Apply CSS with object-fit and box-sizing handling</description>
    <actions>
      <action>Set container position: relative with explicit dimensions</action>
      <action>Set img to object-fit: contain with pointer-events: none</action>
      <action>Style markers with transform: translate(-50%, -50%) for centering</action>
    </actions>
    <acceptance-criteria>
      <criterion priority="critical">Images maintain aspect ratio (no stretching)</criterion>
      <criterion priority="high">Images centered within containers</criterion>
      <criterion priority="high">Marker styles visible and positioned absolutely</criterion>
    </acceptance-criteria>
    <blocks>3-click-handlers</blocks>
  </step>

  <step id="3-click-handlers" order="third" depends-on="2-apply-css">
    <description>Implement click handlers with border and letterboxing adjustments</description>
    <actions>
      <action>Add click listener to each container</action>
      <action>Implement getContentDimensions() for border adjustment</action>
      <action>Implement calculateLetterboxing() for visual bounds</action>
      <action>Apply both adjustments before coordinate calculation</action>
    </actions>
    <acceptance-criteria>
      <criterion priority="critical">Click on visual center returns (0, 0) normalized</criterion>
      <criterion priority="critical">No offset errors from borders or letterboxing</criterion>
      <criterion priority="high">Console shows coordinates on each click</criterion>
    </acceptance-criteria>
    <blocks>4-mark-center</blocks>
  </step>

  <step id="4-mark-center" order="fourth" depends-on="3-click-handlers">
    <description>Mark center point to establish coordinate origin</description>
    <actions>
      <action>Click on sprite visual center</action>
      <action>Verify crosshair appears exactly at click position</action>
      <action>Store center as reference point for normalization</action>
    </actions>
    <acceptance-criteria>
      <criterion priority="critical">Crosshair visually aligned with sprite center</criterion>
      <criterion priority="high">Center coordinates stored for subsequent calculations</criterion>
    </acceptance-criteria>
    <blocks>5-mark-points</blocks>
  </step>

  <step id="5-mark-points" order="fifth" depends-on="4-mark-center">
    <description>Mark animation anchor points and capture normalized coordinates</description>
    <actions>
      <action>Click on each animation point (engines, emitters, attachments)</action>
      <action>Verify marker appears at exact click position</action>
      <action>Record normalized coordinates displayed</action>
    </actions>
    <acceptance-criteria>
      <criterion priority="critical">Markers appear exactly where clicked</criterion>
      <criterion priority="critical">Coordinates in -1 to 1 range</criterion>
      <criterion priority="high">Multiple points distinguishable visually</criterion>
    </acceptance-criteria>
    <blocks>6-export</blocks>
  </step>

  <step id="6-export" order="sixth" depends-on="5-mark-points">
    <description>Export configuration and integrate into animation system</description>
    <actions>
      <action>Copy normalized coordinates to configuration object</action>
      <action>Format as TypeScript/JavaScript config matching AnimationPointConfig</action>
      <action>Import into animation system</action>
    </actions>
    <acceptance-criteria>
      <criterion priority="critical">Config matches AnimationPointConfig interface</criterion>
      <criterion priority="high">All sprites have complete point data</criterion>
    </acceptance-criteria>
    <blocks>7-verify</blocks>
  </step>

  <step id="7-verify" order="seventh" depends-on="6-export">
    <description>Verify coordinates work at different render sizes</description>
    <actions>
      <action>Test animation with sprites at 50% scale</action>
      <action>Test animation with sprites at 200% scale</action>
      <action>Verify effects appear at correct positions regardless of size</action>
    </actions>
    <acceptance-criteria>
      <criterion priority="critical">Effects positioned correctly at all scales</criterion>
      <criterion priority="critical">No pixel-based offset errors</criterion>
      <criterion priority="high">Visual confirmation of scale-independence</criterion>
    </acceptance-criteria>
  </step>
</workflow>

---

## Validation Checklist

Verify locator tool correctness before using coordinates in production.

### Coordinate Accuracy (Critical)
- [ ] Center click returns (0, 0) normalized coordinates (±0.02 tolerance)
- [ ] Top-left corner of visual content returns approximately (-1, -1)
- [ ] Bottom-right corner of visual content returns approximately (+1, +1)
- [ ] Coordinates remain accurate after window resize
- [ ] Coordinates scale correctly at different sprite render sizes

### CSS Handling (Critical)
- [ ] `object-fit: contain` letterboxing offset calculated
- [ ] `box-sizing: border-box` borders subtracted from dimensions
- [ ] Markers appear exactly where clicked (no visible offset)
- [ ] Visual content bounds correctly identified (not container bounds)

### Click Event Handling (High)
- [ ] Click coordinates adjusted for border offset
- [ ] Click on letterbox area (outside visual) handled gracefully
- [ ] Multiple rapid clicks register correctly
- [ ] Click position unaffected by page scroll

### Output Quality (High)
- [ ] All coordinates in -1 to 1 normalized range
- [ ] Configuration format matches TypeScript interface
- [ ] Coordinates work at 50%, 100%, and 200% render scales
- [ ] No hardcoded pixel values in exported config

### Visual Verification (Medium)
- [ ] Crosshair aligns with sprite visual center
- [ ] Multiple markers distinguishable by color/number
- [ ] Coordinate display updates in real-time on click
- [ ] Grid layout shows all sprites without overlap

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Points offset to the right | box-sizing: border-box not accounted for | Subtract border widths from container size |
| Points offset from visual | object-fit letterboxing not calculated | Calculate visual bounds within img element |
| Points scale incorrectly | Using pixel coordinates instead of normalized | Convert to -1 to 1 range relative to center |
| Crosshair not centered on click | getBoundingClientRect includes border | Adjust by borderLeft/borderTop |
