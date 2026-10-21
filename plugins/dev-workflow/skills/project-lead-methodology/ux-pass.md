# UX pass prompts

The two prompts of a wave that includes `ux-verifier`, which end-sequence step 5 of
`project-lead.md` adds when the changed set holds a page file. Read from
[SKILL.md](SKILL.md) § Prompts; the rest of that section applies to these as to every prompt.

## App-up Instruction

Before each wave that includes `ux-verifier` (`project-lead.md` end-sequence step 5).

```
App-up. The wave about to run screenshots the pages this build changed. Start the app, or
confirm it is running and serving the current tree, and probe it as builder-contract
§ Bringing the app up says. Return, as your whole report, one line `App: {base url}` and under it one `Route: {path}` line per
route a changed page file renders; or your four lines with Status: BLOCKED and what failed.
```

## `ux-verifier`

Only when the changed set holds a page file, after the App-up Instruction has returned. Note
`git rev-parse HEAD` at each `ux-verifier` dispatch: on a re-run, `{REF}` is the one noted for
the prior verdict's round on a lane, and `BASE` off a lane, where nothing is committed.

```
Contract lives in your system prompt — inputs follow.
Agent: ux-verifier | {End-of-build wave | Fix-turn wave} | Project: {PROJECT}

## Paths
- binding document: scratch/{PROJECT}/idea.md   (`## Contracts & Acceptance`)
- the build's report: scratch/{PROJECT}/run-card.md   (may not exist yet on the first pass)

## App
{the coder's `App:` line and its `Route:` lines, verbatim}

## Files to review
{the changed page files, one per line}

## Your Prior Verdicts (re-run only — omit on the first pass)
{path}
Fix diff: `git diff {REF}`

## MCP write_report args
project: "{PROJECT}" | step: 0 | iter: {ITER} | role: "ux"
Return exactly 3 lines: Wrote / Status / Carry-over — the Carry-over line is mandatory even when 0.
```
