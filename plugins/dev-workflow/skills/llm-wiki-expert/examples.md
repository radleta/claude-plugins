---
tags: [llm-wiki-expert/examples]
summary: Sample wiki artifacts — index entries, entity pages with key claims and contradictions, and log entries showing the wiki format in practice.
---

# Examples

## Sample Index Entry

```markdown
## Entities
- [Ada Lovelace](wiki/entities/ada-lovelace.md) — Mathematician, first computer programmer (3 sources)
- [Charles Babbage](wiki/entities/charles-babbage.md) — Inventor of the Analytical Engine (2 sources)

## Concepts
- [Mechanical computation](wiki/concepts/mechanical-computation.md) — Pre-electronic computing devices and theory
```

Note: the paths above are illustrative — in your wiki, file paths reflect your own directory structure.

## Sample Entity Page

```markdown
---
tags: [person, mathematician, computing-pioneer]
source_count: 3
last_updated: 2026-04-01
---
# Ada Lovelace

English mathematician (1815-1852). Recognized as the first computer programmer for her work on Babbage's Analytical Engine.

## Key Claims
- Wrote the first algorithm intended for machine execution (Source: Essinger 2014)
- Foresaw general-purpose computing beyond pure calculation (Source: Fuegi & Francis 2003)

## Connections
- Collaborated with [[Charles Babbage]] on the Analytical Engine
- Work relates to [[mechanical computation]] and [[algorithm]] concepts

## Contradictions
- Debate over extent of independent contribution vs transcription of Babbage's ideas.
  See Fuegi & Francis 2003 for detailed analysis.
```

## Sample Log Entry

```markdown
## [2026-04-01] ingest | Essinger 2014 — Ada's Algorithm
- Summary page: wiki/sources/essinger-2014.md
- Updated: ada-lovelace.md, charles-babbage.md, mechanical-computation.md
- New page: algorithm.md
- Contradictions: none found
```
