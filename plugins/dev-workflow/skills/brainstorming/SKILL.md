---
name: brainstorming
description: "Brainstorm an idea into a binding idea.md design — a researcher read, a clarifying dialogue, the design written as it settles, one read-only review pass, the user's approval, then the build. Use when starting a feature, component, or project that needs a design, or when requirements still need pinning down — even for a change that looks too simple to need a design."
---

# Brainstorming Ideas Into Designs

Turn an idea into a design through dialogue, checked once by read-only reviewer sub-agents
that persist verdicts through the `scratch-memory` MCP. The approved `idea.md` is the
**binding artifact and the plan**: `/implement-code` builds it directly. There is no spec and
no plan corpus in between.

<HARD-GATE priority="CRITICAL">
Present a design and get the user's explicit approval before any implementation action:
writing code, scaffolding a project, or invoking `/implement-code`. This holds for every
project regardless of perceived simplicity.
</HARD-GATE>

## The flow

1. **Read the project first.** Dispatch `researcher` (foreground), if it is available in this
   deployment:

   ```
   Agent({
     subagent_type: "researcher",
     description: "Investigate project context for /brainstorming",
     prompt: "Dispatcher: /brainstorming. Project: {PROJECT_NAME}. Question: What is the top-level structure, key conventions (file layout, naming, build tools), and relevant existing patterns for this project? Focus on what a designer would need to know before proposing new features. Source: brainstorming/research."
   })
   ```

   A return whose first line matches `^CLARIFICATION_REQUIRED:` means the project name could
   not be resolved: ask the user for it rather than guessing. If the agent is unavailable,
   investigate directly with Glob, Grep and Read. If the return ends in a trailer, relay the
   lines its contract requires (`researcher` § Dispatch Contract, Trailer relay); that is the
   only place the user learns a wiki page was written.

   **Done when** the structure, conventions and existing patterns a designer needs are in
   context, and every finding that passes the `knowledge-capture` heuristic is written to
   `scratch/{project}/learned/research-*.md` once step 2 creates the directory.

2. **Init the artifact set.** `mkdir -p scratch/{project}/learned/`, then `idea.md` from
   [idea-template.md](idea-template.md) with Problem and Context seeded from step 1,
   `changelog.md` from [changelog-template.md](changelog-template.md), and an empty dated
   `process-notes.md`. If `idea.md` already exists, adopt it: leave every section it has in
   place and carry on from step 3.

3. **The dialogue.** If the request describes several independent subsystems and no epic in
   `scratch/issues/` sits behind it, say so in one line and offer `/discovery` first; the user
   may decline and carry on. Load `interview-methodology` once and use its option-batch
   protocol for every enumerable choice. Propose alternatives when the conversation calls for
   them, not as a required step. Update `idea.md` inline as each decision lands: you hold the
   reasoning, so you make the edit (`## Authorship`). Record the user's own wording in the
   Decision column, never a paraphrase, and log the ruling, its evidence and the alternatives in
   `changelog.md` in the same pass.

   Fill the remaining sections as they become clear: Scope, Contracts & Acceptance
   (`## Contracts & Acceptance` below), Risks, Failure Modes, Implementation Notes, Must Not
   Appear. Scale each to its complexity. Apply YAGNI: carry only what the stated problem
   requires.

   **Done when** every decision reached has a Decisions row in `idea.md` and a dated entry in
   `changelog.md`, and `## Open Questions` is empty: the build executes decisions, it does not
   discover them. An open question that cannot be closed is closed as out of scope with a
   reason, or the design waits.

4. **One review pass.** Dispatch, in ONE message with parallel Agent calls:
   - `codebase-alignment-reviewer` at `thorough` depth, prompt from
     [codebase-alignment-reviewer-prompt.md](codebase-alignment-reviewer-prompt.md);
   - `domain-reviewer`, one dispatch carrying every relevant expert skill, prompt from
     [domain-reviewer-prompt.md](domain-reviewer-prompt.md), **only when** the design introduces
     technology beyond what the expert skills already loaded in this session cover. When they
     are loaded, their knowledge is already in the design.

   Each returns two lines, `Wrote:` and `Status:`. Read every `ISSUES_FOUND` verdict body; this
   is the one place main reads a verdict. Then:
   - a finding that is a plain inconsistency, obvious once named, you fix inline now, moving
     replaced text to `changelog.md`;
   - a finding that would change a `## Decisions` row, or contradicts what the user said, goes
     to the user as one batch through `interview-methodology`, each with the reviewer's quote,
     its consequence and your recommendation. The user's ruling is terminal.

   No reviewer is re-dispatched after the pass. Tiers: `dispatch-tier-rubric`.

   **Done when** every finding is fixed or ruled on, and a dated idea-loop entry is appended
   to `process-notes.md`: what each reviewer caught, what it missed, whether the domain
   review was dispatched and earned it. "Nothing to note" is a valid entry.

5. **The user reviews.** Flip `idea.md` status to `Complete` inline, then:

   > Idea doc ready for review at `scratch/{project}/idea.md`. Review the changes with
   > `git -C scratch diff`. Once you're happy with it, I'll start the build.

   Changes requested loop back to step 3 for the decisions they touch; a change that touches
   what a reviewer checked gets no second pass, the build's own review catches it.

6. **Build.** On approval, invoke `/implement-code {project}` via the Skill tool. That is the
   only exit: no spec, and no implementation skill invoked from inside this flow.

The control graph, with every loop-back edge, is drawn in [process-flow.md](process-flow.md).

## Contracts & Acceptance

`idea.md` is binding, so its `## Contracts & Acceptance` carries:

- **Interface contracts** between the parts (module boundaries, CLI/API shapes, data formats),
  enough that the coder builds each without re-negotiating the seams.
- **Acceptance outcomes**: for each major deliverable, at least one real-input, end-to-end
  observable behavior ("given this actual payload, this command exits 2 and writes this state
  file"). Grep counts, string-presence checks and exit codes on synthetic input are all
  satisfiable by behaviorally dead code. An outcome that must be seen running in a browser is
  marked `verify-live:`; the coder dispatches `chrome-browser` for that one.
- **The tests the build runs.** Name the commands; they are the build's whole acceptance
  surface. A prose, skill, command or agent deliverable names none, and the coder invents none.

Scale to the work: a trivial component gets one acceptance line.

## Authorship

**The author of an artifact applies its fixes.** Main holds the reasoning behind every
ruling in `idea.md`, so main edits it inline: decision rows, scope, fix applications, the
status flip. There is no per-edit sub-agent. Measured, a delegated fix ran ~170k tokens plus
a verification round against ~8k inline, and every documented cross-reference break came
from a delegated edit whose author lacked the rulings behind the text.

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
