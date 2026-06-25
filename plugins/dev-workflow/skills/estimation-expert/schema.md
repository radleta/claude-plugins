# estimation-expert Wiki — Schema

## Page Types
- **Knowledge page**: Core domain content with frontmatter (tags, summary, plus any per-domain required fields)
- **Data page**: Calibration or reference data (e.g., velocity profiles) — same frontmatter requirements

## Conventions
- Filenames: kebab-case, descriptive
- Links: standard markdown (`[Page](page.md)`)
- Frontmatter: `tags` and `summary` required on all knowledge pages; additional required fields declared in this schema.md
- Tag prefix: `estimation-expert/<subtopic>` (e.g., `estimation-expert/formula`, `estimation-expert/workflow`)

## Subtopic Taxonomy
- `estimation-expert/context` — user workflow context and parallelism patterns
- `estimation-expert/formula` — estimation formula, multipliers, and math
- `estimation-expert/workflow` — estimation protocol steps and process
- `estimation-expert/reference` — lookup tables, classification guides, signals
- `estimation-expert/output` — output formats and templates
- `estimation-expert/calibration` — velocity data, profiles, recalibration
- `estimation-expert/qa` — quality checklists and anti-patterns

## Evolution
Review and update this schema after every 10-20 ingests.
