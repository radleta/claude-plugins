---
tags: [github-actions-expert/anti-patterns]
summary: "Performance anti-patterns: missing caching, redundant restore/build, lack of path filters and concurrency controls"
---

# Performance Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| No caching | Slow builds, wasted minutes | Add cache for package manager |
| Redundant restore/build | Double compilation | Chain `--no-restore` and `--no-build` |
| Missing `paths-ignore` | CI runs on docs changes | Filter out non-code paths |
| Missing `concurrency` | Duplicate runs pile up | Add concurrency group with cancel-in-progress |
| Large artifacts with long retention | Storage costs | Set `retention-days` explicitly |

See [artifacts-and-caching.md](../artifacts-and-caching.md) for caching patterns and key strategies.
