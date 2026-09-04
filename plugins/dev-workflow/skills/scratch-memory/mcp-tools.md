# Scratch Memory — MCP Tool Contracts

Reference companion to [SKILL.md](SKILL.md): the five write tools' parameters, write paths, frontmatter, return shapes, and error strings.

A call is ready when every required parameter is supplied, the `status` you chose appears in that role's allowed set, and every value the server authors is left out of the call.

## Shared across all five tools

**Guarantees** — `write_report`, `write_review`, `write_issue`, `write_session`, and `write_task` all hold these:

- **Append-only** — `flag: 'wx'` fails if the file already exists. A collision is a caller bug, and the write fails closed rather than overwriting.
- **Sandboxed** — the resolved path must stay under `{project_root}/scratch/`; anything else is refused.
- **Audited** — every write appends one JSONL line to `{project_root}/scratch/.scratch-memory/audit.jsonl`. The line carries the `tool` name, so the streams filter independently, and a `status` field: `write_report`/`write_review` record the verdict status, `write_issue` records `status: "captured"`, `write_session` records `{ ts, tool: 'write_session', session_id, path, status: 'written' }`.

**Error channel** — both branches, the `-32602` validation branch and the `-32000` runtime branch, carry a named string in `error.data.error`, and the message repeats it as a `NAME: ` prefix followed by the human-readable cause. The JSON-RPC `code` separates a validation failure from a runtime one. Branch on `error.data.error`; it is the stable field, where `error.message` is prose. No tool uses the `isError: true` result content channel — one shared failure-identification strategy beats a per-tool second one. The single exception is an unknown tool name, which is not a tool failure at all: `handleCall` throws a plain `Error`, so it returns `-32000` with no `error.data`.

**Return shape** — `write_report` and `write_review` return plain text `"Wrote: {path}"`. `write_issue`, `write_session`, and `write_task` return a JSON-stringified payload inside the single `content[0].text` block, which preserves MCP wire-format compliance (text-only content blocks) while giving the caller parseable structured fields. A new tool follows the plain `"Wrote: {path}"` pattern unless it specifically needs multiple structured return fields.

**`MALFORMED_TOOL_CALL_XML`** (-32602, on `write_issue` and `write_task`) — a string-typed arg contains the pattern `</X>\n<parameter name="Y">`: a mismatched close-tag immediately followed by a different parameter's open-tag, meaning the caller's tool-call XML emission dropped args into the preceding arg's value. The error message names the embedded arg(s) found (e.g., `lost args: intent, impact`). Re-emit the tool call with a consistent `<parameter>` namespace.

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

**Error semantics:**

| Error string | JSON-RPC code | Condition |
|---|---|---|
| `PROJECT_INVALID` | -32602 | `project` missing, not a string, or not matching `[a-zA-Z0-9._-]+` |
| `STEP_INVALID` | -32602 | `step` not an integer `>= 0` |
| `ITER_INVALID` | -32602 | `iter` not an integer `>= 1` |
| `ROLE_INVALID` | -32602 | `role` not one of `coder`, `completeness`, `quality`, `security` |
| `STATUS_INVALID` | -32602 | `status` not allowed for the given `role` (see the mapping above) |
| `BODY_INVALID` | -32602 | `body` missing or not a string |
| `FS_FAILURE` | -32000 | Filesystem/runtime failure — sandbox escape, the `wx` collision (a report file for this project/step/role/iter already exists in the same second), ENOENT, or permissions |

## Tool: `write_review`

Append-only write of a reviewer verdict. Used by /brainstorming's idea review pass, the blog-writer craft loop (phase=draft, role=craft), and any plan-phase reviewer (phase=plan) — cases with no plan steps but review phases and reviewer roles distinct from the step-based workflow.

```
write_review({
  project: string,       // scratch subdir, same rules as write_report
  phase: enum,           // "idea" | "spec" | "draft" | "plan"
  iter: integer,         // iteration within the review loop; 1-based
  role: enum,            // "document-quality" | "codebase-alignment" | "domain" | "creative" | "decision-traceability" | "combinatorial-completeness" | "craft" | "step-quality" | "investigation-quality" | "spec-traceability"
  status: enum,          // see role-to-status table below
  skills: string[],      // OPTIONAL — ordered expert-skill names for role=domain disambiguation
  body: string           // markdown body; server prepends YAML frontmatter
}) → "Wrote: {path}"
```

**Role-to-status mapping:**

| Role | Allowed `status` |
|---|---|
| `document-quality` / `codebase-alignment` / `domain` / `decision-traceability` / `combinatorial-completeness` / `craft` / `step-quality` / `investigation-quality` / `spec-traceability` | `APPROVED` \| `ISSUES_FOUND` |
| `creative` | `SUGGESTIONS` \| `NO_SUGGESTIONS` |

Server writes to:
```
{project_root}/scratch/{project}/reviews/{phase}/{role}[-{skills[0]}]-iter{N}-{ts}.md
```

For `role=domain`, the first entry of `skills` is appended to the filename (e.g. `domain-frontend-iter1-<ts>.md`), which keeps multiple parallel domain reviewers (frontend, backend-net, etc.) in distinct files within the same iteration.

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

**Error semantics:**

| Error string | JSON-RPC code | Condition |
|---|---|---|
| `PROJECT_INVALID` | -32602 | `project` missing, not a string, or not matching `[a-zA-Z0-9._-]+` |
| `PHASE_INVALID` | -32602 | `phase` not one of `idea`, `spec`, `draft`, `plan` |
| `ITER_INVALID` | -32602 | `iter` not an integer `>= 1` |
| `ROLE_INVALID` | -32602 | `role` not in the review-role enum, or present in it but missing its `STATUS_BY_REVIEW_ROLE` entry (a half-edit of the two tables) |
| `STATUS_INVALID` | -32602 | `status` not allowed for the given `role` (see the mapping above) |
| `SKILLS_INVALID` | -32602 | `skills` present but not an array, or an entry that is not a string matching `[a-zA-Z0-9._-]+` |
| `BODY_INVALID` | -32602 | `body` missing or not a string |
| `STATUS_BODY_MISMATCH` | -32602 | `status` contradicts the body — `APPROVED` with a non-empty blocking section, `ISSUES_FOUND` with none, or a `role=domain` verdict whose `## Aggregate` section disagrees with (or is missing for) the declared status |
| `FS_FAILURE` | -32000 | Filesystem/runtime failure — sandbox escape, the `wx` collision (a verdict file for this project/phase/role/iter already exists in the same second), ENOENT, or permissions |

## Tool: `write_issue`

Append-only write of an issue, idea, or mixed capture to `scratch/issues/{slug}.md`. Four callers reach it: the `/capture-issue` slash command filing a user's free-form pain-point or feature idea; the `researcher` sub-agent filing a drift issue during D6 auto-heal (the issue write fires FIRST, before the wiki correction step); future commands or agents filing a capture with a server-authored state snapshot; and automations recording a bug or idea with reboot-sufficient context (git branch, HEAD, working-tree status, recent commits), so future agents and future-you can reconstruct the moment of capture weeks later.

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
  notes?: string,            // markdown — env, constraints, overflow

  // Epic/spike keys. All optional, all emitted only when supplied, appended
  // after the ten required frontmatter keys. Values are comma-separated
  // scalars, never YAML lists — see the corpus schema note below.
  role?: enum,               // "epic" | "spike"
  epic?: string,             // slug(s) of the owning epic(s); required when role is "spike"
  spike_type?: enum,         // "interview" | "prototype" | "research" | "task"; requires role "spike"
  blocked_by?: string        // slug(s) that must resolve first; requires role "spike".
                             // "No blockers" is expressed by OMITTING this parameter —
                             // an empty string is a validation error, not an empty list.
}) → JSON-in-text: { path, kind, title, collision_note }
```

`role` and `spike_type` take their enum values straight from `tasks.mjs`'s `ISSUE_ROLES` and `SPIKE_TYPES`, the same constants the corpus lint evaluates — one source of truth, so the schema a calling model reads and the rules the file is later linted against stay in lockstep. `epic` and `blocked_by` are validated against the slug-list pattern `^[a-z0-9]([a-z0-9-]*[a-z0-9])?(,[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$` — no space after the comma; a space is rejected, not trimmed.

Validation is **shape checks plus exactly two cross-field rules**: `role: spike` requires `epic`, and `spike_type` or `blocked_by` requires `role: spike`. Everything that needs a sibling file to decide — does the epic exist, do the blockers resolve, is the graph acyclic — stays with the corpus lint, the only layer that can see the corpus. Note the deliberate asymmetry the second rule carries: `epic` alone leaves `role` free, so an ordinary capture may name an epic while staying an ordinary capture. `role: spike` likewise leaves `spike_type` free at write time; the lint catches a spike missing it on the first hand-edit.

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

**Frontmatter example (a spike — the four optional keys appended after the ten):**
```yaml
---
tool: write_issue
kind: mixed
title: Decide the retry backoff curve
slug: decide-the-retry-backoff-curve
status: open
captured: 2026-04-21T14:30:22.123Z
repo: claude-code-ref
branch: feat/auth-retry
commit: abc1234
working_tree: clean
role: spike
epic: auth-retry-policy
spike_type: prototype
blocked_by: pick-a-transport-library
---
```

**Return payload:** `{"path":"...","kind":"...","title":"...","collision_note":null|string}`.

**Usage notes:**
- Supply the content fields only — the server authors the state snapshot (git state, timestamp) itself.
- Let the server derive the slug from `title`; supply `slug_override` when the user explicitly requests a specific filename.
- Canonical placeholder `_Not captured._` appears in every omitted optional section — grep-friendly.

**Error semantics:**

| Error string | JSON-RPC code | Condition |
|---|---|---|
| `MALFORMED_TOOL_CALL_XML` | -32602 | A string-typed arg carries the embedded-tag XML signature — see the shared section above |
| `ROLE_INVALID` | -32602 | `role` present but not `epic` or `spike` |
| `SPIKE_TYPE_INVALID` | -32602 | `spike_type` present but not one of `interview`, `prototype`, `research`, `task` |
| `EPIC_INVALID` | -32602 | `epic` present but not a string, or not a comma-separated list of well-formed slugs — the empty string included |
| `BLOCKED_BY_INVALID` | -32602 | `blocked_by` present but not a string, or not a comma-separated list of well-formed slugs — the empty string included, which is why "no blockers" means omitting the parameter |
| `EPIC_REQUIRED` | -32602 | `role: spike` with no `epic` |
| `ROLE_SPIKE_REQUIRED` | -32602 | `spike_type` or `blocked_by` supplied without `role: spike` |
| `FS_FAILURE` | -32000 | Filesystem write error (sandbox escape, ENOENT, permissions, collision suffix exhausted) |

Lifecycle conventions, the `## Resolution` pairing rule, triage, and the resolution procedure are owned by `.claude/skills/scratch-issues-methodology/SKILL.md`; this page owns the `write_issue` tool contract.

## Tool: `write_session`

Append-only write of a per-session handoff file. Called by the `/handoff` slash command from the main session.

```
write_session({
  session_id: string,    // caller-chosen unique identifier for the workstream; not normalized
                         // or validated as a UUID, but gated to ^[A-Za-z0-9._-]+$ — only
                         // letters, digits, dots, underscores, hyphens; rejects path
                         // separators, .., leading dot, newlines, null bytes, and shell
                         // metacharacters; minLength: 1; determines folder name as S-{session_id}
  body: string           // full per-session markdown content (frontmatter + 10 body sections
                         // per V2 schema); MCP performs ZERO validation on body content shape;
                         // minLength: 1; maxLength: 1048576 (1 MB)
}) → JSON-in-text: { path, session_id, started, ended, pointer }
```

All five return fields are MCP-derived — supply `session_id` and `body`, and read the rest back.

**Return field semantics:**

| Derived value | Source |
|---|---|
| `session_id` | echoed from the caller-supplied `session_id` parameter |
| `started` | caller-supplied value if present and non-empty; otherwise server write-time (`Date.now()`) |
| `ended` | caller-supplied value if present and non-empty; otherwise server write-time (`Date.now()`) |
| `path` | full filesystem path of the written session file |
| `pointer` | `{ written: true, path }` on success, or `{ written: false, error, recovery }` on failure — see below |

**Pointer auto-regeneration:** After the session file is durably written (and the audit-log entry appended), the server mechanically regenerates the derived `HANDOFF.md` pointer by calling the shared `rewritePointer` core (the same core the `rewrite-pointer` CLI verb uses) against the session's workstream folder. This is **non-fatal**: the session file is the source of truth and `HANDOFF.md` is a derived cache, so a pointer failure leaves the `write_session` call successful. On success, `pointer` is `{ written: true, path: <absolute HANDOFF.md path> }`. On failure, `pointer` is `{ written: false, error: <message>, recovery: "scratch-memory rewrite-pointer 'scratch/S-{session_id}/'" }` and the failure is also logged to stderr (`write_session: pointer regeneration failed (non-fatal): ...`).

**Timestamp injection (inject-when-missing semantics):** When the caller-supplied body frontmatter has `started:` absent or empty-string, the server injects the write-time ISO timestamp. Same for `ended:`. When the caller provides explicit non-empty values, the server preserves them verbatim — backward-compatible, so pre-injection session files continue to work and callers wanting true session-start time can still author it. After injection, the value written into the body frontmatter equals the value returned in the JSON `started`/`ended` fields: one source of truth for timestamps on a given write.

**Dashed timestamp format:** `YYYY-MM-DDTHH-MM-SS-mmmZ` (colons replaced with dashes for filesystem compatibility).

**Server write path:**
```
{project_root}/scratch/S-{session_id}/sessions/{ts}-{shortid}.md
```

The `sessions/` directory is created idempotently. Writes use `wx`-flag exclusive create; collision suffix: `-2`, `-3`, … up to 100 iterations.

**Body passes through verbatim:** body content shape is never validated. A body with the wrong section count, malformed frontmatter, or arbitrary text produces a successful write with no error — compose the body correctly at the caller, since the server will not catch it.

**Error semantics:**

| Error string | JSON-RPC code | Condition |
|---|---|---|
| `SESSION_ID_REQUIRED` | -32602 | `session_id` missing, not a string, or empty |
| `SESSION_ID_INVALID` | -32602 | `session_id` contains path separators, `..`, leading dot, newlines, null bytes, any character outside `[A-Za-z0-9._-]`, or would escape scratch root |
| `BODY_REQUIRED` | -32602 | `body` missing or not a string |
| `BODY_TOO_LARGE` | -32602 | `body` exceeds 1 MB (`MAX_BODY_BYTES`) |
| `FS_FAILURE` | -32000 | Filesystem write error (sandbox escape, ENOENT, permissions, collision suffix exhausted) |

**Return payload:** `{ path, session_id, started, ended, pointer: { written: bool, path?, error?, recovery? } }`.

## Tool: `write_task`

Append-only write of a new workstream task to `scratch/S-{session_id}/tasks/{id}-{slug}.md`. The server mints the id (`t-` + 6 hex chars, e.g. `t-3f9a2c`), stamps `created`/`updated`, creates `tasks/` idempotently, and refuses to publish over an existing task.

**Create-only.** Mutations after creation — status changes, `blocked_on` updates, promotion — are hand Edits to the task file directly, guarded by the `scratch-lint.sh` PostToolUse hook (spec T6, and see the growth-path table in [internals.md](internals.md)).

```
write_task({
  session_id: string,    // workstream identifier — task lands under scratch/S-{session_id}/tasks/;
                         // charset ^[A-Za-z0-9._-]+$, same gate as write_session's session_id
  title: string,         // required; 1–80 characters
  body?: string,         // optional freeform markdown body; ≤ 1 MB (MAX_BODY_BYTES) of UTF-8 bytes
  status?: enum,         // one of open | blocked | done | dropped | promoted; defaults to "open"
  blocked_on?: string,   // 1–120 characters after CR/LF normalization and trim. Bounded because
                         // it is rendered inline in a one-line task row
                         // ("(blocked on: <blocked_on>, updated 3d ago)") and the row must stay
                         // one line
}) → JSON-in-text: { path, id, title, status }
```

All four return fields are server-derived: `id` is the minted id, `path` is the final filesystem path, `title` is echoed after whitespace/newline normalization, and `status` is the resolved value (`"open"` when the caller omitted `status`).

**Validation order** — every check throws before any filesystem mutation, in this order: `session_id` → `title` → `body` → `status` → `blocked_on` → filesystem.

**Atomic publish:** the task file is written to a dot-prefixed tmp name in the same `tasks/` directory (`.{id}-{slug}.md.tmp`) and `renameSync`'d into place, so a concurrent reader (`tasks list`, `tasks lint`, `cat-sessions --with-tasks`, the `scratch-lint.sh` hook) sees either no file or the complete file, never a partial write. Every scanner filters directory entries to `t-*.md` only, which makes the dot-prefixed tmp structurally invisible — it fails that filter on both the leading character and, before rename, the missing `.md`-only suffix — rather than merely absent by timing.

**Error semantics:**

| Error string | JSON-RPC code | Condition |
|---|---|---|
| `MALFORMED_TOOL_CALL_XML` | -32602 | `title`, `body`, or `blocked_on` contains the embedded-tag XML signature — see the shared section above |
| `SESSION_ID_REQUIRED` | -32602 | `session_id` missing, not a string, or empty |
| `SESSION_ID_INVALID` | -32602 | `session_id` contains path separators, `..`, a leading dot, newlines, null bytes, any character outside `[A-Za-z0-9._-]`, or would resolve outside the scratch root |
| `TITLE_REQUIRED` | -32602 | `title` missing or not a string |
| `TITLE_INVALID` | -32602 | `title` is not 1–80 characters, or becomes empty after whitespace normalization |
| `BODY_INVALID` | -32602 | `body` present but not a string |
| `BODY_TOO_LARGE` | -32602 | `body` exceeds 1 MB (`MAX_BODY_BYTES`) |
| `STATUS_INVALID` | -32602 | `status` present but not one of `open`, `blocked`, `done`, `dropped`, `promoted` |
| `BLOCKED_ON_INVALID` | -32602 | `blocked_on` present but not a string, or not 1–120 characters after whitespace normalization |
| `FS_FAILURE` | -32000 | Filesystem/runtime failure — sandbox escape, ENOENT, permissions, or the 100-attempt id-mint bound exhausted |
