# New Capabilities (v2.1+)

Features added to the Claude Code skills system since version 2.1 (January 2026).

## Skill Hot-Reload (v2.1.0)

Skills created or modified in `~/.claude/skills` or `.claude/skills` are now **immediately available** without restarting the session. Live change detection watches for file modifications.

This also applies to skills in directories added via `--add-dir`.

**Impact**: No need to tell users to "start a new conversation" after skill changes.

## Slash Commands Merged into Skills (v2.1.3)

Slash commands and skills are now unified:
- `.claude/commands/review.md` and `.claude/skills/review/SKILL.md` both create `/review`
- Existing `.claude/commands/` files continue to work with no migration needed
- Skills take precedence on name collision
- Commands now support the same frontmatter as skills (`allowed-tools`, `model`, `hooks`, etc.)

**What skills add over commands**:
- A directory for supporting files (references, scripts, templates)
- Frontmatter to control invocation behavior
- Ability for Claude to load them automatically when relevant

## Nested Skill Discovery (v2.1.6)

When working with files in subdirectories, Claude Code auto-discovers skills from nested `.claude/skills/` directories.

**Example**: Editing a file in `packages/frontend/` causes Claude Code to also look in `packages/frontend/.claude/skills/`.

**Use case**: Monorepo setups where each package has its own skills.

## Skills from Additional Directories (v2.1.32)

Skills defined in `.claude/skills/` within directories added via `--add-dir` are loaded automatically and picked up by live change detection.

## Scaled Description Budget (v2.1.32)

The skill description character budget now scales with context window size:
- **Default**: 2% of context window
- **Fallback**: 16,000 characters
- **Override**: `SLASH_COMMAND_TOOL_CHAR_BUDGET` environment variable

Users with larger context windows can see more skill descriptions without truncation.

## Plugin Name in Skill Descriptions (v2.1.33)

Plugin name is now shown alongside skill descriptions in the `/skills` menu for better discoverability.

## Subagent Skills Preloading (v2.1.33)

Agent definitions can declare skills that auto-load into subagent context:

```yaml
---
name: api-developer
skills:
  - api-conventions
  - error-handling-patterns
---
```

Full skill content is injected into the subagent's context. See [frontmatter.md](frontmatter.md) for details.

## Session ID Substitution (v2.1.10)

`${CLAUDE_SESSION_ID}` string substitution available in skill content for accessing the current session ID.

## Shorthand Argument Syntax (v2.1.19)

`$0`, `$1`, etc. as shorthand for `$ARGUMENTS[0]`, `$ARGUMENTS[1]`. Bracket syntax `$ARGUMENTS[N]` replaced the older dot syntax `$ARGUMENTS.N`.

## Context Fork with Agent Selection (v2.1.0)

Skills can run in isolated subagent contexts:

```yaml
---
context: fork
agent: Explore
---
```

The skill content becomes the subagent prompt. No conversation history access. See [frontmatter.md](frontmatter.md) for details and known issues.

## Hooks in Skill Frontmatter (v2.1.0)

Lifecycle hooks can be defined directly in skill frontmatter, scoped to the skill's execution. See [frontmatter.md](frontmatter.md) for syntax.

## Extended Thinking via "ultrathink" (v2.1+)

Include the word "ultrathink" anywhere in skill content to enable extended thinking mode.
