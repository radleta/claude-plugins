---
tags: [llm-wiki-expert/troubleshooting]
summary: Common LLM wiki issues with causes and resolutions — context window limits, contradiction buildup, schema migrations, stale pages, and cross-reference gaps.
last-verified: "2026-07-12"
---

# Common Issues

| Issue | Cause | Resolution |
|-------|-------|------------|
| Wiki too large for context window | Too many pages to read at once | Use index-first navigation; load only relevant pages; add search tooling |
| Contradictions piling up | Sources disagree on facts | Run lint, flag for human review, add "disputed" tags |
| Schema needs breaking changes | Early conventions don't scale | Migrate incrementally; update schema, then batch-lint existing pages into compliance |
| Stale pages after new sources | New data supersedes old | Lint detects staleness; update claims with newer citations |
| Poor cross-referencing | Ingest didn't link related pages | Run cross-reference audit in lint; add missing bidirectional links |
