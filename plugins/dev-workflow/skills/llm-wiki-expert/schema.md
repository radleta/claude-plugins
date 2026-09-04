# llm-wiki-expert Wiki — Schema

## Page Types

- **Knowledge page**: Core domain content with frontmatter (`tags`, `summary` required)
- **Operations page**: Workflow procedures and checklists (e.g., OPERATIONS.md)
- **Source page**: Raw source material preserved for reference (e.g., llm-wiki-source.md)

## Conventions

- Filenames: kebab-case, descriptive
- Links: standard markdown (`[Page](page.md)`)
- Frontmatter: `tags` and `summary` required on all knowledge pages
- Tag prefix: `llm-wiki-expert/<subtopic>` (e.g., `tags: [llm-wiki-expert/principles]`)
- `last-verified`: optional frontmatter field, a quoted YAML string (e.g. `last-verified: "2026-07-12"`) bumped by lint/groom deep-confirms when a page survives verification unchanged; never a bare date

## Evolution

Review and update this schema after every 10-20 ingests.
