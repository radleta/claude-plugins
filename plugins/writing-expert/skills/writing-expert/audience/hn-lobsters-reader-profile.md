---
tags: [writing/audience]
summary: "What Hacker News and Lobsters technical readers bring to a post: high domain prior knowledge, skeptical evaluation mode, pattern-matching for hype, and an early-exit threshold that fires within the first two paragraphs when depth is absent."
code-cites: []
---

# HN/Lobsters Reader Profile

Hacker News and Lobsters readers are not a general audience. They read to evaluate, not to be entertained. Understanding what this community surface-tests for is the difference between a post that gets substantive technical discussion and one that gets downvoted or closed.

## What They Bring

**High domain prior knowledge.** A post on database indexing is read by people who have written indexing code. A post on distributed consensus is read by people who have debugged split-brain scenarios. The baseline assumption is "professional with relevant experience," not "informed generalist."

**Evaluation mode, not consumption mode.** The reader is running a continuous background test: "does this check out?" They compare claims against their own experience and knowledge. Anything that fails the sanity check — a number that seems off, a claim that contradicts their experience, an omitted caveat they know to be critical — generates distrust that colors everything that follows.

**Hype pattern recognition.** Years of reading product announcements and "we're excited to share" posts have trained these readers to spot marketing language instantly. Once spotted, the frame shifts from "evaluating technical claims" to "identifying what is being sold." Everything becomes suspect.

## The Early-Exit Threshold

If the first two to three paragraphs do not demonstrate technical depth, most HN readers close the tab. Technical depth signals include: a specific failure mode described, a number with conditions, a constraint named and explained, a prior-art comparison that acknowledges the prior art's actual strengths. Abstract positioning ("we built a better X") does not satisfy this threshold.

Posts that open with context ("we needed to handle 10K concurrent writes to a single row, and every standard approach we tried failed for the same reason") outperform posts that open with announcement ("today we're releasing X"). The former places the reader in a familiar problem; the latter is a headline.

## What They Reward

| Signal | Concrete form |
|--------|--------------|
| Specific numbers with conditions | "p99 under 40ms at 500 req/s on a 4-core machine" |
| Named failure modes | "We tried approach A first; it failed under load because of B" |
| Honest tradeoffs | "This works well for X; it is wrong for Y" |
| Open questions | "We still don't fully understand why this spikes under heavy GC pressure" |
| Builder-only details | Config flags, specific file structures, error messages encountered |
| Self-correction | "Our initial model was wrong; here is what we discovered instead" |

## What They Punish

| Marker | Why it backfires |
|--------|----------------|
| Superlatives without benchmarks | "Fastest" has been claimed too many times without evidence |
| All-positive competitor comparisons | Real tradeoffs exist; absence implies unawareness or dishonesty |
| No failure modes mentioned | Signals inexperience or concealment |
| Product-page vocabulary | "Delightful," "seamless," "powerful" — language of PR, not engineering |
| Complexity hidden or smoothed over | Implies the author did not understand it |
| First-person plural about the tool's values | "We believe in developer experience" is not a technical claim |

## Calibrating Baseline

These readers know the terrain. A post on Redis that does not mention eviction policies, persistence modes, or replication will read as shallow to a reader who runs Redis in production. You do not need to cover everything — but you must signal awareness of the full problem space. "We considered X and decided it was not a concern for our use case because Y" earns more credibility than silence on X.

Source: Synthesized from observed HN/Lobsters community norms, comment patterns, and post performance in technical communities (2010–2025). The pattern is stable across the period.

## How to apply

1. Before publishing, apply the "senior engineer" test: would a professional who has solved this problem before believe these claims? If uncertain, add specifics.
2. Read your opening paragraph as a skeptic. Does it signal "this person built the thing" within the first 100 words? If not, restructure the opening.
3. Scan for superlatives and comparison claims. Every one needs a benchmark, conditions, or a cited source — or cut it.
4. Add at least one failure mode, constraint, or open question. Its absence is a credibility red flag.
5. Remove all product-page vocabulary. Replace with specifics or cut the sentence entirely.
6. Apply the "builder-only detail" check: does the post contain at least one piece of information that only someone who actually implemented the system would know? If not, add one.
