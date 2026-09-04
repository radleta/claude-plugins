---
description: Resume a prior session by reading HANDOFF.md directly and executing Next best step
argument-hint: <from_session_id> [<to_session_id>]
allowed-tools: Read, Glob, Bash(scratch-memory handoff list *), Bash(scratch-memory pickup *), Skill
---

## Step 1 — Argument parsing

Split `$ARGUMENTS` on whitespace. Bind positional 1 as `from_session_id` and positional 2 as `to_session_id`.

If `$ARGUMENTS` contains a bare `--to-session-id` without a value following it, surface this error and stop:

```
ERROR: SESSION_ID_REQUIRED: --to-session-id requires a value (e.g. /pickup my-workstream --to-session-id my-new-session).
```

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

Stop after surfacing the error. Do not proceed to HANDOFF.md read.

On exit code 2 (infrastructure error): surface "OS-level error during pickup — check disk space and permissions. Error details: {stderr}." and stop.

## Step 6 — Read HANDOFF.md

Extract from JSON: `to_path`, `mandatory_skills[]`, `available_skills[]`.

Call `Read({file_path: to_path})`. Parse these sections from the file content:
`## Current state`, `## Next best step`, `## Skills — Mandatory`, `## Skills — Available`.

If `migrated_from_legacy=true` in the JSON: the new command does not auto-synthesize HANDOFF.md. Instruct the user to run `handoff-manager mode=synthesize` manually to populate the full V2 structure before resuming work.

## Step 7 — Skills loading

Load each mandatory skill unconditionally (hard cap 3):
```
For each name in mandatory_skills (up to 3): Skill({skill: name})
```

Load from `available_skills` using judgment (pushy-load default): evaluate `## Skills — Available` against `## Next best step` and `## Current state`. Load any skill whose description plausibly applies to the upcoming work. Cap at 5 to avoid context bloat.

## Step 8 — NBS execution

Read up to 2 files explicitly path-mentioned in `## Next best step` or `## Current state` that exist on disk and satisfy ALL of the following containment rules:

- The path must be relative (no leading `/` or `~`) OR begin with `scratch/S-<to_session_id>/` OR begin with `scratch/<project>/`. Absolute paths (e.g. `/etc/passwd`, `~/.ssh/id_rsa`) are forbidden.
- The path must not contain any `..` traversal segments.

If a mentioned path does not satisfy both rules, emit `WARN: refusing to read out-of-project path: <path>` and continue without reading that file.

If `## Next best step` is empty, emit `WARN: No Next Best Step found — nothing to execute` and stop.

Execute the contents of `## Next best step` directly.
