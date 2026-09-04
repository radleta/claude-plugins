---
name: interview-methodology
description: "Structured option-batch protocol for soliciting user decisions — batched questions with 3 options each, recommendation citing a 4-criterion rubric (best practices, DRY, YAGNI, user-intent), explicit drill-in modes, and a convergence declaration. Use when an agent needs to elicit decisions from the user (clarifying questions, open-question resolution, alternative-suggestion evaluation) — even for single-question moments where option-and-recommendation framing improves quality over freeform Q&A."
---

## Role

This skill defines a structured option-batch protocol for soliciting user decisions: 3 options per question with an explicit recommendation, batched (cap 5), with a convergence declaration closing the session.

**No install, no tooling.** The protocol is prose and runs anywhere Claude runs — Claude Cowork or any packaged copy included. The `.claude/skills/` paths further down appear only in this skill's recorded design history, as the worked example of the protocol; nothing in the protocol itself reads them.

## When to Use This Skill

Load this skill when any of the following callsites is active:

- **Clarifying questions** — the agent needs to ask the user questions to refine a feature idea, spec, or design before proceeding
- **Open-question (OQ) resolution** — unresolved entries in the idea.md Open Questions section require user decisions
- **Creative-suggestion verdicts** — a creative reviewer has emitted suggestions and the user must evaluate each (Adopt / Adapt / Reject)
- **Single-question moments** — even one decision uses the same structure

## Core Protocol

### Batch cap

Present at most 5 questions per batch. When more than 5 independent questions exist, split into multiple batches. Label each batch as: **Batch N of M (5 questions, K remaining)** where N is the current batch number, M is the total batch count, and K is the count of unresolved questions remaining after this batch. Increment N on each subsequent batch.

### Dependency rule

Defer a question only when its framing **strictly depends** on a prior question's answer — meaning the wording literally requires that answer to make sense. "Related" or "thematically adjacent" is NOT dependent.

- **Dependent (defer):** Q-A "should we use Redis or Memcached?" → Q-B "what TTL for the {chosen-store} keys?" — Q-B's framing requires Q-A's answer.
- **NOT dependent (present together):** Q-A "what auth provider?" + Q-B "what session length?" — neither requires the other's answer to be intelligible.

### Per-question shape

Every question presents exactly 3 options. Never present 2. Never present 4+. The third option is the strawman / ruled-out path so the user sees the full consideration space.

### Recommendation requirement

Every question carries one explicit recommendation among its 3 options. The recommendation MUST invoke the Shared Rubric (see below). Present recommendations in this form:

> **Recommendation:** Option B. *DRY* — reuses the existing reviewer dispatch shape. *User-intent alignment* — matches the stated goal of one protocol across all callsites.

### Single-question moments

When only one question is in flight, present it using the same 3-options + recommendation structure. There is no single-question fallback mode.

## Rubric (Shared)

Recommendations and creative-suggestion verdicts MUST cite ≥2 of the following 4 criteria, OR explicitly mark themselves as single-criterion with a one-line reason:

1. **Best practices** — alignment with established patterns in the relevant domain or codebase
2. **DRY** — avoidance of duplicated structure or logic
3. **YAGNI** — avoidance of speculative scope
4. **User-intent alignment** — match to the stated goal of the requesting user

**Invocation pattern (same for both consumers):**

> Cite ≥2 criteria → state the verdict.

Numeric scoring is forbidden. Do NOT write "DRY=8, YAGNI=9, total=17/20". The rubric is prose-only.

**Consumer 1 — Option ranking (clarifying questions, OQ resolution):**

When presenting 3 options, the recommendation cites rubric criteria by name. Example:

> **Recommendation:** Option B. *DRY* — reuses the existing reviewer dispatch shape. *User-intent alignment* — matches the stated goal of one protocol across all callsites.

**Consumer 2 — Creative-suggestion verdict (Step 10 in brainstorming):**

For each suggestion in a creative reviewer's verdict file, return one of three verdicts (Adopt / Adapt / Reject), each tied to the rubric. Example:

> **Suggestion 3 — Adapt.** *Best practices* — single-template approach matches the verify-fix-loop precedent. *YAGNI* — checklist-as-paragraph hybrid duplicates the audit semantics already present in the checklist. Adapt: collapse to single template with checklist as slot-population rule.

## Drill-In Modes

### State machine

| State | Entered when | Exit condition | Restoration |
|-------|--------------|----------------|-------------|
| **Batched** | Caller invokes the protocol with N ≥ 1 questions | (1) User answers all questions in current batch AND more batches remain → remain Batched, present Batch N+1. (2) User triggers a drill-in → Drill-in. (3) All batches answered + convergence declaration shows no Unlocked → Converged. | If drill-in entered, restore via full re-presentation on exit |
| **Drill-in** | One of 4 named entry triggers fires (no inference — match exactly) | User signals exit via one of these recognized patterns: "back to the batch", "ok continue", "let's resume the batch", "return to the questions", "I'm done with this question", or any sentence beginning with "back to" / "let's continue" / "resume" | Re-present the FULL remaining batch — every unanswered question with all 3 options and the recommendation |
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

On drill-in exit, re-present the FULL remaining batch in its original shape — every unanswered question with its 3 options and recommendation. Do NOT abbreviate ("back to OQ-3 and OQ-4, your call?"). Do NOT collapse to a one-line summary. The user has been in focused-discussion mode — they need the full surface area restored.

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

1. **All Open Questions resolved or explicitly waived** — every entry in the OQ section either has a corresponding Decisions row or is marked out-of-scope with a reason
2. **Rationale populated** — every Decisions row carries a non-empty Rationale column
3. **No new questions surfaced in the most recent dialog turn** — the conversation has stabilized
4. **Scope and Constraints sections are internally consistent** — no scope item contradicts a constraint, no constraint contradicts a scope item

### Slot-population rule

The checklist IS the rule — not a separate artifact.

- All 4 items pass for an item → place in **Locked**
- Some items pass for an item → place in **Soft Spots** with the failing item named as the reason (e.g., "Soft Spot: D6 verdict shape — Rationale column references the rubric but does not name which 2 criteria it expects to apply")
- Any item fails for an item → place in **Unlocked**; re-enter the option-batch protocol to resolve before re-running the convergence declaration

A run that produces any Unlocked entries is NOT converged. Re-batch and re-evaluate before presenting a new declaration.

## Anti-Patterns

1. **Numeric scoring** — Do NOT invent scores like "DRY=8, YAGNI=9, total=17/20". The rubric is prose-only. Recommendations cite criteria by name, not by number.

2. **Two-option corner case** — Do NOT skip the 3rd option when only 2 feel real. Always present 3. The third is the strawman / ruled-out path so the user sees the full consideration space.

3. **Drill-in restoration shortcut** — Do NOT abbreviate the re-presentation on drill-in exit. Do NOT write "back to OQ-3 and OQ-4, your call?". Re-present the FULL remaining batch with all 3 options and the recommendation per question.

4. **"Looks ready" gate bypass** — Do NOT declare convergence without running the 4-item checklist. The checklist is the rule for slot population, not a vibe check.

5. **"Related" treated as "dependent" for batching** — Do NOT defer questions that are merely thematically related. "Dependent" means Q-B's framing literally requires Q-A's answer. Thematic adjacency does NOT defer.

## Examples

### Example 1 — Clarifying-question batch (Consumer 1)

**Scenario:** Brainstorming step 5 — two independent design questions.

---

**Batch 1 of 1 (2 questions)**

**Question 1: Where should interview-methodology live?**

- **Option A:** New standalone skill at `.claude/skills/interview-methodology/SKILL.md` (monolithic, no sibling pages)
- **Option B:** New page inside the `brainstorming` skill folder as `brainstorming/interview-protocol.md`
- **Option C:** Inline expansion of the `brainstorming` SKILL.md with the protocol embedded

**Recommendation:** Option A. *Best practices* — methodology skills in this repo are standalone monolithic files (handoff-methodology, commit-methodology). *DRY* — a standalone skill is reusable by any caller without importing brainstorming as a dependency.

---

**Question 2: Should the skill support wiki-backed decomposition?**

- **Option A:** Single monolithic SKILL.md only (no sibling pages)
- **Option B:** SKILL.md hub + sibling pages for each protocol section
- **Option C:** Start monolithic; allow decomposition if the file exceeds 400 lines

**Recommendation:** Option A. *YAGNI* — the protocol fits within the 400-line cap; decomposition adds complexity with no current benefit. *Best practices* — methodology skills in this repo stay monolithic (see `verify-fix-loop-expert` precedent).

---

### Example 2 — Convergence declaration

**Scenario:** All open questions answered; convergence check as the exit artifact of brainstorming step 8 (Open Questions Gate).

```
## Convergence Declaration

**Locked:**
- Skill placement: standalone `.claude/skills/interview-methodology/SKILL.md`
- Structure: monolithic single file, no sibling pages
- Rubric: 4-criterion prose rubric, no numeric scoring

**Soft Spots:**
- Plugin manifest ordering: insertion point confirmed (after doc-update), but bundle array ordering rationale not documented in decisions.md — Rationale column is empty

**Unlocked:**
(none)
```

*All 4 gating-checklist items pass for Locked entries. The Soft Spot item partially passes — rationale column is unpopulated. No Unlocked entries → declaration is final.*
