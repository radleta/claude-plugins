# The Lane Record

Contents: Fields · Sections · The lane key · Fold

Companion to [SKILL.md](SKILL.md): the record `L-{lane}/README.md`, the `lane:` key it backs, and
folding an issue into an open lane. The record lives only on the scratch lane branch, and is the
lane's pull request: every piece of work the lane does is written into it.

## Fields

Frontmatter, in this order:

| Key | Value |
|---|---|
| `primary` | the primary issue's slug |
| `folded` | slugs of the issues folded in, comma-separated with no spaces; omitted while there are none |
| `epic` | the epic slug; absent on an epic lane and on a lane with no epic |
| `base` | the code branch the lane forks from and lands on |
| `branch` | the lane branch, the same name in every lane repo |
| `fork` | the code base's commit the lane forked from |
| `scratch_fork` | scratch `main`'s commit the scratch branch forked from; `/end-lane`'s harvest reads from it |
| `extras` | the extra lane repos the lane holds, each `{path}:{base}:{full fork sha}`, comma-separated with no spaces; omitted while there are none |
| `pending` | the extra lane repos listed at `/begin-lane` and absent from the checkout, each `{path}:{base}`, in the same form; omitted while there are none |
| `workstream` | the `S-` slug in flight, the lane name when `/begin-lane` ran `/start {lane}`, or `none` |
| `started` | `YYYY-MM-DD` |
| `state` | `open` or `pr-open` |
| `pr` | the PR URL when `gh` opened it, otherwise the compare URL, never carrying userinfo (`end.md` § PR landing); present only in `pr-open` |

`lane begin` writes the record, and `lane add-repo` moves a repo from `pending` to `extras`
(`SKILL.md` § Lane repos). A path matches `^[A-Za-z0-9._/@+-]+$`, holds no `..` and starts with
neither `/` nor `-`; a base is a branch name with no comma. A reader that does not call `lane`
reads `extras` in that form from `scratch/L-{lane}/README.md`.

## Sections

Body: an H1 `# Lane: {lane}`, one or two sentences of purpose drawn from the primary issue's
summary, then these sections, in this order:

- `## Log` — one dated line per piece of work the lane did: a build, a fix asked for mid-lane, a
  groom, a refresh, a fold, a catch-up resolution, a lane repo `lane add-repo` brought in, and
  `/end-lane`'s closing line. A line is
  `- YYYY-MM-DD: <what> — <paths or sha>`.
- `## Decisions made` — the agent's own calls made outside a build, each with its one-sentence
  reversal; a build's calls live in its run card.
- `## Rulings` — links to the lane's ruling captures and to the upstream issues it filed
  (`user-decision-rubric` § Recording a ruling).
- `## Assets` — every file the lane produced, linked.
- `## Notes` — lane particulars.

```markdown
---
primary: demo-fix
base: main
branch: lane/demo-fix
fork: 3f9a12c0de4b5a6978f0e1d2c3b4a5968778695a
scratch_fork: 8c01de5a6978f0e1d2c3b4a5968778693f9a12c0
workstream: demo-fix
started: 2026-09-29
state: open
---
# Lane: demo-fix

Fix the demo's broken start path.

## Log
- 2026-09-29: Began on main at 3f9a12c — L-demo-fix/README.md

## Decisions made

## Rulings

## Assets

## Notes
```

The closing lines `/end-lane` appends to `## Log`:

- landed: `- YYYY-MM-DD: Closed: lands on {base} at {short sha} by {merge | push | PR {pr}} — L-{lane}/README.md`
- abandoned: `- YYYY-MM-DD: Abandoned: {the user's reason, or "no reason given"}`

## The lane key

`lane:` on an issue in `scratch/issues/` holds a lane name, or `none` on a `role: epic` issue only,
meaning the epic has no branch of its own. It is written by hand edit, on the lane branch.

- **It names the last lane that held the issue.** `/begin-lane` and § Fold write it, overwriting a
  name with no open record; a name whose record is still open stays, and the fold warns. Beginning
  an epic's own lane overwrites that epic's `none`.
- **It is never cleared.** It stays on every issue a lane held after the lane ends, as provenance:
  the held check confirms it against an open record, and a later lane overwrites it.

## Fold

Folding an issue into an open lane happens in conversation, when the user asks; the ask is the
approval for these scratch writes.

1. Bring scratch current by [SKILL.md](SKILL.md) § Scratch commit step 1, then check the issue
   exists and is `open`. A missing or settled issue stops with one line.
2. When another open record holds the issue, warn in one line naming that lane, and go on.
3. Add the slug to the record's `folded`, write `lane: {lane}` on the issue by § The lane key, and
   add a `## Log` line.
4. Commit both files by [SKILL.md](SKILL.md) § Scratch commit.
