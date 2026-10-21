---
name: handoff-methodology
description: 'Handoff and resume: per-session files, workstream tasks, the HANDOFF.md pointer, the /pickup brief, task grooming. Use when writing a handoff, picking up a session, creating or editing a workstream task, grooming a workstream, handling a legacy HANDOFF.md folder, or choosing skills to re-load — even for short sessions. A scratch/issues/ issue is scratch-issues-methodology: a different test.'
user-invocable: false
---

# Handoff Methodology

Backing reference for `/handoff` and `/pickup`, whose steps are § Entry: /handoff in [handoff-entry.md](handoff-entry.md) and § Entry: /pickup in [pickup-entry.md](pickup-entry.md). This hub holds the v3 HANDOFF.md schema, the per-session file schema, pickup-time behavior, the Invariants, and the Sync Map; the pages below hold the rest.

## Pages

- [task-files.md](task-files.md) — the task file schema and ID minting, who writes tasks, questions versus tasks, the manual promotion flow, and why a task's age reads `updated:`. Read before creating or hand-editing a task file.
- [tasks-methodology.md](tasks-methodology.md) — what becomes a task, questions versus tasks, `Done when:`, the fold test, dedupe, save points, unattended versus user-only edits, `## Tasks touched` verbs, and the `TASKS_METHODOLOGY_VERSION` log. Read before any task is created or edited, including at `/handoff` Step 1d.
- [groom.md](groom.md) — the groom sub-agent's procedure: when to run, write limits, `Done when:` backfill, closing answered tasks, converting the question backlog, `mark-groomed`, and the return with recommended user-only edits. Read when running `/groom` or answering a `GROOM:` line.
- [boundary-groom.md](boundary-groom.md) — the event groom `/pickup`, `/end-lane` and `/close-issue` run: radius, dispatch, marks, veto list, undo. Read at a groom step, or to undo a groomer's edit.
- [event-groom.md](event-groom.md) — the `workstream-groomer`'s protocol. Read as that agent.
- [assembly-protocol.md](assembly-protocol.md) — recency ordering, the `cat-sessions` budget, open-questions and cumulative carry-forward, the `/handoff` Step 1b disposition pass, the `rewrite-pointer` and `cat-sessions` contracts, and the tasks brief rendering contract. Read when changing either verb, reading their output, or authoring a `## Open questions resolved` line.
- [legacy-and-recovery.md](legacy-and-recovery.md) — upgrading V1/V2 folders to v3, recovering a corrupt, missing, or stale pointer, the `summary:` fallback, legacy frontmatter and session naming, and the scratch subrepo rename churn after `/pickup`. Read when a folder is not v3, a pointer needs rebuilding, or `git status` in `scratch/` shows a workstream rename.

## HANDOFF.md Schema (v3 — thin pointer)

`HANDOFF.md` is a **derived cache** (Invariant 3). Deleting it loses nothing — `scratch-memory rewrite-pointer <session-dir>` regenerates it.

**Body sections (in order):**

| Heading | Content |
|---|---|
| `## Open questions (still open)` | Carry-forward set: still-open questions computed across the whole log per the ordering-aware algorithm (see [Open-questions carry-forward](assembly-protocol.md#open-questions-carry-forward)). Each row: `- [q-XXXXXX] <question> → [sessions/{file}](sessions/{file}) (age: N)`. Empty list renders `none`. |
| `## Goal` | Verbatim `goal_at_time` from the newest session file. |
| `## Next best step` | Verbatim `## Next best step` body from the newest session file. |
| `## Latest summary` | Verbatim `summary:` frontmatter value from the newest session file (or the read-side derived fallback if absent). |
| `## Sessions` | One row per session, newest first. Format: `\| timestamp \| summary \| file \|`. |

**Full v3 template:**

```
---
session_id: <slug>
schema_version: 3
last_pointer_rewrite: <ISO-8601-Z>
session_count: <N>
---

## Open questions (still open)
- [q-XXXXXX] <question> → [sessions/{file}](sessions/{file}) (age: N)

## Goal
<verbatim newest goal_at_time>

## Next best step
<verbatim newest ## Next best step>

## Latest summary
<verbatim newest summary>

## Sessions
| timestamp | summary | file |
|---|---|---|
| <ts> | <summary> | [sessions/{file}](sessions/{file}) |
```

**Legacy divergence:** pre-redesign folders may have UUID frontmatter `session_id` diverging from the folder slug — see [legacy-and-recovery.md](legacy-and-recovery.md).

## Per-Session File Schema

**Path:** `sessions/{ISO-8601-timestamp-with-Z}-{8-char-shortid}.md`
Timestamps colon-replaced for filesystem compatibility (e.g., `T14:03:12Z` → `T14-03-12Z`).
**Filenames are immutable** — HANDOFF.md links depend on them. **Section headings are a versioned contract** the assembly parser depends on.

**Frontmatter:**

```yaml
---
session_id: <string — UUID pre-redesign, slug post-redesign>
started: <ISO-8601-with-Z>    # Server-injected on write — caller omits this field.
                               # The MCP write_session handler injects the server write-time
                               # ISO timestamp when this field is absent or empty-string in
                               # the caller-supplied body. Callers wanting a true session-start
                               # time may author it explicitly; the server will preserve it.
ended: <ISO-8601-with-Z>      # Server-injected on write — same semantics as started.
session_name: <slug or empty>
goal_at_time: <one-line goal as of this session>
summary: <one-line authored summary>   # composed at /handoff; read-side fallback in cat-sessions
parent_handoff_state: <path to prior HANDOFF.md, optional>
_legacy: <true if migrated, otherwise omitted>
---
```

**Body sections (in order):**

| Heading | Content |
|---|---|
| `## Goal` | The workstream goal — persistent across sessions, restated (and updated if the goal shifted) each session. Not a per-session snapshot; the per-session one-liner lives in `goal_at_time`. |
| `## Next best step` | This session's last view of next (preserves reasoning even after the index advances). **No working-tree assertions.** Uncommitted file counts, "the commit is still owed", and stray-file baselines all go stale when anyone commits between sessions, and the resuming agent reads them as current fact. Name the command that produces the state (`git status`, `git log --oneline {BASE}..HEAD`) instead of its output. When a save point ([tasks-methodology.md](tasks-methodology.md#save-points)) is `open` or `blocked`, open with the save point's `<invocation>` from its newest header (a slash command with its arguments, or a bare skill name), then the save point's task path; a task path is a durable pointer, not a working-tree assertion. Once a save point is set `done`, name no save point path; point at the skill's artifacts or `## Decisions made` instead. |
| `## Done` | **Per-session delta**: what was accomplished this session only. Do not restate prior sessions' items — `cat-sessions` accumulates them across the whole log. |
| `## Decisions made` | **Per-session delta**: architectural and implementation decisions made this session only, with full rationale. Do not restate prior sessions' items — `cat-sessions` accumulates them across the whole log. |
| `## What to avoid` | **Per-session delta**: gotchas, dead ends, and anti-patterns discovered this session only. Do not restate prior sessions' items — `cat-sessions` accumulates them across the whole log. |
| `## Open questions raised` | **Per-session delta**: new questions surfaced this session only. One per `- ` bullet, shaped by `tasks-methodology.md` § Questions versus tasks. Leave the section empty when there is nothing to raise — never a placeholder bullet such as `- none`. |
| `## Open questions resolved` | **Per-session delta**: questions answered this session — restate the question kernel verbatim before the answer (see [Open-questions carry-forward](assembly-protocol.md#open-questions-carry-forward)). Each entry is a `- ` bullet. Leave the section empty when there is nothing to resolve — never a placeholder bullet such as `- none` or `- N/A`. |
| `## Tasks touched` | **Per-session delta**: one `- t-<6hex>: <verb>` line per task this session created or changed, verbs per [tasks-methodology.md](tasks-methodology.md#tasks-touched). Leave the section empty when no task was touched. |
| `## Key files & artifacts` | Paths to source files, plans, specs, and scratch artifacts central to the workstream. |
| `## Skills used` | Flat list of skills loaded or relied on this session. |
| `## Projects` | Scratch project slugs active in this workstream (e.g. `handoff-sid-fix`). |

`cat-sessions` derives the whole-log union of the question and cumulative delta sections at read time — the still-open question set by ID-based carry-forward less the ledger's closes, and the three cumulative lists by dedup-on-read — per [assembly-protocol.md](assembly-protocol.md).

## Starting a Workstream

A new workstream needs no init step. `/handoff <new-slug>` creates it: `write_session` makes `scratch/S-{slug}/sessions/` on the way in and regenerates the `HANDOFF.md` pointer from the file it just wrote, and `/handoff` Step 1b tolerates the missing prior log rather than erroring on it. A workstream is new when it has no session file, no task file, and no `HANDOFF.md` (`scratch-memory`'s [mcp-tools.md](../scratch-memory/mcp-tools.md), New-workstream marker). Whichever of `write_task` or `write_session` lands first in a new workstream stamps `groom.yaml`; under `/handoff` that is Step 1d's first `write_task` when it creates a task, otherwise `write_session`. A new workstream has no history older than the current task methodology, so the next `/pickup` shows no version `GROOM:` line; a failed stamp leaves that line for `/groom` to clear. A folder with earlier sessions, tasks, or a hand-written `HANDOFF.md` is never stamped this way; `/groom` marks it.

`/start <slug>` is shorthand for exactly that first `/handoff`, so the command that begins a workstream is findable under the name you would look for. It adds no behavior of its own.

## Skills Loading at /pickup

`## Skills used` is a flat list, with no Mandatory/Available tiering.

At `/pickup`, the resume brief reads `## Skills used` from the newest session file (via `cat-sessions`) and applies pushy-load judgment against `## Next best step`, any instruction passed to `/pickup`, and recent state: load each skill whose description plausibly applies to the upcoming work, preferring a false-positive over a false-negative. Hard cap: 5 skills.

A save point ([tasks-methodology.md](tasks-methodology.md#save-points)) bypasses that judgment for a skill only, and `/pickup` Step 6 reads it before the judgment runs. Step 6 considers only a `## Next best step` path shaped `scratch/S-{session_id}/tasks/t-<6hex>-<slug>.md`, with no `..`, and reads the first one named. When that task is a save point whose `status` is `open` or `blocked`, Step 6 reads its newest block's header. If the header's invocation names an installed skill (a `skills/<name>/SKILL.md`), Step 6 loads it outside the cap and without judgment, leaves it out of the capped pass, and prints `Resuming under <invocation> at <position> (t-<6hex>)`. Any other name is never loaded unjudged: a command name is added to the candidates before the capped pass runs, and Step 6 prints a `WARN:` line instead. Printed fields are plain text cut to 120 characters.

## Invariants

1. One workstream = one `scratch/S-{slug-or-uuid}/` folder = one `HANDOFF.md`.
2. Main session is the only writer for its own folder, with three exceptions: the groom sub-agent `/groom` dispatches writes `tasks/`, `groom.yaml` and the ledger `groom-closes.md`; the `workstream-groomer` an event groom dispatches writes `tasks/` and the ledger; and the mapper, sorter and reconciler sub-agents `/wrap-up` dispatches write under `wrap/`, confined there by their dispatch prompts. `/handoff` creates and updates tasks.
3. `HANDOFF.md` is a **derived cache** of `sessions/` and the ledger, regenerated by `write_session` after each session file and by `scratch-memory session close` after each ledger line. `rewrite-pointer` is the recovery path. No agent or LLM synthesizes the body. The per-session log is immutable, and the ledger append-only but for a line the main session removes to undo a close ([boundary-groom.md](boundary-groom.md) § Undo); `HANDOFF.md` is always reconstructable from them.
4. Per-session files under `sessions/` are **immutable** post-write. A post-write mtime change to a `sessions/` file is a defect. **`tasks/` is the mutable zone** — task files ([task-files.md](task-files.md)) change after creation (status changes, by hand or `scratch-memory tasks done`; `blocked_on` updates; promotion).
5. `S-` prefix distinguishes session-scoped folders from project-scoped folders in `scratch/`.
6. Sessions cross-cut projects; the session folder enumerates related project folders, never the reverse.

## Sync Map

The executable mechanics are the two entry pages; this hub and its other pages are the reference. These pairs must move together:

| Contract | Normative copies |
|---|---|
| 11 per-session section headings | `EXPECTED_SESSION_SECTIONS` in `scratch-memory/scripts/handoff.mjs` ↔ `/handoff` Step 2 list ↔ Per-Session File Schema table here (enforced by PAR tests in `test-handoff.mjs`) |
| Section semantics (cumulative vs delta) | `/handoff` Step 2 descriptions ↔ Per-Session File Schema table here (enforced by PAR3 in `test-handoff.mjs`) |
| Open-question disposition pass (decision table, kernel-fallback rule, exit-code skip notes, STILL-OPEN acknowledgment) | `/handoff` Step 1b ↔ `### Handoff disposition pass (Step 1b)` in `assembly-protocol.md` (enforced by PAR4 in `test-handoff.mjs`) |
| pickup exit-1 error codes | `/pickup` Step 4 ↔ `## pickup` in `scratch-memory/cli-verbs.md` ↔ `pickup.mjs` |
| Skills loading (flat list, cap 5; a save point's skill loads outside the cap, its command joins the judgment; save point path restricted to `tasks/t-*.md`) | `/pickup` Step 6 ↔ `## Skills Loading at /pickup` here ↔ `## Skill Loading` in `claude-code-ref-expert/handoff/pickup-command-contract.md` |
| Save point contract (`Done when:` first line, `Save point ` header split on the first ` — `, create/append/`done` life, Next best step path while `open` or `blocked` and none once `done`, resume line) | `## Save points` in `tasks-methodology.md` and its pointer from `## Dedupe` ↔ `/handoff` Step 1d and Step 2 item 2 ↔ the `## Next best step` row of the Per-Session File Schema here ↔ `/pickup` Step 6 ↔ `## Skills Loading at /pickup` here |
| Instruction argument (takes precedence over NBS; adjacency is not supersession) | `/pickup` Step 7 ↔ `## The Guards Around Execution` in `claude-code-ref-expert/handoff/pickup-command-contract.md` (command side enforced by PAR10 in `test-handoff.mjs`) |
| Starting a workstream (`/start` delegates to the first `/handoff`, adds no behavior) | `/start` ↔ `## Starting a Workstream` here |
| Resolve-pass matcher (guard → ID → kernel precedence; a ledger close pairs by id alone) | `cat-sessions.mjs`'s resolve pass and ledger read inside `assembleWithMarks` ↔ `### Open-questions carry-forward` in `assembly-protocol.md` ↔ the line `session close` writes in `session.mjs` |
| `--max-cumulative-chars` flag: default (6000), validation, `--format full` only scope (default `--format json` omits the arrays it would cap), and the still-open block it also caps | `CAT_HELP` and `openQuestionsBlock` in `cat-sessions.mjs` ↔ `### cat-sessions contract`, `### Cumulative sections carry-forward` and **Cap** under `### Open-questions carry-forward` in `assembly-protocol.md` |
| Event groom (dispatch prompt, return shape, marks) | `boundary-groom.md` ↔ `event-groom.md` Steps 1 and 6 ↔ `session radius` and `mark-event-groomed` in `session.mjs` |
| Still-open question row format (`[q-XXXXXX]` id, kernel text, session link, `(age: N)` annotation; blank line follows the heading before the first row) | `openQuestionsBlock` in `cat-sessions.mjs` ↔ `### Open-questions carry-forward` in `assembly-protocol.md` (enforced by CAT10a in `test-handoff.mjs`) |
| `cat-sessions --format json --with-history` output shape (never truncated, unlike the capped `full` format) | `assembleSessions`'s return shape in `cat-sessions.mjs` ↔ `json` bullet under `### cat-sessions contract` in `assembly-protocol.md` (enforced by CAT10c and CAT76 in `test-handoff.mjs`) |
| Default `cat-sessions --format json` shape (dropped fields, `JSON_BUDGET_CHARS` row trim, `omitted` object) | `jsonDefaultPayload` and `CAT_HELP` in `cat-sessions.mjs` ↔ **Default `json`** under `### cat-sessions contract` in `assembly-protocol.md` (enforced by CAT73-CAT75 and CAT77 in `test-handoff.mjs`) |
| Read a spilled `cat-sessions` output in full | `/pickup` Step 5 ↔ `/handoff` Step 1b ↔ `groom.md` procedure item 2 ↔ `wrap-up/SKILL.md` final-session-file check (enforced by PAR11 in `test-handoff.mjs`) |
| Tasks row format, ordering, and age rule | `renderTasksBlock` in `scratch-memory/scripts/tasks.mjs` ↔ `/pickup` Step 5 ↔ `### Brief rendering contract` in `assembly-protocol.md` (enforced by PAR6 in `test-handoff.mjs`) |
| Task reconciliation at handoff (candidates, dedupe, unattended edits, `## Tasks touched` lines) | `/handoff` Step 1d ↔ `tasks-methodology.md` (enforced by PAR8 in `test-handoff.mjs`) |
| `TASKS_METHODOLOGY_VERSION` value and bump rule | `TASKS_METHODOLOGY_VERSION` in `scratch-memory/scripts/tasks.mjs` ↔ `## Version log` in `tasks-methodology.md` (enforced by TV1 in `test-tasks.mjs`) |
| `GROOM:` line shapes (data count line, version line) and the version stop | `dispatch()` in `scratch-memory/scripts/cat-sessions.mjs` ↔ `/pickup` Step 5 and Step 6a (enforced by CAT67 and PAR9 in `test-handoff.mjs`) |
| Task close and `updated:` format (`tasks done` writes `status: done`, a full ISO UTC `updated:` and a dated note; a hand edit must write the same `updated:` form) | `tasks done` in `scratch-memory/scripts/tasks.mjs` ↔ H1 in `scratch-memory/scripts/hooks/scratch-lint.sh` ↔ `## tasks` in `scratch-memory/cli-verbs.md` ↔ `## Edit permissions` in `tasks-methodology.md` ↔ the `updated` row in `task-files.md` (H1 enforced by the TH tests in `test-tasks.mjs`) |
| Handoff tasks-lint pass (read-only, non-blocking, exit-code notes) | `/handoff` Step 1c ↔ `## tasks` exit codes in `scratch-memory/cli-verbs.md` ↔ `scratch-memory tasks lint` (enforced by PAR7 in `test-handoff.mjs`) |
