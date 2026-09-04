---
tags: [verify-fix-loop/learned]
summary: "An ISSUES_FOUND verdict with no confirming re-review is still open, even when the plan's own status narrative calls it closed"
---

## A plan's own "closed" narrative can name three axes and silently omit a fourth that never got a confirming re-review

`reviews/spec/decision-traceability-iter5-20260821T205706Z.md` returned `status: ISSUES_FOUND` at
2026-08-21T20:57Z with 9 findings, 2 of them blockers (a plan step's Description still specified a
design superseded by decision D25; stale deliverable/test counts). Plan files were edited that same
evening (21:06–21:50Z), apparently in response, and two further fix rounds followed days later.

The plan's own `README.md:11-16` status line narrates the whole arc — and its own wording is the
finding:

> "...after an initial confirmation wave the loop reopened twice, most recently to fix Step 05's
> Description ... both flagged in `reviews/spec/decision-traceability-iter5-...md`. **It closed for
> real on 2026-08-24 with all three axes Approved:** `step-quality-iter8`, `investigation-quality-iter8`,
> and `spec-traceability-iter7`."

Three axes, not four. `reviews/spec/` holds exactly one file for the role that actually surfaced the
blockers, and no later iteration of that role exists anywhere under `reviews/`. The declared
"closed for real" is scoped to the three roles that were re-dispatched — it does not mean the iter5
verdict was ever re-confirmed, and the sentence reads as if it does.

Checking the artifacts iter5 flagged shows the underlying work was, in fact, done — `steps/05-hook-write-path.md`'s
Description now matches spec's `ClearsRoster` design instead of the pre-D25 inline guard, and
`steps/14-plan-tracking-rollup.md` now includes D25 in its executed-decisions range. But that was
unknowable from the narrative alone: the "3/3 Approved" framing gives no signal that a fourth,
never-re-run role is the one whose findings are actually load-bearing here.

**What to do differently.**

- At any resume/handoff boundary, list every `status: ISSUES_FOUND` (or non-APPROVED) verdict file
  under `scratch/{project}/reviews/`, then check whether a *later* iteration of that same role
  exists. A role with no later iteration is open regardless of what the surrounding prose claims.
- Read "closed with N axes Approved" as a claim scoped to exactly those N roles, never as a claim
  about the plan as a whole. A closing statement that lists specific files is precise about what it
  covers — trust the list, not the word "closed."
- `verify-fix-loop-expert`'s rule to never exit without an APPROVED verdict operates *within* a
  session. This is the same rule applied across a resume/handoff boundary: the boundary is exactly
  where a role can be silently dropped from the tracked set, because the summary that carries
  forward is prose, not a re-scan of the reviews directory.

**Discovered:** Auditing `scratch/agent-liveness-roster`'s validation trail end-to-end after the
plan's status line declared closure — `reviews/spec/decision-traceability-iter5-*.md` (ISSUES_FOUND)
has no later sibling, while three other roles in `reviews/plan/` show fresh iterations two days
later without it.
**Impact:** Applies to any multi-role verify-fix loop whose findings and closing declaration can be
separated by a session boundary — a resumed session must rebuild "what's still open" by scanning
verdict files, never by trusting a prior session's summary of which axes closed.
