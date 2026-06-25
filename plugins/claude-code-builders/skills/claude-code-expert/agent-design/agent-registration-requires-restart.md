---
tags: [claude-code/agent-design, claude-code/session-lifecycle]
updated: 2026-04-24
summary: "Creating new agent files mid-session doesn't register them for Agent tool dispatch until next session"
---

# Agent Registration Requires Session Restart

## The Gotcha

Creating a new `.claude/agents/*.md` file mid-session does **not** make that agent callable via `Agent({ subagent_type: "..." })` in the same session. The agent must exist before session start to be registered in the internal agent registry.

This applies to both UI autocomplete (`@agent-name`) and programmatic dispatch via the `Agent` tool — they draw from the same registration index built at session start.

### Behavioral breakdown

| Operation | Hot-reload | Requires Restart |
|-----------|------------|------------------|
| Edit existing agent file | Yes (tools, skills, model, prompt pick up changes) | No |
| Create new agent file | — | Yes |
| Dispatch via `Agent({ subagent_type: "..." })` | N/A | Needed if agent is new |
| Reference via `@agent-name` autocomplete | N/A | Needed if agent is new |

## Why This Matters

When designing a command that creates a new agent and then dispatches it in the same session, the dispatcher phase fails at runtime:

```
Agent({ subagent_type: "my-new-agent", ... })
# Returns:
# Agent type 'my-new-agent' not found. Available agents: [list of agents 
# from session start, excluding my-new-agent]
```

The file exists on disk and is well-formed, but the harness never loaded it into the session-scoped registry.

## Implications for Command Design

### Pattern 1: Sequential Sessions (Safest)

Write the agent file in session N, then `/clear` and start session N+1 to dispatch it:

```
Session N:
  /skill-builder create agent X
  /clear

Session N+1 (fresh):
  /command Y
  # Dispatches agent X successfully
```

### Pattern 2: Probe + Fallback (Intermediate)

Add a pre-flight check to your command that probes for the agent's availability before attempting dispatch. If missing, provide a clear message instead of silently falling back to a different agent:

```javascript
// Inside command dispatch logic
const agent_available = Agent({ 
  subagent_type: "my-new-agent", 
  tools: ["None"] 
})
if (!agent_available) {
  console.log("This command requires a fresh session after first install. "
    + "Agent registration happens at session start.");
  process.exit(1);
}
```

### Pattern 3: Inline Agent (Dependency Injection)

Avoid creating new agent files entirely. Inline the agent behavior as a command or skill in the same session, or use an existing agent that you dispatch with different prompts.

## Related Pages

- **[Agent Constraint Drift](agent-constraint-drift.md)** — When editing agents, keeping constraint descriptions in sync with tool changes
- **[Session-ID Lifecycle](../session-lifecycle/session-id-lifecycle.md)** — How sessions start and initialize their registries
- **[Command Dispatch Parity Patterns](../command-architecture/command-dispatch-parity-patterns.md)** — When commands dispatch agents vs. run inline
