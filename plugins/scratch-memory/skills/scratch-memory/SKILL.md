---
name: scratch-memory
description: "Project-scoped structured-write layer — MCP for sub-agent verdicts and session writes (write_report/write_review/write_issue/write_session) and CLI for session lifecycle (handoff commit, pickup, install-hooks). Use when registering scratch-memory, managing handoffs, running pickup or install-hooks, or wiring sub-agents to persist output without Write/Bash/Edit — even for single-tool usage."
---

# Scratch Memory

Narrow MCP server exposing **write-only** tools for sub-agents to emit structured artifacts into a project's `scratch/` folder. Reads stay direct (Read/Glob). Writes go through this tool so sub-agents with no Write/Bash/Edit capability can still persist their output.

## Why this exists

The `/implement-code` and `/brainstorming` commands dispatch coder and verifier sub-agents whose back-and-forth lives as timestamped markdown files. Verifiers must be **strictly read-only** for role integrity — if a verifier has Bash or Write, it will eventually decide to fix something it's reviewing.

The MCP tool is the narrow channel that lets a read-only verifier persist its verdict without the capability to modify code. Its schema IS the boundary — no file path parameter, no content-type override, just structured fields the server translates into a safe, append-only write under `scratch/`.

A second surface handles session lifecycle rather than sub-agent verdicts: the `scratch-memory handoff` and `scratch-memory pickup` CLI verbs write and transfer session state. These are called by slash commands (`/handoff`, `/pickup`), not by sub-agents.

## One-time machine setup

```bash
bash ~/.claude/skills/scratch-memory/scripts/install.sh
```

Installs `scratch-memory` CLI to `~/.local/bin/`. The MCP server script stays in the skill directory (referenced by absolute path at registration time). Edits to `server.mjs` take effect on the next server spawn.

## Per-project enable

```bash
cd /path/to/project
scratch-memory register add        # registers the MCP in this project, binds $(pwd) as project_root
```

Under the hood, that runs:
```
claude mcp add scratch-memory -- node /abs/path/to/server.mjs --project-root "$(pwd)"
```

**Local scope** (default) — registration lives in your personal Claude Code config, not shared via git. Teammates who clone the repo are not forced to adopt it.

**User scope** — pass `--user` to register machine-wide (available in all projects):
```bash
scratch-memory register add --user   # one-time per machine; available in every project
```
Project root resolves from `process.cwd()` at MCP spawn time, so the same registration serves every project; do not pass `--project-root` for user-scope registrations.

**Restart Claude Code in that project** to load the MCP (it's resolved at session start).

Ad-hoc:
```bash
scratch-memory register add --user   # register at user scope (machine-wide, one-time)
scratch-memory register add          # register at local scope (project-only)
scratch-memory register status       # show current registration + bound project_root
scratch-memory register remove       # unbind from this project
scratch-memory register check        # check drift of local-scope MCP registration
scratch-memory register check --user # check drift of user-scope MCP registration
```

Each `register add` log line includes a scope label — `(user scope)` or `(local scope)` — confirming which registration was written.

## Tool: `write_report`

Append-only write of a sub-agent report.

```
write_report({
  project: string,       // scratch subdir, e.g. "my-feature"; must match [a-zA-Z0-9._-]+
  step: integer,         // plan step number; use 0 for ad-hoc
  iter: integer,         // iteration within the step; 1-based
  role: enum,            // "coder" | "completeness" | "quality" | "security"
  status: enum,          // see role-to-status table below
  body: string           // markdown body; server prepends YAML frontmatter
}) → "Wrote: {path}"
```

**Role-to-status mapping** (server rejects mismatched pairs):

| Role | Allowed `status` |
|---|---|
| `coder` | `READY_FOR_REVIEW` \| `FIXED` \| `BLOCKED` |
| `completeness` / `quality` / `security` | `APPROVED` \| `FINDINGS` |

Server writes to:
```
{project_root}/scratch/{project}/steps/step-{NN}/{role}-iter{N}-{ts}.md
```

Where `{ts}` is UTC-compact (e.g. `20260417T143022Z`). Frontmatter added automatically:
```yaml
---
role: quality
status: FINDINGS
step: 1
iteration: 1
timestamp: 2026-04-17T14:30:22.123Z
project: my-feature
---
```

**Why `status` is in the frontmatter:**
- `rg "^status: FINDINGS" scratch/` — list all verdicts with findings across projects/steps/iters in one shot
- Main session can route by reading just the first ~8 lines of each verdict file, no body parse needed
- Audit log gains a filterable column (query "all security FINDINGS in last week" without grepping bodies)

**Guarantees:**
- **Append-only** — `flag: 'wx'` fails if file already exists (collision = caller bug)
- **Sandboxed** — path must start with `{project_root}/scratch/`; anything else refused
- **Audited** — every write appends one JSONL line to `{project_root}/scratch/.scratch-memory/audit.jsonl` (includes `status`)
- **Role/status validated** — coder statuses and verifier statuses are non-interchangeable

## Tool: `write_review`

Append-only write of a /brainstorming reviewer verdict. Used for the idea
and spec review loops, where there are no plan steps but there are two review
phases and different reviewer roles than the step-based workflow.

```
write_review({
  project: string,       // scratch subdir, same rules as write_report
  phase: enum,           // "idea" | "spec"
  iter: integer,         // iteration within the review loop; 1-based
  role: enum,            // "document-quality" | "codebase-alignment" | "domain" | "creative" | "decision-traceability"
  status: enum,          // see role-to-status table below
  skills: string[],      // OPTIONAL — ordered expert-skill names for role=domain disambiguation
  body: string           // markdown body; server prepends YAML frontmatter
}) → "Wrote: {path}"
```

**Role-to-status mapping:**

| Role | Allowed `status` |
|---|---|
| `document-quality` / `codebase-alignment` / `domain` / `decision-traceability` | `APPROVED` \| `ISSUES_FOUND` |
| `creative` | `SUGGESTIONS` \| `NO_SUGGESTIONS` |

Server writes to:
```
{project_root}/scratch/{project}/reviews/{phase}/{role}[-{skills[0]}]-iter{N}-{ts}.md
```

For `role=domain`, the first entry of `skills` is appended to the filename
(e.g. `domain-frontend-iter1-<ts>.md`) so multiple parallel domain reviewers
(frontend, backend-net, etc.) don't collide within the same iteration.

Frontmatter added automatically:
```yaml
---
role: domain
status: APPROVED
phase: spec
iteration: 1
timestamp: 2026-04-18T14:42:28.840Z
project: my-feature
skills: [csharp-expert, dynamodb-expert]
---
```

Same sandboxing, append-only, and audit-log guarantees as `write_report`. The
audit line's `tool` field is `write_review` so the two streams can be filtered
independently.

## Tool: `write_issue`

Append-only write of an issue, idea, or mixed capture to
`scratch/issues/{slug}.md`. Used when (1) the `/capture-issue` slash command
files a user's free-form pain-point or feature idea, (2) the `researcher`
sub-agent files a drift issue during D6 auto-heal (issue write fires FIRST,
before the wiki correction step), (3) future commands or agents need to file
a capture with a server-authored state snapshot, or (4) an automation wants
to record a bug or idea with reboot-sufficient context (git branch, HEAD,
working-tree status, recent commits) so future agents and future-you can
reconstruct the moment of capture weeks later.

```
write_issue({
  kind: enum,                // "issue" | "idea" | "mixed"
  title: string,             // 1–80 chars
  slug_override?: string,    // matches ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$
  summary?: string,          // markdown — what's happening / what should change
  intent?: string,           // markdown — what triggered the capture
  impact?: string,           // markdown — who's affected / what's blocked
  prior_thinking?: string,   // markdown — analysis / candidate approaches
  related?: string,          // markdown — links to code, skills, other issues
  notes?: string             // markdown — env, constraints, overflow
}) → JSON-in-text: { path, kind, title, collision_note }
```

**Kind → heading prefix:**

| `kind` | H1 prefix |
|---|---|
| `issue` | `# Issue: ` |
| `idea`  | `# Idea: ` |
| `mixed` | `# Feature: ` |

**Server write path:**
```
{project_root}/scratch/issues/{slug}.md
```

`slug` is derived from `title` unless `slug_override` is provided. Collision auto-suffix: `{slug}-2.md`, `{slug}-3.md`, etc.

**Frontmatter example (all fields server-filled):**
```yaml
---
tool: write_issue
kind: issue
title: Login times out on slow networks
slug: login-times-out-on-slow-networks
status: open
captured: 2026-04-21T14:30:22.123Z
repo: claude-code-ref
branch: feat/capture-issue
commit: abc1234
working_tree: 3 modified, 1 untracked
---
```

**Return shape:** Unlike `write_report` and `write_review`, which return plain-text
`"Wrote: {path}"`, `write_issue` returns a JSON-stringified payload inside the
single `content[0].text` block:
`{"path":"...","kind":"...","title":"...","collision_note":null|string}`.
The JSON-in-text shape preserves MCP wire-format compliance (text-only content
blocks) while giving the caller parseable structured fields for the multi-field
echo. New future tools should follow the simpler `"Wrote: {path}"` pattern
unless they specifically need multiple structured return fields.

**Usage notes:**
- Server authors the state snapshot (git state, timestamp) — caller never passes these.
- Server derives slug from `title`; caller supplies `slug_override` only when the user explicitly requests a specific filename.
- Canonical placeholder `_Not captured._` appears in every omitted optional section — grep-friendly.
- Audit line written to `scratch/.scratch-memory/audit.jsonl` with `status: "captured"`.

**Error semantics:**

| Error string | JSON-RPC code | Condition |
|---|---|---|
| `MALFORMED_TOOL_CALL_XML` | -32602 | Any string-typed arg contains the pattern `</X>\n<parameter name="Y">` — a mismatched close-tag immediately followed by a different parameter's open-tag, indicating the caller's tool-call XML emission dropped args into the preceding arg's value. Error message names the embedded arg(s) found (e.g., `lost args: intent, impact`). Re-emit the tool call with consistent `<parameter>` namespace. |
| `FS_FAILURE` | `isError: true` | Filesystem write error (ENOENT, permissions, collision suffix exhausted) |

## Tool: `write_session`

Append-only write of a per-session handoff file. Called by the `/handoff` slash command
from the main session — not from sub-agents.

```
write_session({
  session_id: string,    // caller-chosen unique identifier for the workstream; any non-empty
                         // string — UUID or meaningful slug; opaque to server; no path
                         // separators, no .., no leading dot, no newlines, no null bytes;
                         // minLength: 1; determines folder name as S-{session_id}
  body: string           // full per-session markdown content (frontmatter + 10 body sections
                         // per V2 schema); MCP performs ZERO validation on body content shape;
                         // minLength: 1; maxLength: 1048576 (1 MB)
}) → JSON-in-text: { path, session_id, started, ended }
```

All four return fields are MCP-derived — the caller never supplies them.

**Return field semantics:**

| Derived value | Source |
|---|---|
| `session_id` | echoed from the caller-supplied `session_id` parameter |
| `started` | caller-supplied value if present and non-empty; otherwise server write-time (`Date.now()`) |
| `ended` | caller-supplied value if present and non-empty; otherwise server write-time (`Date.now()`) |
| `path` | full filesystem path of the written session file |

**Timestamp injection (inject-when-missing semantics):** When the caller-supplied body
frontmatter has `started:` absent or empty-string, the server injects the write-time ISO
timestamp. Same for `ended:`. When the caller provides explicit non-empty values, the server
preserves them verbatim (backward-compatible — pre-injection session files continue to work;
callers wanting true session-start time can still author it). After injection, the value
written into the body frontmatter equals the value returned in the JSON `started`/`ended`
fields — single source of truth for timestamps on a given write.

**Dashed timestamp format:** `YYYY-MM-DDTHH-MM-SS-mmmZ` (colons replaced with dashes for
filesystem compatibility).

**Server write path:**
```
{project_root}/scratch/S-{session_id}/sessions/{ts}-{shortid}.md
```

The `sessions/` directory is created idempotently. Writes use `wx`-flag exclusive create;
collision suffix: `-2`, `-3`, … up to 100 iterations.

**Zero body-content validation:** Body content shape is NEVER validated. A body with the
wrong section count, malformed frontmatter, or arbitrary text produces a successful write
with no error.

**Error semantics:**

| Error string | JSON-RPC code | Condition |
|---|---|---|
| `SESSION_ID_REQUIRED` | -32602 | `session_id` missing, not a string, or empty |
| `SESSION_ID_INVALID` | -32602 | `session_id` contains path separators, `..`, leading dot, newlines, null bytes, or would escape scratch root |
| `BODY_REQUIRED` | -32602 | `body` missing or not a string |
| `BODY_TOO_LARGE` | -32602 | `body` exceeds 1 MB (`MAX_BODY_BYTES`) |
| `FS_FAILURE` | `isError: true` | Filesystem write error (ENOENT, permissions, collision suffix exhausted) |

**Return shape:** `{ path, session_id, started, ended }` — JSON-stringified inside
`content[0].text`, matching the `write_issue` convention for multi-field returns.

**Guarantees:**
- **Append-only** — `wx` flag; file must not already exist
- **Sandboxed** — `session_id` must not escape scratch root; anything invalid refused (`SESSION_ID_INVALID`)
- **Audited** — one JSONL line appended to `{project_root}/scratch/.scratch-memory/audit.jsonl` with `{ ts, tool: 'write_session', session_id, path, status: 'written' }`

**Env override:** Set `CLAUDE_SESSIONS_DIR` to override the default sessions directory
(useful for test fixtures).

## CLI verb group: `handoff`

Manages session state files under `scratch/S-{slug}/`. Called by the `/handoff` slash command.
Full argument reference: `scratch-memory handoff --help`.

**Subcommands:**

| Subcommand | Purpose |
|---|---|
| `handoff commit` | Validate HANDOFF.md strict schema (V1 or V2 auto-detected), regenerate frontmatter, atomic write |
| `handoff path` | Print the resolved `scratch/S-{slug}/HANDOFF.md` path (slug or uuid) without writing |
| `handoff template` | Print the 10-section HANDOFF.md template to stdout |
| `handoff validate` | Validate an existing HANDOFF.md against the 10-section schema (V1 or V2 auto-detected); exit 1 on failure |
| `handoff list` | List all `scratch/S-*/HANDOFF.md` files with one-liner goal summaries |
| `handoff commit-session {path}` | Validate a per-session file in `sessions/`, compute SHA-256, append audit log; always emits JSON (machine-only verb). Server extracts `session_id` from the file path — see session_id extraction note below. |

**session_id extraction (commit-session):** Locates the last `S-(.+)` segment immediately before `/sessions/` in the supplied path — captures group 1 verbatim; hyphens preserved. Example: `scratch/S-my-feature/sessions/foo.md` → `session_id = "my-feature"`.

**Shrink-warning behavior:** `handoff commit` warns to stderr (but does not block) when the new
body would shrink an append-dedup section (Done, Decisions, What to avoid, Key files) vs the
prior file. The `/handoff` command re-reads and recomposes before retrying up to 2 cycles.

**Error strings surfaced on stderr (exit 1):**

| String | Cause | Recovery |
|---|---|---|
| `NAME_COLLISION` | Resolved slug matches an existing folder whose HANDOFF.md `session_id` is not in `{session_id} ∪ session_chain` — the slug belongs to a different session | Report both session ids to user; user must `/rename` one of the two sessions and retry `/handoff` |

## CLI verb: `pickup`

Transfers ownership of a prior session's workstream folder to the current session via atomic
directory rename. Called by the `/pickup` slash command.
Full argument reference: `scratch-memory pickup --help`.

```
scratch-memory pickup <from-session-id> --to-session-id <to-session-id> [--json]
```

**`--to-session-id` is always required at the CLI boundary.** The `to_session_id = from_session_id`
default is implemented in the `/pickup` slash command body, NOT in the CLI verb.

**JSON response shape** (stdout, parsed by `/pickup` command):

| Field | Type | Notes |
|---|---|---|
| `from_path` | string | Original folder path before rename, e.g. `scratch/S-abc123` |
| `to_path` | string | New folder path after rename, e.g. `scratch/S-my-feature` |
| `session_chain` | string[] | Full audit array: all prior session ids + current session id at end |
| `session_id` | string | Current session id — confirms active session after rename |
| `first_written` | ISO 8601 | Preserved from prior frontmatter (D7 — ownership transfer does not reset origin timestamp) |
| `last_updated` | ISO 8601 | Preserved from prior frontmatter (D7 — not bumped on metadata-only transfer) |
| `related_projects` | string[] | Preserved from prior frontmatter |
| `goal_one_liner` | string | Re-parsed live from the `## Goal` section of the body |
| `body` | string | Full HANDOFF.md body after frontmatter update |
| `session_name` | null | Always null post-redesign (no PID-file lookup; session identity sourced from caller-supplied `session_id`, not from PID file) |
| `folder_slug` | string | Label used for the target folder — slug when named, uuid when unnamed |
| `mandatory_skills` | string[] | Skills pre-parsed from the `## Skills — Mandatory` section in the V2 HANDOFF body; parser accepts em-dash (`—`), en-dash (`–`), and double-hyphen (`--`) in both heading and inline rationale separator; empty array on V1/legacy |
| `available_skills` | string[] | Skills pre-parsed from the `## Skills — Available` section in the V2 HANDOFF body; same separator tolerance as `mandatory_skills`; empty array on V1/legacy |
| `migrated_from_legacy` | boolean | `true` when the source folder was V1 legacy and was mechanically migrated to V2 during this pickup |

**Exit codes and stderr error strings:**

| Exit code | Stderr string | Cause | Recovery |
|---|---|---|---|
| 0 | — | Success | — |
| 1 | `PICKUP_COLLISION` | Target folder is owned by a third session | Report both session ids to user |
| 1 | `PICKUP_SOURCE_MISSING` | Source folder not found by uuid or slug scan | Prior session may not have run `/handoff` |
| 1 | `PICKUP_INVALID_FROM_SESSION_ID` | `from-session-id` fails `validateSessionId` (path separators, leading dot, etc.) | Pass a clean UUID or slug for the source session |
| 1 | `PICKUP_INVALID_TO_SESSION_ID` | `--to-session-id` value fails `validateSessionId` | Pass a clean UUID or slug for the target session |
| 1 | `SESSION_ID_REQUIRED` | Missing positional `<from-session-id>` or missing `--to-session-id` | Provide both required identifiers |
| 2 | — | Infrastructure error (rename failed, OS-level error) | Not recoverable by retry |

## Session name resolution

Post-redesign, session identity is **caller-supplied** — the user types `session_id` at
`/handoff` and `/pickup` invocations. The `session_id` is opaque to the server (any
filesystem-safe non-empty string). The workstream folder is `S-{session_id}` directly.
No slug derivation step. No PID-file lookup.

Read-only verbs (`list`, `path`, `validate`) still accept slug prefixes and UUID forms —
`resolveSessionArg` in `handoff.mjs` scans existing `S-*/HANDOFF.md` frontmatter for
matches without touching PID files.

Override the sessions directory via `CLAUDE_SESSIONS_DIR` env var (useful for test fixtures).
Full collision semantics and mid-workstream rename handling live in
`.claude/skills/handoff-methodology/SKILL.md` — this skill does not duplicate that detail.

## When to use

The tools and verbs split into **four** usage classes: **sub-agent-invoked** (`write_report`, `write_review` — called by read-only verifier sub-agents from `/implement-code` and `/brainstorming` workflows), **capture-invoked** (`write_issue` — called by the `/capture-issue` slash command on behalf of the human user, and also by the `researcher` sub-agent during D6 auto-heal drift issue filing), **slash-command-invoked** (`write_session` — called by the `/handoff` slash command from main session), and **CLI-invoked** (`scratch-memory handoff`, `scratch-memory pickup` — called by `/handoff` and `/pickup` to manage session state and ownership; not called by sub-agents).

Any sub-agent whose job is "review X and produce a structured verdict" that must not have Write/Bash/Edit:

**`write_report`** (step-based, implement-code):
- Completeness verifiers (catch stubs/deferrals)
- Code/quality verifiers (lint, conventions, drift)
- Security verifiers (OWASP checks)

**`write_review`** (phase-based, brainstorming):
- Idea and spec document-quality reviewers
- Codebase-alignment reviewers at idea (light) and spec (thorough) depth
- Domain reviewers for idea and spec (one per affinity group)
- Creative-alternatives reviewer (advisory, single-run per brainstorming session)
- Decision-traceability reviewer (spec phase only)

**`write_issue`** (capture-invoked; also researcher sub-agent for D6 auto-heal):
- User-facing `/capture-issue` slash command filing issues, features, and mixed-kind pain-points
- `researcher` sub-agent filing drift issues during D6 auto-heal (issue FIRST, before wiki correction)

**`write_session`** (slash-command-invoked, not sub-agent-invoked):
- `/handoff` command (uses `mcp__scratch-memory__write_session` MCP verb) writing the per-session file from main session body composition
- Not for sub-agents — use `write_review`, `write_report`, or `write_issue` for structured reports from agents
- Not for CLI orchestration — use `handoff`/`pickup` CLI verbs for those flows
- This is the main-session-to-MCP path for per-session handoff file creation

**`scratch-memory handoff commit-session`** (CLI-invoked, not sub-agent-invoked):
- `/handoff` command (uses `scratch-memory handoff commit-session` verb) validating and committing the per-session file written by `/handoff` to `scratch/S-{slug}/sessions/`
- `handoff commit` and other verbs remain available for tooling but are not called by the `/handoff` slash command itself

**`scratch-memory pickup`** (CLI-invoked, not sub-agent-invoked):
- `/pickup` command (uses `scratch-memory pickup` verb) transferring ownership of a prior session's workstream folder to the current session
- Called once per pickup before any `/handoff` write so subsequent writes land in the correct `scratch/S-{session_id}/` folder (session_id supplied by the user; no PID-file lookup)

The calling sub-agent's tool list becomes `Read, Grep, Glob, Skill,
mcp__scratch-memory__<tool>` — narrow by construction.

## When NOT to use

- Writing source code files (coder agents have Write/Edit legitimately)
- Writing append-only audit content that must never be overwritten — use `write_report` or `write_review`, not `scratch-memory handoff commit` (which overwrites on every call)
- Writing issue/idea captures with an immutable audit trail — use `write_issue`; edits happen by filing a new capture referencing the prior slug, not by mutating the existing file
- Copying a handoff to a new session without ownership transfer — that's `fork_handoff` (future CLI verb); `scratch-memory pickup` always renames (the source folder no longer exists after a successful pickup)
- Cross-project state (tool is hard-bound to one project_root)

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `scratch-memory: command not found` | `~/.local/bin/` not on PATH or install didn't run | Run `install.sh`, check PATH |
| `ERROR: missing dependencies: claude` | Claude Code CLI not installed | Install Claude Code |
| `claude mcp get scratch-memory` shows wrong project_root (local scope) | Registration is stale (dir was moved) | Run `scratch-memory register add` again in the correct dir — it re-binds |
| `[DRIFT]` in `scratch-memory register check --user` output | Legacy `--project-root` baked from before the user-scope cwd-at-spawn fix | Re-run `scratch-memory register add --user` (it sweeps + re-adds without baking) |
| Tool call returns "ENOENT: no such file or directory, open '...wx'" | File already exists (rare — same second + same role + same iter) | Caller bug — use a unique iter per pass |
| Tool call returns "Refused: path escapes scratch root" | `project` parameter contained `..` or absolute path segments | Use only the scratch subdir name (no slashes) |
| Tool doesn't appear after `scratch-memory register add` | Didn't restart Claude Code in that project | MCP tools load at session start — restart the session |

## Growth path

Four MCP tools are currently implemented (`write_report`, `write_review`, `write_issue`, `write_session`). The session lifecycle surface (handoff, pickup) migrated to CLI verbs in `scratch-memory.mjs`. Future candidates below:

| Surface (future) | Purpose |
|---|---|
| `scratch-memory handoff fork` (CLI verb) | Copy (not rename) a handoff folder to a new session id. Preserves source as-is. For branching workstreams without ownership takeover. |
| `mark_criterion` (MCP tool) | Flip a plan acceptance-criterion checkbox in a step file |
| `append_decision` (MCP tool) | Structured entry in a project's `decisions.md` |
| `record_event` (MCP tool) | Workflow event stream (dispatched, returned, failed, etc.) |
| `update_task_status` (MCP tool) | Mark todo done in a task file |

New MCP tools share the same server, `project_root` binding, and sandbox guarantee — add by extending `TOOLS` and the dispatch in `server.mjs`. New CLI verbs extend `scratch-memory.mjs`'s subcommand dispatch.

## File layout

```
.claude/skills/scratch-memory/
├── SKILL.md              # this file
└── scripts/
    ├── server.mjs              # MCP stdio server (zero-dep, ~700 lines)
    ├── scratch-memory.mjs      # CLI entry point + dispatcher
    ├── handoff.mjs             # handoff subcommands (init, commit, path, template, validate, list, commit-session)
    ├── pickup.mjs              # pickup verb (top-level sibling)
    ├── pickup-with-pid.mjs     # legacy test fixture — in-process pickup via self-PID write; PID name injection is a post-redesign no-op (session_name always null); not a runtime entry
    ├── register.mjs            # register subcommands (add, remove, status, install-hooks)
    ├── hooks/
    │   └── handoff-validate.sh # PostToolUse loose-validation hook (opt-in)
    └── install.sh              # one-time machine setup
```

Data (per project, never leaves the project):
```
{project}/scratch/
└── .scratch-memory/
    └── audit.jsonl       # one line per write, for retrospectives
```

Reports go to their natural home in the workflow's scratch folders (e.g. `{project}/scratch/my-feature/steps/step-01/coder-iter1-*.md`).

## Gotchas

- **Slug case normalization (MCP only)** — `mcp__scratch-memory__write_issue` applies a lowercase + slugify pass to the `slug_override` value: `wikieval-T1-` becomes `wikieval-t1-`. The CLI verb `scratch-memory` preserves case verbatim. If you need a slug to match across MCP and CLI calls, pass it lowercase to begin with. See also `wiki-memory` SKILL.md gotcha — wiki-write CLI preserves case the opposite way (verbatim).
