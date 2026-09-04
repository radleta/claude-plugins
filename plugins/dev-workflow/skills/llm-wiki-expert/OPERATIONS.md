---
tags: [llm-wiki-expert/operations]
summary: Detailed workflows and checklists for the three core wiki operations — Ingest, Query, and Lint — including supervised and batch ingest procedures.
last-verified: "2026-07-12"
---

# LLM Wiki Operations

Detailed workflows for the three core wiki operations: Ingest, Query, and Lint.

**Prerequisites for all operations:**
- Wiki directory initialized (`raw/`, `wiki/`, schema file at root)
- Schema file present with conventions documented
- `wiki/index.md` exists (even if minimal)
- `wiki/log.md` exists (even if empty)

## Ingest Operation

### Supervised Ingest (Recommended)

Process one source at a time with human involvement:

1. **Read the source** — Read the full document, extract key information
2. **Discuss with human** — Summarize key takeaways, notable claims, connections to existing wiki content
3. **Write summary page** — Create `wiki/sources/{source-name}.md` with:
   - Source metadata (title, author, date, URL) in YAML frontmatter
   - Key claims and findings with direct citations
   - Notable quotes with attribution
   - Connections to existing wiki pages
4. **Update entity pages** — For each entity (person, organization, concept) mentioned:
   - Create page if it doesn't exist
   - Add new information with source citation
   - Flag contradictions with existing claims
5. **Update concept pages** — For each concept or theme:
   - Add new perspectives or evidence
   - Strengthen or challenge existing synthesis
   - Note where new data changes the picture
6. **Update index.md** — Add source entry with link and one-line summary
7. **Append to log.md** — Record ingest with timestamp: `## [YYYY-MM-DD] ingest | Source Title`
8. **Cross-reference check** — Verify all new pages link to relevant existing pages and vice versa

**Depends on:** Steps 1-2 must complete before 3-8. Steps 3-5 can run in any order. Steps 6-8 run after all page edits.

### Batch Ingest

For processing many sources quickly with less supervision:

1. **Queue sources** — List all sources to process
2. **Process each** — Follow supervised steps but skip discussion step
3. **Batch review** — After all sources processed, review index and log for completeness
4. **Cross-reference sweep** — Check for missing links across all newly created/updated pages

## Query Operation

### Standard Query Flow

1. **Read index.md** — Identify relevant pages based on the question
2. **Read relevant pages** — Drill into 3-10 pages depending on question complexity
3. **Synthesize answer** — Combine information with citations to wiki pages
4. **Assess filing value** — File if answer synthesizes multiple pages, reveals undocumented connections, or would be asked again
5. **File if valuable** — Create a new wiki page; update index and log

### Answer Formats

| Question Type | Best Format | Example |
|--------------|-------------|---------|
| Factual | Short markdown answer | "What year was X founded?" |
| Comparison | Comparison table | "How do X and Y differ?" |
| Analysis | Full markdown page | "What are the trends in X?" |
| Presentation | Marp slide deck | "Summarize X for a talk" |
| Overview | Mind map or canvas | "Map the connections in X" |

## Lint Operation

### Health Check Protocol

Run every 10-20 ingests or when wiki feels stale:

1. **Contradiction scan** — Compare entity pages for inconsistent facts; check if newer sources supersede older claims
2. **Orphan detection** — Find pages with no inbound links
3. **Stub detection** — Find concepts mentioned across pages but lacking their own page
4. **Stale claim check** — Identify time-sensitive information not confirmed by newer sources
5. **Cross-reference audit** — Verify bidirectional links; find broken or missing references
6. **Gap analysis** — Identify topics mentioned but not covered; suggest new sources or web searches

### Lint Output Format

```markdown
## Wiki Health Report — [DATE]

### Contradictions Found
- **[Page A]** vs **[Page B]**: [description of conflict]

### Orphan Pages
- [page-name.md] — no inbound links

### Stubs / Missing Pages
- "concept X" mentioned in [N] pages but has no dedicated page

### Stale Claims
- [page-name.md]: claim about X from [old source] — check against recent data

### Missing Cross-References
- [Page A] should link to [Page B] (both discuss X)

### Suggested Actions
1. [specific action with priority]
```

## Comprehensive Checklist

Use this checklist when setting up or auditing an LLM Wiki.

### Setup (10 items)

- [ ] Directory structure created (`raw/`, `wiki/`, schema file)
- [ ] Schema file documents page type conventions
- [ ] Schema file documents naming conventions
- [ ] Schema file documents cross-referencing rules
- [ ] Schema file documents YAML frontmatter requirements
- [ ] Schema file documents ingest workflow
- [ ] `wiki/index.md` initialized with category headings
- [ ] `wiki/log.md` initialized with consistent entry format
- [ ] Git repository initialized for version history
- [ ] Obsidian vault pointed at wiki directory (if using Obsidian)

### Ingest Quality (12 items)

- [ ] Source filed in `raw/` and never modified after filing
- [ ] Summary page created with complete metadata (title, author, date, URL)
- [ ] Key claims extracted with specific citations to source
- [ ] Entity pages created or updated for all mentioned entities
- [ ] Concept pages created or updated for all relevant concepts
- [ ] Contradictions with existing claims explicitly flagged
- [ ] Cross-references added bidirectionally (new→existing and existing→new)
- [ ] YAML frontmatter added to new pages (tags, source_count, last_updated)
- [ ] index.md updated with new entry in correct category
- [ ] log.md appended with timestamped ingest record
- [ ] Images downloaded locally if applicable
- [ ] Summary reviewed by human for accuracy and emphasis

### Query Quality (8 items)

- [ ] Index consulted first, not random page browsing
- [ ] Relevant pages identified and read (3-10 depending on complexity)
- [ ] Answer includes citations to specific wiki pages
- [ ] Answer format matches question type (table, page, slides, etc.)
- [ ] Filing decision made explicitly (keep or discard)
- [ ] If filed: new page follows wiki conventions
- [ ] If filed: index and log updated
- [ ] Answer doesn't duplicate existing wiki content

### Lint Quality (8 items)

- [ ] Contradiction scan covers all entity pages
- [ ] Orphan pages identified and either linked or flagged for removal
- [ ] Stubs listed with page count where concept is mentioned
- [ ] Stale claims flagged with date of original source
- [ ] Cross-references audited for broken links
- [ ] Gap analysis performed with suggested sources
- [ ] Health report written in standard format
- [ ] log.md appended with lint record

### Schema Health (7 items)

- [ ] Schema reflects actual wiki structure (not aspirational)
- [ ] Page type conventions match what's in the wiki
- [ ] Naming conventions are consistent across pages
- [ ] Cross-referencing rules are documented and followed
- [ ] Frontmatter requirements are documented and followed
- [ ] Ingest workflow matches actual practice
- [ ] Schema has been updated within the last 20 ingests

## Schema Evolution

**Stage 1 (0-10 sources):** Minimal conventions. Basic page types, simple naming.

**Stage 2 (10-50 sources):** Formalized structure. YAML frontmatter added, cross-referencing rules codified, ingest workflow documented.

**Stage 3 (50-100+ sources):** Full maturity. Search tooling integrated, Dataview queries active, lint schedule established, output format templates ready.
