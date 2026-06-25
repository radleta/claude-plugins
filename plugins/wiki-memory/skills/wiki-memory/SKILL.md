---
name: wiki-memory
description: "Wiki-backed knowledge system for expert skills — manages domain wikis with ingest, query, lint, init, show, health, audit, migrate, and consolidate operations. Use when updating domain knowledge, querying experts, initializing new wiki domains, migrating or consolidating skills into a target wiki, or maintaining wiki health — even for quick knowledge captures after a session."
user-invocable: true
argument-hint: "[ingest|lint|query|init|show|health|audit|migrate|consolidate]"
---

<role>
  <identity>Wiki domain knowledge manager for expert skills</identity>
  <purpose>Maintain wiki-backed expert skill knowledge — persistent, compounding knowledge bases built from interlinked markdown. Each wiki domain is an editable knowledge base co-located with its skill folder; SKILL.md is the navigation hub via `## Pages`.</purpose>
  <scope>
    <in-scope>
      <item>Wiki operations: init, ingest, lint, query, show, migrate</item>
      <item>Wiki page management: create, update, cross-reference</item>
      <item>Wiki health: staleness detection, structural lint, log maintenance</item>
    </in-scope>
    <out-of-scope>
      <item>Wiki foundational principles (defer to llm-wiki-expert skill)</item>
      <item>Thin expert skill creation (use claude-skill-builder)</item>
      <item>Plugin publishing (use marketplace-publish)</item>
    </out-of-scope>
  </scope>
</role>

## Operations

Parse `$ARGUMENTS` to determine operation, then Read the protocol file:

| Command | Action | Protocol |
|---------|--------|----------|
| `init <domain>` | Create wiki-backed skill folder via direct mkdir + Write | Read `protocols/init.md` |
| `ingest <domain>` | Extract session insights, update wiki pages + SKILL.md ## Pages + log | Read `protocols/ingest.md` |
| `lint <domain>` | Run structural lint + content staleness checks | Read `protocols/lint.md` |
| `query <domain> <question>` | Index-first drill, synthesize answer, assess filing value; **may write** a new wiki page when synthesis meets filing-worthiness criteria (WMF-D18) | Read `protocols/query.md` |
| `show [domain]` | List all wikis or show specific domain index + health | Inline below |
| `migrate <skill-name>` | Convert existing expert skill to wiki-backed format | Read `protocols/migrate.md` |
| `consolidate <target> <source...> [--dry-run]` | **DISABLED — pending migration (D-PLAN-10).** Merge N source skills into target wiki atomically; rewrites cross-references and updates plugin manifest | Read `protocols/consolidate.md` |

**Health flag:** `wiki-health <skill> --full` runs a deep-audit pass (Step 5b cross-link scan + Step 6 group-affinity) on structurally-healthy skills and downgrades to `partial-migration` when candidates are found. Use this after protocol evolution or before triggering `/wiki-memory migrate` on a healthy skill.

If no arguments or unrecognized command: show this operations table and prompt for a command.

## Wiki Domain Structure

New-format wiki-backed skill (post-migration):

| File | Purpose |
|------|---------|
| `SKILL.md` | Navigation hub: YAML frontmatter + role stub + `## Pages` (page links + one-line summaries) |
| `log.md` | Timestamped operations log (ingest, lint, query filings) |
| `schema.md` | Wiki conventions: page types, naming rules, frontmatter requirements |
| `.mditerc` | mdite config: `entrypoint: SKILL.md` |
| `*.md` | Knowledge pages — flat siblings alongside SKILL.md |

## Page Conventions

Every wiki page (except SKILL.md, log.md, schema.md, .mditerc, protocols/*.md) requires YAML frontmatter. Protocol files are dispatch targets — they are read by command/skill orchestrators directly, not surfaced via index navigation.

```yaml
---
tags: [domain/subtopic]
summary: "One-line description"
---
```

- **tags**: `domain/subtopic` (e.g., `akn-data/dynamodb`, `mdite/config`)
- **summary**: One-line description — used in `## Pages` index entries (universally required)
- **Staleness**: Page age is read from `git log -1 --format=%ad -- <file>` or filesystem mtime, never from a YAML field. Do not add an `updated:` field to new pages.
- **Per-domain fields**: `schema.md` in each skill folder is authoritative for additional required frontmatter fields beyond `summary` (e.g., domain-specific tags taxonomy, extra metadata).
- **Linking**: Standard markdown links (`[Page](page.md)`), not wikilinks
- **Naming**: Kebab-case filenames, descriptive, no numbering prefixes
- **`## Pages` entries**: One-line format: `- [title](file.md) — one-line summary` (no bold wrappers, no nested bullets, no multi-line descriptions)
- **`## Pages` sub-sectioning** (4+ groups rule): When a wiki has 4 or more subdirectory groups,
  split `## Pages` into two sub-sections to give the agent visual distinction between navigation
  hubs (load to navigate further) and terminal leaves (load to read final content):
  - `### Topic Areas` — list group hub pages only (e.g., `core-principles/index.md`)
  - `### Standalone Pages` — list top-level leaf pages not grouped into a subdirectory
  When the wiki has fewer than 4 subdirectory groups, keep a flat `## Pages` list (no sub-sections).
  `migrate.md` implements this rule when emitting the post-migration SKILL.md `## Pages` block.

## Show Workflow

`/wiki-memory show [domain]`

**Migration fires only on write-path operations, never read-only.** The show operation reads
both new-format and old-format sources without triggering migration.

### Show all wikis (no domain argument)

**Dual-scope glob (new-format wikis):**

1. Glob `.claude/skills/*/` (project-scoped) for skill folders containing `.mditerc` where
   `tr -d '\r' < .claude/skills/*/.mditerc | grep -q '^entrypoint:[[:space:]]*SKILL\.md'` exits 0.
2. Glob `~/.claude/skills/*/` (user-scoped) for skill folders with the same `.mditerc` test.
3. Merge results from both globs; deduplicate by skill-name (same skill-name in both scopes
   keeps the project-scoped entry as primary; the user-scoped duplicate is labeled `[partial]`
   with a warning).

**Report format per wiki:**

```
{domain}: {title-from-SKILL.md-first-line} ({path})
```

If no entries found: "No wikis found. Use `/wiki-memory init <domain>` to create one."

### Show specific domain

1. Resolve wiki path via convention-based lookup: check `.claude/skills/{domain}/SKILL.md`, then `.claude/skills/{domain}-expert/SKILL.md` (project-scoped); or `~/.claude/skills/{domain}/SKILL.md`, then `~/.claude/skills/{domain}-expert/SKILL.md` (user-scoped).
2. Read `SKILL.md` and display `## Pages` section + YAML frontmatter title.
3. Health summary: page count, last ingest date (from log.md), time since last lint.

## Maintaining This Skill

To refine this skill: `/skill-builder refine wiki-memory`. Uses protocol-per-file architecture — keep SKILL.md as lean orchestrator, add new operations as `protocols/*.md`.

## Foundational Principles

This skill handles wiki **operations**. For foundational wiki **principles** (compile-once, human-curates/LLM-maintains, schema evolution, index-first navigation), defer to the `llm-wiki-expert` skill.

Key principles across all operations:
- **Compile once, keep current**: Integrate knowledge during ingest, don't re-derive on query
- **Index-first navigation**: Always read index before drilling into pages
- **Schema evolves organically**: Start minimal, codify patterns after 10-20 ingests
- **Human curates, LLM maintains**: Human directs what to capture; LLM does all bookkeeping

## Gotchas

- **Slug case preservation (CLI verbatim)** — `wiki-write` CLI preserves slug case verbatim: `wikieval-T5-x` stays `wikieval-T5-x`. This is the OPPOSITE of `mcp__scratch-memory__write_issue`, which lowercases. If a downstream consumer compares slugs across both surfaces, normalize at the caller — wiki-write will not coerce case for you. See also `scratch-memory` SKILL.md gotcha for the MCP side.

## Pages

- [Init Protocol](protocols/init.md) — create a new wiki-backed skill folder from scratch
- [Ingest Protocol](protocols/ingest.md) — extract session insights and integrate them into wiki pages
- [Lint Protocol](protocols/lint.md) — check wiki structural integrity and content freshness
- [Query Protocol](protocols/query.md) — answer questions using wiki knowledge with index-first navigation
- [Migrate Protocol](protocols/migrate.md) — convert an existing expert skill to wiki-backed format
- [Audit Protocol](protocols/audit.md) — consume wiki-health verdict and produce a remediation plan
- [Consolidate Protocol](protocols/consolidate.md) — merge N source skills into a target wiki atomically
