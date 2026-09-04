---
tags: [llm-wiki-expert/principles]
summary: Five foundational principles for LLM-maintained wikis — compile-once, human-curates, organic schema, index-first navigation, and compounding queries.
last-verified: "2026-07-12"
---

# Core Principles

## 1. Compile Once, Keep Current

**What:** Build knowledge into the wiki once during ingest, then maintain it — don't re-derive from raw sources on every query.

**Why:** RAG re-discovers knowledge from scratch every time. A compiled wiki has cross-references already in place, contradictions already flagged, synthesis already reflecting all sources.

**How:** When a new source arrives, the LLM reads it, integrates key information into existing pages, updates cross-references, and flags contradictions. The wiki gets richer with each source.

## 2. Human Curates, LLM Maintains

**What:** The human selects sources, directs analysis, and asks questions. The LLM does all bookkeeping — summarizing, cross-referencing, filing, maintaining consistency.

**Why:** Humans abandon wikis because maintenance burden grows faster than value. LLMs don't get bored, don't forget cross-references, and can touch 15 files in one pass.

**How:** Drop sources into the raw collection and tell the LLM to process them. Review results in Obsidian. Guide emphasis through conversation. Never edit wiki pages directly.

## 3. Schema Evolves Organically

**What:** Start with minimal conventions, let the schema grow as patterns emerge through use.

**Why:** Over-engineering the schema before you have content leads to abandoned structures. Real needs only become clear after 10-20 sources.

**How:** Begin with basic page types and naming. After each batch of ingests, reflect on what's working and what isn't. Codify successful patterns into the schema. Document schema changes in the log.

## 4. Index-First Navigation

**What:** The LLM reads the index to find relevant pages before answering queries — no embedding infrastructure needed.

**Why:** At moderate scale (~100 sources, ~hundreds of pages), a well-maintained index.md with links and one-line summaries works surprisingly well. Avoids the complexity of vector databases.

**How:** Update index.md on every ingest. Organize by category (entities, concepts, sources). When querying, read the index first, identify relevant pages, then drill into them.

## 5. Every Query Can Compound

**What:** Good answers to questions should be filed back into the wiki as new pages — analyses, comparisons, and connections compound just like ingested sources.

**Why:** Valuable synthesis disappears into chat history if not captured. A comparison table you build once shouldn't need rebuilding.

**How:** After synthesizing an answer, assess its filing value. If it synthesizes multiple pages, reveals undocumented connections, or would be asked again — create a wiki page for it.
