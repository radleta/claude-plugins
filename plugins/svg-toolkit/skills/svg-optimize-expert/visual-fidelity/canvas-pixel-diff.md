---
tags: [svg-optimize-expert/visual-fidelity]
summary: Canvas-based pixel diff tool — renders both SVGs at 2x resolution and compares every pixel to measure visual fidelity after optimization.
---

# Canvas Pixel Diff Tool

Render both SVGs to canvas at 2x resolution, compare every pixel:

```javascript
async function measureDiff(refUrl, testUrl, size = 864) {
  const render = (url) => new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      c.getContext('2d').drawImage(img, 0, 0, size, size);
      resolve(c.getContext('2d').getImageData(0, 0, size, size));
    };
    img.src = url;
  });

  const [ref, test] = await Promise.all([render(refUrl), render(testUrl)]);
  let diffCount = 0, significantDiffs = [];

  for (let i = 0; i < ref.data.length; i += 4) {
    const maxD = Math.max(
      Math.abs(ref.data[i] - test.data[i]),
      Math.abs(ref.data[i+1] - test.data[i+1]),
      Math.abs(ref.data[i+2] - test.data[i+2]),
      Math.abs(ref.data[i+3] - test.data[i+3])
    );
    if (maxD > 2) diffCount++;
    // Collect significant diffs for analysis
    if (maxD > 10) {
      const px = (i/4) % size, py = Math.floor((i/4) / size);
      significantDiffs.push({ x: px, y: py, maxD });
    }
  }

  return {
    totalPixels: size * size,
    diffPixels: diffCount,
    diffPercent: (diffCount / size / size * 100).toFixed(2),
    significantDiffs: significantDiffs.length
  };
}
```
