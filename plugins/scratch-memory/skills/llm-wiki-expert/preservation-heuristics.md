---
tags: [llm-wiki-expert/memory-management]
summary: "Memory preservation prioritizes reference-count and category over age; aggressive consolidation loses granularity"
---

## Comparable Memory Systems Preserve by Reference-Count and Category, Not Age, and Warn Against Over-Consolidation

Production and community guidance favors reference-count over age as the preservation signal, plus category-differentiated TTLs — decisions and preferences are treated as never-expiring while debug notes get short TTLs (~14 days). Community guidance explicitly warns "don't over-consolidate — you lose granularity" (Letta forum: https://forum.letta.com/t/sleeptime-agents-for-memory-consolidation-best-practices-guide/154). A medical-agent study found a curated-small memory set (248 selectively-managed/curated records) outperformed an accumulated-large one (2,400+ stored records) on accuracy: 39% vs 13% respectively.

**Implication:** Wiki-memory's staleness/retention design should weight reference-count and knowledge-category (decision/preference vs. debug-note) over raw age, and should guard against aggressive consolidation collapsing granularity — both directly inform the "one staleness definition" and remediation-contract goals of the wiki-aging-loop effort.
