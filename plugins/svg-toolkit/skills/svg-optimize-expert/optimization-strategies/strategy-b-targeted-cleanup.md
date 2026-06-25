---
tags: [svg-optimize-expert/optimization-strategies]
summary: Strategy B — targeted cleanup of specific bloat sources (unused defs, clipPaths, use references) followed by SVGO (40-60% reduction).
---

# Strategy B: Targeted Cleanup + SVGO (40-60% reduction)

Remove specific bloat sources, then run SVGO:

1. Strip unused `<defs>` elements
2. Remove unreferenced `<clipPath>` definitions
3. Inline simple `<use>` references
4. Run SVGO with `--multipass`
