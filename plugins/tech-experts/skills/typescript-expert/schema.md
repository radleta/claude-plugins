# typescript-expert Wiki — Schema

## Page Types
- **Knowledge page**: Core domain content with frontmatter (tags, summary, plus any per-domain required fields)

## Conventions
- Filenames: kebab-case for new pages; ALL-CAPS preserved for legacy sibling files
- Links: standard markdown (`[Page](page.md)`)
- Frontmatter: `tags` and `summary` required on all knowledge pages; additional required fields declared in this schema.md
- Tag prefix: `typescript-expert/<subtopic>` (e.g., `tags: [typescript-expert/patterns]`)

## Page Inventory
- `DETECTION.md` — Pattern detection rules (signal → pattern mapping, decision trees)
- `CHECKLISTS.md` — Verification checklists (190+ items across 8 categories)
- `INVESTIGATION.md` — 12 tool-specific investigation protocols
- `PATTERNS.md` — 42 code generation templates
- `PRINCIPLES.md` — TypeScript 5.x features and core principles
- `EXAMPLES.md` — Real-world generation examples and walkthroughs
- `REFERENCE.md` — Performance optimization, troubleshooting, edge cases

## Evolution
Review and update this schema after every 10-20 ingests.
