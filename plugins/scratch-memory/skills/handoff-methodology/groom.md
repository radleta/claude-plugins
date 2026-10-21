# Groom

Companion to [SKILL.md](SKILL.md): the procedure the groom sub-agent follows to bring one workstream's tasks up to the current task methodology. `/groom <session_id>` dispatches the `employee` agent with this page and the workstream folder; nothing else runs it. The rules it applies live in [tasks-methodology.md](tasks-methodology.md) and are not restated here. A broken or stale `HANDOFF.md` pointer is not groom's job — see [legacy-and-recovery.md](legacy-and-recovery.md).

## When to run

- `/pickup` printed a version `GROOM:` line (`task methodology v… is newer than this workstream's …`).
- `/pickup` printed a data `GROOM:` line (`<N> task data problem(s)`).
- The user asks for a groom of a legacy, aged, or active workstream.

## Write limits

Groom writes only three things: files under `scratch/S-{id}/tasks/` — new tasks through `mcp__scratch-memory__write_task`, existing tasks through `scratch-memory tasks done` to set `done`, and otherwise only through the Edit tool, one file per call and never through another script or shell write, because the `scratch-lint.sh` hook sees only Edit and Write, with `updated:` bumped to a full ISO UTC timestamp of now — the marker, through `scratch-memory session mark-groomed 'scratch/S-{id}/'`; and question closes, only through `scratch-memory session close`, which appends to the ledger `scratch/S-{id}/groom-closes.md` and regenerates `HANDOFF.md`. Session files, git, and every other path stay read-only. Every task change is an unattended edit from the methodology; a user-only edit goes on the recommended list instead.

A name read from disk reaches a command only after it matches its pattern: a task or question id `^[qt]-[0-9a-f]{6}$`, a task file name `^t-[0-9a-f]{6}-[A-Za-z0-9._-]+\.md$`. A file name arrives by a pull as well as from `write_task`, and one carrying `'` closes the single quotes around it. A task whose file name does not match gets no command: leave it as it is and name it under part 1 of the return as skipped.

## Procedure

1. **Load the rules.** Read `tasks-methodology.md` in full.
2. **Take the baseline.** Note the run's start time, `date -u +%Y-%m-%dT%H:%M:%SZ`. Run `scratch-memory session lint 'scratch/S-{id}/'` and `scratch-memory cat-sessions 'scratch/S-{id}/' --format json --with-tasks`. If Bash saved the `cat-sessions` output to a file behind a preview, read the whole file before continuing. Read every task file. Grep `sessions/` for each task id. Read an artifact, or a session passage beyond those hits, only when a later step needs it as evidence for a specific call.
3. **Backfill `Done when:`.** Give every `open` or `blocked` task lacking it a `Done when: <one observable state>` line, as [Done when](tasks-methodology.md#done-when) and [Edit permissions](tasks-methodology.md#edit-permissions) say.
4. **Close answered tasks.** Set `done` on an `open` or `blocked` task only when its `Done when:` state is already met, with `scratch-memory tasks done 'scratch/S-{id}/' t-<6hex> --note '<evidence>'`, writing each `'` in the note as `'\''` so the single quotes stay closed, the note citing the evidence: a session file and the line that shows it, or a command and its output.
5. **Convert the question backlog.** Sort every entry in `still_open_questions` by [Questions versus tasks](tasks-methodology.md#questions-versus-tasks) and apply the outcome each entry sorts to, creating any task after the dedupe rules. A row that sorts to moot, a recorded decision or a heading that introduces a list, closes with `--kind moot`, citing its raising session file and quoting the row. A row an open issue already owes closes with `--kind tracked`, citing the issue's path and quoting the line that owes it. A defect or a feature row stays open, since groom files no issue: name it under part 4 of the return as one to file with `/capture-issue`. Write each close against a task to the ledger as a tracked close: first add the `Waits on q-<6hex>: <the question>` line to the task's body when it is missing, then run the command below with the task's title in the heredoc, whose quoted delimiter keeps the title away from the shell. `{run}` is the start time from step 2, the same on every close of this groom, and exit 1 means nothing was written.

   ```bash
   scratch-memory session close 'scratch/S-{id}/' q-<6hex> --kind tracked --cite 'tasks/t-<6hex>-<slug>.md' --quote-file - --event groom --run {run} <<'QUOTE'
   <the task's title>
   QUOTE
   ```
6. **Add missing tasks.** Create a task for each owed item in the session history that passes the task test and the dedupe rules.
7. **Fix the remaining findings.** Resolve each other `session lint` finding with an unattended edit when the evidence names the fix, such as the gate for a `blocked` task with no `blocked_on`. Put every finding that needs a user-only edit, such as a `promoted_to` naming a deleted issue, on the recommended list. A `question-shape:` line is a warning, not a finding: session files are read-only, so it gets no edit and goes on no list.
8. **Record and re-check.** Run `scratch-memory session mark-groomed 'scratch/S-{id}/'`, then `scratch-memory session lint 'scratch/S-{id}/'` last.

**Done when:** the final `session lint` reports no `version-behind` finding and no `missing-done-when` finding but on a task skipped for its file name, and every other finding it still reports appears on the recommended list.

## Return

Return exactly these four parts, in order:

1. **Task ids** — created, edited, and closed, one line each, `none` for an empty list; then any file skipped for its name.
2. **`session lint` output** — the final run, verbatim, with its exit code.
3. **Question closes written to the ledger** — the lines `session close` printed in step 5, verbatim, or `none`.
4. **Recommended user-only edits** — a numbered list; each item names every task file the edit touches by its path, `scratch/S-{id}/tasks/t-<6hex>-<slug>.md` (a merge names each file it joins; a split names the original), and the exact edit (`status: dropped`, `promoted_to: <slug>`, strike part N, merge into `t-…`, split into two tasks, re-create a dropped item), with one line of evidence.
