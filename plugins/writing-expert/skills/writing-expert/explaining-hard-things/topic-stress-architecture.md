---
tags: [writing/explaining-hard-things]
summary: "Every sentence has a topic position (the beginning, carrying familiar context) and a stress position (the end, carrying new information). Readers process sentences in one forward pass and expect the architecture to match their knowledge state: familiar first, new last. Violating this structure makes prose confusing even when the content is accurate."
code-cites: []
---

# Topic-Stress Sentence Architecture: Information Ordering for Explanatory Prose

Gopen and Swan, in "The Science of Scientific Writing" (American Scientist, 1990), argue that most clarity problems in technical writing are not caused by difficult content — they are caused by structural mismatch between where writers place information and where readers expect to find it.

The core framework: every English sentence has two positions that carry privileged meaning for readers.

| Position | Location | Reader expectation |
|----------|----------|--------------------|
| **Topic position** | Beginning of the sentence | "This tells me what the sentence is about — context I bring from what I already know" |
| **Stress position** | End of the sentence | "This is the new information I'm supposed to take from this sentence" |

Readers read in one forward pass. They cannot hold a complicated clause in working memory while waiting for the context that would make it meaningful. When context arrives before content, readers orient correctly. When content arrives before context, readers interpret the content with no anchor — they often misread it, then have to revise when context arrives, which is effortful and makes prose feel dense.

## The Mismatch Problem

A common failure in technical explanatory writing:

> "The mitochondria, a double-membrane organelle found in the cytoplasm of eukaryotic cells and responsible for the majority of ATP synthesis in aerobic respiration, powers the cell."

The new, important information ("powers the cell") arrives at the end — that is correct. But the interrupt before it (the long appositive phrase) forces the reader to hold "the mitochondria" in suspension across an enormous clause before getting the verb. By the time "powers the cell" arrives, the reader has expended most of their working memory budget on tracking the appositive.

The fix is not to delete information — it is to restructure so context comes before complexity:

> "The mitochondria powers the cell. It is a double-membrane organelle found in the cytoplasm of eukaryotic cells, responsible for the majority of ATP synthesis in aerobic respiration."

Now the key claim ("mitochondria powers the cell") arrives with full reader attention. The supporting detail follows as a second sentence, where the reader has the context to place it.

## Context Before Complexity: The Paragraph-Level Extension

The topic-stress principle scales from sentences to paragraphs. At the paragraph level:

- The opening sentence should establish what the paragraph is about (topic), using language the reader already holds from the previous paragraph.
- New complexity is introduced once the reader has an anchor for it.
- The closing sentence often carries the most important new conclusion (stress).

This means paragraphs should not open with the most complex or new idea — they should open with a bridge from the previous paragraph's known conclusion, then build.

## What "Familiar" Means

Familiarity is not just about whether the reader knows the term — it is about whether the reader has encountered the concept in the preceding text. A term can be familiar from shared general knowledge, from a definition two paragraphs ago, or from the previous sentence's stress position. The previous sentence's new information becomes the current sentence's old information — this chaining is what makes a paragraph feel like it flows.

A diagnostic: if you read two consecutive sentences and the second sentence's opening word or phrase is not traceable to something in the first sentence or in shared common knowledge, you have broken the chain. The reader will feel the jump as a clarity problem even if they can eventually piece it together.

## Topic-Stress and the Curse of Knowledge

Experts violate topic-stress not because they write badly, but because they know the material so well that they process it in parallel — they do not experience the serial working-memory constraint that a reader navigating new material experiences. What feels like one simple clause to the writer is three simultaneous new concepts to the reader.

Applying topic-stress structure is a direct countermeasure to the curse of knowledge at the sentence level: it forces the writer to sequence information in the order the reader needs it, not in the order the expert finds it logically compact.

## See also

- [audience/reader-expectation-framework](../audience/reader-expectation-framework.md) — The same Gopen & Swan framework viewed from the audience-calibration angle: how readers assign interpretive weight by sentence position, and what this means for technical writing aimed at specific communities.
- [sentence-craft/sentence-rhythm](../sentence-craft/sentence-rhythm.md) — Stress position is also a rhythm mechanism: the end of the sentence is where the reader's emphasis lands, so the most important term should arrive there to control both clarity and cadence.

## How to apply

1. **Read each sentence and locate the stress position** (the clause at the end, before the period). Ask: is this where the most important new information lands? If the key claim is buried mid-sentence, restructure to move it to the end.
2. **Check the topic position** (the opening of each sentence). Ask: can the reader recognize this from what they just read or from common knowledge? If the sentence opens on an unfamiliar technical term without prior definition, shift context to the front and move the new term to the stress position.
3. **Trace paragraph-opening sentences back to the previous paragraph's closing idea.** If there is no traceable link, add a bridge sentence or revise the transition.
4. **Flatten long apposite phrases that interrupt subject-verb.** If a sentence has more than ~12 words between the subject and its verb, consider breaking it into two sentences: the core claim first, the qualifying detail second.
5. **Chain the new-to-old:** confirm that the first clause of each sentence contains something the previous sentence already established. If not, you have a jump that readers will experience as a clarity gap regardless of content accuracy.
