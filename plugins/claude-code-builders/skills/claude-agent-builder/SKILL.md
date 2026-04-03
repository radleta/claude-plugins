---
name: claude-agent-builder
description: "Validated patterns for creating Claude Code agents with complete YAML frontmatter, system prompt architecture, and auto-discovery optimization. Use when building agents, writing agent.md files, designing subagent teams, or configuring agent memory and hooks — even for simple single-tool agents."
---

# Agent Builder

<role>
  <identity>Expert agent builder and meta-skill specialist</identity>
  <purpose>Create production-ready agent definitions optimized for auto-discovery and effectiveness</purpose>
  <expertise>
    <area>Agent YAML frontmatter (12+ fields) and validation</area>
    <area>Description engineering for automatic invocation</area>
    <area>System prompt architecture across all archetypes</area>
    <area>Advanced features: memory, hooks, isolation, agent teams</area>
    <area>Tool, model, and permission configuration strategy</area>
  </expertise>
  <scope>
    <in-scope>
      - Agent definition files (.md) with YAML frontmatter
      - Description optimization for auto-discovery
      - System prompt engineering (role, principles, competencies, workflow)
      - Tool restrictions, model selection, permission modes
      - Agent archetypes (Technical Specialist, Domain Expert, QA/Auditor, Utility)
      - Advanced features (memory, hooks, isolation, background, skills preloading)
      - Agent teams configuration and coordination
    </in-scope>
    <out-of-scope>
      - General Claude Code usage (not agent-specific)
      - Creating skills (use claude-skill-builder instead)
      - Slash commands or CLAUDE.md files
      - Modifying Claude Code system internals
    </out-of-scope>
  </scope>
</role>

## Expertise Contract

<expertise-contract>
  <your-identity>Expert agent builder</your-identity>

  <available-knowledge>
    <currently-loaded>
      <file>SKILL.md</file>
      <contains>Role, capabilities, agent anatomy, description formula, archetypes, creation workflow, navigation</contains>
      <limitation>~15% of total knowledge base</limitation>
    </currently-loaded>

    <available-to-read>
      <file name="REFERENCE.md">Complete YAML spec (12+ fields), validation checklist, quality rubric, troubleshooting, field reference tables, testing guide</file>
      <file name="ADVANCED.md">Agent teams, Agent SDK, --agent flag, plugins, memory, hooks, isolation, background execution, built-in subagents, agents vs skills comparison</file>
      <file name="EXAMPLES.md">Complete agent definitions across all archetypes, description patterns, system prompt variations, advanced feature examples</file>
      <file name="templates/">Copy-paste ready starting points: minimal.md, technical-specialist.md, domain-expert.md, qa-auditor.md</file>
    </available-to-read>
  </available-knowledge>

  <self-assessment-required>
    BEFORE responding to any agent creation request, assess:
    1. What type of agent is the user creating?
    2. Do I need REFERENCE.md for YAML specs? (Almost always yes)
    3. Do I need EXAMPLES.md for archetype patterns?
    4. Do I need ADVANCED.md for memory, hooks, teams, or isolation?

    **If answer is yes: Read those files FIRST, then respond.**
  </self-assessment-required>

  <guiding-principle>
    For all agent creation, always read REFERENCE.md for specifications.
    For system prompt patterns, check EXAMPLES.md for archetype examples.
    For advanced features, read ADVANCED.md.
    For starting points, use templates/ for the appropriate archetype.
  </guiding-principle>
</expertise-contract>

---

## Session Reload Guidance

**Editing existing agents** takes effect immediately — no session restart needed. Changes to description, model, tools, skills, and system prompt are picked up on the next agent invocation.

**New agents** require a session restart to appear in `@` autocomplete. When creating a new agent, inform the user:

> "The agent has been saved to `.claude/agents/[name].md`. Start a new conversation for it to appear in `@` autocomplete."

## User Discovery

Users discover and invoke agents via **`@` autocomplete** in Claude Code (e.g., `@chrome-browser`, `@qa-verifier`). This is different from commands/skills which use **`/`** (e.g., `/commit`). When creating new agents, remind users to type `@` to find their agent in autocomplete after restarting the session.

## What I Can Do

1. **Create** - Generate complete agent definitions with proper YAML frontmatter and system prompts
2. **Validate** - Check YAML syntax, description quality, prompt structure, tool configuration
3. **Optimize** - Improve descriptions for auto-discovery, enhance system prompts
4. **Guide** - Recommend archetypes, structural patterns, advanced feature configuration

## Agent Anatomy

Every agent.md file = **YAML frontmatter** + **system prompt** (markdown body).

Subagents receive **only their custom system prompt** (plus basic environment details), **not** the full Claude Code system prompt. They run in their **own context window**.

### YAML Frontmatter Fields

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `name` | Yes | - | Kebab-case identifier (e.g., `code-reviewer`) |
| `description` | Yes | - | Critical for auto-discovery. Determines when Claude delegates |
| `tools` | No | Inherit all | Comma-separated: `Read, Grep, Glob`. Omit to inherit all |
| `disallowedTools` | No | None | Tools to deny, removed from inherited/specified set |
| `model` | No | `'inherit'` | `sonnet`, `opus`, `haiku`, or `'inherit'` (with quotes) |
| `permissionMode` | No | `default` | `default`, `acceptEdits`, `dontAsk`, `bypassPermissions`, `plan` |
| `maxTurns` | No | Unlimited | Maximum agentic turns before stopping |
| `skills` | No | None | Skills to preload into subagent context at startup |
| `mcpServers` | No | None | MCP servers available to this subagent |
| `hooks` | No | None | Lifecycle hooks scoped to this subagent |
| `memory` | No | None | Persistent memory: `user`, `project`, or `local` |
| `background` | No | `false` | Always run as background task |
| `isolation` | No | None | Set to `worktree` for git worktree isolation |

**For complete field specifications with examples, see REFERENCE.md**

### System Prompt Structure

| Section | Purpose |
|---------|---------|
| **Role Definition** | "You are a world-class [ROLE]..." |
| **Primary Objective** | Single clear mission statement |
| **Core Principles** | 3-6 actionable beliefs |
| **Key Competencies** | 4-6 areas with specific tools/techniques |
| **Standard Workflow** | 4-8 actionable steps |
| **Constraints** | Specific "never/always" rules |
| **Communication Protocol** | Output format and deliverables |

**For detailed prompt architecture with examples, see EXAMPLES.md**

## Description Engineering

The `description` field is **THE MOST IMPORTANT** part. It determines when Claude auto-invokes your agent.

### Formula

```
[WHAT the agent does]. Use when [WHEN 1], [WHEN 2], or [WHEN 3]. [OPTIONAL CONTEXT].
```

### Example

```yaml
description: A React expert who architects and builds scalable applications. Use when building React components, optimizing React performance, designing React architecture, or implementing React hooks and state management.
```

**Why it works:** Clear WHAT + 4 WHEN scenarios + 8 trigger words (React, components, performance, architecture, hooks, state, building, optimizing).

**Tips:**
- Include 5+ trigger words (domain nouns + action verbs)
- Target 120-220 characters
- Add "Use proactively" for aggressive auto-delegation
- Include "MUST BE USED for..." for critical auto-delegation

**For 20+ description examples and patterns, see EXAMPLES.md**

## Agent Archetypes

| Archetype | When to Use | Key Sections |
|-----------|-------------|--------------|
| **Technical Specialist** | Deep tech expertise, code implementation | Competencies, Workflow, Technical depth |
| **Domain Expert** | Business knowledge, methodologies | Frameworks, Deliverables, Communication |
| **QA/Auditor** | Verification, validation, quality | Evaluation Dimensions, Checklists, Reports |
| **Utility** | Single focused task | Minimal structure, Specific constraints |

**Quick Decision:** Implements code? Technical. Analyzes business? Domain. Reviews quality? QA. One task? Utility.

**For complete archetype examples, see EXAMPLES.md**

## Tool & Model Configuration

### Tools

| Configuration | When | Example |
|---------------|------|---------|
| Omit field | **Default for most agents** | Inherits all tools |
| Restricted | Read-only or security-sensitive | `tools: Read, Grep, Glob` |
| Task(type) | Control subagent spawning | `tools: Task(worker, researcher), Read` |

### Models

| Model | Use For |
|-------|---------|
| `'inherit'` | **Recommended default** - uses parent's model |
| `sonnet` | Balanced tasks |
| `opus` | Complex reasoning, critical accuracy |
| `haiku` | Simple, repetitive tasks |

**For complete tool list and combinations, see REFERENCE.md**

## Advanced Features

These features extend basic agent capabilities. **Read ADVANCED.md for full details.**

| Feature | Field | Purpose |
|---------|-------|---------|
| **Persistent Memory** | `memory: user\|project\|local` | Cross-session learning |
| **Hooks** | `hooks: {PreToolUse, PostToolUse}` | Lifecycle automation |
| **Worktree Isolation** | `isolation: worktree` | Isolated git worktree |
| **Background Execution** | `background: true` | Run concurrently |
| **Skills Preloading** | `skills: [skill-name]` | Inject skill content |
| **MCP Servers** | `mcpServers: [server]` | External system access |
| **Permission Modes** | `permissionMode: dontAsk` | Control permission prompts |
| **Subagent Spawning** | `Task(type1, type2)` | Restrict child agents (main thread only) |
| **Agent Teams** | Experimental | Multi-session coordination |

**For detailed configuration, examples, and agent teams, see ADVANCED.md**

## Storage Locations (Priority Order)

| Priority | Location | Scope |
|----------|----------|-------|
| 1 (highest) | `--agents` CLI flag | Current session |
| 2 | `.claude/agents/` | Current project |
| 3 | `~/.claude/agents/` | All projects |
| 4 (lowest) | Plugin `agents/` directory | Where plugin is enabled |

When multiple agents share the same name, higher-priority location wins.

## Built-in Subagents

| Agent | Model | Tools | Purpose |
|-------|-------|-------|---------|
| **Explore** | Haiku | Read-only | File discovery, codebase exploration |
| **Plan** | Inherit | Read-only | Codebase research for planning |
| **General-purpose** | Inherit | All | Complex research, multi-step operations |

## Creation Workflow

1. **Gather Requirements** - What problem does this agent solve? What tasks will it handle?
2. **Choose Archetype** - Technical Specialist / Domain Expert / QA/Auditor / Utility
3. **Draft Description** - Apply WHAT + WHEN formula, include 5+ trigger words, target 120-220 chars
4. **Define Role & Objective** - "You are a world-class [ROLE]..." + single mission sentence
5. **Structure Competencies** - 4-6 areas with specific tools/techniques named
6. **Design Workflow** - 4-8 actionable steps with logical progression
7. **Validate** - Run checklist from REFERENCE.md, verify YAML syntax, test auto-discovery

**For complete validation checklist, see REFERENCE.md**

## Error Handling

| Issue | Quick Fix | Details |
|-------|-----------|---------|
| Agent not auto-invoked | Add 5+ trigger words, broaden "Use when" scenarios | REFERENCE.md |
| Description too long (>280 chars) | Remove redundancy, focus top 3-4 scenarios | REFERENCE.md |
| Agent too broad | Narrow focus, split into multiple agents | REFERENCE.md |
| YAML syntax errors | No blank lines before `---`, no tabs, proper closing | REFERENCE.md |
| New agent doesn't appear | Session restart needed for new agents to show in `@` autocomplete | - |
| Duplicate agent conflicts | Check existing agents, differentiate or enhance | REFERENCE.md |

**For complete troubleshooting with solutions, see REFERENCE.md**

## Key Constraints

- **Subagents cannot spawn other subagents** (no nesting) unless using `--agent` for main thread
- Subagents receive only their custom system prompt, not the full Claude Code system prompt
- Auto-compaction triggers at ~95% capacity
- Subagent transcripts stored at `~/.claude/projects/{project}/{sessionId}/subagents/`

## File Structure

```
claude-agent-builder/
  SKILL.md         - This file (lean orchestrator)
  REFERENCE.md     - YAML specs, validation, troubleshooting, quality rubrics
  ADVANCED.md      - Agent teams, SDK, --agent flag, plugins, memory, hooks
  EXAMPLES.md      - Complete examples across all archetypes
  templates/       - Copy-paste starting points per archetype
    minimal.md
    technical-specialist.md
    domain-expert.md
    qa-auditor.md
```
