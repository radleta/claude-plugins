# Advanced Agent Features

This document covers advanced capabilities beyond basic agent creation: persistent memory, hooks, isolation, background execution, agent teams, the Agent SDK, CLI flags, and plugin distribution.

---

## Persistent Memory

Agents can maintain persistent memory across sessions using the `memory` field.

### Memory Scopes

| Scope | Location | Use When |
|-------|----------|----------|
| `user` | `~/.claude/agent-memory/<agent-name>/` | Learnings persist across all projects |
| `project` | `.claude/agent-memory/<agent-name>/` | Project-specific, shareable via VCS |
| `local` | `.claude/agent-memory-local/<agent-name>/` | Project-specific, not version controlled |

### How It Works

- The first **200 lines** of `MEMORY.md` in the memory directory are injected into the subagent's system prompt
- Read, Write, and Edit tools are **automatically enabled** so the subagent can manage its memory files
- Memory persists across sessions — the agent learns and improves over time

### Example

```yaml
---
name: project-expert
description: Project domain expert that learns and improves. Use when asking about project architecture, conventions, or history.
memory: project
---

You are a project domain expert. As you work, save important discoveries
about the project's architecture, conventions, and patterns to your memory.

Update MEMORY.md with validated findings. Organize by topic, not chronologically.
```

---

## Hooks in Agent Frontmatter

Agents can define lifecycle hooks scoped to their execution.

### Available Hook Events

| Event | Matcher Input | Fires When |
|-------|--------------|------------|
| `PreToolUse` | Tool name | Before a tool is called |
| `PostToolUse` | Tool name | After a tool completes |
| `Stop` | - | Converted to `SubagentStop` automatically |

### Example

```yaml
---
name: safe-coder
description: Code writer with automatic linting. Use when writing production code.
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-command.sh $TOOL_INPUT"
  PostToolUse:
    - matcher: "Edit|Write"
      hooks:
        - type: command
          command: "./scripts/run-linter.sh"
---
```

### Project-Level Subagent Hooks

In `settings.json`, you can hook into subagent lifecycle events:

| Event | Matcher | When |
|-------|---------|------|
| `SubagentStart` | Agent type name | Subagent begins execution |
| `SubagentStop` | Agent type name | Subagent completes |

---

## Worktree Isolation

Set `isolation: worktree` to run the agent in a temporary git worktree — an isolated copy of the repository.

```yaml
---
name: experimental-coder
description: Tries experimental approaches in isolation. Use when exploring risky code changes.
isolation: worktree
---
```

- Worktree is automatically cleaned up if the agent makes no changes
- If changes are made, the worktree path and branch are returned in the result
- Useful for risky or experimental operations that shouldn't affect the main working directory

---

## Background Execution

Set `background: true` to always run the agent as a background task.

```yaml
---
name: long-runner
description: Long-running analysis task. Use when running comprehensive codebase audits.
background: true
---
```

### Foreground vs Background

| Mode | Behavior | Permission Prompts | Questions |
|------|----------|-------------------|-----------|
| **Foreground** | Blocks main conversation | Pass through to user | Pass through to user |
| **Background** | Runs concurrently | Pre-approved before launch; auto-denied otherwise | Fail silently, agent continues |

**Tip:** Press **Ctrl+B** to background a running foreground task.

---

## Skills Preloading

The `skills` field injects skill content into the subagent's context at startup.

```yaml
---
name: quality-reviewer
description: Reviews code quality using expert testing patterns. Use when reviewing test quality.
skills:
  - qa-expert
  - typescript-expert
---
```

Skills are fully loaded (not just made available) — the entire skill content is injected into the subagent's system prompt context.

---

## MCP Servers

The `mcpServers` field configures Model Context Protocol servers available to the subagent.

### By-Name Reference

Reference MCP servers already configured in the session (via `claude mcp add` or `.mcp.json`):

```yaml
mcpServers:
  - chrome-devtools
  - database-server
```

### Inline Definition

Define the MCP server directly in the agent frontmatter:

```yaml
mcpServers:
  chrome-devtools:
    command: cmd
    args: ["/c", "npx -y chrome-devtools-mcp@latest --isolated"]
```

**Windows note:** Wrap `npx` commands with `cmd /c` on native Windows (not WSL), otherwise the stdio transport fails silently.

### Critical Gotchas

- **MCP must be healthy in the session.** If the MCP server fails to start (e.g., Chrome not found for `--isolated` mode), the subagent receives zero MCP tools with **no error**. The agent simply doesn't see the tools.
- **Rogue agent anti-pattern:** When MCP tools are missing, agents may improvise — writing their own scripts to connect directly to the protocol. Add explicit constraints: "Use ONLY MCP tools. Never write scripts to work around missing MCP tools."
- **`permissions.deny` is session-global.** Denying MCP tools (e.g., `mcp__chrome-devtools__*`) blocks them for both the main session AND all subagents. There is no per-agent permissions override.

---

## Token Isolation Pattern

Subagents are ideal for isolating token-hungry MCP tools (e.g., Chrome DevTools, database queries). The MCP output stays in the subagent's context window; only a concise summary returns to the caller.

```yaml
---
name: chrome-browser
description: "REQUIRED for ALL browser operations. NEVER call mcp__chrome-devtools__* tools directly — ALWAYS delegate to this agent instead."
mcpServers:
  - chrome-devtools
skills:
  - chrome-devtools-agent
model: inherit
memory: user
---
```

### Routing MCP Through Subagents

There is no technical mechanism to block the main session from calling MCP tools while allowing subagents to use them (`permissions.deny` is session-global, hooks lack subagent context). Use a **pushy agent description** as soft enforcement:

- Include "REQUIRED" and "NEVER call directly" in the description
- Explain the cost: "Direct MCP calls waste the main context window with verbose data"
- This reliably routes Claude through the subagent instead of calling MCP directly

### Design Considerations

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| Token cost | ~27-30k tokens per simple browser task | Acceptable given main session isolation |
| Resume | End responses with "resume this agent" hint | Avoids re-navigation and context rebuild |
| Session dirs | `.tool-name/{timestamp}-{hex}/` | Parallel-safe, per-project, gitignored |
| Tool restrictions | Inherit all (no `tools` field) | Restricting Edit while giving Bash is security theater |

---

## Permission Modes

The `permissionMode` field controls how the agent handles permission prompts.

| Mode | Behavior |
|------|----------|
| `default` | Normal permission prompts |
| `acceptEdits` | Auto-accept file edits, prompt for other tools |
| `dontAsk` | Skip files not in allowed list |
| `bypassPermissions` | No permission prompts (use with extreme caution) |
| `plan` | Read-only planning mode |

```yaml
---
name: autonomous-fixer
description: Autonomously fixes linting issues. Use when auto-fixing code style.
permissionMode: acceptEdits
tools: Read, Edit, Glob, Grep
---
```

### Permission Scoping Limitations

- **`permissions.deny` is session-global** — it applies to the main session AND all subagents. No per-agent override exists.
- **PreToolUse hooks lack subagent context** — `session_id` is shared between parent and subagent, and there is no `agent_id` or `caller_type` field in hook input.
- **Agent `tools`/`disallowedTools`** only scope built-in tools, not MCP tools, and do not override `permissions.deny`.

---

## Task(agent_type) — Restricting Subagent Spawning

When an agent runs as the **main thread** via `claude --agent`, it can restrict which subagent types it spawns using `Task(type1, type2)` syntax in the `tools` field.

```yaml
---
name: coordinator
description: Coordinates work across specialized agents.
tools: Task(worker, researcher), Read, Bash
---
```

- This is an **allowlist**: only `worker` and `researcher` subagents can be spawned
- If `Task` is omitted entirely from tools, the agent cannot spawn any subagents
- This restriction **only applies to agents running as the main thread** via `--agent`
- Regular subagents cannot spawn other subagents (no nesting)

---

## The `--agent` Flag

The `--agent` flag configures the **main Claude Code session** with a custom agent's system prompt, tool restrictions, and model.

```bash
# CLI usage
claude --agent my-custom-agent

# In settings.json (default for all sessions)
{
  "agent": "security-reviewer"
}
```

When active:
- System prompt is replaced with the agent's custom instructions
- Tool restrictions are applied from the agent definition
- Model uses the agent's designated model
- `Task` tool becomes available for spawning subagents

---

## The `--agents` Flag (Dynamic Agents)

Define subagents dynamically via JSON for a single session:

```bash
claude --agents '{
  "code-reviewer": {
    "description": "Expert code reviewer. Use proactively after code changes.",
    "prompt": "You are a senior code reviewer.",
    "tools": ["Read", "Grep", "Glob", "Bash"],
    "model": "sonnet"
  }
}'
```

### JSON Fields

| Field | Description |
|-------|-------------|
| `description` | When to delegate to this agent |
| `prompt` | System prompt content |
| `tools` | Array of tool names |
| `disallowedTools` | Array of denied tool names |
| `model` | Model to use |
| `skills` | Skills to preload |
| `mcpServers` | MCP server configurations |
| `maxTurns` | Maximum agentic turns |

---

## Plugin Distribution

Agents can be distributed as part of Claude Code plugins.

### Plugin Directory Structure

```
my-plugin/
  .claude-plugin/
    plugin.json          # Manifest (name, description, version)
  agents/                # Custom agent definitions
  skills/                # Skills
  commands/              # Slash commands
  hooks/                 # Event handlers
  .mcp.json              # MCP server configurations
  settings.json          # Default settings (can set "agent" key)
```

### Plugin Agent Priority

Plugin agents have the **lowest priority** (4th) in the storage location hierarchy. Project and personal agents override plugin agents with the same name.

### Plugin settings.json

Setting `agent` in a plugin's `settings.json` activates one of the plugin's agents as the main thread:

```json
{
  "agent": "security-reviewer"
}
```

---

## Agent Teams (Experimental)

Agent teams coordinate **multiple independent Claude Code sessions**. Enable with:

```
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

### Agent Teams vs Subagents

| | Subagents | Agent Teams |
|--|-----------|-------------|
| **Context** | Own context window; results return to caller | Fully independent sessions |
| **Communication** | Report back to main agent only | Teammates message each other directly |
| **Coordination** | Main agent manages all work | Shared task list with self-coordination |
| **Best for** | Focused tasks, result only matters | Complex work requiring discussion |
| **Token cost** | Lower (results summarized) | Higher (each is separate instance) |

### Architecture

| Component | Role |
|-----------|------|
| **Team lead** | Main session, creates team, spawns teammates |
| **Teammates** | Separate Claude Code instances |
| **Task list** | Shared work items teammates claim and complete |
| **Mailbox** | Inter-agent messaging system |

### Quality Gate Hooks

| Hook | Fires When | Exit Code 2 |
|------|-----------|-------------|
| `TeammateIdle` | Teammate about to go idle | Sends feedback, keeps working |
| `TaskCompleted` | Task being marked complete | Prevents completion, sends feedback |

### Best Practices

- Start with **3-5 teammates**
- Create **5-6 tasks per teammate** for optimal productivity
- Always have the **lead clean up** (not teammates)
- Teammates load project context (CLAUDE.md, MCP, skills) but NOT the lead's conversation

---

## Claude Agent SDK

The Claude Code SDK was **renamed to Claude Agent SDK**. It provides the same tools, agent loop, and context management programmatically.

### Installation

```bash
# TypeScript
npm install @anthropic-ai/claude-agent-sdk

# Python
pip install claude-agent-sdk
```

### Basic Usage

```python
from claude_agent_sdk import query, ClaudeAgentOptions

async for message in query(
    prompt="Find and fix the bug in auth.py",
    options=ClaudeAgentOptions(allowed_tools=["Read", "Edit", "Bash"]),
):
    print(message)
```

### SDK Subagent Definition

```python
agents={
    "code-reviewer": AgentDefinition(
        description="Expert code reviewer.",
        prompt="Analyze code quality and suggest improvements.",
        tools=["Read", "Glob", "Grep"],
    )
}
```

### Key Features

- Built-in tools: Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch, AskUserQuestion
- Hooks as callback functions (not shell commands)
- MCP server integration
- Session management (resume, fork)
- Authentication: Anthropic API, Amazon Bedrock, Google Vertex AI, Microsoft Azure

---

## Agents vs Skills vs Commands

### Decision Matrix

| Feature | Subagents | Skills | Agent Teams |
|---------|-----------|--------|-------------|
| **Context** | Isolated window | Main conversation | Fully independent |
| **Defined in** | `.claude/agents/*.md` | `.claude/skills/*/SKILL.md` | Created dynamically |
| **Auto-invoked** | Yes (via description) | Yes (unless disabled) | No (user requests) |
| **User-invocable** | Via "use X agent" | Via `/skill-name` | Via natural language |
| **Own tools** | Yes (configurable) | Limited (`allowed-tools`) | Yes (inherited) |
| **Own model** | Yes | Yes | Yes (per teammate) |
| **Persistent memory** | Yes (`memory` field) | No | No |
| **Hooks** | Yes (in frontmatter) | Yes (in frontmatter) | Yes (quality gates) |
| **Worktree isolation** | Yes | No | No |
| **Can spawn children** | No (no nesting) | No (unless `context: fork`) | No |

### When to Use What

- **Subagents**: Task is self-contained, produces verbose output, needs tool restrictions or own context
- **Skills**: Reusable prompts/workflows in main context, reference content, conventions
- **Main conversation**: Frequent back-and-forth, iterative refinement, latency matters
- **Agent Teams**: Complex parallel work requiring inter-agent discussion and collaboration

---

## Disabling Specific Subagents

In `settings.json`:

```json
{
  "permissions": {
    "deny": ["Task(Explore)", "Task(my-custom-agent)"]
  }
}
```

Or via CLI: `claude --disallowedTools "Task(Explore)"`

---

## Extended Thinking in Skills/Agents

Include the word "ultrathink" in skill/agent content to enable maximum extended thinking budget.

Hierarchy: `think` < `think hard` < `think harder` < `ultrathink`

---

## Subagent Constraints & Internals

- **No nesting**: Subagents cannot spawn other subagents (unless running as main thread via `--agent`)
- **System prompt**: Subagents receive only their custom system prompt + basic environment details, NOT the full Claude Code system prompt
- **Transcripts**: Stored at `~/.claude/projects/{project}/{sessionId}/subagents/agent-{agentId}.jsonl`
- **Auto-compaction**: Triggers at ~95% context capacity (override with `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`)
- **Description budget**: Descriptions loaded into context at 2% of context window (~16,000 char fallback, override with `SLASH_COMMAND_TOOL_CHAR_BUDGET`)
