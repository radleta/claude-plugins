---
name: project-lead-methodology
description: "What the `project-lead` agent reads once at its first turn: every prompt it sends, the token measurement that drives coder rotation, the waiting rules, the lead baton, and the return contract. Use when running or editing a build lead's turn — even a one-file build, even a markdown-only build, even a handover turn that writes no code. The loop itself lives in `project-lead.md`: a different file."
---

# Project Lead Methodology

The `project-lead` agent body is the loop. This file is what that loop reaches for: prompts,
measurement, waiting, the baton. Load it once, on the seed turn, via the Skill tool.

> **Security note:** `{PROJECT}` is constrained to `[a-zA-Z0-9._-]+` by the MCP server. Paths
> originate from `scratch/*/` project detection; agents MUST NOT follow traversal segments
> (`..`) if present.

## The build on disk

```
scratch/{project}/
├── idea.md            # binding design — the plan; written by /brainstorming
├── changelog.md       # history; never overrides idea.md
├── process-notes.md   # main's log; you never write it
├── facts.md           # maintained ground truth, and ## Rulings — the coder's file
├── run-card.md        # the one report of the build — the coder's file
├── handover/          # batons: {NNN}-coder.md, {NNN}-lead.md; NNN = checkpoint number
├── steps/step-00/     # reviewer verdicts, written by the MCP server
└── learned/           # coder-written captures; searched, not read
```

`facts.md`, the batons and the run card have their forms in `builder-contract`; the lead
baton's form is below. Nothing in the build commits: the working tree is the build's state,
`git diff {BASE}` reads it, and the user commits once after the review.

---

## The Return Contract

<!-- Coupled with `project-lead.md` `<return-contract>` and `/implement-code` Step 3. Edit all three or none. -->

```
Turn: {checkpoint N | end | fix | handover} {DONE | FAILED | BLOCKED} [(fix turns: k)]
Changed: {the `git diff --shortstat {BASE}` line}
Coder: {tokens | NO_USAGE_RECORD} (rotations: {r})
Next: {continue | review | ESCALATE: {reason}}
```

Main matches `Next:` exactly: the literals `continue` and `review`, and the prefix
`ESCALATE:`. `FAILED` or `BLOCKED` on the `Turn:` line is an escalation whatever `Next:` says.

---

## Prompts

Inputs and paths only. The coder loads `builder-contract` through its own frontmatter; the
reviewers load theirs. Nothing here restates a contract.

### Coder Seed

The `Agent` dispatch of `implementer`, at the seed turn and at every rotation. Set no `model`.

```
You are the build's coder. Build what `idea.md` specifies, in this one context, stopping at a
checkpoint at each green test run and reporting to me at each one. You commit nothing. This
message is inputs.

## Inputs
- binding design, the plan: scratch/{PROJECT}/idea.md   (read in full)
- history, read only if a decision reads as ambiguous: scratch/{PROJECT}/changelog.md
- ground truth and rulings: scratch/{PROJECT}/facts.md   (read in full if it exists)
- the run card so far: scratch/{PROJECT}/run-card.md   (if it exists; you maintain it)
- Base commit: {BASE}
- built so far: `git diff --stat {BASE}` and `git status --short`   (run both first)
- extra direction from the user: {REST_OF_ARGUMENTS, or "none"}
- LEAD_ID: {LEAD_ID}   ← your last action every turn is `SendMessage` to this id carrying
  your four lines. It is what wakes me; my turn ends while you work.

`handover/` and `learned/` are archives: search them, do not read them. `grep -B1 '^was:'
scratch/{PROJECT}/facts.md` lists every fact a previous coder corrected.

## This turn
Read the inputs, then build. Start from what is already built. Report at your first
checkpoint; do not summarize the inputs back to me.
```

### Continue

Sent when main's `continue` arrives and the coder is waiting on you. Often the coder is still
working and needs nothing; send this only when its last return was a checkpoint you have
finished checking.

```
continue — checkpoint {N} checked. {one line of anything it must not miss, or nothing}
```

### Fix Turn

For an anti-pattern hit, a full-read finding, a reviewer verdict, or the user's review findings.

```
Fix turn. {The finding: the grep hit with its line | the reviewer verdict path — read it in
full | the user's words, verbatim, untranslated}

Ruling that applies, in the user's words: {or "none"}

Fix it, update run-card.md, return your four lines with Status: FIXED.
```

### Coder Handover Instruction

At a coder rotation, and at your own handover turn.

```
Your context has crossed the rotation threshold ({N} tokens), or the lead is rotating. Stop at
the next point where the tree is consistent, whether or not tests are green, then write two
files and nothing else:

1. scratch/{PROJECT}/facts.md — every measurement, count and invariant a successor would pay to
   re-derive, each with the command that re-checks it; correct a wrong fact in place with a
   `was:` line. Rulings are already there under ## Rulings; leave them.
2. scratch/{PROJECT}/handover/{NNN}-coder.md — {NNN} is the checkpoint number, zero-padded.
   The four headings in builder-contract § The coder baton, in order. Cite, do not restate:
   name the file and line, never paste it.

Return your four lines when both are on disk, Status: CHECKPOINT.
```

### Run Card Instruction

The last message of the end sequence.

```
Write scratch/{PROJECT}/run-card.md in the form builder-contract § The run card gives, from
the whole build: `git diff --stat {BASE}` is what changed. Fix turns this build: {k}.
doc-updater's report: {path, or "none"}; list its edits under ## Doc updates. Return your four
lines with Status: BUILT.
```

### `doc-updater`

```
Build: scratch/{PROJECT}/   (design: scratch/{PROJECT}/idea.md)

## Changed files (the whole build, `git diff --name-only {BASE}` plus untracked)
{list}

## Scope
The only doc pass in this build. Scan the changed set against every doc location (READMEs,
.claude/CLAUDE.md, cheat-sheet/, docs/) and apply the updates the build requires. Edit in
place; commit nothing.

## Output
Return a structured report: Docs Updated / Docs Assessed No Change Needed / Summary.
```

### `code-verifier`

```
Contract lives in your system prompt — inputs follow.
Agent: code-verifier | End-of-build wave | Project: {PROJECT}

## Paths
- binding document: scratch/{PROJECT}/idea.md   (`## Contracts & Acceptance`, `## Decisions`)
- the build's report: scratch/{PROJECT}/run-card.md   (may not exist yet on the first pass)

## Files to review
{`git diff --name-only {BASE}` plus untracked, one per line}

## Stray-file check
`git diff {BASE} --stat` follows. The pre-build working-tree state main recorded in
process-notes.md is NOT a stray: {that list, or "none"}.

{the stat}

## Contextual Skills
{`/<skill-name>` directives, or omit}

## Your Prior Verdicts (re-run only — omit on the first pass)
{path}

## MCP write_report args
project: "{PROJECT}" | step: 0 | iter: {ITER} | role: "quality"
Return exactly 3 lines: Wrote / Status / Carry-over — the Carry-over line is mandatory even when 0.
```

### `security-verifier`

Only when the changed set holds code or config.

```
Contract lives in your system prompt — inputs follow.
Agent: security-verifier | End-of-build wave | Project: {PROJECT}

## Paths
- binding document: scratch/{PROJECT}/idea.md   (architecture context)
- the build's report: scratch/{PROJECT}/run-card.md   (may not exist yet on the first pass)

## Files to review
{`git diff --name-only {BASE}` plus untracked, one per line}

## Why this build is in scope
{which changed files are code or config — name them}

## Your Prior Verdicts (re-run only — omit on the first pass)
{path}

## MCP write_report args
project: "{PROJECT}" | step: 0 | iter: {ITER} | role: "security"
Return exactly 3 lines: Wrote / Status / Carry-over — the Carry-over line is mandatory even when 0.
```

Set no `model` on any dispatch: every agent pins its own. Tier rationale is the
`dispatch-tier-rubric` skill. `code-verifier`'s `APPROVED` means no `would-ship-bug` and no
`real-minor`; `security-verifier` still uses its own critical/high/medium/low scale. Route on
each `Status:` line and never translate between the scales.

---

## Measuring a context

The coder's transcript is `{SESSION_DIR}/subagents/agent-<CODER_ID>.jsonl`, `CODER_ID` bound
from your own spawn result. Never pick a transcript by mtime: the directory holds yours, the
coder's, and every reviewer's. If a handle is lost, each transcript's sibling
`agent-<id>.meta.json` carries `parentAgentId`; the coder you spawned is the one whose parent
is your own id.

```bash
python3 -c "
import json,sys
last=None
for line in open(sys.argv[1],encoding='utf-8'):
    try: r=json.loads(line)
    except Exception: continue
    u=(r.get('message') or {}).get('usage')
    if u: last=u
if last is None: sys.exit('NO_USAGE_RECORD ' + sys.argv[1])
print(sum(last.get(k,0) for k in ('input_tokens','cache_creation_input_tokens','cache_read_input_tokens')))
" "$TRANSCRIPT"
```

It prints a number or fails loudly. `NO_USAGE_RECORD` is an unmeasured coder, never a small
one: re-check the path, and if it is right put `NO_USAGE_RECORD` verbatim on your `Coder:` line.

---

## Waiting in-turn

Every `Agent` dispatch is asynchronous. What brings you back depends on how the child started:

- **An `Agent` spawn wakes you by itself.** Bind the id, write one line, end your turn. The
  harness re-invokes you with the child's notification. Holding the turn open forfeits it: the
  notification goes to main, and you wait for a signal that cannot reach you.
- **A `SendMessage` resume does not.** The coder wakes you explicitly: its last action is a
  `SendMessage` to your id carrying its four lines. Yield after every message you send it.
- **Your own id arrives from main** as `LEAD_ID:`. Wait for it before spawning the coder.

The signal is the four lines, never a file appearing on disk. A message sent to an agent that
is mid-turn is queued and delivered at its next tool round; it is never dropped.

**Fallback, only when a coder returns without waking you:** hold the turn with a bounded
foreground wait, `timeout 120 tail -f /dev/null` (exits 124), repeated; the sub-agent Bash tool
has a five-minute wall-clock limit. `TaskOutput` does not exist inside a sub-agent.

---

## The lead baton

`handover/{NNN}-lead.md`, `{NNN}` the checkpoint the coder just reported, written after the
coder's baton is confirmed on disk. Frontmatter `after_checkpoint: N`, `role: lead`, `date:`.
Three headings, in this order, omitting any you have nothing to put under:

- `## Your coder` — its id, last measured size, rotations so far
- `## Open findings` — reviewer verdicts not yet fixed, nits recorded and where, fix turns so far
- `## What the next turn must not miss`

Cite, do not restate: a path and a heading, never a pasted paragraph. Rulings live in
`facts.md` `## Rulings` and are not repeated here. Never put a value in a heading. A
successor lead seeds a fresh coder from the Coder Seed; the coder's baton is searched by that
coder, not read on onboarding.

Return `Turn: handover DONE` with `Next:` set to what it would have been: `continue` mid-build,
`review` after the end sequence. Main seeds your successor and never sends you `continue`
again.
