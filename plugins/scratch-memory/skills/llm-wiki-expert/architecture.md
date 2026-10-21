---
tags: [llm-wiki-expert/architecture]
summary: Three-layer architecture for LLM wikis — raw sources (immutable), wiki (LLM-generated), and schema (co-evolved conventions).
last-verified: "2026-07-12"
---

# Three-Layer Architecture

```
┌─────────────────────────────────────────┐
│  Schema (CLAUDE.md / AGENTS.md)         │  ← Conventions, workflows, structure rules
│  Co-evolved by human + LLM over time   │
├─────────────────────────────────────────┤
│  Wiki (LLM-generated markdown)          │  ← Summaries, entity pages, concept pages,
│  LLM owns entirely; human reads         │     comparisons, synthesis, index, log
├─────────────────────────────────────────┤
│  Raw Sources (immutable)                │  ← Articles, papers, images, data files
│  Human curates; LLM reads only          │     Source of truth — never modified by LLM
└─────────────────────────────────────────┘
```

**Raw sources** — Immutable collection curated by the human. The LLM reads but never modifies.

**The wiki** — LLM-generated markdown. Summaries, entity pages, concept pages, comparisons. The LLM creates, updates, cross-references, and maintains consistency.

**The schema** — Configuration file (e.g., CLAUDE.md) defining wiki structure, conventions, and workflows. Human and LLM co-evolve over time.
