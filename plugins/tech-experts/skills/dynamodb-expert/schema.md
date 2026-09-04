# dynamodb-expert Wiki — Schema

## Page Types
- **Knowledge page**: Core domain content with frontmatter (tags, summary, plus any per-domain required fields)

## Conventions
- Filenames: kebab-case, descriptive
- Links: standard markdown (`[Page](page.md)`)
- Frontmatter: `tags` and `summary` required on all knowledge pages; additional required fields declared in this schema.md

## Tag Prefix

All knowledge pages use the `dynamodb-expert/` tag prefix.

Examples:
- `tags: [dynamodb-expert/modeling]`
- `tags: [dynamodb-expert/dotnet-sdk]`
- `tags: [dynamodb-expert/anti-patterns]`

## Evolution
Review and update this schema after every 10-20 ingests.
