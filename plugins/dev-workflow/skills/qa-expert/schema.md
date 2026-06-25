# qa-expert Wiki — Schema

## Page Types
- **Knowledge page**: Core domain content with frontmatter (tags, summary, plus any per-domain required fields)
- **Group hub**: `index.md` inside a subdirectory — provides navigation list for that group's pages
- **Template file**: Code-only test templates (`.ts`, `.java`, `.js`, `.py`, `.rb`) — no frontmatter required

## Conventions
- Filenames: kebab-case for `.md` pages; framework naming conventions for code templates
- Links: standard markdown (`[Page](page.md)`)
- Frontmatter: `tags` and `summary` required on all knowledge `.md` pages; not required on code template files
- Tags: prefix is `qa-expert/` followed by subtopic slug (e.g. `qa-expert/rules`, `qa-expert/decision-trees`)

## Group Structure
- `decision-trees/` — Choice guidance trees for test strategy decisions
- `examples/` — Complete workflow examples for unit and integration testing
- `investigation/` — Project detection protocols for framework/pattern discovery
- `rules/` — Hard constraint rule files for test authoring
- `templates/` — Framework-specific working test code templates (Jest, Pytest, JUnit, Mocha, RSpec)
- `validation/` — Post-generation quality checklist

## Evolution
Review and update this schema after every 10-20 ingests.
