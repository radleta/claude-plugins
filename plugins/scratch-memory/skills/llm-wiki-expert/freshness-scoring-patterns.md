---
tags: [llm-wiki-expert/documentation-staleness]
summary: "Production doc-freshness tools combine multi-signal scoring (age, drift, TTL) rather than single binary threshold"
---

## Production Doc-Freshness Tools Score Multi-Signal and Gradual, Not Single-Threshold Binary

dosu.dev scores documentation freshness in CI using multiple combined signals — the git-age gap between a doc's last touch and its underlying code's last touch, symbol drift, and a per-doc TTL — producing a gradual score rather than a binary pass/fail (https://dosu.dev/blog/score-documentation-freshness-in-ci). Fiberplane Drift anchors markdown documentation to AST symbols with git-SHA provenance and enforces staleness as a hard CI exit-1 gate (https://fiberplane.com/blog/drift-documentation-linter/).

**Implication:** A single uniform git-age threshold (e.g. wiki-memory lint's current 90-day check) is less precise than comparable production tools, which combine multiple signals (age gap, symbol/content drift, per-item TTL) into a graded score instead of one binary cutoff.
