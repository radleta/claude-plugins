---
description: Initialize, refine, or assess skills using claude-skill-builder patterns
argument-hint: <init|refine|assess> <skill-name> [focus-area]
---

## Required: Load Skills First

Use the Skill tool to load these skills before proceeding:
1. `claude-skill-builder` - Skill creation patterns, YAML, descriptions, token optimization
2. `agent-expert` - Agent-optimization principles (26 principles)

## Execution

Execute the appropriate protocol from claude-skill-builder based on mode ($1):

| Mode | Protocol | Purpose |
|------|----------|---------|
| init | `workflows/init-protocol.md` | Create new skill with proper architecture |
| refine | `workflows/refine-protocol.md` | Update skill with health check first |
| assess | `workflows/assess-protocol.md` | Audit health, detect bloat, recommend fixes |

Use Read tool on the protocol file from claude-skill-builder skill directory, then execute.

## Context

- Skill name: $2
- Analyze current conversation for insights automatically
- **Skills load once per session** - remind user to reload after changes

Additional instructions (when provided) override the above:
$ARGUMENTS
