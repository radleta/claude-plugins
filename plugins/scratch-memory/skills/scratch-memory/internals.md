# Scratch Memory — Layout & Growth Path

Reference companion to [SKILL.md](SKILL.md): where the code lives, what each verb touches, and how the surface is meant to grow.

A new surface is done when the code, the dispatch, and a test sibling all carry it: a new MCP tool extends `TOOLS` and the dispatch in `server.mjs`; a new CLI verb extends `scratch-memory.mjs`'s subcommand dispatch; either way it gains a `test-{module}.mjs` sibling. New MCP tools inherit the same server, `project_root` binding, and sandbox guarantee for free.

## File layout

```
.claude/skills/scratch-memory/
├── SKILL.md              # entry point — setup, caller-class routing, troubleshooting
├── mcp-tools.md          # the five write tools' contracts
├── cli-verbs.md          # six of seven CLI verb groups (register is in SKILL.md)
├── internals.md          # this file — layout, verb I/O, growth path
└── scripts/
    ├── server.mjs              # MCP stdio server (zero-dep)
    ├── scratch-memory.mjs      # CLI entry point + dispatcher
    ├── handoff.mjs             # handoff subcommands (commit, path, validate, list, commit-session)
    ├── handoff-legacy.mjs      # V1→V2 upgrade machinery (EXPECTED_SECTIONS_V1, HANDOFF_TEMPLATE_V2) — consumed only by pickup's legacy migration
    ├── pickup.mjs              # pickup verb (top-level sibling)
    ├── cat-sessions.mjs        # cat-sessions verb — assembles chronological session log (read-only; stdout only)
    ├── rewrite-pointer.mjs     # rewrite-pointer verb — writes thin V3 HANDOFF.md atomically from sessions/
    ├── tasks.mjs               # tasks verb group (list, lint) + the shared lint/scan/render core write_task and --with-tasks both consume; also owns the epic/spike graph traversal and its lint rules
    ├── epics.mjs               # epics verb group (frontier) — thin dispatch over tasks.mjs's graph traversal; reads the issues corpus, writes stdout only
    ├── pickup-with-pid.mjs     # legacy test fixture — in-process pickup via self-PID write; PID name injection is a post-redesign no-op (session_name always null); not a runtime entry
    ├── register.mjs            # register subcommands (add, remove, status, install-hooks)
    ├── hooks/
    │   ├── handoff-validate.sh # PostToolUse loose-validation hook (opt-in)
    │   └── scratch-lint.sh     # PostToolUse lint hook for the tasks/issues corpora (opt-in)
    └── install.sh              # one-time machine setup
```

The tree above lists production modules. Tests follow one convention — one `test-{module}.mjs` per module it covers, as a flat sibling of the production `.mjs` files in `scripts/`: `test-handoff.mjs`, `test-pickup.mjs`, `test-tasks.mjs`, `test-epics.mjs`, `test-write-issue.mjs`, `test-write-task.mjs`, `test-write-report.mjs`, and `test-write-review-enums.mjs`, plus the shared `test-driver.mjs` and `test-fixtures.mjs` helpers the rest of them drive through.

## Verb I/O

| Verb | Reads | Writes |
|---|---|---|
| `cat-sessions` | `<session-dir>/sessions/*.md` — read-only | stdout only (no filesystem writes) |
| `rewrite-pointer` | `<session-dir>/sessions/*.md` via `cat-sessions` | `<session-dir>/HANDOFF.md` — atomic overwrite (V3 thin pointer) |
| `tasks list` | `<session-dir>/tasks/*.md` — read-only | stdout only (no filesystem writes) |
| `tasks lint` | the given file, or every matching `*.md` in the given directory — read-only. A file target carrying `role:` or `epic:` also reads that epic's sibling files, for the graph rules | stdout only (no filesystem writes) |
| `epics frontier` | `scratch/issues/*.md` — read-only | stdout only (never writes a file) |

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

`epics` is the seventh and most recent verb group — added for the epic/spike graph over the issues corpus, and worth studying as **the shape this surface grows in**: the epic/spike frontmatter keys arrived as **optional parameters on the existing `write_issue`** rather than as a sixth MCP tool, and the read side arrived as a CLI verb. Keep the read side on the CLI — this server has no read-side MCP tool and wants none.

Future candidates:

| Surface (future) | Purpose |
|---|---|
| `scratch-memory handoff fork` (CLI verb) | Copy (not rename) a handoff folder to a new session id. Preserves source as-is. For branching workstreams without ownership takeover. |
| `mark_criterion` (MCP tool) | Flip a plan acceptance-criterion checkbox in a step file |
| `append_decision` (MCP tool) | Structured entry in a project's `decisions.md` |
| `record_event` (MCP tool) | Workflow event stream (dispatched, returned, failed, etc.) |
| `update_task` (MCP tool) | Mutate an existing task's fields (status, `blocked_on`, etc.) after creation. Deferred: v1 mutations are hand Edits to the task file, guarded by the `scratch-lint.sh` PostToolUse hook; revisit only if hand-edit drift is observed despite the hook. |
| `/capture-task` (command) | A slash-command wrapper around `write_task`, mirroring `/capture-issue`. Deferred: ad-hoc main-session invocation already covers the observed need, and a command would add a gate without adding a guarantee — Invariant 2 is enforced by caller-wiring convention either way. |
