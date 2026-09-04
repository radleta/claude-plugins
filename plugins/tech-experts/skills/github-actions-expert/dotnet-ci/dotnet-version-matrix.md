---
tags: [github-actions-expert/dotnet]
summary: "Multi-version dotnet testing matrix using strategy.matrix with setup-dotnet action"
---

# .NET Version Matrix

```yaml
strategy:
  matrix:
    dotnet: ["8.0.x", "9.0.x"]
steps:
  - uses: actions/setup-dotnet@v4
    with:
      dotnet-version: ${{ matrix.dotnet }}
```
