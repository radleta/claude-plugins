# Boundary Groom

Contents: Steps · The veto list · Undo · Per event

Companion to [SKILL.md](SKILL.md): the one normative copy of the event groom a workflow runs at its boundary, `/pickup` before it builds the brief, `/end-lane` before it commits uncommitted lane work, and `/close-issue` after its close entry returns. Each points here in one line. The groomer's own side is [event-groom.md](event-groom.md).

**Input:** the workstream path, `scratch/S-{id}/`, and the event: `pickup`, `end-lane` or `close-issue`. [Per event](#per-event) says where each caller gets the path and when it runs nothing. Run every command from the repository root.

The groom makes no fetch, merge, commit or push, at any event, and it reads scratch as it stands. It cancels no event, and nothing below asks the user anything.

## Steps

1. **Gate.** Check the path yourself before it goes into a command: it matches `^scratch/S-[A-Za-z0-9._-]+/$`. Otherwise run nothing.
2. **Ask what is new.** The verb reads git and the workstream and writes nothing.

   ```bash
   scratch-memory session radius 'scratch/S-{id}/' --json
   ```

   - **Any non-zero exit** — print `Event groom skipped: {the ERROR: line}` and go on with the event, with no groom. A git failure never reads as "nothing new", and never stalls the event.
   - **`pending` is empty** — stop here. Dispatch nothing, print nothing and write nothing: either nothing is newer than the last run's marks, or the new evidence reached no row.
   - **Otherwise** — keep the output for steps 4 and 6.
3. **Snapshot** the two folders the groomer may edit, so a change no returned row names still shows. Keep the path it prints. A folder that does not exist is skipped; any error line it prints means the snapshot is not whole.

   ```bash
   B=$(mktemp) && { for d in 'scratch/S-{id}/tasks' scratch/issues; do [ -d "$d" ] && find "$d" \( -type f -o -type l \) -exec sha1sum {} +; done | LC_ALL=C sort > "${B:?}"; echo "$B"; }
   ```

4. **Dispatch one `workstream-groomer`** and take step 5 next, once its return is in: the wait is on the agent, never on the user. When the call hands back the return, go straight on. When it hands back only a launch notice, the agent is running in the background: end the turn on one line saying the event groom is running, ask nothing, and go on to step 5 when its completion notification arrives. Until then run no later step of the event and edit nothing under `tasks/` or `scratch/issues/`, since step 7 would count that edit as the groomer's. Its prompt is the workstream path on line one, `event: {event}` on line two, then step 2's output verbatim, and nothing else: it reads its own protocol, and a prompt that paraphrases it competes with it. When the dispatch itself fails, because the agent type is not available or the call errors, print `Event groom skipped: {the error}`, remove the snapshot with `rm -f '{B}'`, and go on with the event.
5. **Print the return** exactly as it came back, one line per row. A return whose last line is not a `Run:` line did not complete: print it the same way, then `The event groom did not finish; its marks are unchanged.`
6. **Record a completed run.** Skip this step for a run that did not complete: the closes it wrote stand, so the next event reads the same evidence without those questions.

   ```bash
   scratch-memory session mark-event-groomed 'scratch/S-{id}/' --code '{marks.code}' --scratch '{marks.scratch}' --session '{marks.session}' --remainder '{id=ref,id=ref,…}'
   ```

   The three marks are step 2's, unchanged. The remainder is every `past_cap` entry of step 2's output, as its `id=ref`, then each id on the return's `Remainder:` line with the `ref` its row carries in step 2's output. Leave `--remainder` off when both are empty.

   Check each value yourself before it goes into the command, as step 1 does the path: a session file name comes from a directory listing and a `ref` from `groom.yaml`, and either can arrive by a pull carrying shell text. The two commits match `^[0-9a-f]{7,40}$`, the session name and each `ref` match `^[A-Za-z0-9._-]+$`, and each id matches `^[qt]-[0-9a-f]{6}$`. When one does not, run nothing and print `Event groom marks not recorded: {which value}`; the next event reads the same evidence again.
7. **Compare the snapshot.** With `{B}` the path step 3 printed:

   ```bash
   for d in 'scratch/S-{id}/tasks' scratch/issues; do [ -d "$d" ] && find "$d" \( -type f -o -type l \) -exec sha1sum {} +; done | LC_ALL=C sort | LC_ALL=C comm -3 '{B}' - | awk '{ n = ($0 ~ /^\t/); p = $0; sub(/^\t/, "", p); sub(/^[^ ]+ [ *]/, "", p); if (n) new[p] = 1; else old[p] = 1 } END { for (p in new) print (p in old ? "changed " : "appeared ") p; for (p in old) if (!(p in new)) print "went " p }' | LC_ALL=C sort; rm -f '{B}'
   ```

   It prints one line per path whose content differs from the snapshot, as `changed {path}`, `appeared {path}` or `went {path}`. When step 3 or this command printed an error line, such as a missing `sha1sum` or a folder it could not read, add `Edits with no undo row could not be checked: {the error}` where the veto list goes. A path no returned row names, by its task id, its file or the issue path a `file` row gives, is an **edit with no undo row**.
8. **List what can be vetoed**, as [The veto list](#the-veto-list) gives, then go on with the event. The groomer's changes and `groom.yaml` are from here on this session's own uncommitted work, handled by the rules it already follows; this procedure commits and stages none of it.

**Done when:** the radius ran; and either nothing was dispatched, or the return is printed, a completed run is recorded or an unfinished one is said to be unfinished, and the veto list is where its event puts it.

## The veto list

Each `merge`, `drop`, `rewrite` and `file` row of the return is one numbered item: its row id, its determination, its citation, and what it replaced, copied from the row. A `file` row is an item only when step 7 printed the line `appeared scratch/issues/{name}` for the path it gives; write the item with that path. A `file` row naming any other path is listed as an edit with no undo row. Each edit with no undo row follows, by path. A question close and every other determination are not on the list.

- **`/pickup` and `/close-issue`** — the list is in the reply, under the printed return. With no items, say nothing more.
- **`/end-lane`** — write each item as one line under the lane record's `## Decisions made`, unnumbered, since the merge review numbers that section's groom lines with its other veto items:

  ```
  - Event groom {run}: {determination} {row id} — {citation}; replaced: {what it replaced}
  ```

  The merge review is built from the record and may run in a later session, so the line carries everything an undo needs.

Owner: user-decision-rubric `corpus-calls`

## Undo

A veto is undone from the return's row or the `## Decisions made` line, never by a git restore or revert: an uncommitted task file is often untracked or already edited, and a committed one shares its commit with other work.

| Item | Undo |
|---|---|
| `rewrite` | put the old line back |
| `drop` | restore the task's `status` and `blocked_on` and remove the dated note |
| `merge` | restore each task's `status` and `blocked_on`, and remove the folded lines from the survivor |
| `file` | delete the issue file, only when the item's path matches `^scratch/issues/[A-Za-z0-9._-]+\.md$`, the form [The veto list](#the-veto-list) writes for a file this run created; for a name holding any other character, delete nothing and show the user the path. Either way remove the question's line from `scratch/S-{id}/groom-closes.md`, and run `scratch-memory rewrite-pointer 'scratch/S-{id}/'` |
| a question close the user disputes | remove its line from `scratch/S-{id}/groom-closes.md` and run `scratch-memory rewrite-pointer 'scratch/S-{id}/'`, whether or not a commit already carries the line |
| an edit with no undo row | show the user the path; its earlier content is not in the return |

Each task `Edit` bumps `updated:` to a full ISO UTC timestamp of now.

## Per event

| Event | Workstream | Runs |
|---|---|---|
| `pickup` | the `session_id` `/pickup` resolved | at every `/pickup`, on a lane or off one, before the brief is built, so the brief shows the groomed state |
| `end-lane` | the lane record's `workstream` | only when the argument is not `abandon`, the record reads `state: open`, and the workstream does not close with the lane (the condition `lane-methodology` `end.md` § 2 step 3 tests): `abandon` and a `state: pr-open` resume have no merge review to show a veto list, and a workstream that closes gets the full `/groom` from `wrap-up` |
| `close-issue` | the lane record's `workstream` | once per `/close-issue` command, after the close entry returns, whichever tickets closed |

`/end-lane` and `/close-issue` run the groom only on a lane (`lane-methodology` § Claim) whose record names a workstream: with no lane record, or `workstream: none`, they dispatch nothing. A close reached without the `/close-issue` command, from `/groom-lane`, `/wrap-up`, `code-change` or a refresh, dispatches nothing either, and the next event reads its commits.

On a lane, a `/pickup` or `/close-issue` run's edits stay uncommitted until this session commits their paths itself, or `/end-lane`'s check commits them with the lane's other uncommitted work: a `lane-methodology` § Scratch commit carries only the paths its own step wrote. A later scratch pull or catch-up merge that touches the same files is refused by git, the case § Scratch commit already pauses on.
