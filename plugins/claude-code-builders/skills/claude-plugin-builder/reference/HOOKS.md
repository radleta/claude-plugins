# Hook Reference for Plugins

Hooks enable event-driven automation within plugins. They execute shell commands in response to Claude Code lifecycle events.

## Hook Event Types

### Events Supporting Command/HTTP Hooks with Prompt/Agent Access

| Event | Fires When | Block Support |
|-------|-----------|---------------|
| `PostToolUseFailure` | A tool call fails | Yes |
| `PreToolUse` | Before a tool executes | Yes (exit 2) |
| `Stop` | Agent is about to stop | Yes |
| `SubagentStop` | A subagent is about to stop | Yes |
| `TaskCompleted` | A background task completes | No |
| `TaskCreated` | A background task is created | No |
| `UserPromptSubmit` | User submits a prompt | Yes |

### Events Supporting Command/HTTP Hooks Only

| Event | Fires When |
|-------|-----------|
| `ConfigChange` | Settings change (block supported) |
| `CwdChanged` | Working directory changes |
| `Elicitation` | Claude asks user a question |
| `ElicitationResult` | User responds to elicitation |
| `FileChanged` | A file is modified |
| `InstructionsLoaded` | CLAUDE.md files are loaded |
| `Notification` | A notification is triggered |
| `PermissionDenied` | User denies a permission prompt |
| `PostCompact` | After context compaction |
| `PreCompact` | Before context compaction |
| `SessionEnd` | Session terminates |
| `StopFailure` | Stop hook itself fails |
| `SubagentStart` | A subagent launches |
| `TeammateIdle` | A team member becomes idle |
| `WorktreeCreate` | A git worktree is created |
| `WorktreeRemove` | A git worktree is removed |

## Hook Configuration in Plugins

### Inline in plugin.json

```json
{
  "name": "my-plugin",
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "command": "node ./hooks/pre-bash.js"
      }
    ],
    "UserPromptSubmit": [
      {
        "command": "bash ./hooks/on-submit.sh"
      }
    ]
  }
}
```

### External File Reference

```json
{
  "name": "my-plugin",
  "hooks": "hooks/config.json"
}
```

## Hook Semantics

### Exit Codes

| Exit Code | Meaning |
|-----------|---------|
| 0 | Success — continue normally |
| 2 | **Block** — prevent the action (only on blockable events) |
| Other non-zero | Error — logged but doesn't block |

### Stdin/Stdout Contract

- **Stdin**: JSON object with event context (tool name, arguments, etc.)
- **Stdout**: JSON object with optional `decision` field
- **Stderr**: Logged for debugging

### Block Decision Format

```json
{
  "decision": "block",
  "reason": "Explanation shown to Claude"
}
```

### Matcher Field

The `matcher` field filters which tool triggers a `PreToolUse` or `PostToolUse` hook:

```json
{
  "matcher": "Bash",
  "command": "node ./hooks/check-bash.js"
}
```

Without a matcher, the hook fires for ALL tool uses of that event type.

## Hook Development Patterns

### Guard Pattern (Blocking Dangerous Actions)

```javascript
// hooks/guard-destructive.js
const input = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));

if (input.tool_name === 'Bash') {
  const cmd = input.tool_input?.command || '';
  const dangerous = ['rm -rf', 'drop table', 'force push'];
  
  for (const pattern of dangerous) {
    if (cmd.toLowerCase().includes(pattern)) {
      console.log(JSON.stringify({
        decision: 'block',
        reason: `Blocked dangerous command containing "${pattern}"`
      }));
      process.exit(2);
    }
  }
}

process.exit(0);
```

### Logger Pattern (Observing Without Blocking)

```bash
#!/bin/bash
# hooks/log-activity.sh
# Reads stdin, logs event, exits 0 (never blocks)
INPUT=$(cat)
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "$TIMESTAMP: $INPUT" >> /tmp/claude-activity.log
exit 0
```

### Notification Pattern (User Alerts)

```javascript
// hooks/notify-on-stop.js
const input = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
// Send notification via OS-specific mechanism
// (toast on Windows, osascript on macOS, notify-send on Linux)
process.exit(0);
```

## Best Practices for Plugin Hooks

- **Always exit cleanly** — unhandled exceptions leave hooks in unknown state
- **Keep hooks fast** — they run synchronously and block the event pipeline
- **Use matchers** — filter to specific tools rather than processing all events
- **Log to files** — stderr is captured but files are more reliable for debugging
- **Test with `--plugin-dir`** — verify hooks fire correctly before publishing
- **Don't trigger alerts** — browser modal dialogs block all further events
- **Handle missing stdin gracefully** — some events provide minimal context

## See Also

- [SKILL.md](../SKILL.md) — Main orchestrator with plugin architecture, creation workflow, and validation checklist
- [MARKETPLACE.md](MARKETPLACE.md) — Marketplace creation and distribution
- [BEST-PRACTICES.md](BEST-PRACTICES.md) — Context budget, component design, testing strategies
