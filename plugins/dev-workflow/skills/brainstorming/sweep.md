# Step 1.4 — The sweep

Nearby open issues ride in this build rather than waiting for their own. Load
`issue-groom-methodology` and dispatch its comb `intern` (§ The comb prompt) with the settled
ticket as the start ticket, or `none`, the files the read above named as its changed paths, and the
problem as the user stated it, with the settled ticket's `## Summary` when there is one, in place of
what landed. `idea.md` does not exist until step 2, so nothing here reads it. A comb that returns
`none` asks nothing.

Its candidates carry two kinds of call:

- **Joins.** Each open or deferred candidate that carries no `role:` (`/close-issue` refuses an
  epic or a spike), proposed to join the `**Ticket:**` line, with the overlap that puts it there. A
  join pulls work into this build, so it is asked on a lane and off.
  Owner: user-decision-rubric (test: Scope)
- **Determinations.** For each candidate not joining, any merge or obsolete close
  `scratch-issues-methodology` `issue-standard.md` `## Determinations` gives for it.
  Owner: user-decision-rubric `corpus-calls`

Put them as `issue-groom-methodology` § The procedure step 6 does:

- **On a lane** (`lane-methodology` § Claim): put the joins to the user as one numbered question.
  Apply each determination on the lane's scratch branch and commit it by `lane-methodology`
  § Scratch commit as a commit of its own, so a veto reverts it alone; report them numbered, each
  with its issue path, its edit, one line of evidence and its commit, and record each with its
  commit in the lane record's `## Decisions made`, which the merge review shows.
- **Off a lane:** put joins and determinations to the user as one numbered list, each naming the
  issue path, the exact edit and one line of evidence. The last item is the scratch commit, by
  path, of every file the determinations change. Apply only what the user approves.

Each issue that joins goes on the line after the settled ticket, in the order ruled; with no
settled ticket, the first one ruled in is the build's own. Run `/refresh-issue {slug}` on each as
it joins. Apply a determination as `issue-standard.md` gives, a close being
`issue-groom-methodology` § Entry: /close-issue's close proposal alone.
