---
tags: [llm-wiki-expert/memory-management]
summary: "Production memory systems invalidate on contradiction/supersession, never on age alone"
---

## Production Agent-Memory Systems Invalidate on Contradiction, Never on Age Alone

No production memory system reviewed invalidates facts purely because they aged — invalidation is contradiction- or supersession-driven. Graphiti/Zep set an `expired_at` timestamp on edges that are contradicted by newer facts and never delete the original edge (https://blog.getzep.com/beyond-static-knowledge-graphs/). MemStrata retires facts via a `valid_to` timestamp plus a `superseded_by` link, using deterministic (subject, relation)-key matching to detect contradictions rather than embedding similarity — embedding similarity alone scores near-chance (0.59 AUROC) at contradiction detection (https://arxiv.org/html/2606.26511). mem0's memory decay is search-ranking-only (lowers retrieval rank over time) and never deletes memories outright (https://mem0.ai/blog/introducing-memory-decay-in-mem0).

**Implication:** Any staleness/aging design for wiki-memory should treat age as a signal to re-verify rather than a deletion trigger — supersession/contradiction detection via deterministic key matching (not embedding similarity, which underperforms at this task) is the mechanism that actually retires facts in comparable production systems.
