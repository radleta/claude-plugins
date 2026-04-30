---
description: Initialize, refine, or assess skills using claude-skill-builder patterns
argument-hint: <init|refine|assess> <skill-name> [focus-area]
---

## Required: Load Skills First

Use the Skill tool to load these skills before proceeding:
1. `claude-code-expert` - Skill/agent/command/plugin building patterns (builders/ group)
2. `agent-expert` - Agent-optimization principles (26 principles)

## Execution

Execute the appropriate protocol from the `builders/skill-patterns.md` page in `claude-code-expert` based on mode ($1):

| Mode | Section | Purpose |
|------|---------|---------|
| init | Init workflow section | Create new skill with proper architecture |
| refine | Refine workflow section | Update skill with health check first |
| assess | Assess workflow section | Audit health, detect bloat, recommend fixes |

Use Read tool on `.claude/skills/claude-code-expert/builders/skill-patterns.md`, then execute the relevant workflow section.

## Context

- Skill name: $2
- Analyze current conversation for insights automatically
- **Skills load once per session** - remind user to reload after changes

Additional instructions (when provided) override the above:
$ARGUMENTS
