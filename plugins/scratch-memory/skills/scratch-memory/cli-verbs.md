# Scratch Memory — CLI Verb Reference

Contents: `handoff` · `pickup` · `tasks` · `session` · `epics` · `wrap` · `repos` · `issue` · `cat-sessions` · `rewrite-pointer` · Session name resolution

Reference companion to [SKILL.md](SKILL.md): ten of the CLI's eleven verb groups, with their subcommands, output streams, JSON shapes, and exit codes. The eleventh, `register`, is documented in [SKILL.md](SKILL.md)'s setup section, where it is the only verb a run needs before the MCP exists.

`scratch-memory <verb> --help` is the live argument reference for every verb and is authoritative on flags and positionals — `scratch-memory handoff --help`, `scratch-memory pickup --help`, `scratch-memory tasks --help`, `scratch-memory session --help`, `scratch-memory epics --help`, `scratch-memory wrap --help`, `scratch-memory repos --help`, `scratch-memory issue --help`, and the same for `register`, `cat-sessions`, and `rewrite-pointer`. This page covers what `--help` leaves out: stream semantics, the JSON field meanings, and the reasoning behind each exit code.

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

**`--to-session-id` is always required at the CLI boundary.** The `to_session_id = from_session_id` default lives in `/pickup`'s steps (`handoff-methodology` § Entry: /pickup), and the CLI verb requires the flag explicitly.

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

**"Source not found" has two error paths.** `PICKUP_SOURCE_MISSING` fires for a UUID-shaped from-id that resolves to no folder; a plain-slug miss instead surfaces the resolver's `no handoff found matching '<arg>'` error (from `resolveSessionArg` in `handoff.mjs`). Pickup resolves `<from-session-id>` by UUID or exact-slug match only (`exact: true`): the prefix-glob fallback the read-only verbs use is disabled, so a retired id that merely prefixes a live folder name (e.g. after a rename to `S-<id>-2`) errors instead of resolving to that folder.

**Pointer after takeover.** On a v3 source folder, pickup regenerates the target's v3 pointer after a successful rename (best-effort; on regeneration failure the pointer remains ownership-claiming but non-v3 until `rewrite-pointer` is run manually). A legacy V1 source keeps the V1→V2 two-hop documented in `handoff-methodology`'s `legacy-and-recovery.md`.

## `tasks`

Lints and inspects the workstream tasks corpus (`scratch/S-*/tasks/`) and the `scratch/issues/` corpus, sharing one rule engine and one `## Tasks` block renderer with the `/pickup` resume brief's `--with-tasks` flag.

| Subcommand | Purpose |
|---|---|
| `tasks list <session-dir>` | Print the `## Tasks` block for a workstream — the same renderer `--with-tasks` uses |
| `tasks lint <path>` | Lint a file or a directory (non-recursive, sorted by basename) with the rule set auto-detected from the path |
| `tasks schema [--json]` | Print the issues vocabularies as JSON — the single source a consumer in another repository reads |
| `tasks version` | Print `TASKS_METHODOLOGY_VERSION` and a newline, exit 0 — the version a workstream's `groom.yaml` is compared against |
| `tasks done <session-dir> <task-id> --note <text>` | Close one workstream task: `status: done`, `updated:` stamped with a full ISO UTC timestamp, `- YYYY-MM-DD: <text>` appended as the last body line |

**Schema auto-detection:** `tasks lint`'s rule set is derived from the path, never guessed — a `/tasks/` path segment selects the tasks rules, a `/issues/` path segment selects the issues rules, and a path matching neither fails closed as a `USER_ERROR` (exit 1). `tasks list` always uses the tasks rules (it only ever reads a workstream's `tasks/` directory).

**Output format:** read findings from **stdout**, one per line: `WARN: <file-basename>: <problem>`. Diagnostics (argument errors, infrastructure errors) go to **stderr**: `ERROR: <message>`. This split is the reverse of `handoff validate`, and consuming the wrong stream yields a message-less result.

**Exit codes:**

| Exit code | Meaning |
|---|---|
| 0 | Success — `list`; `schema`; `version`; `done`; `lint` with zero findings; `lint` on a missing directory target |
| 1 | `lint` findings (stdout non-empty), OR a user/argument error (stderr non-empty) — check the stream to tell the two apart |
| 2 | Infrastructure error (filesystem read failure; a write failure for `done`) |

**`tasks done`:** both positionals are required, and the pair names exactly one file: `<session-dir>` passes the sandbox check, must be an existing `S-<id>` directory whose real path sits inside `scratch/`, and `<session-dir>/tasks/<task-id>-*.md` must match one file — none or several is exit 1, several listing each path. The task's `status:` must be `open` or `blocked`; a `done` task is exit 1, so a re-close never stacks a second note. Only the `status:` and `updated:` lines change in the frontmatter (a file with no `updated:` gets one directly before the closing `---`), a `blocked_on:` line stays, and the note is appended, so every other line is unchanged; unchecked parts do not stop the close. Stdout is the task's absolute path, then its first `Done when:` body line, or `Done when: (none)`. The write goes through `writeFileAtomic`, a `.tmp` sibling renamed over the file. It runs no lint and no git, and a CLI write fires no edit hook: run `tasks lint` (and `session lint`) after it as before.

**Target semantics (both subcommands share this):** a **missing directory** target is zero findings, exit 0, no output at all — for `lint` exactly as for `list` — because a workstream with no `tasks/` directory yet is the common case, not an error. A **missing file** target (a path naming a `.md` file that does not exist) is exit 1 (`USER_ERROR`), because that is a mistyped path and a checking tool that passes silently on a typo is worse than useless. The asymmetry is deliberate: a missing directory and a missing file are different user intents, and only one of them has a benign reading.

**No-frontmatter exemption (issues schema only):** an issues file whose first line is not `---` is silently skipped by the lint — no warning of any kind. `corpus-state.md` documents this as a standing, accepted exception for files that predate the MCP writer and can never be brought into conformance without fabricating values the corpus explicitly forbids fabricating.

**Graph rules (issues schema only):** the issues rule set spans two families — the per-file `I` rules covering the ten required keys and the body, and the `E` rules covering the optional epic/spike keys. Three of the E rules describe a *graph* and cannot be decided from one file in isolation, so when the target is a **file** carrying `role:` or `epic:`, the lint reads that epic's sibling files and checks the graph as well. That is the one case in this verb where a file target reads more than the file it names. One rule — E5, "a settled spike's decision is recorded in its epic" — runs on the **directory** target only: between settling a spike and writing its line in the epic the rule is legitimately unsatisfied, so on the hook it would block that very edit, every time. A second directory-only rule, M1, passes every file holding a `mermaid` fence to `mermaid-check` and reports a block that fails to parse as a finding; when the validator is absent from PATH or exits `69` it writes `Mermaid check skipped` to stderr and changes no exit code, so a stderr line beside exit 0 or beside non-empty stdout is that note, not an argument error. The rules themselves are documented in `scratch-issues-methodology`'s `lint-rules.md`. `scratch-lint.sh` needed no change to carry any of them, because it already delegates every corpus edit to this verb.

### Hook: `scratch-lint.sh`

`hooks/scratch-lint.sh` fires on `Edit`, `Write`, or `MultiEdit` events whose `file_path` matches `scratch/S-*/tasks/*.md` or `scratch/issues/*.md`. It applies one hook-only rule (H1: `updated:` must be a full ISO UTC timestamp, `YYYY-MM-DDTHH:MM:SS[.sss]Z`, dated today, so a bare date is a finding — a rule that can only run here, since only the hook knows the file was just edited) and then delegates to `scratch-memory tasks lint <file_path>`, translating the CLI's exit code into the PostToolUse contract: CLI 0 (clean) → hook 0 (silent success); CLI 1 (findings) → hook 2 (blocking feedback, CLI stdout forwarded to stderr); CLI 2 (infra error) → hook 1 (non-blocking warning), so an environment gap (missing `jq`, `scratch-memory` not on PATH, an unreadable file) degrades to a warning and lets a legitimate edit through. It is installed by `register install-hooks` as its own `Edit|Write|MultiEdit` PostToolUse matcher group, alongside (not replacing) `handoff-validate.sh`'s existing `Edit|Write` group.

**Restart/caching note:** `settings.json` hot-reloads, so a newly installed PostToolUse entry takes effect in already-running sessions within seconds — no session restart needed. This is unlike agent-frontmatter `hooks:`, which resolve once per main session (see `claude-code-expert` `subagent-skill-body-dispatch-freshness.md`).

## `session`

Checks one workstream's task data against the task methodology (`handoff-methodology` `tasks-methodology.md`), records a groom, and carries the event groom's three verbs: the rows a run holds, a question close, and the run's marks. It reads `tasks/`, `groom.yaml`, `groom-closes.md` and `sessions/` files; of a session file's structure it checks only the shape of the newest file's raised questions, as a warning.

| Subcommand | Purpose |
|---|---|
| `session lint <session-dir>` | One finding per line, then one warning per line |
| `session mark-groomed <session-dir>` | Write `groom.yaml` at `TASKS_METHODOLOGY_VERSION` atomically and print its path, keeping the `event_*` keys |
| `session radius <session-dir> [--json] [--cap N]` | Read-only: print the rows an event groom is dispatched on |
| `session close <session-dir> <q-id> --kind <answered\|moot\|tracked> --cite <file:line, sha or path> --quote-file <path\|-> --event <name> --run <ISO UTC time>` | Append one close to the ledger `groom-closes.md`, regenerate `HANDOFF.md`, print the line |
| `session mark-event-groomed <session-dir> --code <sha> --scratch <sha> --session <file> [--remainder <id=ref,…>]` | Store a completed event groom's marks and remainder in `groom.yaml` and print its path |

**`lint` output:** findings go to **stdout** as `<check>: <file>: <message>`, `<file>` a basename or `-` when the finding has none. Diagnostics go to **stderr** as `ERROR: <message>`. `check` is one of eight finding kinds: `task-warn`, `missing-done-when`, `blocked-without-blocked-on`, `promoted-to-missing`, `moved-to-missing-task`, `open-question-moved`, `blocked-on-closed-question`, or `version-behind`. A workstream with no `tasks/t-*.md` file has no task-data findings. `version-behind` fires whenever `groom.yaml` is missing or older than the constant, task files or not: a workstream with session history and no marker has never been groomed, and its owed work is sitting in session prose waiting for a groom to find it. A new workstream's first `write_session` or `write_task` writes the marker, so it reaches this state only when that write failed.

Two findings read the ledger. `moved-to-missing-task` also fires, against the file `groom-closes.md`, for a tracked close that cites a task id with no task file. `blocked-on-closed-question` does not fire for the task a question's tracked close names: that task is the record of what is owed.

**Warnings** follow the findings in the same line form. They never change the exit code, are absent from `lintSession()`'s `findings` and `data_problems`, and are not counted into the data `GROOM:` line. One kind, `question-shape`: a bullet under the newest session file's `## Open questions raised` with no `?`, more than one, or no `settles when:` clause, the message naming which. It runs with or without task files, and reads no older session file.

**`radius`** prints `run` (the ISO UTC time of the call), the three marks — `code` and `scratch`, the two repos' HEAD commits, and `session`, the newest session file's name among those matching `^[A-Za-z0-9._-]+\.md$`, the only ones it reads. It makes a row only of a task file named `t-<6hex>-<slug>.md` in that character set, and of a question only when the session file that raised it has such a name — then `pending: none`, or `pending: <n>` and one line per row, `<id> | <question or task> | <remainder, id, phrase or path> | <commit sha or session file> | <that reference's evidence line>`, a question's newest still-open mark on an indented line under it, and after `past cap:` each row beyond `--cap` (default 10) as `<id>=<ref>`. `--json` prints the same as `{run, marks, pending, past_cap}`, each row also carrying what the groomer opens it by. Both repos are derived from the workstream's position, as `wrap collect` derives them, not from the current directory.

- **New evidence** is every session file named later than the stored `event_session`, and in each repo every non-merge commit reachable from HEAD and not from the stored commit, when it changes a path outside this workstream's folder and outside every `L-*/` lane record. With no stored marks, a stored commit that is not a sha or no longer resolves, or a stored session name no file carries, it is the newest session file and the commits dated since the session before it.
- **Rows** are the stored remainder that is still open, each with its stored reference and that reference's evidence line read again (none when the reference no longer resolves; a stored reference that is neither a sha nor a bare `.md` file name is dropped with its row, unread, and a `WARN:` line on stderr names the row), then the still-open questions and open or blocked tasks the new evidence nominates: by the row's id, by a shared three-word phrase, or by a specific path. Id hits lead, then phrase hits, then path hits, tasks ahead of questions; rows that name each other's id are one unit, their partners' partners included, placed together and never split by the cap. A `scratch/` the code repo tracks in place is read once, through the code repo, and each repo's paths are read relative to its own folder, so both hold when that folder sits below its git root. A save point is never a row.
- **`pending: none`** prints when nothing is newer than the stored marks, whatever remainder is stored, and when the new evidence and the stored remainder leave no row.

**`close`** appends `- q-<6hex> → RESOLVED: closed — <kind>: <cite> — "<quote>"` under the heading `## <event> <run>`, creating the file as needed and the heading when the file's last heading is not that one, so a run's closes share one heading. The append and the pointer regeneration run under a directory lock beside the ledger (`groom-closes.md.lock`), so closes that overlap each keep their line. The quote comes from a file or from stdin (`-`), fed by a heredoc with a quoted delimiter so no quote text reaches a shell; its whitespace is collapsed to one line. It exits 1, writing nothing, when the id is not `q-<6hex>`, is not a still-open question or maps to more than one, the kind is not one of the three, the run is not an ISO UTC time, the event is not a lowercase name, the cite is empty or spans lines, or the quote is empty or over 200 characters. `close`, `mark-groomed` and `mark-event-groomed` also exit 1 when the file they read and rewrite, `groom-closes.md` or `groom.yaml`, is a symlink. `close` validates shape and decides nothing about whether the close is right; its still-open test runs under the lock, so of two closes of one id that overlap one is refused. A tracked close against a task cites `tasks/t-<6hex>-<slug>.md`. `cat-sessions` reads the ledger as resolves (`handoff-methodology` `assembly-protocol.md`, Ledger closes).

**`mark-event-groomed`** writes `event_code`, `event_scratch`, `event_session` and `event_remainder` into `groom.yaml`, leaving `methodology_version` and `groomed` as they are. An absent `--remainder` stores an empty list; each `ref` is a commit sha or a session file name, and each id a `q-` or `t-` id.

**`<session-dir>`** must be an existing directory inside the project's `scratch/`; a missing one is a user error. `mark-groomed`, `close` and `mark-event-groomed` also require an `S-<id>` basename and a real path inside `scratch/`, so a symlink out of the sandbox is a user error. A `promoted_to` that is not an issue slug is reported as `promoted-to-missing` with a `malformed` message.

**Exit codes:**

| Exit code | Meaning |
|---|---|
| 0 | `lint` with no findings, warnings or not; `radius` with or without rows; a verb that wrote |
| 1 | `lint` findings (stdout non-empty), or a user/argument error (stderr non-empty) |
| 2 | Infrastructure error — a read or write failure, or for `radius` a git failure, which never reads as "nothing new". After `close`, exit 2 with the line appended means `HANDOFF.md` was not regenerated: `scratch-memory rewrite-pointer` recovers it |

`cat-sessions --with-tasks` runs the same checks and reduces the findings to at most two count-only `GROOM:` lines; this verb is where the detail lives.

## `epics`

Derives what an epic holds from the `scratch/issues/` corpus: the workable frontier of its decision spikes, and its whole member graph.

| Subcommand | Purpose |
|---|---|
| `epics frontier <epic-slug>` | Write the epic's ready spikes — open, and with every blocker settled — one bare slug per line, sorted |
| `epics graph <epic-slug> [--json] [--open-only]` | Write the epic's whole membership: decision work and build work in blocker layers, plus external blockers, cycles, unresolvable edges and a progress count |

**Readiness** is exactly three conditions: `role: spike`, the given epic slug in its `epic` key, and `status: open` with every `blocked_by` slug resolving to an issue at a *settled* status — `wont-fix`, `fixed`, `accepted`, `moved` or `settled`. The blocker lookup is **corpus-wide**: a spike waiting on a build issue, or on work in another epic, resolves correctly. `deferred` is not settled: it acknowledges an issue without deciding it, so it still blocks. A blocker that resolves to nothing counts as unsettled, so a typo fails closed and keeps that work off the ready list — `tasks lint` reports that same state as a graph finding at edit time. There is no claim or assignment condition: the corpus records who is working a spike nowhere.

`frontier` stays **spike-only in what it lists**. It answers "what does `/discovery` decide next", and widening it would break both the name and the discovery loop; `graph` is where the build work shows.

Both verbs are a thin dispatch over the same pure traversal the graph lint rules run on, so they and `tasks lint` can never disagree. What they report is a **derived cache** — computed from the live files on every call, which is the whole point of deriving it rather than maintaining a list.

**Output format:** `frontier` writes bare slugs to **stdout**, one per line, sorted, so the output composes with the corpus grep cookbook (`... | xargs -I{} cat scratch/issues/{}.md`). Diagnostics go to **stderr**: `ERROR: <message>`.

`graph` writes a sectioned report to **stdout**: the epic's own line with its own `blocked_by`, then `decisions` and `build` — each member under its blocker layer, layer 0 having no open blocker — then `external blockers`, `cycles`, `unresolvable blockers` and a closing `progress: {closed}/{total} members closed`. An empty section is omitted, except `decisions` and `build`, which print `(none)` so the split stays visible. Members in a `blocked_by` cycle have no layer and are listed under `cycles`.

**The text form is for a person, not a pipe.** Its section headings and indentation are framing, not data, and they are not a stable interface. `--json` is the contract for anything parsing this verb:

```
{ epic: { slug, title, status, blocked_by: [{ slug, status }] },
  decisions: [[{ slug, spike_type, status, blocked_by }]],
  build:     [[{ slug, kind, status, blocked_by }]],
  external:  [{ slug, status, epic }],
  cycles: [[slug]], unresolvable: [{ slug, target }],
  progress: { closed, total } }
```

`decisions` and `build` are arrays indexed by layer. `--open-only` hides members whose `status` is not `open`; it is presentation only and never changes `progress`, which counts the whole membership.

**`frontier` has no `--json`, deliberately.** Its output is one bare slug per line, which pipes already, so a flag would buy nothing. The asymmetry between the two verbs in one group is a chosen design, not an oversight.

**Exit codes** — these differ from `tasks lint`'s, where exit 1 covers findings as well as argument errors. This verb reports no findings, so every exit 1 is a user error on stderr:

| Situation | stdout | Exit code |
|---|---|---|
| Ready spikes exist (`frontier`) | one bare slug per line | 0 |
| Every open spike is blocked, or the epic has no spikes (`frontier`) | nothing at all | 0 |
| The report was built, cycles and unresolvable blockers included (`graph`) | the report | 0 |
| The epic has no members at all (`graph`) | the epic line and `progress: 0/0` | 0 |
| The slug names no file carrying `role: epic` | empty | 1 |
| Bad subcommand or option, missing or extra positional, malformed slug | empty | 1 |
| Filesystem read failure | empty | 2 |

**Read empty output at exit 0 as a clean state:** it means every open spike is waiting on another, which is ordinary mid-epic. It is distinct from exit 1 on an unknown slug, which is a mistyped argument. A caller that treats "no output" as failure will misread a healthy epic.

## `wrap`

The `/wrap-up` skill's collect pass: one mechanical read of a workstream folder into the item list its sorting passes work from.

| Subcommand | Purpose |
|---|---|
| `wrap collect <workstream-dir> [--since-ref <ref>]` | Write `<workstream-dir>/wrap/items.json`, overwriting any earlier one, and print its path; `--since-ref` keeps only items whose session, task or folder file changed in the scratch repo's `<ref>..HEAD` (lane scope) |

**`<workstream-dir>`** must be a folder directly under the project's `scratch/`, holding `sessions/`. The repo root and the scratch subrepo are derived from that position, so churn is read from `git log` in the right repository: a path under `scratch/` in the scratch subrepo, every other path in the parent repo.

**What becomes an item.** Every cumulative decision, lesson and still-open question in the whole session log — the `assembleSessions()` object, which `cat-sessions --format json --with-history` prints — a question closed in the ledger `groom-closes.md` being no longer still open; every task at `open` or `blocked`; and every file in the folder outside `sessions/`, `tasks/`, `learned/`, `wrap/`, `HANDOFF.md`, `groom.yaml` and `groom-closes.md`, recursively. `done` tasks go to `excluded_done_tasks`; `promoted` and `dropped` tasks appear nowhere. `learned/` captures are not items, because the wrap-up's boundary ingest files them.

```
{ head: { repo, scratch, repos: { <name>: sha } },   // short HEAD shas
  repos: [{ name, path, accepts, description, level, corpus }],
  learned_repo: <name> | null,
  items: [
    { id: d001|a001|q001, kind: decision|avoid|question, text, source, since,
      paths, paths_unresolved, repo_paths?: { <name>: [path] },
      churn: { status: untouched|changed|no-path, changed?, repo_changed?: { <name>: [path] } },
      qid?, age_sessions? },                // question items only
    { id: t-xxxxxx, kind: task, status, file, text, body },
    { id: f001, kind: file, path, text } ],
  excluded_done_tasks: [{ id, title }] }
```

`source` is the session file relative to the workstream, and `since` its timestamp. `paths` are repo-relative, resolved from backticked tokens in `text`: a path, a bare primitive name, or a `/command`. A token that looks like a path and resolves to nothing, or to a place outside the repo, lands in `paths_unresolved`. `churn` is `no-path` when nothing resolved, `changed` when any path has a commit since `since`, listing those paths, and `untouched` otherwise. **Registered repos.** `repos` is `repos list --json` minus every entry that is not `ok` (each named once on stderr as `note: registered repo … skipped`) and minus the entry whose realpathed root is this repo, since its destinations are already the local ones; `corpus` is true when the entry's `scratch/issues/` exists, and `head.repos` holds each listed repo's HEAD. `learned_repo` is the listed repo that owns `~/.claude/skills`, the one root a `scope: user` capture can reach, or `null`. A `~/.claude/…` token that a listed repo owns lands in `repo_paths` under that repo's name, relative to its root, and its churn is read there into `repo_changed`; a `~/.claude/…` token no listed repo owns resolves in this repo, as `.claude/…`. `repo_paths` and `repo_changed` appear only when non-empty. An unreadable or too-new repos file exits 2.

A task's `body` is the whole file, frontmatter included; a file item's `text` is its first Markdown heading, else its first non-blank line, from the file's first 64 KB. A symlink is listed with `text` `(symlink, not read)`, since its target may lie outside the repo.

**Output format:** the written path to **stdout**, nothing else. Diagnostics go to **stderr**: `ERROR: <message>`.

| Exit code | Meaning |
|---|---|
| 0 | `items.json` written |
| 1 | Usage error, a folder outside `scratch/` or not directly under it, a symlinked `wrap/` or `wrap/items.json`, or a folder with no session files |
| 2 | A read, write or `git` failure |

## `repos`

Registered repos: other git repos a session can send what it learns to. Three JSON files hold them — the user file `~/.claude/scratch-memory/repos.json` (the directory overridable by `SCRATCH_MEMORY_CONFIG_DIR`), the committed project file `.claude/scratch-memory/repos.json` and the gitignored `.claude/scratch-memory/repos.local.json` — each `{ "version": 1, "repos": { "<name>": { "path", "accepts", "description"? } | null } }`. They merge by name, most specific level winning, and a `null` hides that name from the levels below. A `path` is absolute and holds no quote, `$`, backtick, control character or, off Windows, backslash, since registered paths reach shell commands a model writes; a file breaking that exits 2 like any malformed entry, and `add` refuses such a directory with exit 1. These verbs are the only reader and writer; readers ignore unknown fields and exit 2 on a `version` newer than they know.

| Subcommand | Purpose |
|---|---|
| `repos add <name> <path> --accepts <list> [--description <text>] <level>` | Upsert an entry; `<path>` must be its own git top level and is stored realpathed. `<list>` draws from `learned`, `docs`, `issues`, `primitive`, `code` |
| `repos remove <name> <level>` | Delete the entry at that level |
| `repos suppress <name> <level>` | Write a `null` at that level |
| `repos list [--json]` | Every merged entry, sorted by name |
| `repos resolve <name> [--json]` | One entry |
| `repos owner <path> [--json]` | The `ok` entry whose realpathed root contains `<path>` most specifically |

`<level>` is exactly one of `--user`, `--project`, or `--project --local`. A write to the local level adds `.claude/scratch-memory/repos.local.json` to `.gitignore` when no line covers it. Writes take a directory lock beside the file (broken when its recorded PID is gone or it is older than 60 s; waited on for at most 5 s) and land by tmp-then-rename. The lock is broken or released only after it is moved aside and its owner checked, and moved back when the owner differs, so concurrent writers lose no update with one exception: a writer that arrives in the instant another's lock is moved aside takes the lock, both writers run, and one update can be lost. The next write of that entry, such as a bootstrap re-running `repos add`, restores it.

**Output format:** `list --json` prints `[{ name, path, accepts, description, level, ok }]`, `[]` when no file exists; `ok` is true while the path is still a directory and a git top level. `resolve --json` prints one such object and `owner --json` prints one or `null`. Human output is one tab-separated line per entry — name, path, accepts, level, `ok`/`not-ok`, description — and `owner` with no owner prints nothing. `add`, `remove` and `suppress` report `created`, `updated` or `unchanged` on **stderr**.

| Exit code | Meaning |
|---|---|
| 0 | Success; `owner` with no owner included |
| 1 | Unknown name, bad name or destination, a missing or conflicting level flag, a path that is not a git top level |
| 2 | An unreadable file, a newer `version`, a lock still held after 5 s, or — for `resolve` — a path that is no longer a directory, with the entry still on stdout |

## `issue`

`issue write [--repo <name> | --project-root <path>] [--json]` writes one issue from stdin into a repo's `scratch/issues/`, sharing `write_issue`'s validation and render (`issues.mjs`). stdin is one JSON object in `write_issue`'s input schema, `related` included; an unknown key exits 1 naming it, and a TTY or empty stdin exits 1 with `No input on stdin`. The target is the registered repo `--repo` names, resolved as `repos resolve` does so no path passes through a shell command, or `--project-root`, or the current git top level; it must be its own git top level and must already hold `scratch/issues/`, and the file must realpath inside it. The frontmatter's `repo`, `branch` and `commit` describe the current git top level, where the issue was observed; when the target differs, `### Observed State` adds `- **Filed into:** <target>`. Unlike the MCP tool, it never creates the corpus and writes no audit line.

**Output format:** the written file's absolute path alone on **stdout**, `wrote into <target>` on **stderr**; `--json` prints `{ path, kind, title, collision_note }` on stdout instead.

| Exit code | Meaning |
|---|---|
| 0 | Issue written |
| 1 | A field error, an unknown key, no stdin, a missing corpus, a target that is not a git top level, or a path escaping the corpus |
| 2 | Unreadable stdin or a write failure |

`issue close <slug> --status <s> --resolution-file <path|-> [--summary-file <path|->]` applies a close in one file write: the `## Summary` body replaced when `--summary-file` is given, `## Resolution (YYYY-MM-DD)` and the resolution body appended at the end of the file (the date is today's UTC date, and the file holds the body only), and `status: <s>`. `<s>` is any closed status — `deferred` or a settled value — and the issue's current status must be `open` or `deferred`; any role is accepted, epics and spikes included. `<path|->` is a file path, or `-` for stdin, fed from a heredoc whose delimiter is quoted (`<<'EOF'`) so the shell expands no backtick or `$` in the markdown; at most one input may be `-`, and `-` with a TTY on stdin is exit 1 rather than a blocking read. An input empty after trim, or a `--summary-file` on an issue with no `## Summary`, is exit 1. Stdout is the absolute path, then `## Summary` and its body as written, or `## Summary: (none)`. Because the whole close is one write, the Resolution-before-status order the per-edit hook needs does not apply to it.

`issue mark-groomed <slug>...` and `issue mark-refreshed <slug>...` append `- YYYY-MM-DD: Groomed: <sha>` (or `Refreshed:`) as the last line of each issue's `## Notes`, `<sha>` being `git -C <target> rev-parse --short HEAD`. `_Not captured._` as the whole section body is replaced, and an issue with no `## Notes` gets one appended. Every slug must name an existing issue before any file is written, and each path is printed as its file is written, so a write failure partway leaves the marked paths on stdout. Not idempotent: each run appends another bullet.

All three take `--repo` and `--project-root` as `issue write` does, check that each file's real path sits inside the target's real `scratch/`, write through `writeFileAtomic`, and run no lint and no git write.

| Exit code | Meaning |
|---|---|
| 0 | Close or markers written |
| 1 | A bad slug, a missing issue, a status outside the accepted set, an empty or unreadable input, both inputs on stdin, a target that is not a git top level, or a path escaping `scratch/` |
| 2 | A write failure, unreadable stdin, or a `rev-parse` failure in a repository (no commit yet) |

## `cat-sessions`

Assembles a chronological session log from `<session-dir>/sessions/*.md`, with the questions closed in the ledger `<session-dir>/groom-closes.md` left out of the still-open set. Under `--format full` a still-open block over `--max-cumulative-chars` prints its newest raises first and ends with a count line pointing at `HANDOFF.md`. Read-only — stdout only, no filesystem writes — and idempotent, so it is safe to call repeatedly. Powers the `/pickup` resumption brief and feeds `rewrite-pointer` with source material.

## `rewrite-pointer`

Rewrites the thin V3 `HANDOFF.md` pointer for a session from its per-session files and its close ledger: reads `<session-dir>/sessions/*.md` and `groom-closes.md` via `cat-sessions` and writes `<session-dir>/HANDOFF.md` atomically, every still-open question listed. Called in-process by `/handoff`'s `write_session` and by `session close`, and available as a crash-recovery escape hatch when `HANDOFF.md` is stale or missing — the pointer is a derived cache, so regenerating it is always safe.

## Session name resolution

Post-redesign, session identity is **caller-supplied** — the user types `session_id` at `/handoff` and `/pickup` invocations. Session resolution and naming treat it as an opaque identifier, while the `write_session` MCP boundary charset-validates it to `^[A-Za-z0-9._-]+$` (CLI resolution is more permissive). The workstream folder is `S-{session_id}` directly: no slug derivation step, no PID-file lookup.

Read-only verbs (`list`, `path`, `validate`) also accept slug prefixes and UUID forms — `resolveSessionArg` in `handoff.mjs` scans existing `S-*/HANDOFF.md` frontmatter for matches without touching PID files.

**Test sandboxing.** `resolveProjectRoot()` always walks `process.cwd()` upward looking for a `.git` file or directory, and every CLI verb (`handoff.mjs`, `pickup.mjs`, `cat-sessions.mjs`, `rewrite-pointer.mjs`) plus `write_session` in `server.mjs` resolves its root that way — `server.mjs` from the `--project-root` supplied once at MCP registration time. `CLAUDE_SESSIONS_DIR` is honored only by the legacy `pickup-with-pid.mjs` test fixture; no other module in this skill reads it. So:

- **To sandbox a CLI test** — create an empty `.git` marker at the fixture root, nest the workstream under `<fixture>/scratch/S-{slug}/`, and run the CLI with `cwd` set inside the fixture. `createAnchorFixture()` in `test-fixtures.mjs` is the code home for this recipe.
- **To sandbox `write_session`** — register (or spawn) a server instance pointed at an isolated fixture root.

Mid-workstream rename handling is owned by `handoff-methodology` `legacy-and-recovery.md`.
