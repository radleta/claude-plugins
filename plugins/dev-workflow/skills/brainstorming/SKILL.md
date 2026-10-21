---
name: brainstorming
description: "Brainstorm an idea into a binding idea.md design — a researcher read, a drafted architecture reviewed before the user sees it, a dialogue that walks it, a closing review re-run after each change, approval, then the build. Use when starting a feature, component, or project that needs a design, or when requirements need pinning down — even for a change that looks too simple to need one."
---

# Brainstorming Ideas Into Designs

Turn an idea into a design through dialogue, checked by read-only reviewer sub-agents that
persist verdicts through the `scratch-memory` MCP: on the drafted architecture before the user
sees it, on the finished document, and again after every batch of the user's changes, each time
re-checking the fixes the review caused. The approved `idea.md` is the
**binding artifact and the plan**: `/implement-code` builds it directly. There is no spec and
no plan corpus in between.

<approval-gate>
Present a design and get the user's explicit approval before any implementation action:
writing code, scaffolding a project, or invoking `/implement-code`. This holds for every
project regardless of perceived simplicity.
</approval-gate>

## The flow

1. **Settle the ticket and the lens, read the project, then sweep.** The ticket and the lens are
   settled before anything is dispatched, in this order, and held in the conversation for step 2
   to write: the ticket path, the lens, and whether the user said "you pick".

   1. **The ticket.** The `scratch/issues/{slug}.md` path of the build issue `/discovery`'s
      Breakdown Gate filed for this design. Three cases:

      - **The prose named a ticket.** That is the ticket. A named ticket is authoritative; run no
        lookup.
      - **It named no ticket and no epic slug.** There is no ticket. This is most `/brainstorming`
        runs and it costs no commands.
      - **It named no ticket but did name an epic slug.** The gate filed a ticket and nobody
        carried it across the session gap: recover it from the epic's open build work as
        [ticket-recovery.md](ticket-recovery.md) gives, acting on its one, several or no paths.

      Once the ticket settles, run `lane-methodology` § Held check on it, loading that skill for
      it, then `/refresh-issue {slug}` on it, both before the lens.

   2. **The lens.** When `scratch/{project}/idea.md` already has `## Architecture`, skip this
      sub-step and the next: step 2 keeps that section as it stands, so no draft needs a lens.
      Otherwise read the settled ticket's `lens:` frontmatter line from the file itself;
      `epics graph --json` does not carry it. A value matching a lens name in `options-rubric`
      `## Lenses`, compared case-insensitively with hyphens read as spaces, is the lens.
   3. **No ticket, no `lens:` line, or an unrecognized value:** load `options-rubric` and ask its
      "Choosing a strawman lens" question, saying in one line when the ticket carried a value you
      did not recognize. Wait for the answer. On "you pick", choose the lens yourself.
      Owner: user-decision-rubric (test: Taste)

   Then dispatch `researcher` (foreground), if it is available in this deployment:

   ```
   Agent({
     subagent_type: "researcher",
     description: "Investigate project context for /brainstorming",
     prompt: "Dispatcher: /brainstorming. Project: {PROJECT_NAME}. Question: What is the top-level structure, key conventions (file layout, naming, build tools), and relevant existing patterns for this project? Focus on what a designer would need to know before proposing new features. Source: brainstorming/research."
   })
   ```

   A return whose first line matches `^CLARIFICATION_REQUIRED:` means the project name could
   not be resolved: when neither the arguments nor an existing `scratch/{project}/` names it, ask
   the user for it rather than guessing. Owner: user-decision-rubric (test: Conflict). If the agent is unavailable,
   investigate directly with Glob, Grep and Read. If the return ends in a trailer, relay the
   lines its contract requires (`researcher` § Dispatch Contract, Trailer relay) inside step 2's
   message, so the user knows a capture is waiting: a drift capture for step 5's ingest, any
   other for the build's.

   4. **The sweep.** Nearby open issues ride in this build rather than waiting for their own:
      run [sweep.md](sweep.md), which asks the joins and splits the merges and closes by lane.

   **Done when** the ticket is settled or known absent, the lens is settled or skipped, the
   structure, conventions and existing patterns a designer needs are in context, every sweep
   join has the user's ruling and every joining issue is refreshed, every determination is
   applied or ruled as sweep.md gives, and every
   finding that passes the `knowledge-capture` heuristic is written to
   `scratch/{project}/learned/research-*.md` once step 2 creates the directory.

2. **Init or adopt the artifact set, then draft the architecture.**
   `mkdir -p scratch/{project}/learned/`, then branch on whether `idea.md` exists:

   - **It does not: init.** `idea.md` from [idea-template.md](idea-template.md) with Problem and
     Context seeded from step 1, `changelog.md` from
     [changelog-template.md](changelog-template.md), and an empty dated `process-notes.md`.
   - **It does: adopt.** Leave every section it has in place, and create `changelog.md` and
     `process-notes.md` only if they are missing. The adopted `idea.md` may gain two things it
     lacks: the `**Ticket:**` line, since an adopted `idea.md` is the ordinary cross-session case
     and exactly where the ticket goes missing, and `## Architecture`, drafted below.

   **Then write the `**Ticket:**` line step 1 settled, on the init path and the adopt path
   alike.** It carries the ticket's `scratch/issues/{slug}.md` path, then each path the sweep
   added, every one backticked and comma-separated on the one line, directly under `**History:**`
   in the template's exact position and shape — that is what `/implement-code` reads to find the
   tickets and `/close-issue` reads to close them, and there is no flag and no second line. When
   step 1 settled no ticket and the sweep added none, drop the line.

   Draft `## Architecture` and its `### Agent judgments` on step 1's lens, from step 1's read,
   `## Problem`, and the epic `idea.md` cites, if any, with no scoping exchange with the user
   first. Its first sentence names the lens. When that epic has an `## Architecture` flowchart,
   open the draft with it, rewritten to the system as it stands after this build
   ([`design-record`](../design-record/SKILL.md) § Diagram rules). Every call you make that
   no ruling decided goes on the judgments list; on "you pick", the lens choice is its first entry. The signals tier
   (see `## Contracts & Acceptance` below) is its own entry, starting `Signals tier:`. If an adopted
   `idea.md` already has `## Architecture`, keep it as it stands and skip the draft; the gate
   still runs on it.

   **The gate.** Run the review loop ([review-loop.md](review-loop.md)) on `## Architecture`. When it exits, load
   `interview-methodology` and send the user one short message: the shape in a few sentences,
   the `### Agent judgments` list, the agent-owned fixes in plain language, a line saying the
   ticket was recovered when step 1 recovered it, and only the questions you cannot decide: the
   loop's held questions. If the request describes several independent subsystems and
   no epic in `scratch/issues/` sits behind it, say so in one line of that message and offer
   `/discovery` first. The user vetoes; they do not approve. A judgment
   they leave alone stands.

   **Done when** the gate's loop has exited, that message is sent, and `process-notes.md` has
   one dated line with the minutes spent drafting `## Architecture` (0 when an adopted section
   was kept), the minutes the gate's first review took, and the minutes its re-checks took.

3. **The dialogue.** Use `interview-methodology`'s option-batch protocol for the Scope and Taste
   calls the design leaves open, and for any call a kept call keeps or the Conflict or Undo test
   sends to the user; a settled or agent call goes on `### Agent judgments` for the user to veto.
   Owner: user-decision-rubric (tests). Propose alternatives when the conversation calls for them, not as a required step.
   Each round walks `## Architecture` top down. Update `idea.md` inline as each decision lands:
   you hold the reasoning, so you make the edit (`## Authorship`). Re-read the file from disk
   before every write, since the user may have edited it between rounds; edit only the part the
   ruling bears on, never the whole section; and report each change in plain language. Record
   the user's own wording in the decision line, never a paraphrase, and log the ruling, its
   evidence and the alternatives in `changelog.md` in the same pass. A ruling on an agent
   judgment moves it off the judgments list and into a `## Decisions` line, numbered after the
   highest `D{n}` already in the file.

   Before you write a ruling, check it twice. When the user's stated reason argues for a
   different option than the one they picked, re-ask the same question with `v2` appended to
   its label (OQ-3 becomes OQ-3v2), naming the mismatch between the reason and the pick,
   instead of recording the letter. When the ruling depends on a question still open, or would
   break a `## Decisions` line or agent judgment it touches, hold it until that question is
   answered, or ask the conflict as its own question in the next batch.

   Fill the remaining sections as they become clear: Scope, Contracts & Acceptance
   (`## Contracts & Acceptance` below), Risks, Failure Modes, Implementation Notes, Must Not
   Appear. Scale each to its complexity. Apply YAGNI: carry only what the stated problem
   requires. When you fill `### Signals` and the design declares a signal read outside the
   diff, read the observability record through its `CLAUDE.md` line; that signal's entry names
   the record's path and the production read path the record gives, so the coder takes the
   read path from `idea.md`.

   **Done when** every decision reached has a `## Decisions` line in `idea.md` and a dated entry in
   `changelog.md`, and `## Open Questions` is empty: the build executes decisions, it does not
   discover them. An open question that cannot be closed is closed as out of scope with a
   reason, or the design waits.

4. **The closing review.** Run the review loop on the finished document. When it exits
   with held questions, send them as one batch under `interview-methodology`, then branch on the
   answers:

   - **A ruling changed `idea.md`** → apply it as step 3 does, and when that batch is final
     return here: each return to step 4 is a new review point, and its loop starts from the
     first pass with the fix count at 0.
   - **No ruling changed `idea.md`** ("my ruling stands" on every question), or the loop held
     none → step 5.

   **Done when** the last loop exited with no held question, or with every answer changing
   nothing, and the dated idea-loop entry in `process-notes.md` carries what each reviewer
   caught and what it missed, and one line for every review run in this flow, the gate's
   included ([review-loop.md](review-loop.md)). With step 2's timing line, those lines are what
   `design-review-methodology`'s kill conditions are judged on.

5. **Ingest drift.** Load `knowledge-capture` via the Skill tool and follow § Boundary Ingest on
   `scratch/{project}/learned/` with type `drift`. Every other capture stays `captured` for the
   build's end ingest. Exactly one outcome applies: no drift pending, refused or failed, the
   ingestor ran, or it ran and its snapshot aborted. Each outcome's handling and done-condition
   are in [ingest-drift.md](ingest-drift.md); read the one that applies before going on.

   **Done when** the outcome that applied meets its done-condition there.

6. **The user reviews.** Flip `idea.md` status to `Complete` inline, then:

   > Idea doc ready for review at `scratch/{project}/idea.md`. Review the changes with
   > `git -C scratch diff`. Once you're happy with it, I'll start the build.

   Owner: user-decision-rubric `design-approval`

   When an ingest in this flow wrote pages, the prompt also names `git diff -- .claude/skills/`
   beside `git -C scratch diff`: wiki pages live in the parent repo, so the scratch diff alone
   hides them.

   Changes requested loop back to step 3 for the decisions they touch, then step 4, whose review
   loop runs from the first pass on the changed document, then step 5, then this step again.
   Step 5 dispatches nothing when no new drift was captured.

7. **Build.** On approval, when this flow's ingests and their proposal runs produced a non-empty
   wiki-path set, commit every such set as `knowledge-capture` § Boundary Ingest's commit of the
   wiki-path set says, on a lane and off.

   Pages an aborted ingest wrote yield no set and get no commit here, and step 5 has already told
   the user they stay in the working tree to commit by hand.
   Then the build point: with no lane branch checked out, run `lane-methodology` § When a lane
   opens, loading that skill for it; it offers the rest of the uncommitted pre-work as one base
   commit, then opens or offers the lane, as the repo's lane line says. On a lane already, go on.
   Then invoke `/implement-code {project}` via the Skill tool whether or not the user committed:
   a declined commit is recorded by `/implement-code` Step 1 as pre-build state. That is the
   only exit: no spec, and no implementation skill invoked from inside this flow.

The control graph, with every loop-back edge, is drawn in [process-flow.md](process-flow.md).

## The review loop

Every review point, step 2's gate and step 4's closing review, runs the loop in [review-loop.md](review-loop.md): its passes, the fix cap, `{ITER}`, the process-notes line per pass, and how each finding routes. Read it at the first review point.

## Contracts & Acceptance

What `idea.md`'s `## Contracts & Acceptance` carries (interface contracts, acceptance outcomes, the tests, `### Signals`), how signals scale with the `Signals tier:` judgment, and the observability record are in [contracts-and-acceptance.md](contracts-and-acceptance.md); read it before drafting the signals tier in step 2 and before filling that section in step 3.

## Authorship

**The author of an artifact applies its fixes.** Main holds the reasoning behind every
ruling in `idea.md`, so main edits it inline: decision lines, scope, fix applications, the
status flip. There is no per-edit sub-agent: a delegated edit's author lacks the rulings behind the text,
and that is where cross-reference breaks come from.

**Delegate reads and reviews**: the researcher (bulk reading whose product is a summary) and
the two reviewers (a reviewer that has seen the argument for a decision reviews the argument
instead of the artifact). Reviewers hold Read/Grep/Glob/Skill/Bash(git-only) plus
`mcp__scratch-memory__write_review`, no Write or Edit; keep those lists exactly that narrow.

## The three files

```
scratch/{project}/
├── idea.md            # the current design — binding; the plan
├── changelog.md       # how it got here — append-only, dated
├── process-notes.md   # how the pipeline behaved — append-only, dated, main's only
└── reviews/idea/      # MCP-written reviewer verdicts
```

`scratch/` is its own git subrepo; the parent's pre-commit hook blocks it. Commit inside it
when the user asks (`/commit-all` walks it).

### `idea.md` states what the design is, never how it came to be

A living document, updated when a decision lands, a question surfaces, scope moves, a risk is
found. When a decision changes, **replace** the text; the superseded text goes to
`changelog.md`. Every sentence in the present tense, as though the design had always said
this.

None of this belongs in `idea.md`: dates on design statements; quotations of the user or a
reviewer; *previously*, *originally*, *revised to*, *superseded*, *no longer*; an
alternatives column in Decisions; a rationale that argues against a discarded option instead
of saying why the chosen one holds. A design that carries its own history stays consistent
sentence by sentence and incoherent as a whole.

`## Decisions` and `## Contracts & Acceptance` are what the coder and the reviewers treat as
the contract. `## Implementation Notes` is where anything the build needs that the design
should not argue goes: a reviewer's non-blocking note, a trap, a seam. `## Must Not Appear`
lists literal strings the build must not introduce; the lead greps every checkpoint for them.

### `changelog.md`

The ruling in the user's own words, the evidence, the alternatives, and the replaced text.
Writers put the *why* beside every edit; this file is where that goes.

### `process-notes.md`

How the pipeline behaved: what a reviewer caught or missed, what a dispatch cost. This
skill's entry is the idea-loop exit; `/implement-code` appends the build's. Never ingested
into a wiki.
