# Wrap-up in Lane Scope

Companion to [SKILL.md](SKILL.md), read only by `/end-lane` § 2.

`/end-lane` § 2 runs the wrap-up on a lane, unattended, reading this page in place of the user's
turns. `{lane}`, `{fork}`, `{branch}` and `{scratch_fork}` come from the lane record, as do the
lane's extra repos: its `extras:` key, comma-separated `{path}:{base}:{fork sha}` entries, each a
git repo at `{path}` with its own commit range `{fork sha}..{branch}`. Every stage
runs as SKILL.md gives, with these differences:

- **Invocation.** Skip the open-lane stop: the open lane is the one `/end-lane` is ending.
- **Inputs.** Each dispatch's `{LANE}` line names the record and the lane's commit range, with
  each extra repo's path and range beside it. The
  lane's `learned/` captures, every `scratch/*/learned/` file changed in `{scratch_fork}..HEAD`, are
  filed by stage 8's boundary ingest beside the harvest's own. With `workstream: none`, stages 2 to
  7 have no folder to read: run the boundary ingest and stop.
- **Workstream-only parts** — stage 2's groom, every `task` and `question` item, stage 8's final
  session file and stage 10 — run only when `/end-lane` § 2.3 closes the workstream with the lane.
  Otherwise stage 2 writes the empty `{W}groom-done` marker and does nothing else.
- **Stage 1.** Probe and write `{W}destinations.md` with no question; a registered repo's
  destination is outside the lane, so stages 8 and 9 leave its items unlanded; `/end-lane` § 4
  lists them for veto (Owner: user-decision-rubric (test: Undo)) and § 6.2 lands the rest after
  `accept-and-merge`.
- **Stage 3.** When the workstream closes with the lane, collect as above; otherwise
  `scratch-memory wrap collect 'scratch/S-{session_id}/' --since-ref {scratch_fork}`, then drop
  its `task` and `question` items from `{W}items.json`.
- **Stage 6.** Paths the boundary diff reports open the merge review's veto list rather than
  stopping.
- **Stage 7.** No turn with the user: rule each `decision:` by `user-decision-rubric`, writing the
  ruling and `ruled: agent`. A close, a new issue and a scope rewrite are applied by stage 8 and
  listed, numbered, for the merge review's veto. An issue already settled — `/groom-lane` closed it
  first — gets no second close: its item lands `none`, naming that close.
- **Stage 8.** Lands on the lane branches; a close runs `issue-groom-methodology` § Entry: /close-issue, the
  entry and never the command, with its promotion, as on a lane it is applied for veto. Add a `## Log` line to the lane record per destination landed.
- **Stage 9.** No approval: commit on the lane branches by `lane-methodology` § Scratch commit, and
  path-scoped in the code repo or, for a path inside one, in that extra repo with `git -C {path}`,
  each close with its promotion as commits of its own, a scratch
  commit and the code commit of its wiki pages (`issue-groom-methodology` `promote.md` § Write), so
  a veto reverts it alone. Record each commit of wiki pages, the stage 8 ingest's included, in the
  lane record's `## Decisions made`, as `knowledge-capture` § Boundary Ingest's on-lane commit does.
- **Stage 10.** No separate go-ahead: the merge review shows "workstream closes" for veto. Steps 1 to
  3 run on the scratch lane branch, so the archive rides the approved merge. While a registered
  repo's item is unlanded, stage 10 waits for `/end-lane` § 6.2, which runs it after landing them.
