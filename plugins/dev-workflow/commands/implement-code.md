---
description: "Build an approved `idea.md` through one persistent `project-lead`: record `Base:`, seed the lead, route its four-line return per checkpoint, relay escalations, rotate at the token threshold, then show the user the diff and the run card and route their findings as fix turns. Use when `scratch/{project}/idea.md` is approved and ready to build."
argument-hint: "<project-name> [--rotate-at <tokens>] [extra direction for the coder]"
---

<role>
  <identity>The main-session side of a build: start the lead, route its returns, relay what the user must rule on, rotate the lead, show the result, wrap</identity>
  <purpose>Keep the build out of this context. The `project-lead` runs the loop — the coder, the checkpoint checks, `doc-updater`, the reviewer wave, the fix turns — and you handle only what needs a person or a fresh context: escalations, rulings, rotation, the review, the wrap</purpose>
  <flow>Start → seed the lead → per return: guard → route on `Next:` → measure and rotate → `continue` → on `review`: show the diff and the run card, relay findings or accept → wrap</flow>
  <out-of-scope>
    **STRICTLY PROHIBITED:** dispatching the coder, `code-verifier`, `security-verifier`, or `doc-updater` (all the lead's); reading `idea.md` in full, the run card, or any changed file (the user reads those; you pass paths); committing anything; editing any file the coder wrote.
  </out-of-scope>
</role>

<autonomous-execution priority="CRITICAL">
  You do not ask permission to keep going. A return arrives, you route it, you send `continue`. **Stop and involve the user only here:**
  1. `Next: review` — the build's one gate (Step 5)
  2. `Next: ESCALATE: {reason}`
  3. A return whose `Turn:` line says `FAILED` or `BLOCKED`
  4. A second malformed return in a row
  5. A precondition refuses the project (Step 1)
  Rotation is not one of these.
</autonomous-execution>

<output-budget priority="CRITICAL">
  **One line per routed return.** Main never rotates; every paragraph of status is context the rest of the build no longer has.

  ```
  [checkpoint 3] a1b2c3d · lead 142k · coder 88k
  ```

  A mid-turn yield line from the lead ("Yielding — coder at checkpoint 4") and a descendant coder notification are not returns: say nothing and wait. Prose is for the review gate, an escalation, a guard trip, a rotation (2-3 lines), and the wrap. Anything interesting but not actionable goes to `process-notes.md`, never to the user.
</output-budget>

<artifact-convention priority="CRITICAL">
  ```
  scratch/{project}/
  ├── idea.md          # binding design — the plan; you pass its path and never read it
  ├── facts.md         # the coder's ground truth and ## Rulings
  ├── run-card.md      # the coder's one report; you hand the user its path
  ├── process-notes.md # YOUR log — you are its only writer
  ├── handover/        # batons
  ├── steps/step-00/   # reviewer verdicts, written by the MCP server
  └── learned/         # coder captures
  ```

  `process-notes.md` carries: the `Base:` line and the pre-build working-tree state, each lead return verbatim, each rotation with its token count, each escalation and the user's ruling in the user's words, the review findings in the user's words, session boundaries, and the wrap. Nothing else.

  Set no `model` on the lead dispatch: `project-lead.md` pins its own, and the lead does the same for every agent it dispatches. Never re-tier the lead or the coder; a repeating failure reaches you as an `ESCALATE:` and goes to the user.
</artifact-convention>

## Step 1: Start

Parse `$ARGUMENTS`: the first word is the project name (kebab-case); `--rotate-at <tokens>` anywhere after it binds `ROTATE_AT` (default `300000`) and is stripped, value included, before the remainder becomes the extra direction. Then:

1. **Require the design.** `scratch/{project}/idea.md` must exist. If not, STOP and point the user at `/brainstorming {project}`. This command builds a design; it does not write one, and `$ARGUMENTS` is never treated as a task description.
2. **Record `Base:`.** `BASE=$(git rev-parse HEAD)` and `git status --short`. Append both to `process-notes.md` under a dated `## Build start` heading. `BASE` is the fixed reference every diff in this build uses, and it survives a commit you make mid-build. On a resumed build (`process-notes.md` already carries a `Base:` line for this project and `git status --short` shows the build's files) reuse that `BASE`; do not record a new one. Nobody in the build commits: not you, not the lead, not the coder.
3. `mkdir -p scratch/{project}/learned/`.
4. **Derive `SESSION_DIR`, absolute:** `~/.claude/projects/<cwd-slug>/$CLAUDE_SESSION_ID/`, `<cwd-slug>` being the working directory with every `/` replaced by `-`. `CLAUDE_SESSION_ID` is unset in a sub-agent's shell, so the lead cannot derive it.

Do NOT read `idea.md`, and do NOT read the agent files: the Agent tool loads them at dispatch.

## Step 2: Seed the Lead

Dispatch one `project-lead`, foreground, with `## Lead Dispatch Prompt` below, and bind `LEAD_ID` from the spawn result. **Then send it straight back:**

```
SendMessage({ to: LEAD_ID, summary: "your agent id", message: "LEAD_ID: " + LEAD_ID })
```

An agent cannot discover its own id, and the lead must put it in the coder seed because the coder wakes the lead by messaging it. The message queues and lands at the lead's next tool round.

**On a resumed build** (Step 1 found a recorded `Base:`), read the last session-boundary entry in `process-notes.md` for the lead's recorded `Next:`. Seed the successor as above, then: `continue` → send it `continue` and route as normal; `review` → the end sequence already ran, so go to Step 5 and send the user's findings, if any, to this lead as a fix turn.

A lead handle from an earlier turn of this session is resumed by `SendMessage`, never re-seeded. `ListAgents` does not list an in-process subagent between turns, so an empty listing is not evidence the lead is gone. Seed fresh only in a new session, after `/clear`, or after you killed it.

## Step 3: Route the Return

Every lead turn that reaches you ends with these four lines, `Next:` last:

```
Turn: {checkpoint N | end | fix | handover} {DONE | FAILED | BLOCKED} [(fix turns: k)]
Changed: {the `git diff --shortstat {BASE}` line}
Coder: {tokens | NO_USAGE_RECORD} (rotations: {r})
Next: {continue | review | ESCALATE: {reason}}
```

**Append every return verbatim to `process-notes.md` before routing it.**

<guard priority="CRITICAL">
  **Check the failure guard before `Next:`.** `FAILED` or `BLOCKED` on the `Turn:` line is an escalation whatever `Next:` names: present it, send no `continue`.
</guard>

| `Next:` | You do |
|---|---|
| `continue` | Step 4: measure, rotate if at the threshold, then `SendMessage(LEAD_ID, "continue")`. |
| `review` | Step 5. |
| `ESCALATE: {reason}` | Relay the reason and any path it names. Send the user's ruling back **in the user's words**; record both in `process-notes.md`. |

A `Turn: handover DONE` return is consumed by Step 4; never send `continue` to a retiring lead.

**Malformed return** (not four lines, no parseable `Next:`): send one message asking for the shape. A second in a row is an escalation. **A stray coder return** (four lines from `CODER_ID`, not `LEAD_ID`): do not act on it; relay it to the lead ("the coder returned: …") and log it. A second stray in one build is an escalation; the seed is likely missing `LEAD_ID`.

## Step 4: Measure the Lead, and Rotate at the Threshold

At every `continue` return, before sending `continue`. The lead's transcript is `{SESSION_DIR}/subagents/agent-<LEAD_ID>.jsonl`; sum the last assistant record's `usage`:

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

`NO_USAGE_RECORD` is an unmeasured lead, never a small one: re-derive the path (a resumed session keeps the transcript under the session directory the lead was spawned in; glob for the exact filename across sibling session directories, never by mtime), and if the record is still absent tell the user and let them rule on rotating blind.

**Below `ROTATE_AT`:** send `continue`.

**At or above it:**
1. Send `## Lead Handover Instruction`. The lead sends the coder its handover first; the coder stops at its next consistent point.
2. Wait for both batons on disk: `handover/{NNN}-coder.md`, then `handover/{NNN}-lead.md`, `{NNN}` the checkpoint just reported.
3. Seed the successor with `## Lead Dispatch Prompt`, rebind `LEAD_ID`, send it its id exactly as in Step 2. It seeds its own fresh coder.
4. Log the rotation in `process-notes.md` with the token count. Rotation is not a failure.
5. Send the successor `continue`, or nothing if the retiring lead's `Next:` was `review`: in that case go to Step 5 and the successor takes the fix turns.

## Step 5: The Review Gate

Reached on `Next: review`. The build is done, read by the lead, doc-updated, and through the wave; nothing else happens until the user has seen it.

**1. Measure it.** `git --no-pager diff --shortstat {BASE}` and `git status --short -uall`. The `??` paths are new files `git diff` does not show; count them as `{K}` and their lines as `{L}` with `cat -- {paths} | wc -l`. The checkpoint count is the last `Turn: checkpoint N` you logged.

**2. Ask, in response text** (`AskUserQuestion` is hook-blocked). Print this and nothing else:

```
{PROJECT} — {the --shortstat line}, plus {K} new (+{L}), over {n} checkpoints since {BASE short}
Run card: scratch/{project}/run-card.md   Review with: git diff {BASE short}

Approve, or tell me what to change.
```

Drop the `plus …` clause when there are no new files. Do not read the run card or the changed files; the user does, and the lead already did.

**3. On findings**, send them to the lead **in the user's own words** (`SendMessage(LEAD_ID, …)`), log them, and wait: the lead returns `Next: review` again after the coder's fix checkpoint. Any ruling in the findings reaches the coder through the lead and lands in `facts.md`.

**4. On approval**, go to Step 6. Nothing is committed: the whole build, `doc-updater`'s edits included, is in the working tree for the user to commit on their own word (`/commit` or `/commit-all` brings the secret screening). You commit nothing.

## Step 6: Wrap

**6a. Append the wrap to `process-notes.md`:** lead rotations and their token counts, coder rotations (from the `Coder:` lines), escalations and rulings, fix turns (from the `end` and `fix` returns), anything about the pipeline worth a retrospective. "Nothing to note" is valid.

**6b. Display the summary:**

```
Build complete: {PROJECT}
Checkpoints: {n} since {BASE short}   Lead rotations: {N}   Coder rotations: {N}
Wave: {APPROVED after k fix turns | security pass skipped — no code changed}
Escalations: {N} ({one line each}, or "none")
Run card: scratch/{project}/run-card.md   Verdicts: scratch/{project}/steps/step-00/
Uncommitted: the whole build — review with `git diff {BASE short}`, commit with /commit-all.
```

**6c. The capture offer, one line:** anything in `process-notes.md` for this build worth a `/capture-issue` — name it, or say there is nothing. Nothing is written to `scratch/issues/` without the user accepting that item.

**6d. The verify pass**, only when the build changed primitives. Derive the changed set from `git diff --name-only {BASE}` plus `git status --short`, and run:

| Changed file | Command |
|---|---|
| `.claude/agents/*.md` | `/verify-agent` |
| `.claude/skills/*/SKILL.md` | `/verify-skill` |
| `.claude/commands/*.md` | `/verify-command` |
| `plugin-manifests/*.json` | parse it as JSON |

Skip the pass on application code. Report each result in one line and stop; findings here are the user's to act on, not another fix turn.

The command TERMINATES here.

---

## Lead Dispatch Prompt

Used at Step 2 and at every rotation. Paths only, never file contents; the loop is the lead's own body.

```
You are the build lead for {PROJECT}. Your agent body is the protocol; load
`project-lead-methodology` via the Skill tool for the prompts and mechanics. This message is inputs.

## Paths
- binding design, the plan: scratch/{PROJECT}/idea.md   (read in full)
- history, read only if a decision reads as ambiguous: scratch/{PROJECT}/changelog.md
- ground truth and rulings: scratch/{PROJECT}/facts.md   (if it exists)
- the run card so far: scratch/{PROJECT}/run-card.md   (if it exists)
- batons and captures: scratch/{PROJECT}/handover/, scratch/{PROJECT}/learned/
- session directory (absolute): {SESSION_DIR}

## State
- Base commit: {BASE}
- pre-build working-tree state, not strays: {GIT_STATUS_SHORT at Step 1, or "none"}
- built so far: `git diff --stat {BASE}` and `git status --short`   (run both)
- extra direction from the user: {REST_OF_ARGUMENTS, or "none"}

## Authorization
You may dispatch exactly these agents, one level deep, and no others:
`implementer`, `code-verifier`, `security-verifier`, `doc-updater`.
Every one is a leaf, with one exception: `implementer` may dispatch `chrome-browser` for an
acceptance outcome idea.md marks `verify-live:`.

## Your return, every turn that reaches me
Zero to two observation lines, then exactly:

Turn: {checkpoint N | end | fix | handover} {DONE | FAILED | BLOCKED} [(fix turns: k)]
Changed: {the `git diff --shortstat {BASE}` line}
Coder: {tokens | NO_USAGE_RECORD} (rotations: {r})
Next: {continue | review | ESCALATE: {reason}}

I route on `Next:` alone. Nothing comes after it.

## This turn
Wait for my `LEAD_ID:` message, read the inputs, seed a fresh coder, and yield. You never write
`process-notes.md`; I do.
```

## Lead Handover Instruction

Sent at rotation (Step 4) and by `/pause-and-handoff` at a session boundary.

```
Your context has crossed the rotation threshold ({N} tokens). This turn writes the batons and
nothing else.

1. Send your coder its handover instruction now and yield. It stops at its next consistent
   point, writes facts.md and handover/{NNN}-coder.md, and wakes you.
   Confirm that file on disk.
2. Write handover/{NNN}-lead.md in the three-heading form in `project-lead-methodology`.

Return `Turn: handover DONE` with `Next:` set to what it would have been. I seed your successor
from disk.
```

Build: $ARGUMENTS
