---
tags: [llm-wiki-expert/anti-patterns]
summary: Five anti-patterns that undermine LLM wiki health — direct editing, unsupervised batch ingest, missing schema, lint neglect, and premature schema over-engineering.
last-verified: "2026-07-12"
---

# Anti-Patterns

| Anti-Pattern | Why Wrong | Instead |
|-------------|-----------|---------|
| Editing wiki pages directly | Breaks LLM ownership; creates merge conflicts | Tell the LLM what to change |
| Batch-ingesting 50 sources unsupervised | Quality degrades; cross-references get sloppy | Supervised ingest for first 20+ sources |
| No schema file | LLM loses conventions between sessions | Write minimal schema from day one |
| Skipping lint for months | Contradictions accumulate silently | Lint every 10-20 ingests |
| Over-engineering schema up front | Creates abandoned structures | Start minimal, evolve organically |
