---
description: Save the current session and synthesize the workstream HANDOFF.md
argument-hint: <session_id>
allowed-tools: mcp__scratch-memory__write_session, Agent(handoff-manager)
---

## Step 1 — Argument guard

Parse `$ARGUMENTS`. If empty or whitespace-only, surface this error and stop:

```
ERROR: /handoff requires a session_id argument (e.g. /handoff handoff-sid-fix).
```

Do not proceed to any tool call.

## Step 2 — Body composition

Compose the full per-session body from current session knowledge. The body must contain a YAML frontmatter block followed by all 10 section headings.

**Frontmatter fields:**
- `session_id:` — `$ARGUMENTS` verbatim (the value passed to this command)
- `started:` — (server-injected on write — caller must omit this field)
- `ended:` — (server-injected on write — caller must omit this field)
- `session_name:` — session name if known; empty string if unknown
- `goal_at_time:` — one-line description of the session's primary goal
- `parent_handoff_state:` — path to the prior HANDOFF.md if known; omit this field entirely if unknown

**10 body sections** — fill each from current session context:
1. `## Goal` — the workstream goal (persistent across sessions; not this session only)
2. `## Next best step` — the single most important next action a resuming agent should take
3. `## Done` — append-dedup list of what was accomplished this session and prior sessions
4. `## Decisions made` — append-dedup list of architectural and implementation decisions
5. `## What to avoid` — append-dedup list of gotchas, dead ends, and anti-patterns discovered
6. `## Open questions raised` — questions that arose this session and remain unanswered
7. `## Open questions resolved` — questions that were answered this session (include the answer)
8. `## Key files & artifacts` — paths to source files, plans, specs, and scratch artifacts central to the workstream
9. `## Skills used` — skills that were loaded or relied on this session
10. `## Projects` — scratch project slugs active in this workstream (e.g. `handoff-sid-fix`)

## Step 3 — MCP call

Call `mcp__scratch-memory__write_session({ session_id: $ARGUMENTS, body: <composed body> })`.

## Step 4 — Error handling

If the MCP response contains any `error.code` (JSON-RPC error), surface the error message verbatim to the user and stop. Do NOT retry on MCP errors. Examples of errors that surface verbatim: `SESSION_ID_REQUIRED: session_id is required…`, `SESSION_ID_INVALID: …`, `BODY_TOO_LARGE: …`, `FS_FAILURE: …`.

## Step 5 — Success path

Parse the returned JSON. Bind `path`, `session_id`, `started`, `ended`. The returned `started` and `ended` are the server-injected timestamps written into the session file's frontmatter. Use `path` to dispatch handoff-manager in Step 6.

## Step 6 — handoff-manager dispatch

Launch `Agent(subagent_type="handoff-manager")` with this prompt:

```
mode=synthesize
session_file_path=<path from write_session return>
workstream_folder=<dirname(dirname(path)) — the S-{session_id}/ folder>
```

Parse the handoff-manager output by prefix match:

- `STATUS: SYNTHESIZED: <path>` — success. Report: "Session saved at `sessions/{filename}`. Synthesis complete."
- `STATUS: NEEDS_REWRITE: <reason>` — re-compose the body from Step 2 addressing the reason; call `write_session` again (produces a new path); dispatch a fresh handoff-manager with the new `session_file_path`. **Max 1 retry.** On a second `STATUS: NEEDS_REWRITE`: surface both file paths and both reasons to the user, then report: "handoff aborted — fix and retry manually."
- Any other output — unexpected result; surface to the user verbatim.
