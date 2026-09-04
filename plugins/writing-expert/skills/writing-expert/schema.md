# writing-expert Wiki — Schema

## Page Types

- **Knowledge page**: Core domain content with frontmatter (tags, summary, plus any per-domain required fields)
- **Group index**: `index.md` hub for a subdirectory group (tags, summary required)

## Subdirectory Groups

> **PROVISIONAL** — This dimension set is a starting structure expected to evolve. Step 03r reconciles it against the pilot ingest output before the full fan-out; do not treat rows as stable until that gate passes.

| Dimension (dir) | Coverage | Status |
|-----------------|----------|--------|
| `process/` | the writing passes: reporting → spine → rough draft → structural revision → line edit → opening+title last | Provisional |
| `narrative-craft/` | structure, openings, throughline, tension/payoff, the "so what" | Provisional |
| `sentence-craft/` | rhythm, concision, diction, cutting darlings | Provisional |
| `explaining-hard-things/` | curse of knowledge, analogy, code-in-prose | Provisional |
| `audience/` | the technical reader, HN/Lobsters dynamics, credibility signals | Provisional |
| `canon/` | deconstructed exemplars → reusable patterns | Provisional |
| `meta/` | non-craft utility (D12): community-skill survey (R-survey, fan-out) + Phase-6 eval/A-B analysis (D10); excluded from the content-dimension count | Provisional |
| `review/` | craft-review rubric (filled in Step 06; excluded from the fan-out) | Provisional |

## Conventions

- Filenames: kebab-case, descriptive
- Links: standard markdown (`[Page](page.md)`)
- Frontmatter: `tags` and `summary` required on all knowledge pages
- Tags use `writing/{dimension}` namespace (e.g., `writing/process`, `writing/narrative-craft`)
- Group index files use tags matching their dimension: `writing/process`, `writing/sentence-craft`, etc.
- **Mandatory page convention**: every knowledge page MUST end in an actionable `## How to apply` section (operational, not academic). This is enforced in Step 05.

## Evolution

Review and update this schema after every 10–20 ingests.
