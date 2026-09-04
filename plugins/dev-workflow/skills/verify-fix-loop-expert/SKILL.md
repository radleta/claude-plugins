---
name: verify-fix-loop-expert
description: >-
  Canonical verify-fix loop pattern with guard clauses, anti-patterns, and
  re-dispatch enforcement. Use when implementing any loop that dispatches
  a verifier agent, fixes issues, and must re-verify — even for single-verifier
  loops or seemingly simple validation steps.
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
   b. IMMEDIATELY return to step 1 — do NOT proceed, do NOT ask user.
4. Max [N] iterations. If exceeded, escalate to [ESCALATION_TARGET].
5. NEVER exit this loop without an APPROVED verdict or explicit user escalation.
```

**Parameters:**
- `[VERIFIER]` — agent name(s) and prompt template path
- `[N]` — max iteration count (typically 10)
- `[ESCALATION_TARGET]` — "user" for most loops

## Anti-Patterns

### Category-Level Bans

- Exiting after fix without re-dispatching the verifier
- Treating silence or absence of error as approval
- Conditional phrasing that reads as one-shot ("if issues, fix and re-dispatch") instead of explicit loop
- Buried re-dispatch instructions within other prose
- Missing or ambiguous exit conditions

### Surface-Level Phrase Bans

These are the exact rationalizations that cause premature loop exit. If you are about to write any of these, STOP — return to step 1 instead.

| Banned Phrase | Why Wrong | Instead |
|---|---|---|
| "The issues appear minor" | Severity doesn't exempt from re-verification | Return to step 1 — dispatch verifier |
| "The fix looks correct" | Self-assessment is not verification | Return to step 1 — dispatch verifier |
| "I'll proceed assuming this resolves it" | Assumptions are not verdicts | Return to step 1 — dispatch verifier |
| "These changes should address the concerns" | "Should" is not APPROVED | Return to step 1 — dispatch verifier |
| "The issues have been fixed" | Claim without evidence | Return to step 1 — dispatch verifier to confirm |
| "Moving on to the next step" (after fix) | Skipping re-verify entirely | Return to step 1 — loop is not done |
| "Re-verification isn't needed" | It is always needed | Return to step 1 — no exceptions |
| "The verifier would likely approve" | Predictions are not verdicts | Return to step 1 — let the verifier decide |

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

## Hard Gate: Self-Check Protocol

**Prohibitions:**
- NEVER exit a verify-fix loop without an APPROVED verdict.
- NEVER declare issues "fixed" without re-dispatching the verifier that found them.
- NEVER skip re-verification because the fix "looks correct."

**Execute this self-check before exiting any verify-fix loop:**

1. Did I re-dispatch the verifier after my last fix? If NO → return to step 1.
2. Did the verifier return APPROVED (or equivalent)? If NO → return to step 1.
3. Am I about to write "proceeding to next step" without an APPROVED verdict? If YES → STOP, return to step 1.

Only exit the loop if all three checks pass.

## Workflow Extension

When the verify-fix loop uses fresh sub-agents per iteration (as in
the build pipeline's end-of-build wave — owned by `project-lead-methodology` — and `/brainstorming`), each re-dispatched
sub-agent has no memory of its prior rulings. To preserve continuity without
losing the unbiased-fresh-eyes property:

1. Main session accumulates prior verdict paths per role (a list per verifier/reviewer, appended only when status was FINDINGS).
2. On re-dispatch, main session injects the accumulated paths into the sub-agent's prompt via a `## Your Prior Verdicts` conditional block.
3. The sub-agent Reads each prior verdict (files are immutable and cache-friendly), verifies each prior finding against current code, and labels findings `[carry-over]` or `[new]`.
4. The verifier returns a `Carry-over: {N}` count line (`N` = findings labeled `[carry-over]` in the verdict body). The count exists so an orchestrator can detect a finding that survives repeated fixes **without reading verdict bodies** — an orchestrator that wants a repeat-finding rule (say, "the same issue has now failed three verdicts") tracks consecutive nonzero counts per role and fires on that, and step 3's `[carry-over]`/`[new]` labels are what such a rule hooks on. Whether to have that rule at all is the orchestrator's choice: the build pipeline's unit loop (in `project-lead-methodology`) deliberately has none, capping at 2 fix turns and exiting to the user instead.

This pattern applies to any fix loop whose verifier is a fresh sub-agent spawned per iteration. It does NOT apply to single-agent verification where the verifier sees prior context in its own conversation history.

### Source of Truth and Synchronization

This `## Workflow Extension` section is the **canonical source of truth** for the 4-step re-review protocol wording used across all workflow dispatch templates.

Agents don't load this skill from dispatch prompts, so the protocol wording must be embedded directly in each agent body — as step 0 of that agent's own `<protocol>` block, not a separate `<re-review-protocol>` tag. Neither dispatch-template family embeds the protocol verbatim: `.claude/skills/project-lead-methodology/SKILL.md`'s two end-of-build reviewer prompts (quality/security) and `.claude/skills/brainstorming/`'s two reviewer prompt files carry only the prior-verdict input section (the list of prior FINDINGS/issues paths); the protocol wording that consumes that input lives entirely in the five agent bodies below. All five inventory entries **consume** that block; every dispatch template in both families only **declares** it — no location does both. **The heading is `## Your Prior Verdicts` everywhere, plural, in every declaring template and every consuming agent** — the agents match on that literal string, so a template that declares a singular `## Your Prior Verdict` silently never fires the step-0 read and the agent reviews blind with `Carry-over: 0`. A template may append a parenthetical after the heading; it must not change the heading itself. The count of paths beneath it is free: the build pipeline's wave passes at most one, the brainstorming templates pass a list.

The following 5 agent files embed the protocol as `<protocol>` step 0 in their own body — all 5 copies must stay aligned when the canonical wording changes. Only the three verifier bodies emit the `Carry-over: {N}` return line; the two brainstorming reviewer bodies never had one:

1. `.claude/agents/completeness-verifier.md` — `<protocol>` step 0 — emits `Carry-over: {N}` (`:79`)
2. `.claude/agents/code-verifier.md` — `<protocol>` step 0 — emits `Carry-over: {N}` (`:85`)
3. `.claude/agents/security-verifier.md` — `<protocol>` step 0 — emits `Carry-over: {N}` (`:80`)
4. `.claude/agents/codebase-alignment-reviewer.md` — `<protocol>` step 0 — no `Carry-over` line
5. `.claude/agents/domain-reviewer.md` — `<protocol>` step 0 — no `Carry-over` line

When the protocol steps change here, update all 7 locations above.

## Pages
<!-- BEGIN:PAGES -->
- [Diagnostic-Only Iteration Protocol](diagnostic-only-iter-protocol.md) — When manual gate reveals ambiguous symptom, iterate with pure diagnostics before shipping behavior changes — preserve the controlled-experiment discipline
- [Visual Seal: Fourth Gate for UI-Bearing Loops](visual-seal-fourth-gate.md) — Mandatory fourth visual seal for WinForms UI iterations: run imrdy render --all and inspect every PNG — verifier APPROVED votes cannot detect layout-collapse bugs
- [issues-found-verdict-without-re-review-is-still-open](issues-found-verdict-without-re-review-is-still-open.md) — An ISSUES_FOUND verdict with no confirming re-review is still open, even when the plan's own status narrative calls it closed
<!-- END:PAGES -->

## Meta
- [Schema](schema.md) — Wiki conventions and page-type definitions
