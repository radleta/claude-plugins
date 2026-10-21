# Leftover pass and tier check

End-sequence steps 7 and 8, read when the end sequence reaches step 7: the leftover pass, its
instruction, and the tier check that follows it.

## Leftover pass

End-sequence step 7, and again after every Fix-turn wave that approves. The review loop never
iterates on a nit (`reviewer-contract` § Severity); this pass is the one place a build fixes
them, once, with no re-review.

1. **Collect** from this build's verdicts in `steps/step-00/` every `## Non-blocking findings`
   entry not yet fixed and every `## Undecided` entry.
2. **Rule each `## Undecided` entry** by `user-decision-rubric`. One the rubric gives the agent,
   you rule in one line. One it gives the user becomes a `Question:` line on your return
   (`Owner: user-decision-rubric (test: {Scope|Undo|Taste|Conflict})`) and is left out of the
   instruction.
3. **Send the Leftover Pass Instruction** below and yield. Its four lines go through the checkpoint
   check. A red test the coder cannot clear in two attempts comes back `BLOCKED`, an escalation.

The pass is done when every collected item is fixed, ruled into the run card, or a `Question:`,
and the coder's last test run is green.

## Tier check

End-sequence step 8, the build's last action, when `git diff --name-only {BASE}` plus untracked
holds a file under `.claude/skills/`, `.claude/commands/` or `.claude/agents/`. For each changed
skill or command, propose its tier from `skill-verification` § Testing standard and run what that
tier names: the repo check for a fact correction, the static lint, and for a medium or high tier
the one run of the changed behavior, citing the run card's `## Verified` entry when the build
already made that run. Write one line per skill under run-card.md `## Tier check`:
`{skill} — {tier} — {command} — {result as measured}`. A high-tier line ends `— user reads the
output at the review`. An agent file, which that standard does
not tier, gets `{agent} — not tiered`. A failing check is a fix turn to the coder, then the check
again. The user confirms the proposed tiers at the review.

## Leftover Pass Instruction


```
Leftover pass. This turn clears what the build left open before the user sees it.

Verdicts with non-blocking findings: {paths, or "none"} — read each in full and fix every
finding, nits included.
Undecided reviewer entries I ruled: {one line each: verdict path, the entry, my ruling | "none"}
— apply each and record it in run-card.md ## Decisions made.

Then re-run every run-card.md ## I did not verify item that can now run, moving each that
passes to ## Verified. Fix a nearby fault you meet inside idea.md's scope; file one outside it
with mcp__scratch-memory__write_issue and list the issue path under ## I did not verify. Last,
run the full build, where the repo has one, and every test command idea.md names, once, from
the repository root, and record the results under ## Verified. Return your four lines with
Status: FIXED.
```
