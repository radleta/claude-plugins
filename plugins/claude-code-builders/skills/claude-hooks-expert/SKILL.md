---
name: claude-hooks-expert
description: "Claude Code hooks system: event types, settings.json structure, matcher patterns, exit code semantics, stdin/stdout/stderr contracts, and loop prevention. Use when configuring hooks, debugging hook behavior, writing Stop/PreToolUse/PostToolUse hooks, fixing hook output visibility, or troubleshooting why a hook doesn't fire or block — even for simple single-hook setups."
---

# Claude Code Hooks Expert

Validated patterns for configuring and debugging Claude Code hooks — the shell commands that execute in response to Claude Code lifecycle events.

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
      {
        "type": "command",
        "command": "bash check.sh",
        "timeout": 30
      }
    ]
  }
}

// CORRECT — matcher + hooks array
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "bash check.sh",
            "timeout": 30
          }
        ]
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

## Exit Code Contract

The exit code determines how Claude Code handles the hook result:

| Exit Code | Meaning | Claude Behavior |
|-----------|---------|-----------------|
| **0** | Success | Continues normally, no output shown |
| **1** | Non-blocking failure | Warning shown, Claude continues (does NOT react) |
| **2** | Blocking failure | Claude sees stderr output and CAN react/fix |

### Critical: Exit 2 for Blocking

If you want Claude to **see and respond to** hook output (e.g., fix compile errors), you MUST use exit code 2. Exit code 1 only shows a warning.

## Output Contract

| Stream | Purpose | When Visible to Claude |
|--------|---------|----------------------|
| **stderr** | Messages for Claude to see | On exit code 1 or 2 |
| **stdout** | Not used by hook system | Never shown to Claude |

### Critical: Use stderr

Hook output MUST go to **stderr** for Claude to see it. Stdout is ignored by the hook system.

```bash
# WRONG — Claude won't see this
echo "Build failed" >&1

# CORRECT — Claude sees this
echo "Build failed" >&2
```

In Node.js:
```javascript
// WRONG
process.stdout.write("Build failed\n");

// CORRECT
process.stderr.write("Build failed\n");
```

## Stdin Contract (Stop Hooks)

Stop hooks receive JSON on stdin with context about the current state:

```json
{
  "stop_hook_active": false
}
```

| Field | Type | Purpose |
|-------|------|---------|
| `stop_hook_active` | boolean | `true` if this stop was triggered by a hook-initiated response |

### Loop Prevention

When a Stop hook fails (exit 2), Claude responds to fix the issue. When Claude stops again, the Stop hook fires again. The `stop_hook_active` field prevents infinite loops:

```bash
# Read stdin and check for loop
INPUT="$(cat)"
if echo "$INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null | grep -q true; then
    exit 0  # Break the loop
fi
```

**Alternative:** Use a process guard like `just-one -e` to prevent concurrent/recursive runs.

## Valid Hook Fields

| Field | Required | Type | Default | Description |
|-------|----------|------|---------|-------------|
| `type` | Yes | `"command"` | — | Always `"command"` |
| `command` | Yes | string | — | Shell command to execute |
| `timeout` | No | number (seconds) | 600 | Max execution time |

### Invalid Fields

These do NOT exist and will be silently ignored or cause the hook to not load:

- ~~`statusMessage`~~ — Not a valid field
- ~~`description`~~ — Not a valid field
- ~~`name`~~ — Not a valid field

## Hot-Reload Behavior

Settings files are watched for changes. Hooks update automatically when `.claude/settings.json` is modified — **no restart required** in most cases. If a hook doesn't fire after a change, restart Claude Code.

## Debugging Hooks

### Hook Doesn't Fire

| Check | Fix |
|-------|-----|
| Structure correct? | Must be `matcher` + `hooks` array (not flat) |
| Event name correct? | Case-sensitive: `Stop`, `PreToolUse`, `PostToolUse` |
| JSON valid? | Validate with `jq . .claude/settings.json` |
| File location? | `.claude/settings.json` for project, `~/.claude/settings.json` for user |

### Hook Fires But Claude Doesn't React

| Check | Fix |
|-------|-----|
| Exit code? | Must be **2** (blocking), not 1 (non-blocking) |
| Output stream? | Must write to **stderr**, not stdout |
| Content? | stderr must have actual content (not empty) |

### Hook Causes Infinite Loop

| Check | Fix |
|-------|-----|
| Stop hook? | Check `stop_hook_active` from stdin JSON |
| Process guard? | Use `just-one -e` or similar to prevent concurrent runs |
| Exit code? | Ensure hook exits 0 when nothing to report |

## Examples

### Stop Hook: TypeScript Typecheck

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "bash check-projects.sh --changed",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

Script pattern:
```bash
#!/bin/bash
set -o pipefail
ERRORS=$(tsc --noEmit 2>&1)
if [ $? -ne 0 ]; then
    echo "$ERRORS" >&2    # stderr — Claude sees this
    exit 2                 # blocking — Claude reacts
fi
exit 0                     # silent success
```

### PostToolUse Hook: Lint After Edit

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "bash lint-changed.sh",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

### Multiple Hooks on Same Event

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          { "type": "command", "command": "bash check-types.sh", "timeout": 30 },
          { "type": "command", "command": "bash check-tests.sh", "timeout": 60 }
        ]
      }
    ]
  }
}
```

## Common Pitfalls

| Pitfall | Why It Fails | Fix |
|---------|-------------|-----|
| Flat hook structure | Missing `matcher` + `hooks` nesting | Use correct nested structure |
| stdout for errors | Claude only reads stderr | Write to stderr |
| Exit code 1 | Non-blocking, Claude ignores | Use exit code 2 for blocking |
| `statusMessage` field | Not a valid hook field | Remove it |
| Windows `.cmd` in spawn | `node_modules/.bin/tsc` is a .cmd | Use `node node_modules/typescript/bin/tsc` |
| No loop prevention | Stop hook → fix → stop hook → fix → ... | Check `stop_hook_active` or use process guard |
| Killing node processes | Hook scripts on Node.js may kill Claude | Never `taskkill /IM node.exe` — kill by PID only |
