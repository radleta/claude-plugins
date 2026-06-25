# email-draft-expert Wiki — Schema

## Page Types
- **Knowledge page**: Core domain content with frontmatter (tags, summary)

## Conventions
- Filenames: kebab-case, descriptive
- Links: standard markdown (`[Page](page.md)`)
- Frontmatter: `tags` and `summary` required on all knowledge pages

## Tag Prefix

All pages use the `email-draft-expert/` tag prefix:

```yaml
tags: [email-draft-expert/<subtopic>]
```

Examples: `email-draft-expert/creating-drafts`, `email-draft-expert/label-gated-access`, `email-draft-expert/security-model`

## Evolution
Review and update this schema after every 10-20 ingests.
