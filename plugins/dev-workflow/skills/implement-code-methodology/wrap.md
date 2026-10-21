# Implement Code — Wrap

Step 6 of `/implement-code`, reached from [SKILL.md](SKILL.md) Step 5. `BASE`, the project and every other name below are the ones `SKILL.md` bound.

## Step 6: Wrap

**6a. Append the wrap to `process-notes.md`:** lead rotations and their token counts, coder rotations (from the `Coder:` lines), escalations and rulings, fix turns (the `k` on the last `end` or `fix` return; it counts the whole build, so never sum the returns), each fix turn or escalation whose cause traces to a contradiction inside `idea.md` with the two sections named, the `Signals:` line verbatim from the last lead return that carried one, anything about the pipeline worth a retrospective. "Nothing to note" is valid.

**6b. Find the build's tickets**, only when `idea.md` carries a `**Ticket:**` line. Take the paths with:

```bash
grep -m1 '^\*\*Ticket:\*\*' scratch/{project}/idea.md | grep -o 'scratch/issues/[^`]*\.md'
```

It prints one path per ticket, the build's own first, then those that rode along. Each path is repo-relative: resolve it from the repository root, not from `scratch/{project}/`. No output means no ticket — go to **the missing-ticket check** below.

**Leave every ticket open:** their close is `/close-issue` on the first, once 6e's findings are settled and the build is committed, so each Resolution cites what finally shipped; on a lane, `/end-lane` closes them. 6c names them; you edit no issue here.

**The missing-ticket check.** No `**Ticket:**` line can mean one was filed and lost between `/discovery` and `/brainstorming`, and this is the last moment that is knowable. Two cases:

- **The invoking prose named no epic slug.** Say nothing, run nothing, and move on.
- **It named one.** Ask that epic what it still has open:

```bash
scratch-memory epics graph {epic-slug} --json \
  | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).build.flat().filter(m=>m.status==='open').map(m=>'scratch/issues/'+m.slug+'.md').join('\n')"
```

  Nothing back: say nothing. One or more: name them by path in one line, as work this build may have shipped against and left open, and **close none of them**. A missing `**Ticket:**` line means you do not know which issue this build was, so closing a guess closes work that did not ship.

**6c. Display the summary:**

```
Build complete: {PROJECT}
Checkpoints: {n} since {BASE short}   Lead rotations: {N}   Coder rotations: {N}
Wave: {APPROVED after k fix turns | security pass skipped — no code changed}; UX pass: {newest ux-iter* status | none — no page file}
Escalations: {N} ({one line each}, or "none")
Run card: scratch/{project}/run-card.md   Verdicts: scratch/{project}/steps/step-00/
Ticket: {every path 6b printed, in its order, each as scratch/issues/{slug}.md (open), comma-separated | none | none — {n} open in {epic-slug}: {paths}}
Uncommitted: the whole build — review with `git diff {BASE short}`, commit with /commit-all.
Uncommitted in {root}: {n} wiki pages the build's ingest wrote there — commit them in that repo with /commit
Next: once 6e's findings are settled, /commit-all, then /close-issue {first ticket's slug} {project}
```

Print one `Uncommitted in` line per registered repo root named in the `repo-page` fences of this build's `ingest.md` sections, chosen as in `SKILL.md` Step 5, with its pages listed beneath it; drop the line when those fences hold only `none`, `not measured` or `unknown`. `/commit-all` in this repo never reaches them, so without the line they stay behind in that repo's working tree.

Off a lane print `Uncommitted:`; on a lane print `Lane: {branch}, committed; /end-lane lands it`. Drop `Next:` on a lane or with no ticket.

**6d. The capture offer, one line:** anything in `process-notes.md` for this build worth filing — name it, or say there is nothing. Sort each item as a **fix** for code broken today or **new functionality**. Before offering any item as a new file, apply `scratch-issues-methodology` `issue-standard.md` `## Admission`, its duplicate search included: an item that matches an open or deferred issue is offered as a proposed addition to it, printed as `Matches: scratch/issues/{slug}.md — propose adding: {one line}`, never as a new file. Nothing is written to `scratch/issues/` without the user accepting that item.

- **The first ticket carries `epic:`.** File each accepted fix with `mcp__scratch-memory__write_issue` directly (`/capture-issue` does not carry `epic:`), copying that ticket's `epic:` value verbatim, and `blocked_by` only where the edge is plain from what you know now; the groom wires the rest. Log each as a `Filed: scratch/issues/{slug}.md` line under the wrap in `process-notes.md`. File no new functionality: log each accepted item as a `Pushed out: {one-line description}` line beside the `Filed:` lines.
- **It carries none.** No epic holds the work, so offer each accepted item, fix or new functionality, for `/capture-issue`.

The groom depends on these lines, so the `Next:` commands are run after this offer is answered.

**6e. The verify pass**, only when the build changed primitives. From `git diff --name-only {BASE}` plus `git status --short`, run `/verify-agent` on each changed `.claude/agents/*.md`, `/verify-skill` on each `.claude/skills/*/SKILL.md`, `/verify-command` on each `.claude/commands/*.md`, and parse each changed `plugin-manifests/*.json` as JSON. Report each result in one line; findings here are the user's to act on, not another fix turn.

**6f. The proposal offer, last**, only when a lead return this build, as logged in `process-notes.md`, carried an `Ingest:` line ending `proposal in ingest.md`. Take the blocks from the `proposal` fences of this build's `ingest.md` sections, chosen as in `SKILL.md` Step 5, skipping any that read `none`, and run `/ingest` Step 3 on them, proposal wrap included, with three differences:
- the run's captures are read from each block's own section, with this build's `Build start:` time as the `ingested-at` lower bound (`### Proposal disposition`);
- introduce a block opening `Restructure:` as follow-up work beyond this build, reshaping a wiki subject rather than finishing the build;
- the wrap's snapshots are taken under `{project}`: print a `refused:` line and run nothing, relay the return, and print step 4's `other` paths under `SKILL.md` Step 5's `Written by the ingest, not wiki pages: …` question, or an `aborted:` line as the snapshot aborting.

On a lane, commit as `/ingest` Step 3 says; off a lane, offer no commit. Append each `### Proposal disposition` subsection as `/ingest` Step 3 does, one per section the blocks came from. This sub-step is last because a question the wrap asks in response text ends the turn.

The build ends here.
