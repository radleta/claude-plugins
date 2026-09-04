# cli-expert Wiki — Schema

## Page Types
- **Knowledge page**: Core domain content with frontmatter (tags, summary, plus any per-domain required fields)

## Conventions
- Filenames: kebab-case, descriptive
- Links: standard markdown (`[Page](page.md)`)
- Frontmatter: `tags` and `summary` required on all knowledge pages; additional required fields declared in this schema.md
- Tag prefix: `cli-expert/<subtopic>`

## Page Tag Taxonomy
- `cli-expert/principles` — core Unix and CLI design principles
- `cli-expert/output` — output modes, color, formatting
- `cli-expert/errors` — error handling, exceptions, cancellation
- `cli-expert/dx` — developer experience and conventions
- `cli-expert/checklists` — production readiness and audit checklists
- `cli-expert/platforms` — platform-specific implementation guides

## Evolution
Review and update this schema after every 10-20 ingests.
