# github-actions-expert Wiki — Schema

## Page Types
- **Knowledge page**: Core domain content with frontmatter (tags, summary, plus any per-domain required fields)

## Conventions
- Filenames: kebab-case, descriptive
- Links: standard markdown (`[Page](page.md)`)
- Frontmatter: `tags` and `summary` required on all knowledge pages; additional required fields declared in this schema.md

## Tag Taxonomy
Tags use the `github-actions-expert/<subtopic>` prefix. Example subtopics:
- `github-actions-expert/workflow-syntax`
- `github-actions-expert/security`
- `github-actions-expert/artifacts`
- `github-actions-expert/release`
- `github-actions-expert/dotnet`
- `github-actions-expert/conditional`
- `github-actions-expert/reusable`
- `github-actions-expert/anti-patterns`
- `github-actions-expert/patterns`

## Evolution
Review and update this schema after every 10-20 ingests.
