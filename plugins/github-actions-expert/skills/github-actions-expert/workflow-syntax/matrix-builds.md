---
tags: [github-actions-expert/workflow-syntax]
summary: "strategy.matrix for multi-configuration builds with fail-fast control and matrix value access"
---

# Matrix Builds

Use `strategy.matrix` to run jobs across multiple configurations. Use `fail-fast: false` when all variants must complete regardless of individual failures.

```yaml
strategy:
  fail-fast: false
  matrix:
    rid: [win-x64, win-arm64]
    # Or multi-dimensional:
    os: [ubuntu-latest, windows-latest]
    dotnet: ["8.0.x", "9.0.x"]
    exclude:
      - os: windows-latest
        dotnet: "8.0.x"
```

Access matrix values via `${{ matrix.rid }}` in steps.

See [PATTERNS.md](../PATTERNS.md) for advanced matrix strategies including dynamic JSON matrix and include/exclude combinations.
