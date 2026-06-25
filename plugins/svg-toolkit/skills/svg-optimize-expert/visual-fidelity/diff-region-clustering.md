---
tags: [svg-optimize-expert/visual-fidelity]
summary: Cluster diff pixels into 20x20 spatial grid cells to identify the top problem areas after SVG optimization.
---

# Diff Region Clustering

Cluster diff pixels into spatial regions to identify where problems are:

```javascript
// Bucket diff pixels into 20x20 grid cells (in viewBox coordinates)
const clusters = {};
for (const p of significantDiffs) {
  const cx = Math.floor(p.x / size * viewBoxWidth / 20) * 20;
  const cy = Math.floor(p.y / size * viewBoxHeight / 20) * 20;
  const key = `${cx},${cy}`;
  if (!clusters[key]) clusters[key] = { x: cx, y: cy, count: 0, totalDiff: 0 };
  clusters[key].count++;
  clusters[key].totalDiff += p.maxD;
}
// Sort by count to find top problem areas
const sorted = Object.values(clusters).sort((a, b) => b.count - a.count);
```
