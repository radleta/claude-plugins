---
tags: [writing/meta]
summary: "Survey of community-built and first-party Claude/agent writing-enhancement skills — what exists, what it covers, and where writing-expert fills genuine gaps."
code-cites: []
---

# Community Writing-Skill Survey

**Scope:** Community-built and first-party Claude/agent writing-enhancement tools as of mid-2025. Sources: (a) local skill inspection of this workspace, (b) Anthropic's official prompt library, (c) known community MCP ecosystem and agent frameworks, drawing on training knowledge through August 2025. Direct web browsing was unavailable at survey time; findings are cross-checked against locally verified files where possible.

---

## Workspace-Native Writing Skills (Verified Local)

These skills are confirmed installed in this workspace and represent the baseline of what already exists before writing-expert is needed.

| Skill | Coverage | Role relative to writing-expert |
|-------|----------|----------------------------------|
| `human-voice` | Strips AI tells: puffery, hollow symmetry, fake warmth, em-dash overuse, filler transitions | The **floor** — removes what bad writing has; complementary, not competing |
| `blog-writer` | Orchestrates multi-step blog pipeline: research → draft → review → publish | Pipeline orchestration — consumes writing-expert, does not own craft knowledge |
| `email-draft-expert` | Professional email drafting on someone's behalf | Domain-specific (email only); no craft theory |
| `email-campaign-expert` | Marketing email campaign copy | Domain-specific (campaigns only); no craft theory |
| `user-docs` | User-facing technical documentation updates | Domain-specific (docs only); no craft theory |
| `doc-update` | Documentation revision aligned to code changes | Domain-specific (docs only); no craft theory |

**Overlap assessment:** `human-voice` is the closest peer — it is explicitly designed to complement writing-expert (floor vs. ceiling). All domain-specific skills work on specific output formats and hold no process discipline or craft theory. `blog-writer` is a consumer of writing-expert, not a source of craft knowledge.

---

## Anthropic First-Party (Official Prompt Library)

Anthropic's public prompt library ships ~70 reference prompts for common tasks. Writing-adjacent entries include:

| Prompt | What it does | Craft depth |
|--------|-------------|-------------|
| Prose polisher | Single-pass style and flow improvement | Surface — no craft theory |
| Grammar wizard | Grammatical corrections | Correctness only |
| Content creator | Versatile general content generation | Template-level |
| Essay outliner | Generates outline from a topic | Structure scaffold only |
| Blog post creator | Long-form blog post generation | Generation — no process discipline |

These are single-turn prompts, not persistent skill wikis. They can generate or clean text but cannot encode accumulated craft theory. They have no model of multi-pass process (draft → structural revision → line edit), no canon-derived patterns, no audience calibration for specific communities. Source: Anthropic docs / prompts.anthropic.com (training knowledge).

---

## Community MCP Ecosystem (as of August 2025)

No writing-craft MCP server had emerged as a community standard by August 2025. Observed categories:

| Category | Representative tools | Coverage | Missing |
|----------|---------------------|---------|---------|
| Grammar / spell check | Grammarly API wrappers (community POCs), LanguageTool MCP adapters | Correctness and basic style rules | Craft theory, process discipline |
| Readability metrics | Hemingway-type scoring (sentence length, passive voice flags) | Surface metrics | No instruction on how to fix |
| Text manipulation | Various text-editor MCP servers | Word count, diff, search-replace | No craft theory |
| Research retrieval | Perplexity MCP, Brave Search MCP | Source fetching | No writing craft |

**Assessment:** Community MCP tools as of August 2025 target correctness and retrieval, not craft. None implemented a structured craft knowledge base with canon-derived patterns. Source: community GitHub repos and MCP marketplace listings (training knowledge).

---

## Broader Agent Framework Patterns (Cross-Provider)

Writing-focused agents appear in LangChain, CrewAI, and AutoGPT ecosystems. These are not Claude-specific, but they represent the community's design pattern for writing assistance:

- **Writing crews (CrewAI):** Researcher + Writer + Editor agent roles. The Editor agent receives a style guide as a system prompt — ad-hoc configuration, not an accumulated knowledge wiki.
- **LangChain writing chains:** Sequential research → draft → refine. Refinement is driven by prompt instructions, not by canon-derived craft patterns.
- **Claude.ai Writing Projects:** Individual users configure Claude.ai Projects as personal writing coaches via system prompts. These are private, ad-hoc, and not community-standardized.

**Pattern finding:** The community treats writing quality as a prompt-engineering problem — give Claude better instructions each time. The architectural innovation in writing-expert is that craft knowledge should be *accumulated* in a wiki and loaded once as a persistent skill, not re-specified in each session. No community equivalent of this architecture was found.

---

## Gap Map: What writing-expert Fills That Nothing Else Does

| Dimension | Best community equivalent | writing-expert's unique contribution |
|-----------|--------------------------|--------------------------------------|
| Process discipline | None (Anthropic: essay outliner, no revision theory) | Zinsser/McPhee/Lamott multi-pass sequences accumulated in wiki form |
| Narrative structure | None | Throughline, openings, so-what — from deconstructed exemplars |
| Sentence-level craft | Grammarly (correctness only), Hemingway (metrics only) | Rhythm, diction, cutting darlings — grounded in craft canon |
| Explaining hard things | None | Curse of knowledge, analogy construction, code-in-prose scaffolding |
| Audience calibration | None | HN/Lobsters dynamics, credibility signals, technical trust patterns |
| Canon-derived patterns | None | Structural moves extracted from specific exemplar essays |
| De-slop / AI tell removal | Grammarly (partial), generic style prompts | Fully covered by `human-voice` in this workspace |

**Key finding:** writing-expert has no meaningful community equivalent. Single-pass prompts and grammar tools exist and cover correctness. Accumulated, wiki-persisted craft knowledge derived from canonical writing texts and deconstructed exemplars does not exist in any public community skill as of the survey date.

---

## How to apply

1. **Before adding any new writing-expert dimension, run a community check.** If an existing skill (`human-voice`, `blog-writer`, an MCP tool) already covers the space, link or delegate — do not duplicate. Use this survey as the starting point; update it if the check finds something new.

2. **Do not implement grammar or correctness checking inside writing-expert.** That space is owned by Grammarly-type tools and is not a gap. writing-expert's scope is craft, not correctness.

3. **Treat the gap map as the design brief for the six content dimensions.** Each row where writing-expert is unique (process, narrative-craft, sentence-craft, explaining-hard-things, audience, canon) represents a dimension with no community peer. Protect that scope and resist scope creep into correctness or pipeline orchestration.

4. **Floor before ceiling in practice.** When invoking writing skills on any draft: `human-voice` first (strips de-slop), then `writing-expert` (adds craft). These skills are confirmed complementary by this survey — neither substitutes for the other.

5. **Re-survey before adding a `meta/` utility page** beyond Phase-6 eval. The community MCP ecosystem is moving fast. What was absent in mid-2025 may have a standard tool by the time a new utility is needed.
