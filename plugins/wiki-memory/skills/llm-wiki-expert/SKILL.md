---
name: llm-wiki-expert
description: "LLM-maintained personal wiki pattern — persistent, compounding knowledge bases built from interlinked markdown instead of RAG. Use when setting up a personal wiki, designing wiki schemas, ingesting sources, or maintaining wiki health — even for simple note organization or when mentioning Obsidian or Memex."
wiki: true
---

<role>
  <identity>Expert in the LLM Wiki pattern for persistent, LLM-maintained knowledge bases</identity>
  <purpose>Guide setup, schema design, and ongoing operation of personal wikis where the LLM maintains all content</purpose>
  <scope>
    <in-scope>Wiki setup, schema design, ingest/query/lint operations, Obsidian integration, domain adaptation</in-scope>
    <out-of-scope>RAG implementation, embedding/vector databases, Obsidian plugin development</out-of-scope>
  </scope>
</role>

# LLM Wiki Expert

## Investigation Protocol

Before setting up or advising on a wiki, investigate these areas:

### Domain Discovery

**What to discover:** What domain is this wiki for? (research, personal, business, book reading, competitive analysis)

**Why it matters:** Domain determines page types, cross-referencing style, and which operations matter most. A research wiki needs citation tracking; a personal wiki needs privacy.

### Existing Setup

**What to discover:** Does the user already have notes, a knowledge base, or an Obsidian vault? What format are existing sources in?

**Why it matters:** Migration from existing systems requires understanding what's already there. Markdown notes may become raw sources or wiki seeds.

### Scale Expectations

**What to discover:** How many sources does the user expect to ingest? Over what timeframe? How many topics?

**Why it matters:** Scale determines whether index.md suffices or search tooling is needed. Under 50 sources = index only. Over 100 = consider qmd or similar.

### Tooling Preferences

**What to discover:** Is the user using Obsidian? Do they want git versioning? Are they comfortable with CLI tools?

**Why it matters:** Tooling choices affect schema design, image handling, and output format recommendations.

## Operations Overview

Three core operations maintain the wiki. See [OPERATIONS.md](OPERATIONS.md) for detailed workflows and checklists.

- **Ingest** — Process a new source: read, summarize, update entity/concept pages, cross-reference, update index and log. Typically touches 10-15 pages per source.
- **Query** — Ask questions: read index, drill into relevant pages, synthesize answer with citations. File valuable answers back as wiki pages.
- **Lint** — Periodic health check: find contradictions, orphan pages, stale claims, missing cross-references, knowledge gaps.

## Domain Adaptation

| Domain | Page Types | Key Considerations |
|--------|-----------|-------------------|
| **Personal** | Goals, health, journal entries | Privacy-sensitive; local-only |
| **Research** | Papers, concepts, methodology, thesis | Citation tracking; contradiction flagging |
| **Book reading** | Characters, themes, plot, chapters | Fan-wiki style; connections are the value |
| **Business/team** | Projects, decisions, meetings, customers | Multi-contributor; human review loop |
| **Competitive analysis** | Companies, products, market trends | Time-sensitive; stale-claim detection critical |

## Tooling Integration

**Obsidian** — Recommended viewer. Graph view shows wiki shape. Web Clipper converts articles to markdown. Dataview runs queries over YAML frontmatter. Marp renders slide decks.

**Search** — At small scale, index.md suffices. As wiki grows, use qmd for hybrid BM25/vector search with LLM re-ranking (CLI + MCP server).

**Git** — The wiki is just a git repo. Version history, branching, and collaboration for free.

**Images** — Download locally to `raw/assets/`. LLM reads text first, then views referenced images separately.

## Original Source

This skill is based on Andrej Karpathy's LLM Wiki pattern. Use Read tool on [llm-wiki-source.md](llm-wiki-source.md) when you need the original rationale, want to quote the source directly, or need to reference the full unprocessed idea document.

## Pages

<!-- BEGIN:PAGES -->
- [Core Principles](core-principles.md) — Five foundational principles for LLM-maintained wikis — compile-once, human-curates, organic schema, index-first navigation, and compounding queries.
- [Architecture](architecture.md) — Three-layer architecture for LLM wikis — raw sources (immutable), wiki (LLM-generated), and schema (co-evolved conventions).
- [Operations](OPERATIONS.md) — Detailed workflows and checklists for the three core wiki operations — Ingest, Query, and Lint — including supervised and batch ingest procedures.
- [Examples](examples.md) — Sample wiki artifacts — index entries, entity pages with key claims and contradictions, and log entries showing the wiki format in practice.
- [Anti-Patterns](anti-patterns.md) — Five anti-patterns that undermine LLM wiki health — direct editing, unsupervised batch ingest, missing schema, lint neglect, and premature schema over-engineering.
- [Common Issues](common-issues.md) — Common LLM wiki issues with causes and resolutions — context window limits, contradiction buildup, schema migrations, stale pages, and cross-reference gaps.
- [Original Source](llm-wiki-source.md) — Original source document by Andrej Karpathy describing the LLM Wiki pattern — persistent, compounding knowledge bases built from interlinked markdown.
- [freshness-scoring-patterns](freshness-scoring-patterns.md) — Production doc-freshness tools combine multi-signal scoring (age, drift, TTL) rather than single binary threshold
- [curation-queue-patterns](curation-queue-patterns.md) — Pending-review curation queues require automation or forced expiry to drain reliably
- [consolidation-trigger-patterns](consolidation-trigger-patterns.md) — Memory consolidation is triggered by idle time or importance thresholds, not fixed schedules
- [memory-invalidation-patterns](memory-invalidation-patterns.md) — Production memory systems invalidate on contradiction/supersession, never on age alone
- [preservation-heuristics](preservation-heuristics.md) — Memory preservation prioritizes reference-count and category over age; aggressive consolidation loses granularity
<!-- END:PAGES -->

## Meta

- [Schema](schema.md) — Wiki conventions and page-type definitions
