---
tags: [claude-code/platform-features]
summary: "Parsing Claude Code local session data — JSONL transcripts, result.json, stream-json events, MCP reports, and hook progress — for token analysis and workflow profiling"
---

# Claude Code Session Data

Expert knowledge for parsing Claude Code local session storage to answer quantitative questions. Source: `claude-session-data-expert` skill.

## Core Storage Layout

Claude Code persists every session to a pair of files:

| Artifact | Path | Schema |
|---|---|---|
| Session transcript | `~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl` | One JSON object per line |
| Subagent transcripts | `~/.claude/projects/<encoded-cwd>/<parentSessionId>/subagents/agent-<taskId>.jsonl` + `.meta.json` | Per-subagent isolated context |
| `claude -p` result | wherever you redirect stdout (commonly `outputs/result.json`) | Single JSON object |
| stream-json events | wherever you redirect stdout | NDJSON, one event per line |
| Background tasks | `%TEMP%/claude/<encoded-cwd>/<sessionId>/tasks/<taskId>.output` | Often empty files |
| Command history | `~/.claude/history.jsonl` | `{display, pastedContents, timestamp, project}` per line |
| MCP reports | `scratch/<project>/steps/step-<NN>/<role>-iter<N>-<ts>.md` | YAML frontmatter + markdown body |
| Learned files | `scratch/<project>/learned/*.md` | YAML frontmatter + markdown body |

## JSONL Transcript Schema

Each line is a JSON object with `role` and `content`:

- `role: "user"` — user messages and tool results
- `role: "assistant"` — Claude's responses
- `role: "system"` — system messages

Usage data lives in the last `assistant` message:

```json
{
  "role": "assistant",
  "message": {
    "model": "claude-3-5-sonnet-20241022",
    "usage": {
      "input_tokens": 1500,
      "output_tokens": 300,
      "cache_read_input_tokens": 100,
      "cache_creation_input_tokens": 0
    }
  }
}
```

## result.json (claude -p output)

When running `claude -p --output-format=json`, the result.json gives a precomputed summary:
- `usage` — total tokens (input, output, cache_read, cache_creation)
- `modelUsage` — per-model breakdown (Opus/Sonnet/Haiku)
- `permission_denials` — list of blocked tool calls
- `stop_reason` — why the session ended

## stream-json Events

Running `claude -p --output-format=stream-json` emits NDJSON events:
- `system/init` — session initialization
- `api_retry` — retry after API error
- `plugin_install` — plugin loading events
- `stream_event` — content deltas (text, tool use, tool result)

## Per-Agent Analysis

Find subagent dispatches by grouping JSONL on `subagent_type`:

```bash
# Count dispatches by agent type
jq -r '.subagent_type // "main"' session.jsonl | sort | uniq -c
```

Subagent transcripts are in the `subagents/` subfolder. The `.meta.json` sibling contains `{agentType, description}`.

## Token/Cost Analysis

Compute context usage by summing: `input_tokens + cache_read_input_tokens + cache_creation_input_tokens`.

Cache hit rate: `cache_read_input_tokens / input_tokens` — higher = better prefix reuse.

2026 pricing (approximate):
- Opus: ~$15/$75 per M input/output tokens
- Sonnet: ~$3/$15 per M input/output tokens
- Haiku: ~$0.25/$1.25 per M input/output tokens
- Cache creation: ~1.25× input cost; cache read: ~0.1× input cost

## Filter Scripts

The `claude-session-data-expert` skill ships filter scripts (`.mjs` files) for common analysis tasks under its `filter-scripts/` and `scripts/` subdirectories. Reference files remain in the original location post-Phase-2.

## Analysis Recipes

See `references/analysis-recipes.md` in the source skill for common patterns:
- "Where did the tokens go in that run?"
- "How many fix-loop iterations did step N take?"
- "Which sub-agent consumed the most tokens?"
- "What was the cache hit rate for that batch?"

## Gotchas

- Background task output files (`tasks/*.output`) are often empty — metadata only
- `stop_hook_active` in hook stdin is for loop prevention; do NOT confuse with `stop_reason` in result.json
- The `encoded-cwd` path component is base64url of the working directory path
- Subagent transcripts are **authoritative** for per-agent token tallies (not the parent transcript)

## See Also

- [Hooks](hooks.md) — Hook stdin contract includes transcript_path for real-time session analysis
- [Agent Teams](teams.md) — Team-based session data: per-teammate transcripts in subagents/ subfolder
- [/rename and Session Folder Labels](../session-lifecycle/rename-and-session-labels.md) — How session IDs map to scratch/ folder slugs
- [Agent Constraint Drift](../agent-design/agent-constraint-drift.md) — Detecting drift via subagent transcript tool_use events
