# Known Bugs & Gotchas

Critical issues that can cause skill failures. Check these first when debugging.

## Multi-Line Description Silently Breaks Discovery

**Severity**: Critical
**Issue**: [#9817](https://github.com/anthropics/claude-code/issues/9817)

When Prettier (with `proseWrap: true`) or other formatters wrap the `description` field across multiple lines, Claude Code **silently ignores the entire skill**. No error message.

```yaml
# BROKEN — skill becomes invisible:
---
description:
  Write or modify bash scripts following coding standards. Use when
  creating or editing bash scripts.
---

# WORKING — must stay on one line:
---
description: "Write or modify bash scripts following coding standards. Use when creating or editing bash scripts."
---
```

**Prevention**: Quote descriptions with double quotes. Add `.prettierignore` entries for SKILL.md files.

## `context: fork` Ignored via Skill Tool

**Severity**: High
**Issue**: [#17283](https://github.com/anthropics/claude-code/issues/17283)

When a skill with `context: fork` is invoked programmatically by Claude (via the Skill tool), the fork and agent frontmatter fields may be ignored. The skill runs in the main context instead of spawning a subagent.

**Workaround**: Invoke the skill manually with `/skill-name` for reliable forking behavior.

## Skills Context Lost After Auto-Compaction

**Severity**: High
**Issue**: [#13919](https://github.com/anthropics/claude-code/issues/13919)

When the conversation context is automatically compacted (to fit within the context window), skill context can be completely lost. Claude forgets it loaded the skill and may stop following its instructions.

**Mitigation**: For critical skills, include key instructions in CLAUDE.md as well (belt and suspenders).

## `argument-hint` with Brackets + Colon Causes TUI Hang

**Severity**: High
**Issue**: [#22161](https://github.com/anthropics/claude-code/issues/22161)

When `argument-hint` contains YAML flow sequence syntax with a colon (e.g., `[type: feature]`), the YAML parser interprets it as an array, causing a React error and unrecoverable TUI hang.

```yaml
# BROKEN — causes hang:
---
argument-hint: [type: feature]
---

# WORKING — use quotes:
---
argument-hint: "[type] [feature]"
---
```

**Prevention**: Always quote `argument-hint` values. Avoid colons inside brackets.

## Skills Ignored During Multi-Step Tasks

**Severity**: Medium
**Issue**: [#18454](https://github.com/anthropics/claude-code/issues/18454)

Claude Code may ignore CLAUDE.md and skill instructions during complex multi-step tasks, particularly after many tool calls.

**Mitigation**: Break complex workflows into discrete skill invocations rather than relying on a single long-running skill session.

## Skills Full Content Loaded at Discovery (Token Bloat)

**Severity**: Medium
**Issues**: [#14882](https://github.com/anthropics/claude-code/issues/14882), [#15530](https://github.com/anthropics/claude-code/issues/15530)

In some versions, project skills load full file content at startup instead of just frontmatter metadata. This inflates token usage.

**Mitigation**: Keep SKILL.md body concise. Use progressive disclosure (supporting files loaded via Read tool).

## Skill-Scoped Hooks Not Triggered in Plugins

**Severity**: Medium
**Issue**: [#17688](https://github.com/anthropics/claude-code/issues/17688)

Hooks defined in skill frontmatter are not triggered when the skill is loaded as part of a plugin.

**Workaround**: Define hooks at the settings level instead of skill level when distributing as plugins.
