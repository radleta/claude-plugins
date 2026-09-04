---
tags: [writing/explaining-hard-things]
summary: "Embedding code samples in explanatory prose requires treating the code block as an object in the reader's attention, not a pause in the narrative. The prose before and after a code block does different work: before sets context (what to look for), after extracts the lesson (what just happened). Getting this wrong turns code-heavy explanations into API documentation with commentary."
code-cites: []
---

# Code-in-Prose: Integrating Technical Samples Without Losing Narrative

Technical explanatory writing faces a specific structural challenge that general prose craft does not address: the code block. A code block is not a sentence, a paragraph, or an image — it demands a different kind of reader attention (close, sequential, literal) and it can hold arbitrarily large amounts of complexity. Poor integration leaves the reader unsure what to attend to inside the block, and unsure what to do with it after.

The principles below derive from Gopen and Swan's context-before-complexity principle ("The Science of Scientific Writing," 1990) and Pinker's work on reader working memory (*The Sense of Style*, 2014), applied specifically to the code-in-prose context.

## The Three-Part Frame: Before / Code / After

A code block embedded in explanatory prose requires three structural components:

**Before the code** — Context sentence(s): what is the code doing, and what specific thing should the reader watch for? Not: "Here is the code:" (empty — gives the reader no filter for what they are about to see). Instead: "The following function does X. Notice that Y — this is the behavior we need to explain." The before-frame applies Gopen and Swan's topic position principle: familiar context first, then the new material (the code). The reader needs a schema activated before the code arrives or they will read it without orientation.

**The code** — The block itself, as short as it can be while still demonstrating the principle. Every line not needed to show the principle is cognitive load with no return. Cut setup boilerplate that is not load-bearing for the explanation. Show the minimum self-contained example.

**After the code** — Lesson extraction: what did the reader just see, and why does it matter? "The key line is X: it does Y. This means that when you encounter situation Z, you can expect behavior W." The after-frame occupies Gopen and Swan's stress position: it carries the new information the reader takes away. Without an after-frame, the reader leaves the code block holding the literal syntax with no abstraction — they have seen the code but not understood the principle.

## The Minimum Viable Code Sample

Pinker's working-memory principle: readers have limited working memory and spend it on comprehension rather than synthesis. A code sample with 40 lines forces the reader to hold 40 lines in working memory before extracting the 2 lines that make the point. The cost is not obvious to the writer (who already knows which 2 lines matter) but is very real for the reader.

Rule of thumb: the code sample should be long enough to run in isolation (or be clearly a valid excerpt) and short enough that the before-frame can name the key thing to watch for in one sentence. If the before-frame requires three sentences to orient the reader to the code, the code sample is probably too complex — split it into two smaller samples each making one point.

## Naming Before Showing

Code samples introduce a temptation that plain prose does not: to show the code and then name the pattern it illustrates. This reverses the correct order. Readers who see code without a named schema will try to induce the pattern themselves — an expensive, error-prone process. Readers who have a named schema will verify that the code matches the schema — much cheaper and more reliable.

Correct order: name the pattern in prose → show the code that exemplifies it → confirm what to take away.

Wrong order: show the code → explain afterward what it was illustrating.

This applies Gopen and Swan's topic-stress principle: the familiar (the pattern name, stated in prose) comes at the topic position (before the code); the confirmation (the code) occupies the content position.

## Interleaving vs. Monolith

When an explanation requires several code samples:

- **Monolith approach** (anti-pattern): present all the code at once, then explain all of it. Forces the reader to hold the entire code block in memory and map back to a later explanation. Works only when the reader already knows the domain well enough to read code without prose support.

- **Interleaved approach** (pattern): alternate prose and code — concept in prose, code exemplifying it, lesson extracted, next concept in prose, next code sample, next lesson. Each code block is small and immediately explained. The reader processes one unit at a time. Cognitive load is distributed across the explanation rather than concentrated in one block.

Interleaving is more work to write (each seam between prose and code must be structured) but produces significantly better comprehension for readers new to the topic.

## Passive Code: When to Omit

Not every technical explanation requires code. When the principle can be stated accurately in prose, prose is usually better — it is faster to read, easier to search, and does not require the reader to switch processing modes. Reserve code for:

- Demonstrating an exact syntax, API shape, or behavior that prose cannot convey without ambiguity
- Showing a before/after pair that makes the principle immediately concrete
- Providing a runnable reference the reader can adapt

Avoid code when: the principle is general enough to state in prose without loss, or when the code requires so much context setup that the ratio of scaffolding to signal is too high.

## How to apply

1. **Before every code block, write a context sentence naming (a) what the code does and (b) the one specific thing to watch for.** If you cannot write that sentence in under 30 words, the code sample is probably too complex for one block.
2. **After every code block, write a lesson sentence stating what the reader should take away.** Begin with "Notice that..." or "This means..." or "The key behavior here is..." Do not let a code block be the last thing in a section — always extract the abstraction.
3. **Cut every line in a code sample that is not load-bearing for the principle being shown.** Boilerplate, unrelated imports, and scaffolding that does not illustrate anything should be elided (use `# ...` or `// ...` to mark the cut).
4. **Name the pattern in prose before showing the code that exemplifies it.** Do not reverse this order.
5. **For multi-step explanations, interleave prose and code rather than front-loading all code.** Each interleaved unit is: one prose concept → one short code sample → one lesson extraction.
6. **Ask whether code is necessary.** If the principle can be stated in prose without ambiguity, prefer prose. Code is for when the exact form matters or a concrete example closes a gap words cannot.
