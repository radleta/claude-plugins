---
tags: [claude-code/platform-features]
summary: "Agent teams feature: enablement, tools (TeamCreate, TaskCreate, SendMessage), display modes, hooks, permissions, token costs, and troubleshooting"
---

# Claude Code Agent Teams

Complete technical reference for the agent teams feature. Source: `claude-teams-expert` skill.

**Status:** Experimental (v2.1.32+). Enable via:
```json
{
  "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" }
}
```

## Architecture

| Component | Role | Storage |
|-----------|------|---------|
| **Team lead** | Main session that creates team, spawns teammates, coordinates | Conversation context |
| **Teammates** | Independent Claude Code instances with own context windows | Own conversation context |
| **Task list** | Shared work items with dependency tracking and auto-unblocking | `~/.claude/tasks/{team-name}/` |
| **Mailbox** | Inter-agent messaging (SendMessage) | Ephemeral (not persisted) |
| **Team config** | Runtime state — auto-managed, do not edit | `~/.claude/teams/{team-name}/config.json` |

Teammates load project context (CLAUDE.md, MCP servers, skills) but **not** the lead's conversation history. Each teammate is a fully independent session.

## Core Tools

### TeamCreate / TeamDelete

```javascript
TeamCreate({ name: "my-feature-team" })
TeamDelete({ name: "my-feature-team" })  // Fails if teammates still active
```

One team per session. Clean up existing team before creating a new one. If TeamDelete fails with stale members (bug [#31389](https://github.com/anthropics/claude-code/issues/31389)), use `team-guard remove-member <team-name> <member-name>`.

### TaskCreate / TaskUpdate / TaskGet / TaskList

```javascript
TaskCreate({ subject: "Implement user model", description: "...", team_name: "my-feature-team" })
TaskUpdate({ task_id: "task-123", status: "in_progress", owner: "coder-a" })
TaskList({ team_name: "my-feature-team" })
```

Task states: `pending` → `in_progress` → `completed`. Blocked tasks auto-unblock when dependencies complete. File locking prevents race conditions.

### SendMessage

```javascript
SendMessage({ to: "coder-a", message: "Read step file at scratch/.../step-03.md" })
SendMessage({ to: "*", message: "All tasks complete, shutting down team" })  // Broadcast
```

Broadcast costs scale linearly with team size — prefer direct messages. Shutdown pattern: `SendMessage({ to: "coder-a", message: { type: "shutdown_request", reason: "Work complete" } })`.

**Warning:** SendMessage returns `success: true` for dead teammates after TeamDelete — confirmed bug. Use the hook guard pattern (see below) to prevent waiting for replies that never come.

## Spawning Teammates

```javascript
Agent({
  team_name: "my-feature-team",
  name: "coder-a",
  prompt: "You are a coder teammate. Read your task at ~/.claude/tasks/my-feature-team/..."
})
```

## Display Modes

| Mode | Backend | When |
|------|---------|------|
| `in-process` | Same terminal (default) | Windows Terminal, VS Code, Ghostty |
| `tmux` | Split pane | macOS iTerm2, tmux terminal |
| `auto` | Detect best | Let Claude choose |

## Team Hooks

```json
{
  "hooks": {
    "TeammateIdle": [{"matcher": "", "hooks": [{"type": "command", "command": "bash notify.sh"}]}],
    "TaskCreated": [{"matcher": "", "hooks": [{"type": "command", "command": "bash on-task.sh"}]}],
    "TaskCompleted": [{"matcher": "", "hooks": [{"type": "command", "command": "bash on-done.sh"}]}]
  }
}
```

## Hook Guard Implementation

Prevent SendMessage calls to dead teammates using a PreToolUse hook:

```bash
#!/bin/bash
# hook-guard.sh — reads stdin JSON, extracts session_id, validates teammate is alive
INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
if [ -z "$SESSION_ID" ]; then exit 0; fi
# Check if teammate session is still active...
```

See `.claude/skills/claude-teams-expert/hook-guard-implementation.md` for the full implementation (file remains at original path post-Phase-2).

## Token Cost Modeling

- **Lead context:** Full conversation history; grows with each turn
- **Teammate context:** Fresh per session; only sees project CLAUDE.md + spawn prompt
- **Broadcast cost:** O(n) messages × teammate count — use sparingly
- **Task polling:** Each TaskList call costs tokens; prefer event-driven (hook) patterns

## Key Limitations

| Limitation | Workaround |
|-----------|------------|
| One team per session | TeamDelete existing team first |
| No nested teams | Agent tool unavailable to teammates; lead orchestrates all delegation |
| No session resumption | Checkpoint all state in files on disk |
| No persistent shared channel | Use step files + task list as persistent shared state |
| `skills:` / `mcpServers:` not applied to teammates | Instruct teammates to load skills via Skill tool in spawn prompt |
| SendMessage deferred for teammates | Include `ToolSearch select:SendMessage` in spawn prompt |
| Agent tool unavailable to teammates | Lead spawns separate verifier teammates |
| Plain text invisible to lead | Always use SendMessage for lead communication |

## Known Bugs (GitHub)

- [#40270](https://github.com/anthropics/claude-code/issues/40270) — Agent tool with `team_name` fails with internal error
- [#33045](https://github.com/anthropics/claude-code/issues/33045) — `isolation: "worktree"` has no effect for team agents
- [#28048](https://github.com/anthropics/claude-code/issues/28048) — Team tools not available in VS Code extension
- [#31389](https://github.com/anthropics/claude-code/issues/31389) — Teammate ignores shutdown_request and loops idle notifications (in-process backend)
- SendMessage false-success — confirmed bug, no issue filed

## Platform vs Skill Boundaries

The teams platform provides infrastructure (spawning, messaging, task tracking). Skills must implement:
- Reporting protocol (how teammates report completion)
- Self-verification (teammates verify their own work)
- Shutdown acknowledgment (how leads know teammates are done)
- Quality gates (pre/post-task validation)

See `claude-teams-expert/platform-vs-skill-boundaries.md` for the full mapping (file remains at original path post-Phase-2).

## See Also

- [/rename and Session Folder Labels](../session-lifecycle/rename-and-session-labels.md) — Session IDs and naming conventions for teammate sessions
- [Agent Constraint Drift](../agent-design/agent-constraint-drift.md) — Constraint drift in teammate agent definitions
