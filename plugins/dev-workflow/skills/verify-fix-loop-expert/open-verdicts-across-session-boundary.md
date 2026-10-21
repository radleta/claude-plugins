---
tags: [verify-fix-loop/gotcha]
summary: "An ISSUES_FOUND verdict with no later verdict from the same role is still open after a session resume, whatever the carried-forward summary says closed"
---

# Open Verdicts Across a Session Boundary

## The rule

A verdict that returned `ISSUES_FOUND` (or anything short of APPROVED) stays open until a later
verdict **from the same role** approves it. The loop's own rule — never exit without an APPROVED
verdict — holds inside one session because the loop tracks every role it dispatched. Across a
resume or handoff, what carries forward is prose, and prose can drop a role from the tracked set
without saying so.

- At any resume or handoff, list every non-APPROVED verdict file under
  `scratch/{project}/reviews/`, then check that a later iteration of that same role exists. A role
  with no later iteration is open, whatever the surrounding prose claims.
- Read "closed with N axes Approved" as a claim about exactly those N roles, never about the plan as
  a whole. A closing statement that names files is precise about what it covers: trust the list,
  not the word "closed".

## Why prose is not enough

In August 2026 a plan's decision-traceability review returned `ISSUES_FOUND` with two blockers. The
plan was fixed, and its status line later read "closed for real ... with all three axes Approved",
naming the three roles that had been re-run. The fourth role — the one that raised the blockers —
had no later iteration anywhere under `reviews/`. The fixes turned out to be in place, but nothing
in the narrative said so: "3/3 Approved" gave no sign that the role whose findings mattered was the
one never re-dispatched.
