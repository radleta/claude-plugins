---
tags: [claude-code/platform-features]
summary: "Orchestrating claude -p (print/headless mode) from inside a running session: path-as-reference I/O, session continuity, output formats, and multi-turn flows"
---

# claude -p Orchestration

Expert knowledge for orchestrating `claude -p` (print/headless mode) from inside a running Claude Code session. Source: `claude-dash-p-expert` skill.

## Core Thesis: path-as-reference

> **The prompt is a short imperative that names a file path. Claude reads the file with the Read tool. Bytes never travel through argv or stdin.**

The correct pattern:
```bash
claude -p "Follow the instructions at $WORK/instructions.md and write the result to $WORK/result.md"
```

**NOT** piping content through stdin (`claude -p < prompt.md`) — that folds bytes into the user message and breaks prefix caching.

| | Bytes-into-prompt | Path-as-reference |
|---|---|---|
| Cache behavior | Breaks prefix cache on any change | Stable prompt; cache holds |
| Token cost | Full prompt as fresh input tokens | Tiny stable prompt |
| Diagnosability | Ephemeral | Persists on disk |

## Key Flags

| Flag | Purpose |
|------|---------|
| `-p` / `--print` | Non-interactive mode |
| `--output-format text\|json\|stream-json` | Output format |
| `--model sonnet\|opus\|haiku` | Model selection |
| `--session-id <id>` | Resume/fork from known session |
| `--resume <id>` | Resume session for follow-up turns |
| `--continue` | Continue most recent session |
| `--append-system-prompt-file <path>` | Stable additional system context |
| `--max-turns <N>` | Bound agentic turns |
| `--no-api-key` | Run with no key (for testing) |

## Output Formats

**`--output-format text`** (default): Raw response text

**`--output-format json`**: Full result.json with usage, modelUsage, permission_denials, stop_reason

**`--output-format stream-json`**: NDJSON events (system/init, api_retry, stream_event content deltas) — use for live orchestration

## Session Continuity

```bash
# Start fresh, capture session ID from result.json
SESSION=$(claude -p "Step 1: ..." --output-format json > result.json && jq -r '.session_id' result.json)

# Follow-up turn in same context
claude -p "Step 2: ..." --resume "$SESSION"
```

`--resume` continues the same context window. `--session-id` is used to fork from a known session.

## Multi-Turn Orchestration

The `stream-json` output stream emits `{type: "system/init", session_id: "..."}` as the first event. Capture it to get the session ID for follow-up turns without waiting for the full result.

## Anti-Recursion Rule

**Sub-agents MUST NOT spawn `claude -p`** from inside a Claude Code session when dispatched as a sub-agent. Fresh `claude -p` sessions do not inherit sub-agent constraints and create unbounded recursion vectors. The `Anti-Recursion (Sub-Agent Boundary)` section of `~/.claude/CLAUDE.md` documents this prohibition.

## Cost Comparison: claude -p vs Agent Tool vs MCP

| Method | Context isolation | Caching | Tool access | Best for |
|--------|-------------------|---------|-------------|---------|
| `claude -p` via Bash | Full isolation | Fresh prefix | All configured | Long autonomous tasks needing fresh context |
| Agent tool | Sub-agent isolation | System-prompt cached | Declared in agent YAML | Repeated dispatches (cheaper via cache) |
| MCP server | No isolation (same session) | N/A | MCP tools only | Structured write-only operations (verdicts, reports) |

## path-as-reference Discipline

Per-call working directory pattern:
```bash
WORK=$(mktemp -d)
cat > "$WORK/instructions.md" << 'EOF'
Read the following files and write a summary to ./result.md ...
EOF
claude -p "Follow the instructions at $WORK/instructions.md" --output-format json > "$WORK/result.json"
```

Benefits:
- Every call is diagnosable (instructions and result on disk)
- Reproducible (replay any call by inspecting the files)
- Cache-friendly (stable prompt prefix)

## Prompt-Cache Reuse

Use `--append-system-prompt-file` for stable additional system context across multiple calls:
```bash
claude -p "..." --append-system-prompt-file ~/.claude/stable-context.md
```

The file content gets cached after the first call. Changing the file busts the cache.

## Gotchas

- `claude -p < prompt.md` looks file-based but isn't — stdin is folded into user message, busting prefix cache
- Sessions created by `claude -p` have their own isolated transcript at `~/.claude/projects/.../subagents/`
- `--continue` uses the most recent session in cwd; `--resume <id>` is explicit and safer
- Windows: use forward slashes in paths even in Bash tool calls

## See Also

- [Session Data](session-data.md) — Parsing claude -p result.json and stream-json output
- [Hooks](hooks.md) — Hook system for events triggered by claude -p sessions
- [Agent Teams](teams.md) — Teams as an alternative to claude -p for parallel agent orchestration
