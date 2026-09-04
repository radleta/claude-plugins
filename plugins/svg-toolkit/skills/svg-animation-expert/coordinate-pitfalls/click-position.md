---
tags: [svg-animation-expert/coordinate-pitfalls]
summary: How to adjust click event coordinates from border-edge-relative to content-edge-relative by subtracting borderLeft and borderTop, since getBoundingClientRect includes border thickness.
---

# Pitfall #3: Click Position vs Content Position

Click events give coordinates relative to the element's border edge, not content edge.

<examples category="click-position-handling">
  <negative>
    <description>Uses click coordinates directly</description>
    <code>
```javascript
// WRONG: Doesn't adjust for border offset
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
// CORRECT: Adjust for border offset
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
