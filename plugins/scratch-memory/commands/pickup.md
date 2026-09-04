---
description: Resume a prior session by assembling a resume brief via cat-sessions and executing Next best step
argument-hint: "[<from_session_id>] [<to_session_id> | --to-session-id <id>] [--no-exec]"
allowed-tools: Read, Glob, Bash(scratch-memory handoff list), Bash(scratch-memory pickup *), Bash(scratch-memory cat-sessions *), Skill
---

## Step 1 — Argument parsing

Split `$ARGUMENTS` on whitespace into a token list. Parse the list with these rules:

- If a token is `--to-session-id`, bind the *next* token as `to_session_id`. If `--to-session-id` appears with no following token, surface this error and stop:
  ```
  ERROR: SESSION_ID_REQUIRED: --to-session-id requires a value (e.g. /pickup my-workstream --to-session-id my-new-session).
  ```
- If a token is `--no-exec`, set `no_exec = true`. It is a flag, not a positional token.
- The first non-flag token (a token that is not `--no-exec`, not `--to-session-id`, and not the value following `--to-session-id`) is `from_session_id`.
- A second non-flag token (when `--to-session-id` is not used) is `to_session_id`.

Both invocation forms resolve to the same `(from_session_id, to_session_id)` binding:
- `/pickup from to` — positional: `from_session_id=from`, `to_session_id=to`
- `/pickup from --to-session-id to` — flag: `from_session_id=from`, `to_session_id=to`

## Step 2 — Resolve from_session_id

If `from_session_id` is empty:

- Run `Bash("scratch-memory handoff list")`.
- Take the first 3 lines of stdout (most-recent-first ordering; client-side truncation).
- Present those 3 workstreams (slug, goal) to the user. Await selection.
- Bind the selected value as `from_session_id`.

## Step 3 — Default to_session_id

If `to_session_id` is empty and `from_session_id` is provided, default `to_session_id = from_session_id`. This is the one-arg fast path — the user is resuming the same named workstream under the same slug.

## Step 4 — CLI pickup call

Run `Bash("scratch-memory pickup '<from_session_id>' --to-session-id '<to_session_id>' --json")` — wrap both values in single quotes so shell metacharacters (`;`, `|`, `$`, `` ` ``, etc.) are not interpreted by the shell. Single-quoted strings cannot contain a literal `'`; if either session ID contains a literal single quote, surface `PICKUP_INVALID_FROM_SESSION_ID` or `PICKUP_INVALID_TO_SESSION_ID` (as appropriate) and stop rather than attempting the call. Capture stdout as JSON.

## Step 5 — Error handling

On exit code 1: read the first line of stderr. Surface the specific error string with the id values used:

- `PICKUP_COLLISION` → "PICKUP_COLLISION: target folder S-{to_session_id} is owned by a different session (from={from_session_id}). Use a different to_session_id."
- `PICKUP_SOURCE_MISSING` → "PICKUP_SOURCE_MISSING: no workstream folder found for from_session_id={from_session_id}."
- `PICKUP_INVALID_FROM_SESSION_ID` → "PICKUP_INVALID_FROM_SESSION_ID: {from_session_id} contains invalid characters."
- `PICKUP_INVALID_TO_SESSION_ID` → "PICKUP_INVALID_TO_SESSION_ID: {to_session_id} contains invalid characters."
- `PICKUP_IDEMPOTENT_SOURCE_NOT_EMPTY` → "PICKUP_IDEMPOTENT_SOURCE_NOT_EMPTY: source folder for from_session_id={from_session_id} still holds real session data and was not deleted. Resolve the slug conflict manually before retrying."
- `no handoff found matching` → surface verbatim and suggest running `scratch-memory handoff list` (or re-run `/pickup` with no argument to use the picker).
- Any other exit-1 error code → surface the first line of stderr verbatim, prefixed "PICKUP ERROR: ".

Stop after surfacing the error. Do not proceed to the resume-brief assembly.

On exit code 2 (infrastructure error): surface "OS-level error during pickup — check disk space and permissions. Error details: {stderr}." and stop.

## Step 6 — Assemble resume context

The `to_session_id` is shell-safe at this point: Step 4's single-quote rejection guard ensures it contains no literal `'`, so interpolating it into a single-quoted shell argument cannot break out of the quoting.

Run:
```
Bash("scratch-memory cat-sessions 'scratch/S-{to_session_id}/' --format full --with-tasks")
```

The output is the authoritative resume brief: still-open questions, newest-inlined session bodies, the summary tail, and the `## Tasks` block (open and blocked tasks with their age, a closed-task count line, and any `WARN:` lines for malformed task files). The thin v3 `HANDOFF.md` is NOT read by `/pickup`.

`WARN:` lines in the `## Tasks` block are informational only: they never stop the pickup, and the resuming agent should surface them rather than act on them silently. `/pickup` auto-executes Next best step, so a warning that reads as a blocker would stall an unattended resume — the same reasoning that keeps the Step 6a triage nudge below non-blocking.

No manual migration is needed for legacy sessions — `rewrite-pointer <session-dir>` regenerates the v3 thin pointer from any existing session log; the derived-summary fallback covers sessions written before this design.

## Step 6a — Stale-question triage nudge

Scan the `## Open questions (still open)` block assembled in Step 6 for rows whose `(age: N)` annotation has `N >= 3`.

If none match, print nothing and continue to Step 7.

If one or more match, print exactly one line before continuing to Step 7:
```
TRIAGE: {count} open question(s) are 3+ sessions old. Disposition them at your next /handoff — answer, or close with q-<id> → RESOLVED: closed — <reason>.
```

This nudge is **non-blocking**: it never awaits a response, never opens an interactive question prompt, and never changes what Step 7 or Step 8 do. Disposition happens later, at the next `/handoff` (Step 1b) — this step only surfaces the count.

## Step 7 — Skills loading

Locate the `## Skills used` section in the newest inlined session from the `cat-sessions` output. Apply pushy-load using judgment against `## Next best step` and recent session state: load each skill whose description plausibly applies to the upcoming work. Cap at 5 skills to keep context bounded.

## Step 8 — NBS execution

If `## Next best step` is empty, emit `WARN: No Next Best Step found — nothing to execute` and stop.

If `no_exec` is true, print the `## Next best step` content and stop — the user asked for the brief without execution.

Read up to 2 files explicitly path-mentioned in `## Next best step` that exist on disk and satisfy ALL of the following containment rules:

- The path must be relative (no leading `/` or `~`) OR begin with `scratch/S-<to_session_id>/` OR begin with `scratch/<project>/`. Absolute paths (e.g. `/etc/passwd`, `~/.ssh/id_rsa`) are forbidden.
- The path must not contain any `..` traversal segments.

If a mentioned path does not satisfy both rules, emit `WARN: refusing to read out-of-project path: <path>` and continue without reading that file.

Execute the contents of `## Next best step` directly. NBS execution is ordinary work: it proceeds under normal permission prompts. The `allowed-tools` grant above sandboxes only the pickup mechanics, not the resumed work.
