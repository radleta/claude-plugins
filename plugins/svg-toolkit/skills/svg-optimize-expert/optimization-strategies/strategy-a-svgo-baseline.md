---
tags: [svg-optimize-expert/optimization-strategies]
summary: Strategy A — SVGO baseline optimization (20-40% reduction) for clean SVGs where embedded assets aren't the problem.
---

# Strategy A: SVGO Baseline (20-40% reduction)

For clean SVGs or when embedded assets aren't the problem:

```bash
npx svgo input.svg -o output.svg --multipass
```
