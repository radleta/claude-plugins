---
tags: [writing/audience]
summary: "Decision table for what earns vs. loses trust in technical writing aimed at dev-community audiences. Credibility comes from specifics, named failure modes, and honest tradeoffs; it evaporates on superlatives, all-positive framing, and product-page vocabulary."
code-cites: []
---

# Credibility Signals in Technical Writing

Technical community trust is earned by specific evidence and lost by specific markers. The signals operate below conscious reading: a reader does not decide "I distrust this author" — they simply extend less interpretive charity to the next claim. Every sentence requiring the reader to "trust me on this" that is not backed by evidence is a withdrawal from a limited trust account. Overdrawn accounts produce skeptical comments or no engagement at all.

## Signals That Earn Trust

| Signal | Example form |
|--------|-------------|
| Specific numbers with conditions | "Reduced build time from 4.2m to 38s on a cold Docker layer cache, 16-core host" |
| Named failure modes | "We tried X first; it failed under Y because of Z" |
| Acknowledged tradeoffs | "This approach is wrong if your write/read ratio exceeds 10:1" |
| Prior art acknowledged honestly | "Library A does this better if you don't need B" |
| Open questions stated explicitly | "We don't yet understand why this occasionally spikes under heavy GC pressure" |
| Builder-only implementation detail | Specific file paths, error messages, config flags — details only a builder encounters |
| Self-correction | "Our initial model was wrong; here is what we discovered" |

## Signals That Trigger Skepticism

| Marker | Why it backfires |
|--------|----------------|
| Superlatives without benchmarks | "Fastest" and "most elegant" are claimed constantly and rarely verified |
| All-positive comparisons | Real systems have tradeoffs; no tradeoffs found implies the author didn't look |
| No failure modes mentioned | Signals either inexperience or deliberate concealment |
| Vague scale language | "Handles millions of users" without conditions is unverifiable |
| Product-page vocabulary | "Delightful," "powerful," "seamless" — signals PR authorship, not engineering |
| Absent implementation detail | The post reads as if written about the system, not from building it |
| Team-values claims embedded in technical content | "We believe in developer experience" is a brand statement, not a technical fact |

## The Press-Release Test

Ask: if I removed every sentence about why this matters, what it enables, and how the team feels about it, would a complete technical explanation remain?

- If yes: the post is technical, with enthusiasm added. The enthusiasm is fine.
- If no: the post is a press release with technical vocabulary. The technical audience will identify and reject it.

Technical community readers accept enthusiasm when it follows evidence. They reject it when it substitutes for evidence.

## The Self-Promotion Trap

Technical writing for a tool or system the author built has a structural credibility problem: the author has an obvious stake in the reader finding it worthwhile. The community knows this. The remedy is not to hide the stake — it is to demonstrate that the author applied the same critical standards to their own work as they would to someone else's.

The trap: posts that advocate for the thing before demonstrating it. Advocacy before demonstration signals marketing. Demonstration followed by qualified advocacy signals engineering.

Anti-pattern: "We built X because we were frustrated with existing tools. X solves all these problems. You should try X."

Credible form: "We needed to do Y under constraints A, B, C. Existing tools failed for reasons D, E. We built X to address D and E specifically — it makes no improvement on F, which remains a constraint."

Source: Synthesized from Gopen & Swan (reader trust and structural expectation, "The Science of Scientific Writing," American Scientist, 1990) and HN/Lobsters community norms.

## How to apply

1. Audit every comparative claim in the draft. Does each one carry a number, a condition, or a named source? If not, cut or add one.
2. Run the press-release test. Identify and remove pure-enthusiasm sentences that substitute for evidence.
3. Add at least one failure mode or acknowledged limitation. If none comes to mind, think harder — it almost certainly exists.
4. For any benchmark claim, state the conditions: hardware, dataset size, competing baseline, and when it was measured.
5. Check the draft's vocabulary against the skepticism-marker list. Replace every superlative with a specific measurement or remove it.
6. Apply the self-promotion test: does the post demonstrate before it advocates? Reorder if not.
