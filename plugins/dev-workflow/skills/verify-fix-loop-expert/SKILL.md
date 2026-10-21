---
name: verify-fix-loop-expert
description: >-
  Canonical verify-fix loop pattern, verdict parsing, and the re-review protocol
  with every copy of it. Use when implementing any loop that dispatches a verifier
  agent, fixes issues, and must re-verify — even for single-verifier loops.
wiki: true
---

# Verify-Fix Loop Expert

Defines the mandatory pattern for all verify-fix loops. Load this skill before entering any verification loop.

## Canonical Pattern

Every verify-fix loop follows this 5-step template. Fill in the parameters for your context.

```
VERIFY-FIX LOOP:
1. Dispatch [VERIFIER]: launch verifier agent(s).
2. IF verdict is APPROVED → exit loop, proceed to next step.
3. IF verdict is ISSUES_FOUND:
   a. Fix flagged issues using report findings.
   b. Return to step 1, without proceeding and without asking the user.
4. Max [N] iterations. If exceeded, escalate to [ESCALATION_TARGET].
   (Exception: the build pipeline's reviewer wave has no [N], in project-lead.md
   <end-sequence> step 5 and its <turns> Fix-turn wave alike. A code finding checks the
   diff against idea.md and closes once fixed, where a prose review keeps finding new
   things. After each fix, every verifier the wave dispatched is re-dispatched, whichever
   verdict drove the fix, so no fix goes unreviewed by a verifier it did not come from; the
   wave exits only when every re-dispatched verifier returns APPROVED or a finding goes to
   the user as ESCALATE.)
5. Exit only on an APPROVED verdict or an explicit escalation to the user.
```

**Parameters:**
- `[VERIFIER]` — agent name(s) and prompt template path
- `[N]` — max iteration count (typically 10)
- `[ESCALATION_TARGET]` — "user" for most loops

## Writing a loop

Write the loop as an explicit loop: the re-dispatch on its own line, never buried in other prose
or phrased as a one-shot ("if issues, fix and re-dispatch"), and both exit conditions stated.

## Verdict Protocol

Verifier agents return one of these formats. Parse the response and act accordingly.

**Approved (exit loop):**
- `**Status:** Approved`
- `**Verdict:** APPROVED`
- `**Verdict:** COMPLETE`

**Issues found (continue loop):**
- `**Status:** Issues Found`
- `**Verdict:** ISSUES_FOUND`
- `**Verdict:** INCOMPLETE`

**Unknown format:** Treat as ISSUES_FOUND (fail-safe — forces re-verification).

## Across a session resume

A role can drop out of the tracked set unnoticed when a session resumes, and its last verdict is
still open: see [Open Verdicts Across a Session Boundary](open-verdicts-across-session-boundary.md).

## Workflow Extension

When the verify-fix loop uses fresh sub-agents per iteration, each re-dispatched sub-agent has
no memory of its prior rulings. Two loops in this repo work that way:

- **The build's reviewer wave**, which the [`project-lead`](../../agents/project-lead.md) agent
  runs from the prompts in [`project-lead-methodology`](../project-lead-methodology/SKILL.md), at
  the end of the build and again after each batch of the user's findings. After each fix it
  re-dispatches every reviewer it ran, not just the one whose finding the fix answered.
- **`/brainstorming`'s review loop**, at every review point
  ([`brainstorming/review-loop.md`](../brainstorming/review-loop.md)).

To preserve continuity without losing the unbiased-fresh-eyes property:

1. Main session accumulates prior verdict paths per role (a list per verifier/reviewer, appended only when status was FINDINGS — the build's verifiers — or ISSUES_FOUND — `/brainstorming`'s reviewers).
2. On re-dispatch, main session injects the accumulated paths into the sub-agent's prompt via a `## Your Prior Verdicts` conditional block.
3. The sub-agent Reads each prior verdict (files are immutable and cache-friendly), verifies each prior finding against current code, and labels findings `[carry-over]` or `[new]`.
4. The verifier returns a `Carry-over: {N}` count line (`N` = findings labeled `[carry-over]` in the verdict body). The count exists so an orchestrator can detect a finding that survives repeated fixes **without reading verdict bodies** — an orchestrator that wants a repeat-finding rule (say, "the same issue has now failed three verdicts") tracks consecutive nonzero counts per role and fires on that, and step 3's `[carry-over]`/`[new]` labels are what such a rule hooks on. Whether to have that rule at all is the orchestrator's choice: the build pipeline's reviewer wave deliberately has none, and no cap either — it counts the fix turns, reports the count, and escalates to the user a finding that would change a decision or contradicts `idea.md` ([`project-lead.md` `<end-sequence>` and the `<turns>` Fix-turn wave](../../agents/project-lead.md), [`dispatch-tier-rubric` § Known divergence](../dispatch-tier-rubric/SKILL.md)).

This pattern applies to any fix loop whose verifier is a fresh sub-agent spawned per iteration. It does NOT apply to single-agent verification where the verifier sees prior context in its own conversation history.

### Source of Truth and Synchronization

This `## Workflow Extension` section is the **canonical source of truth** for the 4-step re-review protocol wording used across all workflow dispatch templates.

Agents don't load this skill from dispatch prompts, so the protocol wording is embedded in each consuming body, as step 0 of that agent's own `<protocol>` block. Neither dispatch-template family embeds the protocol verbatim: `.claude/skills/project-lead-methodology/`'s three reviewer-wave prompts (quality and security in `SKILL.md`, ux in `ux-pass.md`) and `.claude/skills/brainstorming/`'s two reviewer prompt files carry only the prior-verdict input section; the wording that consumes that input lives in the copies below. Every entry **consumes** that block; every dispatch template **declares** it — no location does both. **The heading is `## Your Prior Verdicts` everywhere, plural, in every declaring template and every consuming copy** — the agents match on that literal string, so a template that declares a singular `## Your Prior Verdict` silently never fires the step-0 read and the agent reviews blind with `Carry-over: 0`. A template may append a parenthetical after the heading; it must not change the heading itself. The count of paths beneath it is free: the build pipeline's wave passes at most one, and `/brainstorming`'s review loop passes a reviewer every verdict it wrote at the current review point. `/brainstorming` fills the block on re-check passes only and omits it on each review point's first pass, so every review point starts with fresh eyes ([`codebase-alignment-reviewer-prompt.md`](../brainstorming/codebase-alignment-reviewer-prompt.md), [`domain-reviewer-prompt.md`](../brainstorming/domain-reviewer-prompt.md)).

Every copy of the protocol, all of which stay aligned when the canonical wording changes. Only the three verifier bodies and `ux-verifier`'s wave mode emit the `Carry-over: {N}` return line:

1. `.claude/agents/completeness-verifier.md` — `<protocol>` step 0 — emits `Carry-over: {N}`
2. `.claude/agents/code-verifier.md` — `<protocol>` step 0 — emits `Carry-over: {N}`
3. `.claude/agents/security-verifier.md` — `<protocol>` step 0 — emits `Carry-over: {N}`
4. `.claude/agents/codebase-alignment-reviewer.md` — `<protocol>` step 0 — no `Carry-over` line
5. `.claude/agents/domain-reviewer.md` — `<protocol>` step 0 — no `Carry-over` line
6. `.claude/skills/copy-verification/SKILL.md` — workflow step 1, which `copy-reviewer` runs — no `Carry-over` line
7. `.claude/agents/ux-verifier.md` — `## Wave mode` step 0 — emits `Carry-over: {N}`

When the protocol steps change here, update every copy above.

## Pages
<!-- BEGIN:PAGES -->
- [Diagnostic-Only Iteration Protocol](diagnostic-only-iter-protocol.md) — When manual gate reveals ambiguous symptom, iterate with pure diagnostics before shipping behavior changes — preserve the controlled-experiment discipline
- [Visual Seal for UI-Bearing Verify-Fix Loops](visual-seal.md) — An optional visual seal for WinForms UI loops: run imrdy render --all and read every PNG, because source-reading verifiers cannot see a layout collapse
- [Open Verdicts Across a Session Boundary](open-verdicts-across-session-boundary.md) — An ISSUES_FOUND verdict with no later verdict from the same role is still open after a session resume, whatever the carried-forward summary says closed
<!-- END:PAGES -->

## Meta
- [Schema](schema.md) — Wiki conventions and page-type definitions
