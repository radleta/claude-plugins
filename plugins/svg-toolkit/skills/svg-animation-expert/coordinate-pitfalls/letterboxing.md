---
tags: [svg-animation-expert/coordinate-pitfalls]
summary: How to calculate actual visual bounds when object-fit contain leaves horizontal or vertical letterboxing gaps, so click coordinates map to the visible image area rather than the full container.
---

# Pitfall #1: object-fit: contain Letterboxing

When using `object-fit: contain`, the visual content may not fill the entire `<img>` element bounds.

<examples category="letterboxing-handling">
  <negative>
    <description>Assumes click coordinates map directly to image</description>
    <code>
```javascript
// WRONG: Ignores letterboxing
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
// CORRECT: Account for letterboxing first
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
