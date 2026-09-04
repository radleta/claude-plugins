---
tags: [writing/audience]
summary: "Gopen & Swan's topic-stress position model: readers assign interpretive weight based on where information appears in a sentence. Topic position (sentence opening) signals context; stress position (sentence end) signals importance. Violating these positions produces confusion even when content is correct."
code-cites: []
---

# Reader Expectation Framework

Readers parse sentences by position, not just content. Gopen and Swan ("The Science of Scientific Writing," American Scientist, 1990) demonstrated that readers systematically assign interpretive weight based on where information lands within a sentence — independent of the information's logical merit.

Two positions carry structural weight:

**Topic position** (sentence opening, especially the grammatical subject): readers expect context here — what the sentence is "about," usually known information that links back to what came before. The reader holds the subject in mind as a lens for the rest of the sentence.

**Stress position** (sentence end, just before a major structural boundary): readers expect the most important new information here. When new information occupies stress position, it lands with force. When it does not, readers often miss or misweight it — even rereading does not fully compensate.

## The Topic-Stress Anti-Pattern

The most common violation: front-loading the new finding and trailing the context.

Problematic: "The 40ms p99 latency was achieved by eliminating connection pool contention." — The number (new, important) leads; the explanation (context, likely already established) trails.

Revised: "Connection pool contention was the primary bottleneck; eliminating it brought p99 latency to 40ms." — Context first, result at stress position. The reader who already knows there was a latency problem places emphasis exactly where the writer intends.

The content of both sentences is identical. The first produces cognitive work; the second does not.

## Cross-Sentence Topic Linking

Topic position also serves as the chain link between sentences. Readers expect the opening of sentence N to pick up something from sentence N-1 — the "old" information that anchors the next thought. When every sentence opens fresh — new subject, new topic — the reader loses the thread even if each individual sentence is locally clear.

This is the structural source of a common complaint: "I understood each sentence but I got lost in the paragraph." The sentences are individually clear; the chain is broken.

## Application to Technical Writing

Technical writing fails this rule frequently because engineers write in the order they discovered things (new finding → explanation), rather than in the order readers need to receive them (context → new finding). The former matches how the problem was solved; the latter matches how the reader builds understanding.

Source: Gopen & Swan, "The Science of Scientific Writing," American Scientist 78 (1990).

## See also

- [explaining-hard-things/topic-stress-architecture](../explaining-hard-things/topic-stress-architecture.md) — The same Gopen & Swan framework applied to the mechanics of explanatory writing: how to sequence information so readers can build understanding in one forward pass.

## How to apply

1. After drafting a paragraph, identify each sentence's subject and its sentence-final clause.
2. Ask: "Is my most important new information near the end, or buried in the middle of the sentence?"
3. If the key result or finding leads the sentence, rewrite: put context first (known information, the "about"), resolution last (new information, the "point").
4. Check cross-sentence links: does each sentence's opening reference something established in the sentence before? If not, add a bridging phrase or restructure.
5. In technical writing specifically, put the technical result, key number, or conclusion in stress position — readers remember and weight what they read last.
6. Diagnose paragraphs that readers say "confused" them: find sentences where new information is in topic position. That is usually the source.
