---
tags: [writing/review]
summary: "Checkbox craft-review rubric grouped by dimension — the gate spec writing-reviewer consumes, with the locked D9 verdict format."
code-cites: []
---

# Craft-Review Rubric

This is the **gate spec** for the `writing-reviewer` agent (Step 08). Walk every item against the draft in order. Any `[ ]` that cannot be checked `[x]` produces `Status: ISSUES_FOUND`. All checked → `Status: APPROVED`.

---

## Narrative Craft

- [ ] **One true thing leads.** The opening names a specific scene, tension, or detail — not a motivation statement, preamble, or category claim. The first sentence that contains real energy has not been buried behind a warm-up paragraph. → see [openings](../narrative-craft/openings.md)

- [ ] **Throughline is trackable.** A one-sentence party-test version of the piece can be stated without sounding like an abstract. Every section advances, complicates, or resolves the thread; no section is dead weight that does none of these. → see [throughline](../narrative-craft/throughline.md)

- [ ] **Tension arc: itch planted early, payoff earned late.** A question is legible in the first quarter. Sections oscillate (+/-) on the tension audit — the piece does not front-load its conclusion and then add evidence. The resolution feels both surprising and inevitable. → see [structural-tension](../narrative-craft/structural-tension.md)

- [ ] **"So what" lands at the ending.** The final move adds something the reader did not have after the previous paragraph — a transferable frame, not a restatement. The ending shows (specific image, detail, or moment) rather than tells the lesson. → see [so-what](../narrative-craft/so-what.md)

---

## Sentence Craft

- [ ] **Rhythm is varied, not metronomic.** No paragraph runs five consecutive sentences within five words of each other in length. At least one short declarative (≤10 words) follows a long accumulating sentence. Reading aloud would not produce an even beat. → see [sentence-rhythm](../sentence-craft/sentence-rhythm.md)

- [ ] **Key terms land in stress position.** The most important new claim in each sentence ends the sentence, not buries mid-clause. Old or familiar information opens; new or critical information closes. No sentence has more than ~12 words between subject and verb without restructuring. → see [sentence-rhythm](../sentence-craft/sentence-rhythm.md) and [topic-stress-architecture](../explaining-hard-things/topic-stress-architecture.md)

- [ ] **Clutter has been bracketed and cut.** Weak qualifiers (very, rather, somewhat), redundant pairs, throat-clearing preamble, over-hedged attribution, and preposition pileups have been removed or replaced. Every remaining word survives the meaning-loss + rhythm-damage test. → see [clutter-removal](../sentence-craft/clutter-removal.md)

- [ ] **Diction is exact, not approximate.** Placeholder verbs, vague nouns, and intensifier+adjective pairs have been replaced with the one true word. No "very + adjective" that a single adjective could replace. Hedges name genuine uncertainty rather than covering unresolved thinking. → see [diction-precision](../sentence-craft/diction-precision.md)

---

## Explaining Hard Things

- [ ] **Analogies earn their structural mapping.** Each analogy used passes the three-part test: the causal chain in the source domain matches the causal chain in the target domain, and the "unlike" clause marking where the analogy breaks is present (either in the text or explicitly recognized). No analogy relies on surface resemblance alone. → see [analogy-construction](../explaining-hard-things/analogy-construction.md)

- [ ] **Topic-stress architecture is not violated.** Paragraphs open with a bridge from the previous paragraph's known conclusion, not with a new technical term as the first word. Each sentence's topic position carries familiar context; new information arrives at stress position. No complex apposite phrase interrupts subject-verb for more than ~12 words. → see [topic-stress-architecture](../explaining-hard-things/topic-stress-architecture.md) and [reader-expectation-framework](../audience/reader-expectation-framework.md)

---

## Audience

- [ ] **Credibility signals are present; skepticism markers are absent.** At least one specific number with conditions, one named failure mode or acknowledged limitation, and one honest tradeoff appear in the piece. No superlatives without benchmarks, no all-positive comparisons, no product-page vocabulary (delightful, seamless, powerful). The press-release test passes: if enthusiasm sentences were removed, a complete technical explanation would remain. → see [credibility-signals](../audience/credibility-signals.md)

- [ ] **Early-exit threshold cleared for technical readers.** The first two to three paragraphs demonstrate technical depth: a specific failure mode, a number with conditions, a constraint named and explained, or a prior-art comparison that acknowledges actual strengths. The opening places the reader in a problem, not in an announcement. → see [hn-lobsters-reader-profile](../audience/hn-lobsters-reader-profile.md)

---

## Verdict Mapping

| Result | Status emitted |
|--------|---------------|
| All 12 items checked `[x]` | `Status: APPROVED` |
| Any item unchecked `[ ]` | `Status: ISSUES_FOUND` |

---

## Locked Verdict Format (D9)

The `writing-reviewer` agent **must** emit verdicts in exactly this format. No custom status codes. No omissions. This block is the single source of truth Step 08 builds against.

### Verdict frontmatter

```yaml
---
role: writing-reviewer
status: APPROVED | ISSUES_FOUND
phase: craft-review
iteration: <N>
timestamp: <ISO-8601>
project: <project-slug>
---
```

### Per-criterion findings block

Each rubric item that was evaluated gets one finding line. Label `[new]` for issues found this iteration; label `[carry-over]` for issues that appeared in a prior verdict and were not fixed (the fix loop uses carry-over count to escalate).

```markdown
## Findings

- [new] **Tension arc** — Piece front-loads its conclusion in paragraph 2; no oscillation detectable in tension audit. Sections 3–5 are all (-). → structural-tension
- [carry-over] **Clutter** — "It goes without saying that" still present (line 14). → clutter-removal
- [new] **Diction** — "very efficient" (para 6) — replace with the specific term (e.g., "sub-millisecond", "O(1)"). → diction-precision
```

### Aggregate block

```markdown
## Aggregate

Status: ISSUES_FOUND

Summary: 3 findings (2 new, 1 carry-over). Fix tension arc and diction before re-review; carry-over clutter item must be cleared this iteration or escalation fires.
```

Or on a clean pass:

```markdown
## Aggregate

Status: APPROVED

Summary: All 12 rubric items pass. No carry-over from prior iteration.
```

**Rules:**
- `Status:` is the only machine-read field in `## Aggregate`. It must be exactly `APPROVED` or `ISSUES_FOUND` — no other vocabulary.
- Any `[carry-over]` finding that appears for a third consecutive iteration triggers escalation (Step 08 agent notes this in Summary).
- The iteration counter in frontmatter increments each review pass, not each fix pass.

---

## How to apply

1. **Open the draft and this rubric side by side.** Work through the 12 items in order — narrative-craft first (structure), sentence-craft second (line level), explaining-hard-things third (explanatory mechanics), audience last (reception calibration). The ordering mirrors the revision sequence from [multi-pass-sequence](../process/multi-pass-sequence.md): structural issues before line-level issues before audience calibration.

2. **For each item, make a binary call.** The item is checked (`[x]`) only when you can point to specific evidence in the draft. "Probably fine" is not a pass. When in doubt, fail the item and record what evidence you looked for.

3. **Record a finding for every unchecked item.** Label it `[new]` if this iteration is the first it has appeared, `[carry-over]` if a prior verdict for this project already flagged it. Look up the prior verdict's findings to distinguish.

4. **Emit the verdict** in the D9 format above: YAML frontmatter with all six fields, the `## Findings` block with labeled lines, and the `## Aggregate` block with exactly `Status: APPROVED` or `Status: ISSUES_FOUND`. No other status codes.

5. **On APPROVED:** notify the pipeline and archive the verdict. The piece may advance to publication prep.

6. **On ISSUES_FOUND:** return the verdict to the author or fixer agent with the findings block. On re-submission, compare the new draft against the prior verdict's findings. Any that were not addressed become `[carry-over]` in the new verdict.
