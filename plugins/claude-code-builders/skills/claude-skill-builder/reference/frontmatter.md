# Complete Frontmatter Reference

All YAML frontmatter fields available for SKILL.md files. Only `description` is recommended; all others are optional.

## Field Reference

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `name` | No | Directory name | Display name. Lowercase letters, numbers, hyphens only. Max 64 chars. |
| `description` | Recommended | First paragraph of body | What the skill does and when to use it. Max 1024 chars. Claude uses this for auto-discovery. |
| `argument-hint` | No | — | Hint shown during autocomplete. Example: `[issue-number]` or `[filename] [format]`. |
| `disable-model-invocation` | No | `false` | Set to `true` to prevent Claude from auto-loading this skill. Manual `/name` only. |
| `user-invocable` | No | `true` | Set to `false` to hide from the `/` menu. Use for background knowledge Claude should load automatically but users shouldn't invoke directly. |
| `allowed-tools` | No | — | Tools Claude can use without asking permission when this skill is active. Space-delimited list. |
| `model` | No | — | Override model when this skill is active. |
| `context` | No | — | Set to `fork` to run in a forked subagent context. |
| `agent` | No | `general-purpose` | Which subagent type to use when `context: fork` is set. Options: `Explore`, `Plan`, `general-purpose`, or custom agents from `.claude/agents/`. |
| `hooks` | No | — | Hooks scoped to this skill's lifecycle. Supports `PreToolUse`, `PostToolUse`, and `Stop` events. |

## Invocation Control Matrix

The `disable-model-invocation` and `user-invocable` fields interact to control who can invoke a skill:

| Frontmatter | User can invoke | Claude can invoke | When loaded into context |
|-------------|-----------------|-------------------|--------------------------|
| (default) | Yes | Yes | Description always in context; full skill loads when invoked |
| `disable-model-invocation: true` | Yes | No | Description NOT in context; full skill loads when user invokes |
| `user-invocable: false` | No | Yes | Description always in context; full skill loads when Claude invokes |

**Use cases:**
- **Default**: Most skills — both user and Claude can trigger them
- **`disable-model-invocation: true`**: Workflows you want to trigger manually only (e.g., deployment scripts)
- **`user-invocable: false`**: Background knowledge that Claude should use automatically but users don't need in their `/` menu

## String Substitutions

Variables available inside skill content (replaced at invocation time):

| Variable | Description | Example |
|----------|-------------|---------|
| `$ARGUMENTS` | All arguments passed when invoking the skill | `/my-skill fix the login bug` → `$ARGUMENTS` = `fix the login bug` |
| `$ARGUMENTS[N]` | Access a specific argument by 0-based index | `/my-skill src/app.ts json` → `$ARGUMENTS[1]` = `json` |
| `$N` | Shorthand for `$ARGUMENTS[N]` | `$0` = first arg, `$1` = second arg |
| `${CLAUDE_SESSION_ID}` | The current session ID | Useful for unique file names or logging |

## Dynamic Context Injection

The `` !`command` `` syntax runs shell commands before skill content reaches Claude. The command output replaces the placeholder.

```markdown
Current branch: !`git rev-parse --abbrev-ref HEAD`
Node version: !`node --version`
```

**Cautions:**
- Commands run at skill load time — keep them fast (< 100ms)
- Avoid side effects (no writes, commits, network calls)
- Most skills don't need this feature

## Context Fork (Subagent Execution)

When `context: fork` is set, the skill runs in an isolated subagent:
- The skill content becomes the prompt that drives the subagent
- The subagent does NOT have access to conversation history
- The `agent` field determines which agent type executes

```yaml
---
name: deep-analysis
description: "Performs deep code analysis in an isolated context. Use when analyzing large codebases or running exploratory research."
context: fork
agent: Explore
---

Analyze the codebase for architectural patterns and report findings.
```

**Known issue**: When invoked via the Skill tool (programmatically by Claude), `context: fork` may be ignored (#17283).

## Hooks in Skill Frontmatter

Hooks scoped to a skill's lifecycle only run when that skill is active:

```yaml
---
name: safe-deploy
description: "Deploys with safety checks. Use when deploying to production."
hooks:
  PreToolUse:
    - matcher: Bash
      hooks:
        - type: command
          command: "echo 'Bash command intercepted during deploy skill'"
  Stop:
    - hooks:
        - type: command
          command: "echo 'Deploy skill completed'"
---
```

Supported hook events: `PreToolUse`, `PostToolUse`, `Stop`.

## Extended Thinking

Include the word "ultrathink" anywhere in skill content to enable extended thinking mode for that skill.

## Subagent Skills Preloading

Agent definitions (`.claude/agents/`) can preload skills using the `skills` frontmatter field:

```yaml
---
name: api-developer
description: "Implements API endpoints following team conventions."
skills:
  - api-conventions
  - error-handling-patterns
---

Implement API endpoints. Follow the conventions from preloaded skills.
```

The full content of each listed skill is injected into the subagent's context (not just made available for invocation). Subagents don't inherit skills from the parent conversation.

## Skill Description Budget

Skill descriptions are loaded into context so Claude knows what's available. The budget scales dynamically:

- **Default**: 2% of the context window
- **Fallback**: 16,000 characters
- **Override**: Set `SLASH_COMMAND_TOOL_CHAR_BUDGET` environment variable

If total description length exceeds the budget, some skills may be excluded. Check `/context` for warnings about excluded skills.

**Implications for teams with many skills**: Keep descriptions concise. The 3-sentence rule (see UNIVERSAL.md) helps stay within budget.
