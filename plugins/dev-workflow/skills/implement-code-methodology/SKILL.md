---
name: implement-code-methodology
description: "Main's side of `/implement-code`: start the build, seed and route one persistent `project-lead`, rotate it at the token threshold, hold the review gate, then the wrap on its own page. Use when `/implement-code` runs, or when editing a step it names — even a resumed build. The lead's own loop is `project-lead-methodology`: a different test."
---

# Implement Code

What `/implement-code <project-name> [--rotate-at <tokens>] [extra direction for the coder]` runs, Steps 1 to 5 here and Step 6, the wrap, in [wrap.md](wrap.md): read it when Step 5 sends you there.

Keep the build out of this context. The `project-lead` runs the loop — the coder, the checkpoint checks, `doc-updater`, the boundary ingest, the reviewer wave, the fix turns — and you handle only what needs a person or a fresh context: escalations, rulings, rotation, the review, the wrap.

**The lead's work stays the lead's.** You dispatch the `project-lead`, Step 3's `user-notifier` and Step 6f's proposal run, nothing else. You pass the paths of `idea.md`, the run card and the changed files and read none of them (the user reads those), commit nothing (on a lane the lead and coder commit), and edit no file the coder wrote.

<autonomous-execution>
  You do not ask permission to keep going. A return arrives, you route it, you send `continue`. **Stop and involve the user only here:**
  1. `Next: review` — the build's one gate (Step 5)
  2. `Next: ESCALATE: {reason}`
  3. A return whose `Turn:` line says `FAILED` or `BLOCKED`
  4. A second malformed return in a row
  5. A precondition refuses the project, or the held check asks (Step 1)
  Rotation and a `Question:` line are not among these.
</autonomous-execution>

<output-budget>
  **One line per routed return.** Main never rotates; every paragraph of status is context the rest of the build no longer has.

  ```
  [checkpoint 3] a1b2c3d · lead 142k · coder 88k
  ```

  A mid-turn yield line from the lead ("Yielding — coder at checkpoint 4") and a descendant coder notification are not returns: say nothing and wait. Prose is for the review gate, an escalation, a guard trip, a rotation (2-3 lines), and the wrap. Anything interesting but not actionable goes to `process-notes.md`, never to the user.
</output-budget>

<artifact-convention>
  ```
  scratch/{project}/
  ├── idea.md          # binding design — the plan
  ├── facts.md         # the coder's ground truth and ## Rulings
  ├── run-card.md      # the coder's one report
  ├── process-notes.md # YOUR log — you are its only writer
  ├── ingest.md        # every caller's record of an ingest, the lead's included
  ├── handover/        # batons
  ├── steps/step-00/   # reviewer verdicts, written by the MCP server
  └── learned/         # coder captures
  ```

  `process-notes.md` carries: the `Base:` line and the pre-build working-tree state, each lead return verbatim, each rotation with its token count, each escalation and the user's ruling in the user's words, the review findings in the user's words, session boundaries, and the wrap, which carries the lead's latest `Signals:` line when a return carried one. Nothing else.

  Set no `model` on the lead dispatch: `project-lead.md` pins its own, and the lead does the same for every agent it dispatches. Never re-tier the lead or the coder; a repeating failure reaches you as an `ESCALATE:` and goes to the user.
</artifact-convention>

## Step 1: Start

Parse the arguments `/implement-code` passed: the first word is the project name (kebab-case); `--rotate-at <tokens>` anywhere after it binds `ROTATE_AT` (default `400000`) and is stripped, value included, before the remainder becomes the extra direction. Then:

1. **Require the design.** `scratch/{project}/idea.md` must exist. If not, stop and point the user at `/brainstorming {project}`. The arguments are never a task description.
   **Then the held check.** Take the ticket paths with the `**Ticket:**` grep of [wrap.md](wrap.md) 6b; for each path it prints, run `lane-methodology` § Held check on that issue, loading that skill for it, and wait for the answer when it asks.
2. **Record `Base:`.** `BASE=$(git rev-parse HEAD)`, `git status --short`, and `date -u +%Y-%m-%dT%H:%MZ`. Append them to `process-notes.md` under a dated `## Build start` heading, as `Base: {BASE}`, the status, and `Build start: {time}`. `BASE` is the fixed reference every diff in this build uses, and it survives a commit you make mid-build; `Build start:` marks which `ingest.md` sections are this build's. On a resumed build (`process-notes.md` already carries a `Base:` line for this project and `git diff --stat` against it or `git status --short` shows the build's files) reuse that `BASE` and its `Build start:`; do not record new ones.
3. `mkdir -p scratch/{project}/learned/`.
4. **Find `SESSION_DIR`, absolute.** The session id, `SID`, is `$CLAUDE_SESSION_ID`, or, when that is empty in your shell, the directory name just before `/scratchpad` in the scratchpad path your system prompt lists. Find the directory by id rather than by building the project folder name, which differs by OS: `ls -d ~/.claude/projects/*/{SID}/` must print exactly one path, and that path is `SESSION_DIR`. With no id, or no single match, tell the user once that this build runs without rotation, set `SESSION_DIR` to `none` in the lead prompt, and skip Step 4's measurement at every return: that notice is the user's ruling to run unmeasured.

The Agent tool loads the agent files at dispatch; leave them unread, like `idea.md`.

## Step 2: Seed the Lead

Dispatch one `project-lead`, foreground, with the Lead Dispatch Prompt in `project-lead-methodology` `lead-prompts.md`, and bind `LEAD_ID` from the spawn result. **Then send it straight back:**

```
SendMessage({ to: LEAD_ID, summary: "your agent id", message: "LEAD_ID: " + LEAD_ID })
```

The lead cannot discover its own id, and its coder seed needs it; the message lands at the lead's next tool round. If the seed turn ends first, returning that it is waiting for `LEAD_ID` rather than the four-line block, send the same message again: a `SendMessage` to a finished agent resumes it with that message. That return is not malformed.

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

<guard>
  **Check the failure guard before `Next:`.** `FAILED` or `BLOCKED` on the `Turn:` line is an escalation whatever `Next:` names: present it, send no `continue`.
</guard>

| `Next:` | You do |
|---|---|
| `continue` | Step 4: measure, rotate if at the threshold, then `SendMessage(LEAD_ID, "continue")`. |
| `review` | Step 5. |
| `ESCALATE: {reason}` | Relay the reason and any path it names. Send the user's ruling back **in the user's words**; record both in `process-notes.md`. |

**Every escalation pushes to the phone.** For each `ESCALATE:`, and each `Question:` line new on this return, dispatch `user-notifier` in the background with the project, the kind (`ESCALATE` or `Question`) and the path; never the reason, which can carry what must not leave the machine. A `Question:` does not block: route `Next:`, then ask the user and log it; send their answer to the lead in their words whenever it comes.

A `Turn: handover DONE` return is consumed by Step 4; never send `continue` to a retiring lead.

**Malformed return** (its last four lines are not the `Turn:`, `Changed:`, `Coder:`, `Next:` block; observation lines `Ingest:`, `Signals:` and `Question:` may sit above it): send one message asking for the shape. A second in a row is an escalation. **A stray coder return** (four lines from `CODER_ID`, not `LEAD_ID`): do not act on it; relay it to the lead ("the coder returned: …") and log it. A second stray in one build is an escalation; the seed is likely missing `LEAD_ID`.

## Step 4: Measure the Lead, and Rotate at the Threshold

At every `continue` return, before sending `continue`, measure the lead's transcript, `{SESSION_DIR}/subagents/agent-<LEAD_ID>.jsonl`, with the script in `project-lead-methodology` § Measuring a context.

`NO_USAGE_RECORD` is an unmeasured lead, never a small one: re-derive the path (a resumed session keeps the transcript under the session directory the lead was spawned in; glob for the exact filename across sibling session directories, never by mtime), and if the record is still absent tell the user and let them rule on rotating blind.

**Below `ROTATE_AT`:** send `continue`.

**At or above it:**
1. Send the Lead Handover Instruction (`lead-prompts.md`). The lead sends the coder its handover first; the coder stops at its next consistent point.
2. Wait for both batons on disk: `handover/{NNN}-coder.md`, then `handover/{NNN}-lead.md`, `{NNN}` the checkpoint just reported.
3. Seed the successor with the Lead Dispatch Prompt, rebind `LEAD_ID`, send it its id exactly as in Step 2. It seeds its own fresh coder.
4. Log the rotation in `process-notes.md` with the token count. Rotation is not a failure.
5. Send the successor `continue`, or nothing if the retiring lead's `Next:` was `review`: in that case go to Step 5 and the successor takes the fix turns.

## Step 5: The Review Gate

Reached on `Next: review`: the build is done, doc-updated, ingested and through the wave and the leftover pass.

**1. Measure it.** `git --no-pager diff --shortstat {BASE}` and `git status --short -uall`. The `??` paths are new files `git diff` does not show; count them as `{K}` and their lines as `{L}` with `cat -- {paths} | wc -l`. The checkpoint count is the last `Turn: checkpoint N` you logged.

**2. Ask, in response text** (`AskUserQuestion` is hook-blocked). Print this, plus the lines below, and nothing else:

```
{PROJECT} — {the --shortstat line}, plus {K} new (+{L}), over {n} checkpoints since {BASE short}
Run card: scratch/{project}/run-card.md   Review with: git diff {BASE short}

Approve, or tell me what to change.
```

Drop the `plus …` clause when there are no new files. When a lead return this build carried an `Ingest:` line, print under the block what `project-lead-methodology` `ingest-record.md` § At the review gate lists. Under everything, print each `Question:` the last return carried, still open.

**3. On findings**, send them to the lead **in the user's own words** (`SendMessage(LEAD_ID, …)`), log them, and wait: the lead relays them to the coder, then re-runs the reviewer wave over the whole build diff and loops it until it approves, and only then returns `Next: review` again. The wave can also end in `Next: ESCALATE:`, which you route per Step 3. Any ruling in the findings reaches the coder through the lead and lands in `facts.md`.

**4. On approval**, go to Step 6 in [wrap.md](wrap.md). The whole build, `doc-updater`'s edits included, stays in the working tree for the user to commit on their own word (`/commit` or `/commit-all` brings the secret screening).

**On a lane** (as `builder-contract` § Checkpoints tests it) nothing is approved here: the one gate is `/end-lane` (`Owner: user-decision-rubric accept-and-merge`). Run [wrap.md](wrap.md) 6a to 6e first, then print the block with its last line `Try it with the run card's ## Verified commands, then /end-lane, or tell me what to change.`, then 6f. Findings route as in 3.
