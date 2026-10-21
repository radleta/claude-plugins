---
description: "Groom a workstream's tasks to the current task methodology — dispatch the employee agent against scratch/S-{id}/, then apply its user-only edits, for veto on a lane and on your confirmation off one. Use when /pickup prints a GROOM: line or an aged workstream's tasks need bringing up to date — even for a few tasks."
argument-hint: <session_id>
---

## Step 1 — Argument guard

Parse `$ARGUMENTS` as `{session_id}`. If it is empty, or contains any character outside `[A-Za-z0-9._-]`, surface this error and stop:

```
ERROR: /groom requires a session_id of letters, digits, dots, underscores, or hyphens (e.g. /groom handoff-carry-forward-fixes).
```

Run `Bash("scratch-memory session lint 'scratch/S-{session_id}/'")`. When it exits 1 with an `ERROR:` line on stderr, the workstream folder is missing or outside `scratch/`: surface that line and stop. Any other result, findings included, continues to Step 2.

## Step 2 — Dispatch

Take the write-limit baseline: run `Bash("git status --porcelain")` and `Bash("git -C scratch status --porcelain")`, and keep both outputs.

Launch the `employee` agent with the Agent tool and this prompt, `{session_id}` substituted:

```
Groom the workstream at scratch/S-{session_id}/.
Load the handoff-methodology skill, then Read groom.md in its directory and follow it end to end.
Write limits: create or edit files only under scratch/S-{session_id}/tasks/, run
`scratch-memory session mark-groomed 'scratch/S-{session_id}/'`, and close a question only with
`scratch-memory session close 'scratch/S-{session_id}/' …`, which writes groom-closes.md and
regenerates HANDOFF.md. Every other path is read-only, including sessions/ and git. Make only the unattended edits tasks-methodology.md
allows; list every user-only edit instead of making it.
Return the four parts groom.md's ## Return names, in order.
```

End your turn and wait for the agent's completion notification.

## Step 3 — Present

First check the write limits. Run both `git status --porcelain` commands again. A line absent from its baseline, or whose status code changed, is a path the agent touched; paths in the `git -C scratch` output are relative to `scratch/`. When any touched path lies outside `scratch/S-{session_id}/tasks/` and is not `groom.yaml`, `groom-closes.md` or `HANDOFF.md` in `scratch/S-{session_id}/`, print `WARN: groom changed paths outside its write limits:` and one path per line, before anything else. A path already dirty in the baseline with an unchanged status code is not attributed to the agent, so a further edit to it goes unseen.

Print the agent's four parts as returned. Beside each numbered recommended edit, print every path the item names, resolved; a merge names each file it joins, and a split names only the original. Mark `REJECTED: outside tasks/` on any item where any of those paths is absolute, contains `..`, or does not match `scratch/S-{session_id}/tasks/t-*.md`. When the list is empty, print `No user-only edits recommended.` and stop. Otherwise rule the items Step 3 did not mark `REJECTED`. Owner: user-decision-rubric `corpus-calls`

- **On a lane** (`lane-methodology` § Claim): go on to Step 4 with every item, asking nothing. When the write-limit `WARN` fired, add its paths to the lane record's `## Decisions made` too, so the merge review shows them.
- **Off a lane:** ask the user which numbered recommended edits to apply, as one numbered list whose last item is the scratch commit, by path, of every task file the applied edits change, and end your turn.

## Step 4 — Apply edits

Apply every item on a lane, or only the items the user confirmed off one, that Step 3 did not mark `REJECTED`, touching only the paths Step 3 printed for each, plus, for a split, the one new task file `mcp__scratch-memory__write_task` creates under `scratch/S-{session_id}/tasks/`:

- **A single-task edit** — Edit on its task file.
- **A merge** — Edit on every file the item names.
- **A split** — create the new task with `mcp__scratch-memory__write_task`, its body opening with `Done when:`, then Edit the original to remove the part that moved and note the new id.

Every Edit bumps `updated:` to a full ISO UTC timestamp of now, `YYYY-MM-DDTHH:MM:SS.sssZ`. On a lane, commit each item by `lane-methodology` § Scratch commit as a commit of its own, so a veto reverts it alone; print them numbered, each with its task paths, its edit, one line of evidence and its commit, as applied and open to veto, and record each with its commit in the lane record's `## Decisions made`, which the merge review shows. Off a lane, when the user approved the commit item, commit those task files by `lane-methodology` § Scratch commit. Then run `Bash("scratch-memory session lint 'scratch/S-{session_id}/'")` and print its output.
