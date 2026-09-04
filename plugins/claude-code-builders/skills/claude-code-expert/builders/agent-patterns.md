---
tags: [claude-code/builders]
summary: "Agent file authoring: YAML frontmatter fields, archetypes, description engineering, tool configuration, and advanced features"
---

# Agent Builder Patterns

Validated patterns for creating Claude Code agent files (`.claude/agents/*.md`). Source: `claude-agent-builder` skill.

## Agent Anatomy

Every `agent.md` = **YAML frontmatter** + **system prompt** (markdown body).

Subagents receive **only their custom system prompt** (plus basic environment details), **not** the full Claude Code system prompt. They run in their **own context window**.

## YAML Frontmatter Fields

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `name` | Yes | — | Kebab-case identifier |
| `description` | Yes | — | Critical for auto-discovery |
| `tools` | No | Inherit all | Comma-separated: `Read, Grep, Glob` |
| `disallowedTools` | No | None | Tools to deny |
| `model` | No | `'inherit'` | `sonnet`, `opus`, `haiku`, or `'inherit'` |
| `permissionMode` | No | `default` | `default`, `acceptEdits`, `dontAsk`, `bypassPermissions`, `plan` |
| `maxTurns` | No | Unlimited | Maximum agentic turns |
| `skills` | No | None | Skills to preload at startup |
| `mcpServers` | No | None | MCP servers available |
| `hooks` | No | None | Lifecycle hooks |
| `memory` | No | None | Persistent memory: `user`, `project`, or `local` |
| `background` | No | `false` | Always run as background task |
| `isolation` | No | None | Set to `worktree` for git worktree isolation |

## Description Engineering

The `description` field determines when Claude auto-invokes the agent.

Formula: `[WHAT the agent does]. Use when [WHEN 1], [WHEN 2], or [WHEN 3].`

Tips:
- Include 5+ trigger words (domain nouns + action verbs)
- Target 120-220 characters
- Add "Use proactively" for aggressive auto-delegation

## Thin Agent Pattern

Agents in this project follow the **thin agent pattern**: agent files are wiring only (~25 lines of YAML frontmatter), while methodology lives in skills referenced via the `skills:` field.

```
Agent (~25 lines)          Skill (~200-400 lines)
┌─────────────────┐       ┌──────────────────────┐
│ name, tools,    │──────▶│ Detection categories, │
│ skills: [X],    │       │ workflows, checklists,│
│ model, perms    │       │ output format, examples│
└─────────────────┘       └──────────────────────┘
  Edits take effect          Hot-reloads instantly
  immediately                (methodology updates)
```

## Agent Archetypes

| Archetype | When to Use | Key Sections |
|-----------|-------------|--------------|
| **Technical Specialist** | Deep tech expertise, code implementation | Competencies, Workflow, Technical depth |
| **Domain Expert** | Business knowledge, methodologies | Frameworks, Deliverables, Communication |
| **QA/Auditor** | Verification, validation, quality | Evaluation Dimensions, Checklists, Reports |
| **Utility** | Single focused task | Minimal structure, Specific constraints |

## System Prompt Structure

| Section | Purpose |
|---------|---------|
| **Role Definition** | "You are a world-class [ROLE]..." |
| **Primary Objective** | Single clear mission statement |
| **Core Principles** | 3-6 actionable beliefs |
| **Key Competencies** | 4-6 areas with specific tools/techniques |
| **Standard Workflow** | 4-8 actionable steps |
| **Constraints** | Specific "never/always" rules |
| **Communication Protocol** | Output format and deliverables |

## Cache-Aware System Prompt Architecture

Stable content belongs in the agent body or preloaded skill — never in the dispatch prompt. This is ~50× cheaper per token on dispatch #2+: 5× from output→input, and 10× from fresh-input→cached-input.

Placement matrix:
- **Agent body / `skills:` YAML** — stable methodology, contract shape, report format, banned patterns
- **Dispatch prompt** — step-variable data only: step number, file paths, feed-forward output, prior verdict paths

## Tool Configuration

| Configuration | When | Example |
|---|---|---|
| Omit field | Default for most agents | Inherits all tools |
| Restricted | Read-only or security-sensitive | `tools: Read, Grep, Glob` |
| Task(type) | Control subagent spawning | `tools: Task(worker, researcher), Read` |

## Session Reload

- **Editing existing agents** takes effect immediately — no session restart needed.
- **New agents** require session restart to appear in `@` autocomplete.

## Storage Locations (Priority Order)

1. `--agents` CLI flag (highest, current session)
2. `.claude/agents/` (current project)
3. `~/.claude/agents/` (all projects)
4. Plugin `agents/` directory (lowest)

## Built-in Subagents

| Agent | Model | Tools | Purpose |
|-------|-------|-------|---------|
| **Explore** | Haiku | Read-only | File discovery, codebase exploration |
| **Plan** | Inherit | Read-only | Codebase research for planning |
| **General-purpose** | Inherit | All | Complex research, multi-step operations |

## Key Constraints

- Subagents cannot spawn other subagents (no nesting) unless using `--agent` for main thread
- Subagents receive only their custom system prompt, not the full Claude Code system prompt
- Auto-compaction triggers at ~95% capacity

## Validation

Use the **agent-verifier** agent dispatched via the `agent-verification` skill. Follow verify-fix loop (max 10 iterations, APPROVED verdict required before completion).

## See Also

- [Hooks](../platform-features/hooks.md) — Hook configuration for agents (PreToolUse, PostToolUse, session lifecycle)
- [Session Data](../platform-features/session-data.md) — Parsing subagent transcripts and token analysis
- [Agent Teams](../platform-features/teams.md) — Multi-agent orchestration with TeamCreate/SendMessage
