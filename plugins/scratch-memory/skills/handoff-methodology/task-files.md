# Task files

`scratch/S-{slug}/tasks/t-{6hex}-{title-slug}.md` — one file per workstream work item, created by the `write_task` MCP tool and changed afterward by Edit (`scratch-memory`'s [mcp-tools.md](../scratch-memory/mcp-tools.md), `## Tool: write_task`). `/pickup`'s brief renders them per [Brief rendering contract](assembly-protocol.md#brief-rendering-contract).

## File schema

**Path:** `scratch/S-{session_id}/tasks/t-{6hex}-{title-slug}.md` — `t-{6hex}` is the server-minted id (e.g. `t-3f9a2c`), followed by a `-` and the title's `deriveSlug()`-derived slug.

**Frontmatter:**

| Key | Optionality | Notes |
|---|---|---|
| `id` | required | `t-` + 6 hex chars — see ID minting below |
| `title` | required | 1–80 characters |
| `status` | required | one of `open \| blocked \| done \| dropped \| promoted` |
| `created` | required | server-stamped ISO-8601 timestamp at creation |
| `updated` | required | full ISO UTC timestamp (`YYYY-MM-DDTHH:MM:SS.sssZ`): server-stamped at creation, stamped by `scratch-memory tasks done` at close, and bumped to now on every hand edit, which the `scratch-lint.sh` H1 rule enforces (see Age is not mtime below) |
| `blocked_on` | optional | 1–120 characters; meaningful only when `status: blocked` |
| `promoted_to` | optional | issue slug; added by hand only after manual promotion (see Manual promotion flow below) — never a `write_task` parameter |

**Body:** optional freeform markdown, ≤ 1 MB (`MAX_BODY_BYTES`).

**ID minting — mint-once random, never content-hashed.** `id` is a random 6-hex string minted once at creation and never recomputed, unlike the hashed `q-` question IDs in [Open-questions carry-forward](assembly-protocol.md#open-questions-carry-forward): the filename anchors a task's identity, and a title can change.

## Who writes tasks

Three writers touch `tasks/`, all under [tasks-methodology.md](tasks-methodology.md):

- **The main session** — ad hoc when a work item surfaces in conversation, and at `/handoff` Step 1d, which reconciles the session's still-owed work before `write_session`.
- **The groom sub-agent** — the `employee` agent `/groom` dispatches, confined by its dispatch prompt to `tasks/`, `scratch-memory session mark-groomed` and `scratch-memory session close` (see [groom.md](groom.md)).
- **The event groomer** — the `workstream-groomer` agent `/pickup`, `/end-lane` and `/close-issue` dispatch through [boundary-groom.md](boundary-groom.md), which changes the rows an event's new evidence reaches and closes questions through `scratch-memory session close` (see [event-groom.md](event-groom.md)).

`/pickup` itself never writes a task; its event groom does. Any other sub-agent persisting structured output uses `write_report`, `write_review`, or `write_issue`.

This is **Invariant 2** applied to the `tasks/` directory. Exactly as for `write_session`, it is enforced by **caller-wiring convention**, not by a code-level ownership check: `write_task`'s only gates are the `session_id` charset check and the scratch-sandbox containment check, and nothing on the server validates that the calling session owns the workstream named in `session_id`.

## Questions versus tasks

Questions and tasks are two independent machineries answering two different needs. A **question** is a decision needing an answer — it lives inside a session file's `## Open questions raised` / `## Open questions resolved` sections and is carried forward by the whole-log algorithm in [Open-questions carry-forward](assembly-protocol.md#open-questions-carry-forward). A **task** is a work item — it lives in its own file under `tasks/` and is mutated by hand-editing that file directly, except that `scratch-memory tasks done` sets it `done`.

Which one an item becomes, and when a question closes as tracked by a task, is decided by [tasks-methodology.md](tasks-methodology.md#questions-versus-tasks). A task is never converted back into a question.

## Manual promotion flow

A task that outgrows its workstream is promoted to a standalone issue via a manual two-step:

1. Run `/capture-issue` to file the issue in `scratch/issues/`.
2. Hand-edit the task's frontmatter: set `status: promoted` and add `promoted_to: <issue-slug>`.

`/capture-issue` (`scratch-issues-methodology` § Entry: /capture-issue) has no write-back mechanism to the source task and gains none — the two invocations are genuinely separate. The `scratch-lint.sh` hook lints the hand-edit like any other `tasks/` edit (its T7 rule validates `status` against the enum, which includes `promoted`). The window between step 1 and step 2 — where the issue exists but the task still reads `open` — is accepted, not guarded against.

## Age is not mtime

A task's rendered age is computed from its `updated:` frontmatter value, never from the file's filesystem mtime, because git does not preserve mtimes across a clone, checkout, or worktree creation. `updated:` is bumped on every edit that should reset the age clock — by `scratch-memory tasks done` when a task closes, by hand otherwise — and the `scratch-lint.sh` hook's H1 rule requires `updated:` to be a full ISO UTC timestamp dated today on any hook-observed edit to a `tasks/` file.
