---
tags: [github-actions-expert/anti-patterns]
summary: "Structural anti-patterns: monolithic jobs, duplicated steps, hardcoded versions, and workflow-level write permissions"
---

# Structural Anti-Patterns

| Anti-Pattern | Problem | Fix |
|---|---|---|
| All logic in one job | No parallelism, slow feedback | Split build/test/deploy into separate jobs |
| Duplicate steps across workflows | Maintenance burden | Extract to reusable workflow or composite action |
| Hardcoded versions | Drift, forgotten updates | Use matrix or variables, enable Dependabot |
| Missing `fail-fast: false` on matrix | One failure cancels all | Set `fail-fast: false` when all variants matter |
| Workflow-level `permissions: write` | All jobs get write access | Scope permissions per-job |
