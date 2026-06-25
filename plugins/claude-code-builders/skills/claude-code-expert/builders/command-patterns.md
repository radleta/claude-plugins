---
tags: [claude-code/builders]
summary: "Command/skill file authoring: frontmatter, argument handling, cost-aware dispatch, allowed-tools, and creation workflow"
---

# Command Builder Patterns

Validated patterns for writing Claude Code command and skill files. Source: `claude-command-builder` skill.

## Unified Model (v2.1.3+)

Commands and skills share the same underlying system since Claude Code v2.1.3:
- **Commands** = action-oriented (`/commit`, `/deploy`) — invoked explicitly via `/name`
- **Skills** = knowledge-oriented — auto-loaded based on context
- Both use identical YAML frontmatter syntax

## YAML Frontmatter Properties

| Property | Purpose | Default |
|---|---|---|
| `description` | Brief summary shown in UI | First line |
| `allowed-tools` | Comma-separated permitted tools | Inherits |
| `model` | Model alias: `sonnet`, `opus`, `haiku`, `inherit` | Inherits |
| `argument-hint` | Expected argument format display | None |
| `disable-model-invocation` | Prevent SlashCommand tool access | false |
| `user-invocable` | Allow user `/name` invocation | true |
| `context` | Execution context (`fork` for isolation) | default |
| `agent` | Delegate to specific agent | None |
| `hooks` | Lifecycle hooks (pre/post) | None |
| `memory` | Memory scope | None |

## Argument Handling (0-Based)

| Variable | Description |
|---|---|
| `$ARGUMENTS` | All arguments as single string |
| `$0` | First positional argument |
| `$1` | Second positional argument |
| `$N` | Nth positional (0-based) |
| `${CLAUDE_SESSION_ID}` | Current session ID |

Best practice: Use `$ARGUMENTS` once, at the end of your prompt (Claude's ending bias gives more weight to final content).

## Cost-Aware Dispatch Design

When a command dispatches sub-agents repeatedly (e.g., one per plan step), the dispatch prompt is main-session **output tokens** — generated fresh on every call at ~5× the cost of input tokens.

### Three Destinations for Dispatch Content

| Destination | Main-session cost | Sub-agent cost | Cacheable? |
|---|---|---|---|
| Inlined in dispatch prompt | **Output tokens** (~5× input cost) | Input tokens | Partial |
| Agent body / preloaded skill (`skills:` YAML) | Zero | **Cached input tokens** | Yes (within 5-min TTL) |
| File the sub-agent reads at runtime | Zero | Tool-result input tokens | Rarely |

Moving stable content from the dispatch prompt into the agent body is **~50× cheaper per token** on dispatch #2+.

### Default Rule

**Stable content belongs in the agent body or a preloaded skill.** This includes: report-body structure, MCP call shape, return-text contract, banned-pattern reminders, domain methodology.

**Dispatch prompt carries step-variable content only:** step number, iteration, file paths, feed-forward output, prior verdict paths.

### Prefix-Identical Dispatch Rule

Start every dispatch with a **byte-identical prefix** across all steps; place variable bits (step number, iter, paths) AFTER the stable header. The cache holds through the stable prefix.

## allowed-tools: User-Requested Only

**DEFAULT:** Omit `allowed-tools` entirely. Claude already requests user permission for risky operations.

**ONLY ADD when user explicitly requests restrictions** ("make this read-only", "limit to git only").

Pattern syntax (v2.1.0+): Space-separated.

```yaml
allowed-tools: Bash(git *), Read, Grep, Skill(my-skill)
```

## Write Strategy: Direct Edit

Command files are single `.md` files under `.claude/commands/`. Use plain `Edit`/`Write` directly. The v2.1.120+ bypass-permissions exemption covers `.claude/commands/` in `bypassPermissions` mode — no staging wrapper needed. See [skill-edit-bypass-permissions-exemption.md](skill-edit-bypass-permissions-exemption.md) for caveat on `default` mode.

## Best Practices

- **Single responsibility** — one command, one purpose
- **`$ARGUMENTS` at the end** — with "Additional instructions (when provided) override the above:" to give user inputs proper precedence
- **Imperative delegation wording** — "Launch the X agent, providing Y as the prompt" not "Summarize Y, then launch X"
- **Agent error relay + resume** — include: "If the agent returns an error, relay to the user. Resume the same agent via SendMessage — do not launch a fresh agent."
- **Include example agent prompts** — show a concrete example of what the prompt should look like
- **The tool is "Agent" not "Task"** — always write "Launch the X agent via the Agent tool"
- **Don't use `context: fork` for session-aware commands** — `context: fork` starts empty (no conversation history)

## Hot-Reload Behavior

- **Skills** (`.claude/skills/`) hot-reload automatically when files change
- **Legacy commands** (`.claude/commands/`) may require a session restart

## Validation

Use the **command-verifier** agent dispatched via the `command-verification` skill. Follow verify-fix loop (max 10 iterations, APPROVED verdict required).

## See Also

- [Hooks](../platform-features/hooks.md) — Hook integration in commands (Stop hooks for typecheck, PostToolUse for lint)
- [Session Data](../platform-features/session-data.md) — Analyzing command token costs and sub-agent dispatch profiles
- [Agent Teams](../platform-features/teams.md) — Teams as an alternative orchestration to command-dispatched sub-agents
