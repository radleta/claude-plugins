---
tags: [llm-wiki-expert/memory-consolidation]
summary: "Memory consolidation is triggered by idle time or importance thresholds, not fixed schedules"
---

## Memory Consolidation ("Dreaming") Is Triggered by Idle Time or Importance Thresholds, Not Simple Schedules

Observed consolidation triggers across systems: Letta's sleep-time agents run a dedicated consolidator agent during idle periods that shares memory blocks with the primary agent (https://www.letta.com/blog/sleep-time-compute/). The Stanford generative-agents reflection mechanism fires when the sum of recent memory "importance" scores crosses a threshold, and the resulting synthesized insights cite the specific evidence memories that produced them (https://ar5iv.labs.arxiv.org/html/2304.03442). Auto-Dreamer treats the existing memory region as read-only evidence during consolidation and writes an entirely new replacement set rather than editing memories in place (https://arxiv.org/abs/2605.20616). Reported Claude "Dreaming" behavior uses a compound trigger — 24 hours elapsed AND more than 5 sessions — with surgical (non-bulk) writes and a concurrency lock; this is sourced only from third-party reporting, not confirmed on anthropic.com (https://claudefa.st/blog/guide/mechanics/auto-dream).

**Implication:** Consolidation trigger design for wiki-memory should consider compound/idle-based conditions (elapsed time AND activity volume, or importance-sum thresholds) rather than a single fixed schedule. The Claude "Dreaming" trigger detail is unverified third-party reporting and should not be treated as a confirmed Anthropic-published mechanism.
