---
tags: [svg-animation-expert/coordinate-pitfalls]
summary: How to subtract border widths when box-sizing border-box causes offsetWidth/offsetHeight to include border thickness, leading to incorrect content dimensions and coordinate calculations.
---

# Pitfall #2: box-sizing: border-box

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
// WRONG: Ignores border in box-sizing: border-box
const centerX = container.offsetWidth / 2;  // Returns 175, not 173!
```
    </code>
    <why-bad>offsetWidth includes borders, causing 2px offset error</why-bad>
  </negative>

  <positive>
    <description>Subtract border widths from container dimensions</description>
    <code>
```javascript
// CORRECT: Calculate content dimensions
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
