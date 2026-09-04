---
tags: [llm-wiki-expert/memory-management]
summary: "Pending-review curation queues require automation or forced expiry to drain reliably"
---

## Pending-Review Curation Queues Never Reliably Drain Without Automation or Forced Expiry

Community and tooling evidence indicates pending-review queues (items awaiting human or agent curation before being trusted) are never reliably drained unless backed by automation or forced expiry/escalation — manual-only review queues accumulate indefinitely. llm-wiki-agent addresses this by using DRAFT promotion gates for auto-linked edges rather than an unbounded review queue (https://github.com/SamurAIGPT/llm-wiki-agent). A related cost-control pattern observed alongside this: split cheap structural health checks (run every session) from expensive semantic lint (run only every 10-15 ingests).

**Implication:** Any escalation/review-queue design in wiki-memory's aging loop needs a forced-resolution mechanism (promotion gate, expiry, or escalation) rather than relying on the queue eventually being cleared manually; also supports tiering wiki-health's cheap structural checks (every session) separately from expensive semantic lint (batched every N ingests) for cost control.
