---
name: claude-command-builder
description: "Complete specifications for writing Claude Code command and skill files including YAML frontmatter, argument handling ($ARGUMENTS, $0, $1), allowed-tools patterns, and invocation control. Use when writing .claude/commands/*.md or .claude/skills/*/SKILL.md files, editing frontmatter, adding argument variables, or debugging command syntax — even for simple no-argument commands."
---

# Claude Code Command & Skill Builder

## Role

Expert builder for Claude Code command and skill files. Guides creation of production-quality `.claude/commands/*.md` and `.claude/skills/*/SKILL.md` files that agents can execute reliably.

**Primary goals:**

- Correct YAML frontmatter syntax (2-space indentation, valid delimiters)
- Correct argument handling using `$ARGUMENTS` or `$0`, `$1`, `$2` (0-based)
- Appropriate tool permissions based on user requests
- Successful validation before deployment

## Unified Model (v2.1.3+)

Commands and skills share the same underlying system since Claude Code v2.1.3:

- **Commands** = action-oriented (`/commit`, `/deploy`) — invoked explicitly via `/name`
- **Skills** = knowledge-oriented — auto-loaded based on context
- Both use identical YAML frontmatter syntax documented in [SYNTAX.md](SYNTAX.md)
- This skill covers both use cases

**Autocomplete prefixes in Claude Code:** Commands and skills use **`/`** (e.g., `/commit`). Agents use **`@`** (e.g., `@chrome-browser`). When creating user-invocable commands, remind users they'll find it under `/` autocomplete.

## Hot-Reload Behavior (v2.1.0+)

- **Skills** (`.claude/skills/`) hot-reload automatically when files change
- **Legacy commands** (`.claude/commands/`) may require a session restart
- When informing users, be specific about which type they created

## Core Capabilities

1. **Create new command/skill files** — YAML frontmatter, prompt content, argument handling
2. **Edit existing files** — modify frontmatter, fix syntax, adjust arguments
3. **Configure tool permissions** — `allowed-tools` patterns (only when user requests)
4. **Configure invocation control** — `user-invocable`, `disable-model-invocation`, `context: fork`
5. **Debug syntax errors** — YAML parsing, argument substitution, permission issues

## Expertise Contract & Loading Protocol

This skill provides an overview. Detailed specifications live in supporting files that you MUST read when creating or editing commands.

**File Reading Priority:**

| Task                    | Read First                          | Then                                   |
| ----------------------- | ----------------------------------- | -------------------------------------- |
| Create new command      | [SYNTAX.md](SYNTAX.md) (required)               | [QUALITY.md](QUALITY.md) if tool permissions needed |
| Configure allowed-tools | [QUALITY.md](QUALITY.md) decision matrix         | —                                      |
| Validate command        | `protocols/validation-checklist.md` | [QUALITY.md](QUALITY.md) standards                  |
| Find examples           | [EXAMPLES.md](EXAMPLES.md)                        | [EXAMPLES-NAVIGATION.md](EXAMPLES-NAVIGATION.md) for index      |
| Debug errors            | [TIPS.md](TIPS.md)                            | [SYNTAX.md](SYNTAX.md) validation section          |
| Full creation workflow  | `protocols/creation-workflow.md`    | All above as needed                    |

**Decision Tree:**

```
Creating a command?
├─ Read SYNTAX.md (ALWAYS)
├─ User mentioned tool restrictions? → Read QUALITY.md lines 15-96
├─ Need validation? → Read protocols/validation-checklist.md
├─ Need examples? → Read EXAMPLES.md
└─ Debugging? → Read TIPS.md
```

## Quick Reference

**Template and common patterns:** Read `SYNTAX.md` — "Quick Reference Template" and "Common Patterns" sections.

## YAML Frontmatter Properties

| Property                   | Purpose                                           | Default    |
| -------------------------- | ------------------------------------------------- | ---------- |
| `description`              | Brief summary shown in UI (~2% context budget)    | First line |
| `allowed-tools`            | Comma-separated permitted tools                   | Inherits   |
| `model`                    | Model alias: `sonnet`, `opus`, `haiku`, `inherit` | Inherits   |
| `argument-hint`            | Expected argument format display                  | None       |
| `disable-model-invocation` | Prevent SlashCommand tool access                  | false      |
| `user-invocable`           | Allow user `/name` invocation                     | true       |
| `context`                  | Execution context (`fork` for isolation)          | default    |
| `agent`                    | Delegate to specific agent                        | None       |
| `hooks`                    | Lifecycle hooks (pre/post)                        | None       |
| `memory`                   | Memory scope                                      | None       |

**Full syntax details:** Read [SYNTAX.md](SYNTAX.md)

## Argument Handling (0-Based)

| Variable               | Description                    |
| ---------------------- | ------------------------------ |
| `$ARGUMENTS`           | All arguments as single string |
| `$0`                   | First positional argument      |
| `$1`                   | Second positional argument     |
| `$N`                   | Nth positional (0-based)       |
| `${CLAUDE_SESSION_ID}` | Current session ID             |

**Best practice:** Use `$ARGUMENTS` once, at the end of your prompt (Claude's ending bias gives more weight to final content).

## allowed-tools: User-Requested Only

**DEFAULT:** Omit `allowed-tools` entirely. Claude already requests user permission for risky operations.

**ONLY ADD when user explicitly requests restrictions** ("make this read-only", "limit to git only").

**Recommend restrictions** for forked read-only workers (`context: fork` + `user-invocable: false`) — ask the user first. See [QUALITY.md](QUALITY.md) "When to Recommend Restrictions" section.

**Pattern syntax (v2.1.0+):** Space-separated, not colon-separated.

```yaml
allowed-tools: Bash(git *), Read, Grep, Skill(my-skill)
```

**Skill patterns:** `Skill` (all skills) or `Skill(name)` (specific skill). Skills are knowledge injection only — they don't grant tool access.

**Full decision matrix:** Read [QUALITY.md](QUALITY.md)

## Creation Workflow (Summary)

1. **Understand Requirements** — purpose, arguments needed, location, tool restrictions
2. **Design Structure** — filename (verb-noun.md), frontmatter plan, argument placement
3. **Write Command** — YAML frontmatter + prompt content + arguments
4. **Validate** — syntax, arguments, permissions, description quality
5. **Save & Inform User** — write file, explain hot-reload behavior

**Full 5-step workflow with acceptance criteria:** Read `protocols/creation-workflow.md`

## Validation Summary

Before finalizing any command, verify:

- YAML: no tabs, `---` delimiters, 2-space indentation
- Arguments: only `$ARGUMENTS`, `$0`, `$1` etc. (0-based, never `$ARG`, `${1}`)
- Description: 10-50 words, action verb, domain context
- Tool permissions: omitted unless user requested restrictions
- Model: alias only (`sonnet`, not `claude-sonnet-4-...`)

**Full validation checklist:** Read `protocols/validation-checklist.md`

## Best Practices

- **Single responsibility** — one command, one purpose
- **`$ARGUMENTS` at the end** — with "Additional instructions (when provided) override the above:" to give user inputs proper precedence
- **Imperative delegation wording** — "Launch the X agent, providing Y as the prompt" not "Summarize Y, then launch X" (descriptive phrasing causes Claude to narrate before acting)
- **Agent error relay + resume** — when delegating to an agent, include: "If the agent returns an error, relay to the user. Resume the same agent via SendMessage — do not launch a fresh agent."
- **Include example agent prompts** — when delegating to an agent, show a concrete example of what the prompt should look like (Claude pattern-matches against examples for quality)
- **The tool is "Agent" not "Task"** — always write "Launch the X agent via the Agent tool" (not "Task tool")
- **Don't use `context: fork` for session-aware commands** — despite the name, `context: fork` starts empty (no conversation history). Use default context + Agent tool delegation instead.
- **Descriptive filenames** — `review-pr.md` not `rp.md`
- **Minimal frontmatter** — only include properties you need
- **No shell logic in prompts** — let Claude handle conditionals
- **Test with varied arguments** — no args, one arg, multiple args

## File Navigation

| File                                | Lines | When to Read                                             |
| ----------------------------------- | ----- | -------------------------------------------------------- |
| [SYNTAX.md](SYNTAX.md)              | ~565  | Creating ANY command (YAML, arguments, special features) |
| [QUALITY.md](QUALITY.md)            | ~500  | Tool permission decisions, validation standards          |
| [EXAMPLES.md](EXAMPLES.md)          | ~1450 | Need concrete examples or anti-patterns                  |
| [EXAMPLES-NAVIGATION.md](EXAMPLES-NAVIGATION.md) | ~175 | Quick index into EXAMPLES.md sections           |
| [TIPS.md](TIPS.md)                  | ~730  | Debugging, optimization, team collaboration              |
| `protocols/creation-workflow.md`    | ~200  | Full 5-step creation process                             |
| `protocols/validation-checklist.md` | ~100  | Detailed validation checks                               |
| `reference/objectives.md`           | ~120  | Success metrics and measurable outcomes                  |
| `reference/tool-specifications.md`  | ~100  | Tool specs and permission patterns                       |

## Troubleshooting Quick Reference

| Problem                   | Check                                                                 |
| ------------------------- | --------------------------------------------------------------------- |
| Command won't load        | YAML syntax: no tabs, both `---` delimiters, blank line after closing |
| Arguments not working     | Use `$ARGUMENTS` or `$0`/`$1` (0-based). Not `$ARG`, `${1}`          |
| Permission errors         | Omit `allowed-tools` unless user requested. Check [QUALITY.md](QUALITY.md) |
| Description not showing   | Add `description` in frontmatter, avoid unquoted special chars        |
| Changes not taking effect | Skills hot-reload; legacy commands need session restart               |
| Tool pattern errors       | Use space separator: `Bash(git *)` not `Bash(git:*)`                  |

**Detailed troubleshooting:** Read [TIPS.md](TIPS.md)
