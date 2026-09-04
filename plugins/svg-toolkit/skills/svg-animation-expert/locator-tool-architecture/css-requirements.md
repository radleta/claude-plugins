---
tags: [svg-animation-expert/locator-tool-architecture]
summary: Essential CSS rules for the locator tool container, including position relative, explicit dimensions, object-fit contain for images, pointer-events none for markers, and transform translate for centering markers.
---

# CSS Requirements

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
