# Keeping the Epic Current

The epic states the current route: every section says what holds now, and git history holds how it
got there. Every write to an epic body, from `discovery` or from a groom, follows these rules.

- **`## Decisions` states the current decision, in the present tense,** one line each in the
  shape [`design-record`](../design-record/SKILL.md) gives. A decision that changes has
  its line rewritten, and git history holds the old wording. The rewritten line replaces the old
  one; no `Superseded`, `Amended` or dated revision note is added beside it.
- **The current line names what it replaced in one clause, `not X, because Y`,** when the rejected
  option came from a settled spike, or was proposed and rejected in the conversation that made the
  decision. A settled spike's slug goes in that clause.
- **Every settled spike's slug survives a rewrite or a removal.** Each slug the old lines carried
  lands on the current line, as its source or inside its `not X` clause. A line proposed for
  removal moves its slugs onto the current line they bear on, or stays. The session-end lint reads
  these slugs, and a dropped one turns it red.
- **A decision that binds only one open member is written on that member**, as a decision line
  under its `## Decisions` section, which sits after `## Related` and before `## Notes` and is added
  the first time one is written; when the member has an `idea.md`, the line names the change its
  `/brainstorming` must take up. The epic keeps the decisions that bind the route or more than one
  member, and every settled spike's line. Build-level detail that is not a decision is a `## Notes`
  bullet on the member it bears on.
- **Closed members stay as they closed.** A member at any status but `open` or `deferred` is never
  edited to reflect a later decision; the epic is the current record.
- **`## Architecture` is current state too.** When a decision moves a part or a seam, the
  flowchart is rewritten in place, with no before/after half and no note of the old shape.
- **Once `## Decisions` holds more than 15 lines, group it under `###` subject headings** named for
  what the decisions are about, so a change lands beside the line it replaces. A `##` heading would
  end the section for the lint and the explorer.
- **`## Outcomes` lists the conditions that must be true for the Destination to be reached, one
  line each, as they stand now.** An unticked line is
  `- [ ] <outcome>. Not built: <what the code lacks today>.` A ticked line is
  `- [x] <outcome> (ticket-slug, commit)`, its not-built clause dropped. Like `## Decisions`, the
  section states what holds now and git history holds the rest: add a line when a decision makes
  a new condition statable, and rewrite, merge or split lines in place when a decision changes
  what reaching the Destination consists of, with no dated note and no trace of the old wording.
- **A line leaves `## Outcomes` only by merging into another line or by the user ruling it out**,
  which moves it to `## Out of Scope` with the reason. Owner: user-decision-rubric `corpus-calls`
- **The not-built clause states what the code lacks today, in the present tense.** It is where
  decided work that is not filed lives. It names the gap and nothing more: the breakdown gate
  decides the tickets, their acceptance and their edges from the gaps and the code as it stands
  when it runs.
- **An unticked line names the one open ticket filed to work it**, as a bare slug after the
  outcome: `- [ ] <outcome> (ticket-slug). Not built: <what the code lacks today>.` The breakdown
  gate writes the slug when it files the build, splitting a line first when the build takes only
  part of it or a second build takes the rest. A line no open ticket works carries no slug: when
  its ticket is deferred, or closes without delivering it, remove the slug and leave the line
  unticked. The slug is the whole reference: no status and no count beside it.
- **A line is ticked when its condition is met.** At the close of the ticket that delivered it,
  rewrite the outcome to state what was delivered, and tick it with that ticket's slug and the
  short sha of the newest commit its `## Resolution` cites. What the ticket left undone joins an
  unticked line it fits, which is the agent's call (Owner: agent (user-decision-rubric)); when none
  fits, it becomes a new unticked line or moves to `## Out of Scope`, and the user rules on which
  (Owner: user-decision-rubric `corpus-calls`). The rewrite drops nothing that has not landed in
  one of the three.
  A condition met with no build ticket is ticked with what proves it: `(spike-slug)` for one a
  spike met, `(in code)` for one the code already met when the line was written.
- **A ticked line says its condition is met today.** When a later decision rewords a condition
  that is still met, rewrite the line and keep the tick. When a reversal or a regression leaves
  it unmet, rewrite it as an unticked line with its not-built clause, its old slug and commit
  removed.
- **An epic with no `## Outcomes` section gets one at the first write that would touch it.**
  Propose the section from its `## Destination` and `## Decisions`, and propose moving each piece
  of decided work its `## Not Yet Specified` holds into the outcome it serves; the user rules on
  both before any other outcome edit. Owner: user-decision-rubric `corpus-calls`
- **Order is written once, as a `## Decisions` line, and only where a forcing condition makes one
  piece of work wait on another** (`scratch-issues-methodology` `issue-standard.md` `## Folding`).
  Outcome lines carry no order, and filed tickets carry theirs as `blocked_by` edges.
- **The epic file holds the epic's whole current state; `scratch/E-{epic-slug}/` is the store
  behind it.** An artifact specific to the epic that is too large for a line goes there as a
  file: evidence, a table, a folded ticket's investigation. Link each file from the epic line it
  supports, by path, or from `## Related` when it supports no single line. A reader opens a file
  by following its link; the folder is never read on its own, and an epic with no such artifact
  has no folder.
- **A fact a builder needs is a `## Decisions` line when it binds the route or more than one
  member**, a `## Decisions` line on the member when it is a decision binding that one member, as
  above, and otherwise a `## Notes` bullet on that member. One that is true of the shipped code
  and outlives the epic goes to the wiki as a `knowledge-capture` capture.
- **A slug that no longer names a file leaves the epic body.** When a ticket is folded into the
  epic and its file removed, record it in `scratch/E-{epic-slug}/folded-slugs.md`, one table of
  old slug and the outcome that took its content, linked from `## Related`.

Three sessions moved one decision. Appended, they left three lines, and an agent reading the first
acts on a dead decision:

```markdown
- cache-location-spike: the cache lives in the request handler
- Amended 2026-03-02: the cache moves to the service layer (cache-invalidation-spike)
- Superseded: the cache now lives in the shared store
```

Kept current, they are one line, carrying both slugs:

```markdown
- The cache lives in the shared store, not the request handler (`cache-location-spike`) or the
  service layer (`cache-invalidation-spike`), because the background worker reads it too.
```
