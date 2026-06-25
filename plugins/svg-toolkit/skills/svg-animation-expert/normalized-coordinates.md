---
tags: [svg-animation-expert/normalized-coordinates]
summary: How to store and convert animation anchor coordinates as normalized (-1 to 1) values relative to sprite center, enabling scale-independent positioning.
---

# Normalized Coordinates

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
