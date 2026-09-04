# Scratch Memory — CLI Verb Reference

Reference companion to [SKILL.md](SKILL.md): six of the CLI's seven verb groups, with their subcommands, output streams, JSON shapes, and exit codes. The seventh, `register`, is documented in [SKILL.md](SKILL.md)'s setup section, where it is the only verb a run needs before the MCP exists.

`scratch-memory <verb> --help` is the live argument reference for every verb and is authoritative on flags and positionals — `scratch-memory handoff --help`, `scratch-memory pickup --help`, `scratch-memory tasks --help`, `scratch-memory epics --help`, and the same for `register`, `cat-sessions`, and `rewrite-pointer`. This page covers what `--help` leaves out: stream semantics, the JSON field meanings, and the reasoning behind each exit code.

You have read a result correctly when you have checked the **stream** as well as the exit code — across these verbs, one code covers two different outcomes more than once.

## `handoff`

Manages session state files under `scratch/S-{slug}/`. Called by the `/handoff` slash command.

| Subcommand | Purpose |
|---|---|
| `handoff commit` | For a V3 thin pointer, emits an info message and is a no-op — committing a derived cache has no effect. For any non-v3 (legacy V1/V2) folder, prints a JIT signpost to stderr directing the caller to `rewrite-pointer` and exits 0 leaving the file untouched; the in-place V1/V2 write path is retired. |
| `handoff path` | Print the resolved `scratch/S-{slug}/HANDOFF.md` path (slug or uuid) without writing |
| `handoff validate` | For a V3 thin pointer, applies the strict 5-section check (exit 1 on failure). For any non-v3 folder, prints the `rewrite-pointer` signpost and exits 0. `--loose` (used by the PostToolUse hook) runs a schema-agnostic mid-edit tolerance check on any shape. |
| `handoff list` | List all `scratch/S-*/HANDOFF.md` files with one-liner goal summaries |
| `handoff commit-session {path}` | Validate a per-session file in `sessions/`, compute SHA-256, append audit log; always emits JSON (machine-only verb). Server extracts `session_id` from the file path — see below. |

`handoff validate` writes its findings to **stderr**, which is the reverse of `tasks lint`.

**session_id extraction (commit-session):** Locates the last `S-(.+)` segment immediately before `/sessions/` in the supplied path — captures group 1 verbatim; hyphens preserved. Example: `scratch/S-my-feature/sessions/foo.md` → `session_id = "my-feature"`.

**Error strings surfaced on stderr (exit 1):**

| String | Cause | Recovery |
|---|---|---|
| `NAME_COLLISION` | Resolved slug matches an existing folder whose HANDOFF.md `session_id` is not in `{session_id} ∪ session_chain` — the slug belongs to a different session | Report both session ids to user; user must `/rename` one of the two sessions and retry `/handoff` |

## `pickup`

Transfers ownership of a prior session's workstream folder to the current session via atomic directory rename. Called by the `/pickup` slash command.

```
scratch-memory pickup <from-session-id> --to-session-id <to-session-id> [--json]
```

**`--to-session-id` is always required at the CLI boundary.** The `to_session_id = from_session_id` default lives in the `/pickup` slash command body, and the CLI verb requires the flag explicitly.

**JSON response shape** (stdout, parsed by `/pickup` command):

| Field | Type | Notes |
|---|---|---|
| `from_path` | string | Original folder path before rename, e.g. `scratch/S-abc123` |
| `to_path` | string | New folder path after rename, e.g. `scratch/S-my-feature` |
| `session_chain` | string[] | Strictly backward-looking: retired `from_session_id`s only, appended in pickup order (consecutive-only dedup). The current id lives in `session_id`, and never appears here |
| `session_id` | string | Current session id — confirms active session after rename |
| `first_written` | ISO 8601 | Preserved from prior frontmatter (D7 — ownership transfer preserves the origin timestamp) |
| `last_updated` | ISO 8601 | Preserved from prior frontmatter (D7 — a metadata-only transfer leaves it as-is) |
| `related_projects` | string[] | Preserved from prior frontmatter |
| `goal_one_liner` | string | Re-parsed live from the `## Goal` section of the body |
| `body` | string | Full HANDOFF.md body after frontmatter update |
| `session_name` | null | Always null post-redesign — session identity is sourced from the caller-supplied `session_id` |
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
| 1 | `PICKUP_IDEMPOTENT_SOURCE_NOT_EMPTY` | Idempotent-repickup path (target already belongs to `to_session_id`) found the source folder's `sessions/` holding real session files — a reused slug, not a stale duplicate. Fails closed on the delete rather than risk data loss. | Resolve the slug conflict manually — pick a different `from_session_id`/`to_session_id` pairing or inspect and relocate the source folder's session files before retrying |
| 2 | `PICKUP_RENAME_FAILED` | Infrastructure error (rename failed, OS-level error). Source file's frontmatter is best-effort restored to its pre-pickup content before exit, since it was already rewritten to claim the target `session_id` before the rename was attempted. | Not recoverable by retry |

## `tasks`

Lints and inspects the workstream tasks corpus (`scratch/S-*/tasks/`) and the `scratch/issues/` corpus, sharing one rule engine and one `## Tasks` block renderer with the `/pickup` resume brief's `--with-tasks` flag.

| Subcommand | Purpose |
|---|---|
| `tasks list <session-dir>` | Print the `## Tasks` block for a workstream — the same renderer `--with-tasks` uses |
| `tasks lint <path>` | Lint a file or a directory (non-recursive, sorted by basename) with the rule set auto-detected from the path |

**Schema auto-detection:** `tasks lint`'s rule set is derived from the path, never guessed — a `/tasks/` path segment selects the tasks rules, a `/issues/` path segment selects the issues rules, and a path matching neither fails closed as a `USER_ERROR` (exit 1). `tasks list` always uses the tasks rules (it only ever reads a workstream's `tasks/` directory).

**Output format:** read findings from **stdout**, one per line: `WARN: <file-basename>: <problem>`. Diagnostics (argument errors, infrastructure errors) go to **stderr**: `ERROR: <message>`. This split is the reverse of `handoff validate`, and consuming the wrong stream yields a message-less result.

**Exit codes:**

| Exit code | Meaning |
|---|---|
| 0 | Success — `list`; `lint` with zero findings; `lint` on a missing directory target |
| 1 | `lint` findings (stdout non-empty), OR a user/argument error (stderr non-empty) — check the stream to tell the two apart |
| 2 | Infrastructure error (filesystem read failure) |

**Target semantics (both subcommands share this):** a **missing directory** target is zero findings, exit 0, no output at all — for `lint` exactly as for `list` — because a workstream with no `tasks/` directory yet is the common case, not an error. A **missing file** target (a path naming a `.md` file that does not exist) is exit 1 (`USER_ERROR`), because that is a mistyped path and a checking tool that passes silently on a typo is worse than useless. The asymmetry is deliberate: a missing directory and a missing file are different user intents, and only one of them has a benign reading.

**No-frontmatter exemption (issues schema only):** an issues file whose first line is not `---` is silently skipped by the lint — no warning of any kind. `corpus-state.md` documents this as a standing, accepted exception for files that predate the MCP writer and can never be brought into conformance without fabricating values the corpus explicitly forbids fabricating.

**Graph rules (issues schema only):** the issues rule set spans two families — the per-file `I` rules covering the ten required keys and the body, and the `E` rules covering the optional epic/spike keys. Three of the E rules describe a *graph* and cannot be decided from one file in isolation, so when the target is a **file** carrying `role:` or `epic:`, the lint reads that epic's sibling files and checks the graph as well. That is the one case in this verb where a file target reads more than the file it names. One rule — E5, "a resolved spike's decision is recorded in its epic" — runs on the **directory** target only: between flipping a spike to `resolved` and appending its line to the epic the rule is legitimately unsatisfied, so on the hook it would block that very edit, every time. The rules themselves are documented in `scratch-issues-methodology`. `scratch-lint.sh` needed no change to carry any of them, because it already delegates every corpus edit to this verb.

### Hook: `scratch-lint.sh`

`hooks/scratch-lint.sh` fires on `Edit`, `Write`, or `MultiEdit` events whose `file_path` matches `scratch/S-*/tasks/*.md` or `scratch/issues/*.md`. It applies one hook-only rule (`updated:` must be today's UTC date — a rule that can only run here, since only the hook knows the file was just edited) and then delegates to `scratch-memory tasks lint <file_path>`, translating the CLI's exit code into the PostToolUse contract: CLI 0 (clean) → hook 0 (silent success); CLI 1 (findings) → hook 2 (blocking feedback, CLI stdout forwarded to stderr); CLI 2 (infra error) → hook 1 (non-blocking warning), so an environment gap (missing `jq`, `scratch-memory` not on PATH, an unreadable file) degrades to a warning and lets a legitimate edit through. It is installed by `register install-hooks` as its own `Edit|Write|MultiEdit` PostToolUse matcher group, alongside (not replacing) `handoff-validate.sh`'s existing `Edit|Write` group.

**Restart/caching note:** `settings.json` hot-reloads, so a newly installed PostToolUse entry takes effect in already-running sessions within seconds — no session restart needed. This is unlike agent-frontmatter `hooks:`, which resolve once per main session (see `.claude/CLAUDE.md`'s Three Primitives Architecture caveat).

## `epics`

Derives the workable frontier of an epic's decision spikes from the `scratch/issues/` corpus.

| Subcommand | Purpose |
|---|---|
| `epics frontier <epic-slug>` | Write the epic's ready spikes — open, and with every blocker resolved — one bare slug per line, sorted |

**Readiness** is exactly three conditions: `role: spike`, the given epic slug in its `epic` key, and `status: open` with every `blocked_by` slug resolving to a spike at `status: resolved`. A blocker that resolves to nothing counts as unresolved, so a typo fails closed and keeps that work off the ready list — `tasks lint` reports that same state as a graph finding at edit time. There is no claim or assignment condition: the corpus records who is working a spike nowhere.

The verb is a thin dispatch over the same pure traversal the graph lint rules run on, so it and `tasks lint` can never disagree about which spikes are workable. The frontier is a **derived cache** — computed from the live files on every call, which is the whole point of deriving it rather than maintaining a list.

**Output format:** bare slugs to **stdout**, one per line, sorted, so the output composes with the corpus grep cookbook (`... | xargs -I{} cat scratch/issues/{}.md`). Diagnostics go to **stderr**: `ERROR: <message>`.

**Exit codes** — these differ from `tasks lint`'s, where exit 1 covers findings as well as argument errors. This verb reports no findings, so every exit 1 is a user error on stderr:

| Situation | stdout | Exit code |
|---|---|---|
| Ready spikes exist | one bare slug per line | 0 |
| Every open spike is blocked, or the epic has no spikes | nothing at all | 0 |
| The slug names no file carrying `role: epic` | empty | 1 |
| Bad subcommand or option, missing or extra positional, malformed slug | empty | 1 |
| Filesystem read failure | empty | 2 |

**Read empty output at exit 0 as a clean state:** it means every open spike is waiting on another, which is ordinary mid-epic. It is distinct from exit 1 on an unknown slug, which is a mistyped argument. A caller that treats "no output" as failure will misread a healthy epic.

## `cat-sessions`

Assembles a chronological session log from `<session-dir>/sessions/*.md`. Read-only — stdout only, no filesystem writes — and idempotent, so it is safe to call repeatedly. Powers the `/pickup` resumption brief and feeds `rewrite-pointer` with source material.

## `rewrite-pointer`

Rewrites the thin V3 `HANDOFF.md` pointer for a session from its per-session files: reads `<session-dir>/sessions/*.md` via `cat-sessions` and writes `<session-dir>/HANDOFF.md` atomically. Called by `/handoff` on the hot path, and available as a crash-recovery escape hatch when `HANDOFF.md` is stale or missing — the pointer is a derived cache, so regenerating it is always safe.

## Session name resolution

Post-redesign, session identity is **caller-supplied** — the user types `session_id` at `/handoff` and `/pickup` invocations. Session resolution and naming treat it as an opaque identifier, while the `write_session` MCP boundary charset-validates it to `^[A-Za-z0-9._-]+$` (CLI resolution is more permissive). The workstream folder is `S-{session_id}` directly: no slug derivation step, no PID-file lookup.

Read-only verbs (`list`, `path`, `validate`) also accept slug prefixes and UUID forms — `resolveSessionArg` in `handoff.mjs` scans existing `S-*/HANDOFF.md` frontmatter for matches without touching PID files.

**Test sandboxing.** `resolveProjectRoot()` always walks `process.cwd()` upward looking for a `.git` file or directory, and every CLI verb (`handoff.mjs`, `pickup.mjs`, `cat-sessions.mjs`, `rewrite-pointer.mjs`) plus `write_session` in `server.mjs` resolves its root that way — `server.mjs` from the `--project-root` supplied once at MCP registration time. `CLAUDE_SESSIONS_DIR` is honored only by the legacy `pickup-with-pid.mjs` test fixture; no other module in this skill reads it. So:

- **To sandbox a CLI test** — create an empty `.git` marker at the fixture root, nest the workstream under `<fixture>/scratch/S-{slug}/`, and run the CLI with `cwd` set inside the fixture. `createAnchorFixture()` in `test-fixtures.mjs` is the code home for this recipe.
- **To sandbox `write_session`** — register (or spawn) a server instance pointed at an isolated fixture root.

Full collision semantics and mid-workstream rename handling are owned by `.claude/skills/handoff-methodology/SKILL.md`.
