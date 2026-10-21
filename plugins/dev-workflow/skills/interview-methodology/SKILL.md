---
name: interview-methodology
description: "Option-batch protocol for user decisions: batched questions whose options and recommendation follow options-rubric, drill-in, and a convergence declaration. Use when an agent elicits decisions from the user (clarifying questions, open questions) — even for one question. Opening an undecided question is discuss-methodology."
---

## Role

This skill defines a structured option-batch protocol for soliciting user decisions: questions batched (cap 5), each listing its lens-tagged options and then its recommendation, with a convergence declaration closing the session.

**No install, no tooling.** The protocol is prose and runs anywhere Claude runs — Claude Cowork or any packaged copy included. The `.claude/skills/` paths further down appear only in this skill's recorded design history, as the worked example of the protocol; nothing in the protocol itself reads them.

## When to Use This Skill

Load this skill when any of the following callsites is active:

- **Clarifying questions** — the agent needs to ask the user questions to refine a feature idea, spec, or design before proceeding
- **Open-question (OQ) resolution** — unresolved entries in the idea.md Open Questions section require user decisions
- **Single-question moments** — even one decision uses the same structure

## Core Protocol

### Batch cap

Present at most 5 questions per batch. When more than 5 independent questions exist, split into multiple batches. Label each batch as: **Batch N of M (5 questions, K remaining)** where N is the current batch number, M is the total batch count, and K is the count of unresolved questions remaining after this batch. Increment N on each subsequent batch.

### Dependency rule

Defer a question only when its framing **strictly depends** on a prior question's answer — meaning the wording literally requires that answer to make sense. "Related" or "thematically adjacent" is NOT dependent.

- **Dependent (defer):** Q-A "should we use Redis or Memcached?" → Q-B "what TTL for the {chosen-store} keys?" — Q-B's framing requires Q-A's answer.
- **NOT dependent (present together):** Q-A "what auth provider?" + Q-B "what session length?" — neither requires the other's answer to be intelligible.

### Per-question shape

Load `options-rubric` and write every question's options and its recommendation by it: options generated lens by lens, each with its lens tag and price line, the convergence line where pruning merged or dropped any, and one recommendation after all of them. A single question in flight takes the same shape; there is no single-question fallback mode.

## Drill-In Modes

### State machine

| State | Entered when | Exit condition | Restoration |
|-------|--------------|----------------|-------------|
| **Batched** | Caller invokes the protocol with N ≥ 1 questions | (1) User answers all questions in current batch AND more batches remain → remain Batched, present Batch N+1. (2) User triggers a drill-in → Drill-in. (3) All batches answered + convergence declaration shows no Unlocked → Converged. | If drill-in entered, restore via full re-presentation on exit |
| **Drill-in** | One of 4 named entry triggers fires (no inference — match exactly) | User signals exit via one of these recognized patterns: "back to the batch", "ok continue", "let's resume the batch", "return to the questions", "I'm done with this question", or any sentence beginning with "back to" / "let's continue" / "resume" | Re-present the FULL remaining batch — every unanswered question with all its options and its recommendation |
| **Post-drill-in** | Drill-in exits | Automatic transition to Batched (with full re-presentation) | n/a |
| **Converged** | All batches answered AND convergence declaration shows Locked or Soft-Spots-only | Caller proceeds to next phase | Terminal — no return to Batched without a new caller invocation |

### Entry triggers (4 named patterns — match one of these explicitly; no inference from broader conversational tone)

1. **User asks a focused question about one option** — e.g., "tell me more about Option B's tradeoffs"
2. **User flags a concern about one specific item in the batch** — e.g., "I'm worried about the marketplace dependency in question 3"
3. **User requests a side-by-side comparison of two options inside one question** — e.g., "show me Option A vs Option B in detail"
4. **User explicitly requests focused discussion** — e.g., "let's pause and dig into question 2"

### Exit prompt (mandatory wording shape)

After drill-in content, present:

> We've covered {drill-in topic}. Ready to return to the remaining batch?

### Restoration rule

On drill-in exit, re-present the FULL remaining batch in its original shape — every unanswered question with all its options and its recommendation. Do NOT abbreviate ("back to OQ-3 and OQ-4, your call?"). Do NOT collapse to a one-line summary. The user has been in focused-discussion mode — they need the full surface area restored.

## Convergence Declaration

### Single template (3 slots)

```
## Convergence Declaration

**Locked:**
- {decision or scope item that satisfies all 4 gating-checklist items}

**Soft Spots:**
- {decision or scope item that partially passes — name the item AND the reason it's soft}

**Unlocked:**
- {open question, contradiction, or under-specified area requiring re-batching}
```

### 4-item gating checklist (the rule for slot population)

1. **All Open Questions resolved or explicitly waived** — every entry in the OQ section either has a corresponding `## Decisions` line (a row, in an `idea.md` that still holds a table) or is marked out-of-scope with a reason
2. **Rationale populated** — every decision line carries a non-empty `because` clause (a legacy table row, its Rationale column), and a decision picked from options names the lens it was picked on and the strongest losing lens, per `options-rubric`
3. **No new questions surfaced in the most recent dialog turn** — the conversation has stabilized
4. **Scope and Constraints sections are internally consistent** — no scope item contradicts a constraint, no constraint contradicts a scope item

### Slot-population rule

The checklist IS the rule — not a separate artifact.

- All 4 items pass for an item → place in **Locked**
- Some items pass for an item → place in **Soft Spots** with the failing item named as the reason (e.g., "Soft Spot: D6 verdict shape — its `because` clause names the lens it was picked on but not the strongest losing lens")
- Any item fails for an item → place in **Unlocked**; re-enter the option-batch protocol to resolve before re-running the convergence declaration

A run that produces any Unlocked entries is NOT converged. Re-batch and re-evaluate before presenting a new declaration.

## Anti-Patterns

1. **Recommendation written before its options** — The recommendation goes after every option, per `options-rubric`. One placed first was written before the options it claims to weigh, and the options then arrive as its supporting cast.

2. **Drill-in restoration shortcut** — Do NOT abbreviate the re-presentation on drill-in exit. Do NOT write "back to OQ-3 and OQ-4, your call?". Re-present the FULL remaining batch with all options and the recommendation per question.

3. **"Looks ready" gate bypass** — Do NOT declare convergence without running the 4-item checklist. The checklist is the rule for slot population, not a vibe check.

4. **"Related" treated as "dependent" for batching** — Do NOT defer questions that are merely thematically related. "Dependent" means Q-B's framing literally requires Q-A's answer. Thematic adjacency does NOT defer.

## Examples

### Example 1 — Clarifying-question batch

**Scenario:** A design dialogue with two independent questions.

---

**Batch 1 of 1 (2 questions)**

**Question 1: Where should interview-methodology live?**

- Option A (literal ask): inline the protocol in the `brainstorming` SKILL.md, where the user asked for it. Wins on one file to read, pays in a protocol no other caller can load.
- Option B (codebase fit, long-term investment): a standalone skill at `.claude/skills/interview-methodology/SKILL.md`, beside `handoff-methodology` and `commit-methodology`. Wins on any caller loading it without `brainstorming`, pays in one more skill in the listing.
- Option C (simplest): a page inside the `brainstorming` folder as `brainstorming/interview-protocol.md`. Wins on no new skill, pays in a path every other caller has to reach into.

Codebase fit and long-term investment converged on Option B.

**Recommendation:** Option B, on long-term investment: three callers already need this protocol, so its one home has to be loadable on its own. Strongest losing lens: simplest, which would have given no new skill in the listing.

---

**Question 2: Should the skill support wiki-backed decomposition?**

- Option A (simplest, codebase fit): a single monolithic SKILL.md with no sibling pages. Wins on one file, pays in a rewrite if it outgrows the cap.
- Option B (long-term investment): start monolithic and split into pages once the file passes 400 lines. Wins on a planned growth path, pays in a threshold someone has to watch.

Simplest and codebase fit converged on Option A; literal ask produced nothing the other lenses did not.

**Recommendation:** Option A, on simplest: the protocol fits well inside the cap, so structure for growth buys nothing yet. Strongest losing lens: long-term investment, which would have given a split already planned.

---

### Example 2 — Convergence declaration

**Scenario:** All open questions answered; the convergence check closes the dialogue.

```
## Convergence Declaration

**Locked:**
- Skill placement: standalone `.claude/skills/interview-methodology/SKILL.md`
- Structure: monolithic single file, no sibling pages
- Options and recommendation: per `options-rubric`, recommendation last

**Soft Spots:**
- Plugin manifest ordering: insertion point confirmed (after doc-update), but bundle array ordering rationale not documented — its decision line has no `because` clause

**Unlocked:**
(none)
```

*All 4 gating-checklist items pass for Locked entries. The Soft Spot item partially passes — its reason is missing. No Unlocked entries → declaration is final.*
