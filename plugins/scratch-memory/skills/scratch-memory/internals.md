# Scratch Memory — Layout & Growth Path

Reference companion to [SKILL.md](SKILL.md): where the code lives, what each verb touches, and how the surface is meant to grow.

A new surface is done when the code, the dispatch, and a test sibling all carry it: a new MCP tool extends `TOOLS` and the dispatch in `server.mjs`; a new CLI verb extends `scratch-memory.mjs`'s subcommand dispatch; either way it gains a `test-{module}.mjs` sibling. New MCP tools inherit the same server, `project_root` binding, and sandbox guarantee for free.

## File layout

```
.claude/skills/scratch-memory/
├── SKILL.md              # entry point — setup, caller-class routing, troubleshooting
├── mcp-tools.md          # the five write tools' contracts
├── cli-verbs.md          # ten of eleven CLI verb groups (register is in SKILL.md)
├── internals.md          # this file — layout, verb I/O, growth path
└── scripts/
    ├── server.mjs              # MCP stdio server (zero-dep)
    ├── scratch-memory.mjs      # CLI entry point + dispatcher
    ├── handoff.mjs             # handoff subcommands (commit, path, validate, list, commit-session)
    ├── handoff-legacy.mjs      # V1→V2 upgrade machinery (EXPECTED_SECTIONS_V1, HANDOFF_TEMPLATE_V2) — consumed only by pickup's legacy migration
    ├── pickup.mjs              # pickup verb (top-level sibling)
    ├── cat-sessions.mjs        # cat-sessions verb — assembles chronological session log (read-only; stdout only)
    ├── rewrite-pointer.mjs     # rewrite-pointer verb — writes thin V3 HANDOFF.md atomically from sessions/ and groom-closes.md
    ├── tasks.mjs               # tasks verb group (list, lint, schema, version, done) + the shared lint/scan/render core write_task and --with-tasks both consume; TASKS_METHODOLOGY_VERSION and the groom.yaml marker read/write; writeFileAtomic, the tmp-then-rename write the close verbs and groom.yaml share; also owns the epic/spike graph traversal and its lint rules
    ├── session.mjs             # session verb group (lint, mark-groomed, radius, close, mark-event-groomed) — lintSession, the task-data and version checks cat-sessions --with-tasks reduces to GROOM: lines, and the event groom's rows, ledger closes and marks
    ├── epics.mjs               # epics verb group (frontier, graph) — thin dispatch over tasks.mjs's graph traversal; reads the issues corpus, writes stdout only
    ├── wrap.mjs                # wrap verb group (collect) — gathers a workstream's wrap-up items into wrap/items.json; reads sessions via cat-sessions.mjs's assembleSessions in-process; session.mjs imports its git helper
    ├── repos.mjs               # repos verb group (add, remove, suppress, list, resolve, owner) + the side-effect-free library that reads, merges, locks and writes the three registered-repos files; wrap.mjs, issues.mjs and session.mjs (withLock) import it
    ├── issues.mjs              # issue verb group (write, close, mark-groomed, mark-refreshed) + writeIssue, the validation, git snapshot and render server.mjs's write_issue also calls, taking a target root and a context root; session.mjs imports parseArgs and readInput
    ├── pickup-with-pid.mjs     # legacy test fixture — in-process pickup via self-PID write; PID name injection is a post-redesign no-op (session_name always null); not a runtime entry
    ├── register.mjs            # register subcommands (add, remove, status, install-hooks)
    ├── hooks/
    │   ├── handoff-validate.sh # PostToolUse loose-validation hook (opt-in)
    │   └── scratch-lint.sh     # PostToolUse lint hook for the tasks/issues corpora (opt-in)
    └── install.sh              # one-time machine setup
```

The tree above lists production modules. Tests follow one convention — one `test-{module}.mjs` per module it covers, as a flat sibling of the production `.mjs` files in `scripts/`: `test-handoff.mjs`, `test-pickup.mjs`, `test-tasks.mjs`, `test-session.mjs`, `test-epics.mjs`, `test-wrap.mjs`, `test-repos.mjs`, `test-issue-cli.mjs` (the `issue` verbs), `test-write-issue.mjs`, `test-write-task.mjs`, `test-write-report.mjs`, and `test-write-review-enums.mjs`, plus the shared `test-driver.mjs` and `test-fixtures.mjs` helpers the rest of them drive through.

## Verb I/O

| Verb | Reads | Writes |
|---|---|---|
| `cat-sessions` | `<session-dir>/sessions/*.md` and `<session-dir>/groom-closes.md` — read-only | stdout only (no filesystem writes) |
| `rewrite-pointer` | `<session-dir>/sessions/*.md` and `<session-dir>/groom-closes.md` via `cat-sessions` | `<session-dir>/HANDOFF.md` — atomic overwrite (V3 thin pointer) |
| `tasks list` | `<session-dir>/tasks/*.md` — read-only | stdout only (no filesystem writes) |
| `tasks lint` | the given file, or every matching `*.md` in the given directory — read-only. A file target carrying `role:`, `epic:` or `blocked_by:` also reads the whole sibling corpus, for the graph rules | stdout only (no filesystem writes) |
| `session lint` | `<session-dir>/tasks/t-*.md`, `<session-dir>/groom.yaml`, `<session-dir>/groom-closes.md`, and `<session-dir>/sessions/*.md` — read-only | stdout only (no filesystem writes) |
| `session mark-groomed` | `<session-dir>/groom.yaml`, for the keys it keeps | `<session-dir>/groom.yaml` — atomic overwrite |
| `session radius` | `<session-dir>/sessions/*.md`, `tasks/t-*.md`, `groom.yaml`, `groom-closes.md`, and `git rev-parse`, `git cat-file`, `git log` and `git show` in the repo and the scratch subrepo — read-only | stdout only (no filesystem writes) |
| `session close` | `<session-dir>/sessions/*.md`, `groom-closes.md`, and the quote file or stdin | `<session-dir>/groom-closes.md` — atomic overwrite with the line appended, under a directory lock beside it (`groom-closes.md.lock`); then `<session-dir>/HANDOFF.md` through `rewrite-pointer`, in-process and under the same lock; the line to stdout |
| `session mark-event-groomed` | `<session-dir>/groom.yaml`, for the keys it keeps | `<session-dir>/groom.yaml` — atomic overwrite |
| `tasks done` | `<session-dir>/tasks/<task-id>-*.md` | that task file — atomic overwrite via `writeFileAtomic`; its path and `Done when:` line to stdout |
| `epics frontier` | `scratch/issues/*.md` — read-only | stdout only (never writes a file) |
| `epics graph` | `scratch/issues/*.md` — read-only | stdout only (never writes a file) |
| `wrap collect` | `<session-dir>/sessions/*.md`, `tasks/t-*.md`, `groom-closes.md`, every other file in the folder, the three registered-repos files, and `git log` / `git rev-parse` (plus `git diff --name-only <ref>..HEAD` under `--since-ref`) in the repo, the scratch subrepo and each listed registered repo | `<session-dir>/wrap/items.json` — plain overwrite; its path to stdout |
| `repos list`, `resolve`, `owner` | the three registered-repos files, and `git rev-parse` in each entry's path for its `ok` flag — read-only | stdout only (no filesystem writes) |
| `repos add`, `remove`, `suppress` | the file at the chosen level | that file — tmp-then-rename under a directory lock beside it (`<file>.lock`); a local-level write also appends to the repo's `.gitignore` when no line covers the file |
| `issue write` | stdin, and `git` in the current top level for the state snapshot | `<target>/scratch/issues/{slug}.md` — exclusive create, never the corpus directory itself |
| `issue close` | the issue file, and its resolution and summary inputs (a file or stdin) | `<target>/scratch/issues/{slug}.md` — atomic overwrite via `writeFileAtomic` |
| `issue mark-groomed`, `mark-refreshed` | each named issue file, and `git rev-parse --short HEAD` in the target | each named issue file — atomic overwrite via `writeFileAtomic`, one at a time |

## Data layout

Per project, never leaves the project:
```
{project}/scratch/
└── .scratch-memory/
    └── audit.jsonl       # one line per write, for retrospectives
```

Reports go to their natural home in the workflow's scratch folders (e.g. `{project}/scratch/my-feature/steps/step-01/coder-iter1-*.md`).

## Growth path

Five MCP tools are currently implemented (`write_report`, `write_review`, `write_issue`, `write_session`, `write_task`). The CLI verb surface grew in the handoff-cat-pickup cycle: `cat-sessions` and `rewrite-pointer` are first-class top-level verbs that own HANDOFF.md regeneration on the `/handoff` hot path, and the legacy V1/V2 in-place write/validate paths in `handoff commit`/`validate` have since been retired in favor of a `rewrite-pointer` redirect.

`wrap` is the ninth verb group and the newest, added for the `/wrap-up` skill's collect pass. `session`, the eighth, added workstream task-data checks and the `groom.yaml` marker, and has since gained the surface's most recent verbs, the event groom's: `radius`, `close`, which appends to the ledger `groom-closes.md`, and `mark-event-groomed`, which stores the event marks in `groom.yaml`. `epics`, the seventh, added the epic/spike graph over the issues corpus and is worth studying as **the shape this surface grows in**: the epic/spike frontmatter keys arrived as **optional parameters on the existing `write_issue`** rather than as a sixth MCP tool, and the read side arrived as a CLI verb. Keep the read side on the CLI — this server has no read-side MCP tool and wants none.

Future candidates:

| Surface (future) | Purpose |
|---|---|
| `scratch-memory handoff fork` (CLI verb) | Copy (not rename) a handoff folder to a new session id. Preserves source as-is. For branching workstreams without ownership takeover. |
| `mark_criterion` (MCP tool) | Flip a plan acceptance-criterion checkbox in a step file |
| `append_decision` (MCP tool) | Structured entry in a project's `decisions.md` |
| `record_event` (MCP tool) | Workflow event stream (dispatched, returned, failed, etc.) |
| `update_task` (MCP tool) | Mutate an existing task's fields (status, `blocked_on`, etc.) after creation. Deferred: v1 mutations other than the `done` close (`scratch-memory tasks done`) are hand Edits to the task file, guarded by the `scratch-lint.sh` PostToolUse hook; revisit only if hand-edit drift is observed despite the hook. |
| `/capture-task` (command) | A slash-command wrapper around `write_task`, mirroring `/capture-issue`. Deferred: ad-hoc main-session invocation already covers the observed need, and a command would add a gate without adding a guarantee — Invariant 2 is enforced by caller-wiring convention either way. |
