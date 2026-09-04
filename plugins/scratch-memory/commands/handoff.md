---
description: Save the current session via write_session; the HANDOFF.md pointer regenerates mechanically from the session log
argument-hint: <session_id>
allowed-tools: mcp__scratch-memory__write_session, Bash(scratch-memory rewrite-pointer *), Bash(scratch-memory cat-sessions *), Bash(scratch-memory tasks *)
---

## Step 1 — Argument guard

Parse `$ARGUMENTS`. If empty or whitespace-only, surface this error and stop:

```
ERROR: /handoff requires a session_id argument (e.g. /handoff handoff-sid-fix).
```

If `$ARGUMENTS` contains any character outside `[A-Za-z0-9._-]`, surface this error and stop:

```
HANDOFF_INVALID_SESSION_ID: session_id contains characters that are unsafe for shell invocation. Use only letters, digits, dots, underscores, or hyphens (e.g. /handoff my-workstream).
```

Do not proceed to any tool call.

## Step 1b — Open-question disposition

Before composing the body (Step 2), reconcile this session's work against the prior still-open questions.

Run `Bash("scratch-memory cat-sessions 'scratch/S-{session_id}/' --format json")`, single-quoting the path exactly as Step 6 already does; `{session_id}` is `$ARGUMENTS`, already charset-validated in Step 1, so a literal `'` cannot appear.

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

This step is read-only: it runs one `cat-sessions` invocation and writes nothing. The only write in `/handoff` remains the Step 3 `write_session` call.

## Step 1c — Tasks lint

Before composing the body (Step 2), run a last lint pass over the workstream's task backlog (spec T9 layer 3).

Run `Bash("scratch-memory tasks lint 'scratch/S-{session_id}/tasks/'")`, single-quoting the path exactly as Steps 1b and 6 already do; `{session_id}` is `$ARGUMENTS`, already charset-validated in Step 1, so a literal `'` cannot appear.

**On exit 0** — nothing to report; proceed to Step 2. This is also what a workstream with no `tasks/` directory produces: the missing-directory target is zero findings and exit 0, so the common case needs no special handling in this step at all.

**On exit 1** — surface every `WARN:` line from stdout verbatim in the transcript, then proceed to Step 2. The handoff never fails on lint findings. From this call site exit 1 always means real findings: the path is built from an already-charset-validated `{session_id}`, so it is always inside the sandbox and always schema-detectable, and a missing directory now exits 0.

**On exit 2** — `Step 1c: tasks lint exited 2 (infra) — skipping the tasks lint; investigate before the next handoff.` Then proceed to Step 2.

This step is read-only: it runs one `tasks lint` invocation and writes nothing. The only write in `/handoff` remains the Step 3 `write_session` call.

## Step 2 — Body composition

Compose the full per-session body from current session knowledge. The body must contain a YAML frontmatter block followed by all 10 section headings.

**Frontmatter fields:**
- `session_id:` — `$ARGUMENTS` verbatim (the value passed to this command)
- `started:` — (server-injected on write — caller must omit this field)
- `ended:` — (server-injected on write — caller must omit this field)
- `session_name:` — session name if known; empty string if unknown
- `goal_at_time:` — one-line description of the session's primary goal
- `parent_handoff_state:` — path to the prior HANDOFF.md if known; leave the value empty (`''`) when unknown — the field itself stays present, matching `SESSION_FILE_TEMPLATE` in `handoff.mjs`
- `summary:` — one-line summary of this session's work; composed with client-side 3-way fallback before `write_session` is called:
  1. **Authored** (preferred): write a one-line summary from current session context.
  2. **Derived** (if no authored summary available): `## Next best step` content + first non-empty line of `## Done`.
  3. **Placeholder** (if still empty): `⚠ no summary — see source` + first ~300 chars of the session body.
  All three branches execute in this command body; the MCP server never sees the fallback logic.

**10 body sections** — fill each from current session context:
1. `## Goal` — the workstream goal (persistent across sessions; not this session only)
2. `## Next best step` — the single most important next action a resuming agent should take
3. `## Done` — per-session delta: what was accomplished **this session only**. Do not restate prior sessions' items — `cat-sessions` accumulates them across the whole log.
4. `## Decisions made` — per-session delta: architectural and implementation decisions made **this session only**. Do not restate prior sessions' items — `cat-sessions` accumulates them across the whole log.
5. `## What to avoid` — per-session delta: gotchas, dead ends, and anti-patterns discovered **this session only**. Do not restate prior sessions' items — `cat-sessions` accumulates them across the whole log.
6. `## Open questions raised` — new questions surfaced this session only. Each entry is a `- ` bullet (one entry per bullet). Leave the section **empty** when there is nothing to raise — never write a placeholder bullet such as `- none` or `- (none new …)`.
7. `## Open questions resolved` — questions answered this session; restate the question kernel verbatim, then the answer, e.g. `Should we use approach A? → RESOLVED: <answer>` (a reworded restatement won't kernel-match and stays still-open). The `?` in that example belongs to the kernel itself, because the source question happened to end in one — per Step 1b, never append a `?` the original kernel didn't have; an imperative kernel has none, and appending one produces a string that won't match on the next read, silently reopening the question. Each entry is a `- ` bullet (one entry per bullet). Leave the section **empty** when there is nothing to resolve — never write a placeholder bullet such as `- none` or `- N/A`.
8. `## Key files & artifacts` — paths to source files, plans, specs, and scratch artifacts central to the workstream
9. `## Skills used` — skills that were loaded or relied on this session
10. `## Projects` — scratch project slugs active in this workstream (e.g. `handoff-sid-fix`)

## Step 3 — MCP call

Call `mcp__scratch-memory__write_session({ session_id: $ARGUMENTS, body: <composed body> })`.

## Step 4 — Error handling

If the MCP response contains any `error.code` (JSON-RPC error), surface the error message verbatim to the user and stop. Do NOT retry on MCP errors. Examples of errors that surface verbatim: `SESSION_ID_REQUIRED: session_id is required…`, `SESSION_ID_INVALID: …`, `BODY_TOO_LARGE: …`, `FS_FAILURE: …`.

## Step 5 — Success path

Parse the returned JSON. Bind `path`, `session_id`, `started`, `ended`, `pointer`. The returned `started` and `ended` are the server-injected timestamps written into the session file's frontmatter. Use `path` to construct the success report in Step 6. `pointer` reflects whether `write_session` already regenerated the derived `HANDOFF.md` pointer (see Step 6).

## Step 6 — Pointer update (recovery-only)

`write_session` mechanically regenerates the `HANDOFF.md` pointer itself, immediately after durably writing the session file — no separate call is required on the normal path. Inspect the `pointer` field bound in Step 5:

- **`pointer.written === true`** — nothing to do; the pointer is already fresh. Report: "Session saved at `sessions/{filename}`. Pointer updated." (use the filename from `path` in the report)
- **`pointer.written === false`** — the session file is safely durable, but the derived pointer regeneration failed. Run the recovery command from `pointer.recovery`, equivalently `Bash("scratch-memory rewrite-pointer 'scratch/S-{session_id}/'")` where `{session_id}` is `$ARGUMENTS`. The single-quote wrapping isolates the path from shell metacharacters; session_id was already validated in Step 1 to contain only `[A-Za-z0-9._-]`, so a literal `'` cannot appear.
  - **exit 0** — report: "Session saved at `sessions/{filename}`. Pointer updated (recovered)."
  - **non-zero** — report a STALE-POINTER WARNING: the immutable session delta is already safely written. Tell the user to re-run `scratch-memory rewrite-pointer scratch/S-{session_id}/` to recover the pointer. Do NOT treat the handoff as failed.
