---
tags: [investigation, wiki, schema, conventions]
summary: "Wiki conventions and page-type definitions for the researcher skill — frontmatter requirements, page-type taxonomy, and naming rules."
---

# Schema

Wiki conventions and page-type definitions for the researcher skill folder.

## Frontmatter Requirements

All sibling pages in this skill folder must include:

| Field | Required | Notes |
|-------|----------|-------|
| `tags:` | Yes | Array of strings; first tag must be `investigation` |
| `summary:` | Yes | One-sentence description for use in `## Pages` listings |

The auditable reference set (what freshness checking tracks) is literal markdown links in
prose (AD1) — e.g. `[wiki-write.sh:196](../../wiki-memory/scripts/wiki-write.sh)`, line
precision in the anchor text. A legacy `code-cites:` array is tolerated if present on an
existing page but is no longer required or written on new pages; `[]` (or absence) marks a
principle page with nothing to cite.

## Page-Type Taxonomy

| Page type | Description | Example pages |
|-----------|-------------|---------------|
| Methodology page | Step-by-step protocol for researcher operation | `investigation-workflow.md` |
| Decision framework page | Routing tables, filter rules, classification rules | `decision-frameworks.md` |
| Example page | Paired positive/negative examples | `positive-negative-examples.md` |
| Contract page | Output format, trailer schema, enum definitions | `output-format.md` |
| Capability page | Tool capability descriptions | `tool-capabilities.md` |
| Discipline page | Hard rules and constraint documentation | `file-paths-discipline.md` |
| Schema page | Conventions and definitions | `schema.md` |

## Naming Rules

- Sibling pages use kebab-case slugs (e.g., `decision-frameworks`, `output-format`).
- No version numbers in filenames — pages are updated in place via `wiki-write --update`.
- The `.mditerc` `entrypoint: SKILL.md` is required and must not be changed.
