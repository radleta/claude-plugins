---
tags: [claude-code/builders]
summary: "Bypass-permissions mode now exempts .claude/{skills,commands,agents}/ writes from the protected-directory prompt (v2.1.120+)"
---

# Bypass-Permissions Exemption for .claude/skills/

Claude Code v2.1.79 introduced a regression where edits under `.claude/skills/` triggered a "Yes, and allow Claude to edit its own settings for this session" prompt, even in `bypassPermissions` / `--dangerously-skip-permissions` mode. The official docs always claimed `.claude/skills/`, `.claude/commands/`, and `.claude/agents/` were exempt from the `.claude/` protected-directory check — but the exemption function in the binary only listed `commands` and `agents`. The fix landed in two stages.

## Fix versions

| Version | Change |
|---------|--------|
| **2.1.120** | `--dangerously-skip-permissions` no longer prompts for writes to `.claude/skills/`, `.claude/agents/`, and `.claude/commands/` — applies to both main-session and sub-agent tool calls |
| **2.1.126** | `--dangerously-skip-permissions` broadens to bypass writes across all of `.claude/`, `.git/`, `.vscode/`, and shell config files (catastrophic removals like `rm -rf /` still prompt as a circuit breaker) |

## Caveats that survive the fix

1. **Bypass mode only.** The fix is scoped to `bypassPermissions` / `--dangerously-skip-permissions`. In `default` mode with `Edit(.claude/**)` in `permissions.allow`, the prompt still fires — the hardcoded protected-directory check runs before the allow-list is consulted. [Issue #36497](https://github.com/anthropics/claude-code/issues/36497) tracks this and remains OPEN.
2. **`.claude/settings*` still gated.** Edits to settings files prompt regardless of mode.
3. **Hook scope limits during the broken window.** `PermissionRequest` hooks do not fire for sub-agents ([#23983](https://github.com/anthropics/claude-code/issues/23983)) or for the VS Code extension ([#35942](https://github.com/anthropics/claude-code/issues/35942)) — workaround patterns that relied on hooks did not cover those paths.

## Detection — was this session affected?

Symptoms on v2.1.79–v2.1.119 in bypass mode:

- `"Do you want to make this edit to SKILL.md?"` prompt with three options, including `"Yes, and allow Claude to edit its own settings for this session"`.
- Allow-list rules `Edit(.claude/**)` and `Write(.claude/**)` had no effect.
- `skipDangerousModePermissionPrompt: true` did not suppress the prompt.

## Sources

- [Issue #36497 — `.claude/skills/` edits prompt for permission (regression in 2.1.79)](https://github.com/anthropics/claude-code/issues/36497)
- [Issue #41526 — bypassPermissions does not suppress 'edit its own settings' prompt for SKILL.md](https://github.com/anthropics/claude-code/issues/41526)
- [Issue #42366 — Bypass permissions mode still prompts for settings.json edits and other operations](https://github.com/anthropics/claude-code/issues/42366)
- Claude Code changelog entries for v2.1.120 and v2.1.126
