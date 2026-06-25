# wiki-memory Wiki — Schema

## Wiki Domain Structure

| File | Purpose |
|------|---------|
| `SKILL.md` | Navigation hub: YAML frontmatter + role stub + `## Pages` (page links + one-line summaries) |
| `log.md` | Timestamped operations log (ingest, lint, query filings) |
| `schema.md` | Wiki conventions: page types, naming rules, frontmatter requirements |
| `.mditerc` | mdite config: `entrypoint: SKILL.md` |
| `*.md` | Knowledge pages — flat siblings alongside SKILL.md |

## Page Conventions

Every wiki page (except `SKILL.md`, `log.md`, `schema.md`, `.mditerc`, `protocols/*.md`) requires YAML frontmatter:

```yaml
---
tags: [domain/subtopic]
summary: "One-line description"
code-cites: [path/to/file:NN]
---
```

All three fields (`tags:`, `summary:`, `code-cites:`) are required on every write — `wiki-write` validates their presence unconditionally on both create and update paths.

## Operations Log Classification

log.md is the operations log for the wiki. Modifications use direct file appends (Edit/Write); not subject to the wiki-write routing requirement that applies to knowledge-content pages.

