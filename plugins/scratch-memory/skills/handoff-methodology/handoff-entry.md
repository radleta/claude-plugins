# /handoff

Contents: Step 1 — Argument guard · Step 1b — Open-question disposition · Step 1c — Tasks lint · Step 1d — Reconcile tasks · Step 2 — Body composition · Step 3 — MCP call · Step 4 — Error handling · Step 5 — Success path · Step 6 — Pointer update (recovery-only)

## Entry: /handoff

`/handoff <session_id>`, or a caller that runs it unattended (`/pause-and-handoff`).

### Step 1 — Argument guard

Parse the argument. If empty or whitespace-only, surface this error and stop:

```
ERROR: /handoff requires a session_id argument (e.g. /handoff handoff-sid-fix).
```

If the argument contains any character outside `[A-Za-z0-9._-]`, surface this error and stop:

```
HANDOFF_INVALID_SESSION_ID: session_id contains characters that are unsafe for shell invocation. Use only letters, digits, dots, underscores, or hyphens (e.g. /handoff my-workstream).
```

Do not proceed to any tool call.

### Step 1b — Open-question disposition

Before composing the body (Step 2), reconcile this session's work against the prior still-open questions.

Run `Bash("scratch-memory cat-sessions 'scratch/S-{session_id}/' --format json --with-tasks")`, single-quoting the path exactly as Step 6 already does; `{session_id}` is the argument, already charset-validated in Step 1, so a literal `'` cannot appear. If Bash saved the output to a file behind a preview, read the whole file before continuing.

**On any non-zero exit**, skip the rest of this step and proceed to Step 2 — a missing prior log must never fail a handoff — but name which exit occurred rather than skipping silently:
- exit 1 → `Step 1b: cat-sessions exited 1 — no prior log; skipping disposition.`
- exit 2 → `Step 1b: cat-sessions exited 2 (infra) — skipping disposition; investigate before the next handoff.`
- any other non-zero → use the exit-2 wording, naming the observed code.

**On exit 0**, walk the JSON payload's `still_open_questions` array and apply this table to each entry `Q`, collecting the resulting lines for `## Open questions resolved` when Step 2 composes the body:

| Answered this session | Moot this session | `Q.id` usable | Line to author |
|---|---|---|---|
| yes | — | yes | `q-<id> → RESOLVED: <answer>` |
| yes | — | no | `<question kernel verbatim> → RESOLVED: <answer>` |
| no | yes | yes | `q-<id> → RESOLVED: closed — <reason>` |
| no | yes | no | `<question kernel verbatim> → RESOLVED: closed — <reason>` |
| no | no | — | *(no line — still open; carry-forward is automatic, author nothing)* |

**Acknowledging without resolving:** a question that was reviewed this session but deliberately left open (not answered, not moot) may optionally be recorded as `q-<id> → STILL OPEN — <note>` (or the kernel-verbatim form: `<question kernel verbatim> → STILL OPEN — <note>`). This is never treated as a resolution and never resets the question's age — it distinguishes "reviewed and consciously left open" from a question nobody looked at this session. Carry-forward remains automatic either way; this line is optional authorship, not a requirement.

`<question kernel verbatim>` means: copy `Q.text` from its start up to and including its first `?`; if the text has no `?`, copy the whole kernel. Never append a `?` of your own — an imperative kernel has none, and appending one produces a string that won't match on the next read, silently reopening the question you meant to close.

**Never restate a carried-forward question in `## Open questions raised`** — that section is a per-session delta of genuinely new questions only. Restating a carried question there re-raises it and resets its age. Carrying forward is automatic and requires no authoring.

Keep the payload's `tasks` array for Step 1d. When a question this table answers or marks moot is an action offer, Step 1d decides its line instead.

This step is read-only: it runs one `cat-sessions` invocation and writes nothing. Task writes happen in Step 1d and the session write in Step 3.

### Step 1c — Tasks lint

Before composing the body (Step 2), run a last lint pass over the workstream's task backlog (spec T9 layer 3).

Run `Bash("scratch-memory tasks lint 'scratch/S-{session_id}/tasks/'")`, single-quoting the path exactly as Steps 1b and 6 already do; `{session_id}` is the argument, already charset-validated in Step 1, so a literal `'` cannot appear.

**On exit 0** — nothing to report; proceed to Step 2. This is also what a workstream with no `tasks/` directory produces: the missing-directory target is zero findings and exit 0, so the common case needs no special handling in this step at all.

**On exit 1** — surface every `WARN:` line from stdout verbatim in the transcript, then proceed to Step 2. The handoff never fails on lint findings. From this call site exit 1 always means real findings: the path is built from an already-charset-validated `{session_id}`, so it is always inside the sandbox and always schema-detectable, and a missing directory now exits 0.

**On exit 2** — `Step 1c: tasks lint exited 2 (infra) — skipping the tasks lint; investigate before the next handoff.` Then proceed to Step 2.

This step is read-only: it runs one `tasks lint` invocation and writes nothing. Task writes happen in Step 1d and the session write in Step 3.

### Step 1d — Reconcile tasks

Before composing the body (Step 2), carry this session's still-owed work into `tasks/`. First Read `tasks-methodology.md`, found with Glob pattern `handoff-methodology/tasks-methodology.md` under path `~/.claude/skills`, then under the project's `.claude/skills`, then `**/handoff-methodology/tasks-methodology.md` under `~/.claude/plugins`; its rules decide every call below. This step never asks: `/pause-and-handoff` runs it unattended, and a wrong task costs the user one visible edit.

1. **List candidates.** Collect the owed items this session named — parked, carried, deferred, fix-or-file, a check left unrun — including one the Next best step points to, plus each still-open question Step 1b answered or marked moot. Add a save point for each multi-step skill, protocol, or methodology this session ran whose `Done when:` finish condition is not yet met, and each `open` or `blocked` save point whose run met that condition this session, because a resumed session that does not know it was inside a skill runs outside it; record the skill's own state in its own artifacts first, and shape the save point by the methodology's § Save points. Sort each question by the methodology's questions-versus-tasks rules, and keep the items that pass the task test.
2. **Match.** Compare each candidate with the existing tasks of every status: the `tasks` array Step 1b kept, or, when Step 1b skipped, the files Glob `scratch/S-{session_id}/tasks/t-*.md` returns, because `tasks list` omits closed tasks. Read every task file whose title or artifact could match, because bodies are not in the payload; on the Glob path no titles are in hand, so read them all. Apply the dedupe rules and the fold test. A save point matches by invocation instead, found by Grep for `^Save point ` in `scratch/S-{session_id}/tasks/` rather than by title: for an `open` or `blocked` save point whose skill run met its finish condition this session, move the run's session-only state into the skill's artifacts, or into this session's `## Decisions made` when the skill has none, then set it `done`; append a dated block to one whose newest header names the same invocation, and otherwise create a new one.
3. **Write.** Create a task with `mcp__scratch-memory__write_task`, its body opening with `Done when:`. Set a task `done` with `scratch-memory tasks done 'scratch/S-{session_id}/' t-<6hex> --note '<what met its Done when:>'`, writing each `'` in the note as `'\''` so the single quotes stay closed. Make every other change to an existing task with Edit, making only unattended edits and bumping `updated:` to a full ISO UTC timestamp of now, `YYYY-MM-DDTHH:MM:SS.sssZ`. When `write_task` returns an error, surface it verbatim, record nothing for that item, and continue — a task write never fails the handoff.
4. **Hand Step 2 its lines.** For each task created or changed, one `## Tasks touched` line `- t-<6hex>: <verb>`. For each question moved to a task, one `## Open questions resolved` line `q-<id> → RESOLVED: closed — moved to task t-<6hex>`.

**Done when:** every candidate is created, appended, set `done`, or skipped under a named dedupe rule, and each task created or changed has its `## Tasks touched` line.

### Step 2 — Body composition

Compose the full per-session body from current session knowledge. The body must contain a YAML frontmatter block followed by all 11 section headings.

**Frontmatter fields:**
- `session_id:` — the argument verbatim (the value passed to this command)
- `started:` — (server-injected on write — caller must omit this field)
- `ended:` — (server-injected on write — caller must omit this field)
- `session_name:` — session name if known; empty string if unknown
- `goal_at_time:` — one-line description of the session's primary goal
- `parent_handoff_state:` — path to the prior HANDOFF.md if known; leave the value empty (`''`) when unknown — the field itself stays present, matching `SESSION_FILE_TEMPLATE` in `handoff.mjs`
- `summary:` — one-line summary of this session's work; composed with client-side 3-way fallback before `write_session` is called:
  1. **Authored** (preferred): write a one-line summary from current session context.
  2. **Derived** (if no authored summary available): `## Next best step` content + first non-empty line of `## Done`.
  3. **Placeholder** (if still empty): `⚠ no summary — see source` + first ~300 chars of the session body.
  All three branches execute in these steps; the MCP server never sees the fallback logic.

**11 body sections** — fill each from current session context:
1. `## Goal` — the workstream goal (persistent across sessions; not this session only)
2. `## Next best step` — the single most important next action a resuming agent should take. When a save point is `open` or `blocked`, it opens with the save point's `<invocation>` from its newest header (a slash command with its arguments, or a bare skill name), then the save point's path `scratch/S-{session_id}/tasks/t-<6hex>-<slug>.md`, which `/pickup` resumes the skill from. When Step 1d set a save point `done`, the Next best step names no save point path, not even as where the run's decisions are: it points at the skill's artifacts or at this session's `## Decisions made`, where Step 1d moved them.
3. `## Done` — per-session delta: what was accomplished **this session only**. Do not restate prior sessions' items — `cat-sessions` accumulates them across the whole log.
4. `## Decisions made` — per-session delta: architectural and implementation decisions made **this session only**. Do not restate prior sessions' items — `cat-sessions` accumulates them across the whole log.
5. `## What to avoid` — per-session delta: gotchas, dead ends, and anti-patterns discovered **this session only**. Do not restate prior sessions' items — `cat-sessions` accumulates them across the whole log.
6. `## Open questions raised` — new questions surfaced this session only, each one admitted and shaped by `tasks-methodology.md` § Questions versus tasks: one question per `- ` bullet, ending in `?`, then `settles when: <what would close it>`. Leave the section **empty** when there is nothing to raise — never write a placeholder bullet such as `- none` or `- (none new …)`.
7. `## Open questions resolved` — questions answered this session; restate the question kernel verbatim, then the answer, e.g. `Should we use approach A? → RESOLVED: <answer>` (a reworded restatement won't kernel-match and stays still-open). The `?` in that example belongs to the kernel itself, because the source question happened to end in one — per Step 1b, never append a `?` the original kernel didn't have; an imperative kernel has none, and appending one produces a string that won't match on the next read, silently reopening the question. Each entry is a `- ` bullet (one entry per bullet). Include the `moved to task` lines Step 1d handed over. Leave the section **empty** when there is nothing to resolve — never write a placeholder bullet such as `- none` or `- N/A`.
8. `## Tasks touched` — per-session delta: the `- t-<6hex>: <verb>` lines Step 1d handed over, one per task created or changed this session. Leave the section **empty** when no task was touched.
9. `## Key files & artifacts` — paths to source files, plans, specs, and scratch artifacts central to the workstream
10. `## Skills used` — skills that were loaded or relied on this session
11. `## Projects` — scratch project slugs active in this workstream (e.g. `handoff-sid-fix`)

### Step 3 — MCP call

Call `mcp__scratch-memory__write_session({ session_id: <argument>, body: <composed body> })`.

### Step 4 — Error handling

If the MCP response contains any `error.code` (JSON-RPC error), surface the error message verbatim to the user and stop. Do NOT retry on MCP errors. Examples of errors that surface verbatim: `SESSION_ID_REQUIRED: session_id is required…`, `SESSION_ID_INVALID: …`, `BODY_TOO_LARGE: …`, `FS_FAILURE: …`.

### Step 5 — Success path

Parse the returned JSON. Bind `path`, `session_id`, `started`, `ended`, `pointer`. The returned `started` and `ended` are the server-injected timestamps written into the session file's frontmatter. Use `path` to construct the success report in Step 6. `pointer` reflects whether `write_session` already regenerated the derived `HANDOFF.md` pointer (see Step 6).

### Step 6 — Pointer update (recovery-only)

`write_session` mechanically regenerates the `HANDOFF.md` pointer itself, immediately after durably writing the session file — no separate call is required on the normal path. Inspect the `pointer` field bound in Step 5:

- **`pointer.written === true`** — nothing to do; the pointer is already fresh. Report: "Session saved at `sessions/{filename}`. Pointer updated." (use the filename from `path` in the report)
- **`pointer.written === false`** — the session file is safely durable, but the derived pointer regeneration failed. Run the recovery command from `pointer.recovery`, equivalently `Bash("scratch-memory rewrite-pointer 'scratch/S-{session_id}/'")` where `{session_id}` is the argument. The single-quote wrapping isolates the path from shell metacharacters; session_id was already validated in Step 1 to contain only `[A-Za-z0-9._-]`, so a literal `'` cannot appear.
  - **exit 0** — report: "Session saved at `sessions/{filename}`. Pointer updated (recovered)."
  - **non-zero** — report a STALE-POINTER WARNING: the immutable session delta is already safely written. Tell the user to re-run `scratch-memory rewrite-pointer scratch/S-{session_id}/` to recover the pointer. Do NOT treat the handoff as failed.

After the pointer report, print the task picture: run `Bash("scratch-memory tasks list 'scratch/S-{session_id}/'")` and print its `## Tasks` block, then one line each naming the task ids Step 1d created, updated, and closed (`done`), writing `none` for an empty list. Then run `Bash("scratch-memory session lint 'scratch/S-{session_id}/'")` and print each `question-shape:` and `missing-done-when:` line of its output, whatever its exit code, and nothing when it has none. Neither stops the handoff: the session file is written, and the event groomer later closes or reroutes a malformed row.
