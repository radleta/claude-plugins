---
tags: [svg-animation-expert/output-format]
summary: TypeScript interface and example configuration object for exporting normalized animation anchor point coordinates from the locator tool.
---

# Output Format

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
