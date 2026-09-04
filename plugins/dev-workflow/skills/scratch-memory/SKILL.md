---
name: scratch-memory
description: "Write-only persistence into a project's scratch/ — five MCP tools (write_report, write_review, write_issue, write_session, write_task) that let a sub-agent holding no Write/Bash/Edit persist structured output, plus the scratch-memory CLI (register, handoff, pickup, cat-sessions, rewrite-pointer, tasks, epics). Use when registering the MCP or its hooks, running /handoff or /pickup, wiring a sub-agent to write a verdict, capturing an issue or a task, linting the tasks/issues corpora, or deriving an epic's spike frontier — even for a single write call. A sub-agent that only calls `write_report` or `write_review` at runtime wants the slim `scratch-memory-verdicts` instead; that is a different test."
---

# Scratch Memory

Narrow MCP server exposing **write-only** tools for sub-agents to emit structured artifacts into a project's `scratch/` folder, plus a CLI that manages session lifecycle. Reads stay direct (Read/Glob). Writes go through this server so sub-agents with no Write/Bash/Edit capability can still persist their output.

> Reviewer/verifier sub-agents that only ever call `write_report` or `write_review` should preload the slim `scratch-memory-verdicts` skill instead of this one — it carries just those two tool contracts, not the full CLI/handoff/pickup/tasks surface.

## Why this exists

The `/implement-code` build lead and `/brainstorming` dispatch reviewer sub-agents whose verdicts live as timestamped markdown files. Verifiers must be **strictly read-only** for role integrity — a verifier holding Bash or Write will eventually decide to fix something it is reviewing.

The MCP tool is the narrow channel that lets a read-only verifier persist its verdict while holding no capability to modify code. **Its schema IS the boundary** — no file path parameter, no content-type override, just structured fields the server translates into a safe, append-only write under `scratch/`. Wired that way, the calling sub-agent's tool list becomes `Read, Grep, Glob, Skill, mcp__scratch-memory__<tool>` — narrow by construction.

## Setup

**One-time per machine.** Installs the `scratch-memory` CLI to `~/.local/bin/`:

```bash
bash ~/.claude/skills/scratch-memory/scripts/install.sh
```

The MCP server script stays in the skill directory, referenced by absolute path at registration time, so edits to `server.mjs` take effect on the next server spawn. Done when `scratch-memory --version` prints a version.

**Per project.** Register the MCP and bind a `project_root`:

```bash
cd /path/to/project
scratch-memory register add        # registers the MCP in this project, binds $(pwd) as project_root
```

Under the hood, that runs:
```
claude mcp add scratch-memory -- node /abs/path/to/server.mjs --project-root "$(pwd)"
```

Then **restart Claude Code in that project** — MCP tools resolve at session start. Done when `scratch-memory register status` reports the intended scope label and the bound `project_root`, and the `mcp__scratch-memory__*` tools appear in the restarted session.

**Choosing a scope:**

- **Local scope** (default) — registration lives in your personal Claude Code config, kept out of git, so teammates who clone the repo adopt it only if they choose to.
- **User scope** (`--user`) — registers machine-wide, available in every project. Project root resolves from `process.cwd()` at MCP spawn time, so one registration serves every project; leave `--project-root` off a user-scope registration.

Each `register add` log line includes a scope label — `(user scope)` or `(local scope)` — confirming which registration was written.

```bash
scratch-memory register add --user   # register at user scope (machine-wide, one-time)
scratch-memory register add          # register at local scope (project-only)
scratch-memory register status       # show current registration + bound project_root
scratch-memory register remove       # unbind from this project
scratch-memory register check        # check drift of local-scope MCP registration
scratch-memory register check --user # check drift of user-scope MCP registration
```

## Choosing a surface

Route by **caller class** — who invokes the surface, and from where. The table is exhaustive over the five write tools and the six runtime verb groups, each appearing exactly once. `register` is the seventh verb group and stays in the setup section above, since it runs before the MCP exists.

| Caller class | Surface | Called by, and for what |
|---|---|---|
| **sub-agent-invoked** | `write_report` | Read-only verifier sub-agents in `/implement-code`'s end-of-build wave (step 0) and the standalone `/verify-*` commands, step-based |
| **sub-agent-invoked** | `write_review` | Read-only reviewer sub-agents in `/brainstorming`'s review pass and the blog-writer craft loop, phase-based |
| **capture-invoked** | `write_issue` | The `/capture-issue` slash command on behalf of the human user; also the `researcher` sub-agent during D6 auto-heal drift filing (issue FIRST, before the wiki correction) |
| **slash-command-invoked** | `write_session` | `/handoff`, from the main session (as `mcp__scratch-memory__write_session`), writing the per-session file from main-session body composition |
| **main-session-ad-hoc** | `write_task` | The main session directly, when a work item surfaces mid-conversation — no command gate; neither `/handoff` nor `/pickup` creates tasks, and `/capture-task` is a growth-path candidate rather than a built command |
| **CLI-invoked** | `scratch-memory handoff` | `/handoff` — `scratch-memory handoff commit-session` validates and commits the per-session file to `scratch/S-{slug}/sessions/`. The other subcommands stay available for tooling, and `/handoff` itself calls only `commit-session` |
| **CLI-invoked** | `scratch-memory pickup` | `/pickup`, transferring ownership of a prior session's workstream folder. Called once per pickup before any `/handoff` write, so subsequent writes land in the right `scratch/S-{session_id}/` folder |
| **session-assembly** | `scratch-memory cat-sessions` | Assembles a chronological session log; powers `/pickup` resumption briefs and feeds `rewrite-pointer` |
| **pointer-rewrite** | `scratch-memory rewrite-pointer` | `/handoff` on the hot path; also a crash-recovery escape hatch for a stale or missing `HANDOFF.md` |
| **corpus lint** | `scratch-memory tasks` | The `scratch-lint.sh` PostToolUse hook and ad-hoc checks of the tasks and issues corpora |
| **graph query** | `scratch-memory epics` | `/discovery` and ad-hoc callers deriving an epic's ready spikes |

**Sub-agent roles.** Any sub-agent whose job is "review X and produce a structured verdict" while holding no Write/Bash/Edit writes through one of the two verdict tools:

- **`write_report`** (step-based; `/implement-code`'s end-of-build wave at step 0, and the standalone `/verify-*` commands) — code/quality verifiers (lint, conventions, drift), security verifiers (OWASP checks), completeness verifiers (stubs, deferrals).
- **`write_review`** (phase-based; phases `idea`, `spec`, `draft`, `plan`) — codebase-alignment reviewers at idea (thorough) depth; domain reviewers for idea, one dispatch carrying every relevant skill; the craft reviewer (draft phase, blog-writer loop); and the document-quality, creative, decision-traceability, combinatorial-completeness, step-quality, investigation-quality and spec-traceability roles, retained in the enum with no stage dispatching them since the 2026-09-04 dev-workflow cut.

A sub-agent needing to persist structured output reaches for `write_report`, `write_review`, or `write_issue`. `write_session` and `write_task` are main-session surfaces.

**Session-folder ownership.** For both `write_session` and `write_task`, Invariant 2 — "main session is the only writer for its own folder" (`handoff-methodology`) — is enforced by **caller-wiring convention**. There is no code-level ownership check on `session_id`; the sandbox confirms only that the resulting path stays under `scratch/`. Wire the caller correctly, because the server will not catch it for you.

## Boundaries

Each of these lands somewhere else:

| Situation | Where it goes |
|---|---|
| Writing source code files | Coder agents, which hold Write/Edit legitimately |
| Persisting append-only audit content | `write_report` or `write_review`. `scratch-memory handoff commit` is a no-op for V3 and a signpost for legacy V1/V2 folders, so it writes nothing |
| Amending an issue/idea capture | File a new capture referencing the prior slug — `write_issue` output is an immutable audit trail |
| Copying a handoff to a new session | Wait for `scratch-memory handoff fork` (future CLI verb, formerly sketched as `fork_handoff`). `scratch-memory pickup` always renames, so a successful pickup leaves no source folder behind |
| Cross-project state | Keep it in the owning project — the server is hard-bound to one `project_root` |

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

## Gotchas

- **Slug case normalization (MCP only)** — `mcp__scratch-memory__write_issue` applies a lowercase + slugify pass to the `slug_override` value: `wikieval-T1-` becomes `wikieval-t1-`. The CLI verb `scratch-memory` preserves case verbatim. To make a slug match across MCP and CLI calls, pass it lowercase to begin with. See also `wiki-memory` SKILL.md gotcha — wiki-write CLI preserves case the opposite way (verbatim).

## Reference

- [mcp-tools.md](mcp-tools.md) — the five write tools' parameters, write paths, frontmatter, return shapes, and error strings, plus the guarantees and error channel they share. Read before calling or wiring any `write_*` tool.
- [cli-verbs.md](cli-verbs.md) — six of the seven CLI verb groups: subcommands, output streams, JSON shapes, exit codes, the `scratch-lint.sh` hook, and session name resolution. `register` is the seventh and stays in the setup section above. Read before consuming a verb's output or diagnosing an exit code.
- [internals.md](internals.md) — file layout, per-verb I/O, and the growth path. Read when extending the server or the CLI, or when writing a test.
- `.claude/skills/scratch-issues-methodology/SKILL.md` — the `scratch/issues/` corpus lifecycle, `## Resolution` pairing rule, triage, and resolution procedure.
- `.claude/skills/handoff-methodology/SKILL.md` — handoff collision semantics and mid-workstream rename handling.
