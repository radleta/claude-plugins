---
tags: [claude-code/platform-features]
summary: "Claude Code hooks system: event types, settings.json structure, matcher patterns, exit code semantics, stdin/stdout/stderr contracts, and loop prevention"
---

# Claude Code Hooks

Validated patterns for configuring and debugging Claude Code hooks — the shell commands that execute in response to Claude Code lifecycle events. Source: `claude-hooks-expert` skill.

## Hook Architecture

```
Claude Code Event (Stop, PreToolUse, PostToolUse, ...)
    |
    v
.claude/settings.json  →  hooks.[EventName][]
    |
    v
matcher filter (tool name, "" = all)
    |
    v
hooks[] array  →  shell commands executed sequentially
    |
    v
exit code + stderr  →  determines Claude's behavior
```

## Settings File Structure

Hooks live in `.claude/settings.json` (project-scoped) or `~/.claude/settings.json` (user-scoped).

### Correct Format

```json
{
  "hooks": {
    "EventName": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "bash my-script.sh",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

### Critical Structure Rules

| Rule | Detail |
|------|--------|
| Outer array | `hooks.EventName` is an array of **matcher groups** |
| Each group | Has `matcher` (string) + `hooks` (array of commands) |
| Each command | Has `type`, `command`, optional `timeout` |
| `matcher` | Tool name filter: `""` = all, `"Bash"` = Bash only, `"Edit\|Write"` = multiple |

### Common Mistake: Flat Structure

```json
// WRONG — hook will not fire
{
  "hooks": {
    "Stop": [
      { "type": "command", "command": "bash check.sh" }
    ]
  }
}

// CORRECT — matcher + hooks array
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [{ "type": "command", "command": "bash check.sh" }]
      }
    ]
  }
}
```

## Event Types

| Event | When It Fires | Matcher Applies To |
|-------|---------------|-------------------|
| `Stop` | Claude finishes a response | N/A (use `""`) |
| `PreToolUse` | Before a tool executes | Tool name (`"Bash"`, `"Edit"`, etc.) |
| `PostToolUse` | After a tool executes | Tool name |
| `Notification` | Notification shown to user | N/A |
| `SessionStart` | Session starts | N/A |
| `UserPromptSubmit` | User submits prompt | N/A |
| `PreCompact` | Before compaction | N/A |
| `PermissionRequest` | Permission requested | N/A |
| `SessionEnd` | Session ends | N/A |

## Exit Code Contract

| Exit Code | Meaning | Claude Behavior |
|-----------|---------|-----------------|
| **0** | Success | Continues normally, no output shown |
| **1** | Non-blocking failure | Warning shown, Claude continues (does NOT react) |
| **2** | Blocking failure | Claude sees stderr output and CAN react/fix |

**Critical:** If you want Claude to **see and respond to** hook output (e.g., fix compile errors), you MUST use exit code 2.

## Output Contract

| Stream | Purpose | When Visible to Claude |
|--------|---------|----------------------|
| **stderr** | Messages for Claude to see | On exit code 1 or 2 |
| **stdout** | Not used by hook system | Never shown to Claude |

**Critical:** Hook output MUST go to **stderr** for Claude to see it.

```bash
echo "Build failed" >&2   # CORRECT — Claude sees this
echo "Build failed"        # WRONG — Claude won't see this
```

## Stdin Contract

All hooks receive JSON on stdin with session context:

```json
{
  "session_id": "abc123xyz",
  "stop_hook_active": false,
  "transcript_path": "/home/user/.claude/projects/dGlnZXI/abc123xyz.jsonl"
}
```

| Field | Type | Purpose |
|-------|------|---------|
| `session_id` | string | Current Claude Code session ID |
| `stop_hook_active` | boolean | `true` if stop was triggered by a hook-initiated response; for loop prevention |
| `transcript_path` | string | Absolute path to the session's JSONL transcript file |

## Loop Prevention (Stop Hooks)

When a Stop hook fails (exit 2), Claude responds. When Claude stops again, the Stop hook fires again. Use `stop_hook_active` to break the loop:

```bash
INPUT="$(cat)"
if echo "$INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null | grep -q true; then
    exit 0  # Break the loop
fi
```

## Valid Hook Fields

| Field | Required | Type | Default | Description |
|-------|----------|------|---------|-------------|
| `type` | Yes | `"command"` | — | Always `"command"` |
| `command` | Yes | string | — | Shell command to execute |
| `timeout` | No | number (seconds) | 600 | Max execution time |

**Invalid fields** (silently ignored): `statusMessage`, `description`, `name`

## Debugging

| Symptom | Check | Fix |
|---------|-------|-----|
| Hook doesn't fire | Structure correct? | Must be `matcher` + `hooks` array (not flat) |
| Hook fires but Claude doesn't react | Exit code? | Must be **2** (blocking), not 1 |
| Hook fires but Claude doesn't react | Output stream? | Must write to **stderr**, not stdout |
| Infinite loop | Stop hook? | Check `stop_hook_active` from stdin JSON |
| Hook stops after edit | Windows .cmd? | Use `node node_modules/typescript/bin/tsc` not `.bin/tsc` |

## Common Pitfalls

| Pitfall | Why It Fails | Fix |
|---------|-------------|-----|
| Flat hook structure | Missing `matcher` + `hooks` nesting | Use correct nested structure |
| stdout for errors | Claude only reads stderr | Write to stderr |
| Exit code 1 | Non-blocking, Claude ignores | Use exit code 2 for blocking |
| `statusMessage` field | Not a valid hook field | Remove it |
| No loop prevention | Infinite Stop → fix → Stop cycle | Check `stop_hook_active` or use process guard |
| Killing node processes | Hook scripts on Node.js may kill Claude | Never `taskkill /IM node.exe` — kill by PID only |

## To Block a Tool

Add a guard to `~/.claude/scripts/tool-guard.sh` — a centralized `PreToolUse` hook that reads the tool name from stdin JSON and exits with code 2 to block. Do NOT use `disallowTools` (not a real setting) or `permissions.deny` (doesn't cover built-in tools).

## See Also

- [Agent Teams](teams.md) — TeammateIdle, TaskCreated, TaskCompleted hook events for team orchestration
- [/rename and Session Folder Labels](../session-lifecycle/rename-and-session-labels.md) — session_id from hook stdin maps to session folder slug
- [Agent Constraint Drift](../agent-design/agent-constraint-drift.md) — Using PostToolUse hooks to detect tool constraint violations
