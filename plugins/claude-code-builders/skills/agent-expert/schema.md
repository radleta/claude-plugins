# agent-expert Wiki — Schema

## Page Types
- **Knowledge page**: Core domain content with frontmatter (tags, summary)
- **Group index**: Navigation hub for a subdirectory group (`{group}/index.md`)
- **Principle page**: Dedicated page for a single agent-optimization principle

## Conventions
- Filenames: kebab-case, descriptive (e.g., `principle-7-executable.md`)
- Links: standard markdown (`[Page](page.md)`)
- Frontmatter: `tags` and `summary` required on all knowledge pages
- Tags: `agent-expert/<subtopic>` (e.g., `agent-expert/core-principles`, `agent-expert/validation`)
- Group pages: `agent-expert/<group>/<subtopic>` (e.g., `agent-expert/core-principles/principle-7`)

## Tag Taxonomy
- `agent-expert/core-principles` — Core 4 principles (always apply)
- `agent-expert/additional-principles` — Complexity-based additional principles
- `agent-expert/transformation` — Transformation patterns and techniques
- `agent-expert/validation` — Quality assessment and grading
- `agent-expert/workflow` — The 4-phase INVESTIGATE/APPLY/TRANSFORM/VALIDATE workflow
- `agent-expert/examples` — Before/after transformation examples
- `agent-expert/expertise-contract` — Progressive disclosure meta-pattern
- `agent-expert/subagent` — Subagent dispatch methodology

## Evolution
Review and update this schema after every 10-20 ingests.
