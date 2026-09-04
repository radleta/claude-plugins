# winforms-expert Wiki Schema

## Page Conventions

Every wiki page (except SKILL.md, log.md, schema.md) requires YAML frontmatter:

```yaml
---
tags: [winforms-expert/<subtopic>]
updated: YYYY-MM-DD
summary: "One-line description"
---
```

- **tags**: `winforms-expert/<subtopic>` (e.g., `winforms-expert/layered-windows`, `winforms-expert/gdi-handles`)
- **updated**: Last modification date — staleness signal for lint
- **summary**: One-line description used in `## Pages` index entries
- **Linking**: Standard markdown links (`[Page](page.md)`)
- **Naming**: Kebab-case filenames, descriptive, no numbering prefixes

## Page Types

| Type | Purpose |
|------|---------|
| **gotcha** | Counter-intuitive WinForms/.NET behavior or surprising constraint |
| **pattern** | Reusable approach validated in production code |
| **research** | Factual finding about a WinForms/.NET API or runtime behavior |
| **drift** | Wiki content found out-of-sync with actual API/codebase |

## `## Pages` Index Entry Format

`- [title](file.md) — one-line summary` (no bold wrappers, no nested bullets)
