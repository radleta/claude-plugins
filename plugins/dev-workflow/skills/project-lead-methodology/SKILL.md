---
name: project-lead-methodology
description: "What the `project-lead` agent reads at its first turn: prompts, coder-rotation measurement, waiting rules, lead baton, return contract, and § The ingest record every `knowledge-ingestor` caller appends. Use when running or editing a build lead's turn, or writing that ingest record — even a markdown-only build. The loop itself is `project-lead.md`: a different file."
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
├── ingest.md          # every caller's record of an ingest, yours included — append-only
├── handover/          # batons: {NNN}-coder.md, {NNN}-lead.md; NNN = checkpoint number
├── steps/step-00/     # reviewer verdicts, written by the MCP server
└── learned/           # coder-written captures; searched, not read
```

`facts.md`, the batons and the run card have their forms in `builder-contract`; the lead
baton's form is below. `git diff {BASE}` plus untracked files reads the build. On a lane the
coder commits each green checkpoint and you commit scratch, the ingest's pages and `doc-updater`'s
edits (§ Lane commits), and the user reviews the lane whole at `/end-lane`; off a lane nothing in
the build commits, and the user commits once after the review.

---

## The Return Contract

<!-- Coupled with `project-lead.md` `<return-contract>`, `implement-code-methodology` Step 3, and the Lead Dispatch Prompt in `lead-prompts.md`. Edit all four or none. -->

```
Turn: {checkpoint N | end | fix | handover} {DONE | FAILED | BLOCKED} [(fix turns: k)]
Changed: {the `git diff --shortstat {BASE}` line}
Coder: {tokens | NO_USAGE_RECORD} (rotations: {r})
Next: {continue | review | ESCALATE: {reason}}
```

Observation lines sit above the block: `Ingest:` (end-sequence step 4), `Signals:`
(end-sequence step 9, repeated on every later fix return), and one `Question: {reason}` per open
non-blocking escalation, repeated until main relays its answer. Main logs each; it gates its
review on `Ingest:`, writes the latest `Signals:` into the `process-notes.md` wrap, and puts each
new `Question:` to the user without stopping the build.

Main matches `Next:` exactly: the literals `continue` and `review`, and the prefix
`ESCALATE:`. `FAILED` or `BLOCKED` on the `Turn:` line is an escalation whatever `Next:` says.

---

## Prompts

Inputs and paths only. The coder loads `builder-contract` through its own frontmatter; the
reviewers load theirs. Nothing here restates a contract.

The prompts main sends the lead live apart: read [lead-prompts.md](lead-prompts.md) when editing
the Lead Dispatch Prompt or the Lead Handover Instruction. The leftover pass, its instruction and
the tier check live in [leftover-pass.md](leftover-pass.md): read it when the end sequence
reaches step 7. The App-up Instruction and the `ux-verifier` prompt live in
[ux-pass.md](ux-pass.md): read it when the changed set holds a page file.

### Coder Seed

The `Agent` dispatch of `implementer`, at the seed turn and at every rotation. Set no `model`.

```
You are the build's coder. Build what `idea.md` specifies, in this one context, stopping at a
checkpoint at each green test run and reporting to me at each one. On a lane you commit each
green checkpoint as builder-contract § Checkpoints says; off one you commit nothing. This
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
doc-updater's report: {path, or "none"}; list its edits under ## Doc updates.
Latest security verdict: {path, or "none — no security pass ran"}; copy each of its
## Accepted by design bullets into ## I did not verify.
Latest UX verdict: {path, or "none — no page file changed"}; under ## Verified, name its
Status and the screenshot paths it cites.
Verdicts with non-blocking findings: {paths, or "none"}; list each finding, with its label and
verdict path, under ## Verified beside that verifier's result. When idea.md's `Signals tier:` judgment
is not none, ## I did not verify also lists the production read path, or `none`, per
builder-contract § The run card. Return your four lines with Status: BUILT.
```

### `knowledge-ingestor`

The end sequence's boundary ingest, only when `learned-check pending` exits `1`. The lead passes
no type, so the prompt is the path and nothing else; the agent reads its own protocols.

```
{the resolved LEARNED_DIR that knowledge-capture § Boundary Ingest step 1 printed}
```

### `doc-updater`

```
Build: scratch/{PROJECT}/   (design: scratch/{PROJECT}/idea.md)
Learned: scratch/{PROJECT}/learned/

## Changed files ({the whole build, `git diff --name-only {BASE}` plus untracked})
{list}

## Scope
The only doc pass in this build. Scan the changed set against every doc location (READMEs,
.claude/CLAUDE.md, cheat-sheet/, docs/) and apply the updates the build requires. Edit in
place; commit nothing. A stale claim on a wiki page becomes a drift capture in the `Learned:`
directory, as doc-update `<wiki-pages>` says; the boundary ingest after you files it.

## Output
Return a structured report: Docs Updated / Docs Assessed No Change Needed / Drift captures written / Summary.
```

### `code-verifier`

The end sequence's wave and the Fix-turn wave (`project-lead.md` `<turns>`) send the same
prompt; only the label differs: pick one of `{End-of-build wave | Fix-turn wave}`. Each wave's
first pass omits `## Your Prior Verdicts`.

```
Contract lives in your system prompt — inputs follow.
Agent: code-verifier | {End-of-build wave | Fix-turn wave} | Project: {PROJECT}

## Paths
- binding document: scratch/{PROJECT}/idea.md   (`## Contracts & Acceptance`, `## Decisions`)
- the build's report: scratch/{PROJECT}/run-card.md   (may not exist yet on the first pass)

## Files to review
{`git diff --name-only {BASE}` plus untracked, one per line}

## Stray-file check
`git diff {BASE} --stat` follows. The pre-build working-tree state main recorded in
process-notes.md is NOT a stray: {that list, or "none"}.
The wiki pages the build's boundary ingest wrote are NOT strays: {the wiki-path set; "none" when
no ingest ran; on an aborted § Boundary Ingest step 4, "unknown — the ingest's snapshot aborted,
so treat nothing under `.claude/skills/` as a stray"}.
Paths the boundary ingest wrote that are not wiki pages are NOT strays either; the user rules on
them at the review: {the non-page paths; "none"; "unknown" on that same abort}.

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
Agent: security-verifier | {End-of-build wave | Fix-turn wave} | Project: {PROJECT}

## Paths
- binding document: scratch/{PROJECT}/idea.md   (architecture context)
- the build's report: scratch/{PROJECT}/run-card.md   (may not exist yet on the first pass)

## Files to review
{`git diff --name-only {BASE}` plus untracked, one per line}

## Why this build is in scope
{which changed files are code or config — name them}

## Risks the design accepts
- scratch/{PROJECT}/idea.md § Failure Modes

## Your Prior Verdicts (re-run only — omit on the first pass)
{path}

## MCP write_report args
project: "{PROJECT}" | step: 0 | iter: {ITER} | role: "security"
Return exactly 3 lines: Wrote / Status / Carry-over — the Carry-over line is mandatory even when 0.
```

Set no `model` on any dispatch: every agent pins its own. Tier rationale is the
`dispatch-tier-rubric` skill. Every verifier labels every finding on `reviewer-contract`'s one
scale: `## Issues` holds every `would-ship-bug` and `real-minor`, and `Status:` is `FINDINGS`
exactly when it is non-empty, except a `ux` `BLOCKED`, which has none and routes as
`project-lead.md` step 5 says. Route on each `Status:` line, then read every verdict body,
`APPROVED` ones included, for its `## Non-blocking findings`: they never get a fix turn, and the
Run Card Instruction carries every verdict path that holds one.

---

## Measuring a context

The coder's transcript is `{SESSION_DIR}/subagents/agent-<CODER_ID>.jsonl`, `CODER_ID` bound
from your own spawn result. Never pick a transcript by mtime: the directory holds yours, the
coder's, and every reviewer's. If a handle is lost, each transcript's sibling
`agent-<id>.meta.json` carries `parentAgentId`; the coder you spawned is the one whose parent
is your own id.

When your prompt's `SESSION_DIR` is `none`, main could not find the session directory and the
build runs without rotation: measure nothing, never rotate the coder for size, and report
`Coder: NO_USAGE_RECORD`.

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

It prints a number or fails loudly. A measured transcript printing `NO_USAGE_RECORD` is an
unmeasured coder, never a small one: re-check the path, and if it is right put `NO_USAGE_RECORD` verbatim on your `Coder:` line.

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
foreground wait, `timeout 120 tail -f /dev/null` (exits 124), repeated; a foreground Bash call
with no `timeout` parameter runs up to 30 minutes, and up to 120 with one. `TaskOutput` does not exist inside a sub-agent.

---

## Lane commits

On a lane (`lane-methodology` § Claim), before every return that
reaches main:

1. Commit the boundary ingest's wiki-path set as `knowledge-capture` § Boundary Ingest's commit
   of the wiki-path set says on a lane, and the paths `doc-updater`'s report names the same way in
   a commit of their own, each recorded in the lane record's `## Decisions made`.
   Owner: agent (user-decision-rubric)
2. Commit `scratch/{PROJECT}/`, the lane record when step 1 wrote it, and every `scratch/` path
   the coder's `Files:` lines named since the last lane commit, as `lane-methodology` § Scratch
   commit step 3 does: path-scoped, no approval. A path of step 1 inside an extra lane repo is
   committed there by `lane-methodology` § Lane repos.
3. Push every lane branch plain with `lane push` (`lane-methodology` § The lane script).

The coder's checkpoint commits are its own (`builder-contract` § Checkpoints), so the lane's own
repos are left nothing uncommitted for `/end-lane`. A group in a registered repo stays uncommitted
for the user, named on `/implement-code` 6c's `Uncommitted in` line. A push that fails is a
`Question:` line naming it; the commits are local, so the build goes on.

---

## The ingest record

`scratch/{project}/ingest.md` holds the record every caller of `knowledge-ingestor` appends:
the build lead, `/brainstorming` step 5, `/discovery` at session end, `/ingest` Step 3,
`/close-issue` and `/wrap-up` stage 8. `/close-issue` (`issue-groom-methodology` `promote.md`
§ Write) appends to the build project's `ingest.md`, or to `scratch/{ticket-slug}/ingest.md`
when there is no build project. `/wrap-up` stage 8 appends to the workstream's
`wrap/ingest.md` instead. A domain run with no project appends to
`scratch/wiki-groom-{domain}/ingest.md`, creating the folder if it is missing; it needs no init.
The lead writes it as soon as § Boundary Ingest step 4 has printed after `knowledge-ingestor`
returns, and before the wave is dispatched, so a rotation never loses a proposal; the other
callers write it as soon as the return arrives. Append-only: never rewrite or remove a section,
including one an earlier build, lead or caller wrote.

The section format, how each field is counted, the abort and no-snapshot cases, which sections
`/implement-code` reads, and `### Proposal disposition` are in [`ingest-record.md`](ingest-record.md).
Read it before you write a record or read one back.

---

## The lead baton

`handover/{NNN}-lead.md`, `{NNN}` the checkpoint the coder just reported, written after the
coder's baton is confirmed on disk. Frontmatter `after_checkpoint: N`, `role: lead`, `date:`.
Three headings, in this order, omitting any you have nothing to put under:

- `## Your coder` — its id, last measured size, rotations so far
- `## Open findings` — reviewer verdicts not yet fixed, each open `ux` verdict with the HEAD
  noted at its dispatch (`ux-pass.md`), nits recorded and where, fix turns so far
- `## What the next turn must not miss` — an `Ingest:` observation line the end sequence produced
  that no return has carried to main yet belongs here, so the successor carries it, and so does
  each open `Question:` with the item it set aside

Cite, do not restate: a path and a heading, never a pasted paragraph. Rulings live in
`facts.md` `## Rulings` and are not repeated here. Never put a value in a heading. A
successor lead seeds a fresh coder from the Coder Seed; the coder's baton is searched by that
coder, not read on onboarding.

Return `Turn: handover DONE` with `Next:` set to what it would have been: `continue` mid-build,
`review` after the end sequence. Main seeds your successor and never sends you `continue`
again.
