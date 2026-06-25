---
tags: [claude-code/builders]
summary: "Plugin manifest configuration, component wiring, marketplace distribution, and hook integration for Claude Code plugins"
---

# Plugin Builder Patterns

Validated patterns for building Claude Code plugins. Source: `claude-plugin-builder` skill.

## Plugin Architecture

A Claude Code plugin bundles one or more component types into a distributable package:

| Component | Purpose | File Pattern |
|---|---|---|
| **Skills** | Domain knowledge loaded into context | `skills/*/SKILL.md` |
| **Commands** | User-invocable slash commands | `commands/*.md` |
| **Agents** | Autonomous workers with isolated context | `agents/*.md` |
| **Hooks** | Event-driven automation (20+ events) | Inline in manifest or `hooks/` |
| **MCP Servers** | External tool/API integrations | `.mcp.json` or inline |
| **LSP Servers** | Language intelligence providers | `lsp/` or inline |
| **Output Styles** | Custom output formatting | `styles/` |

## Plugin Manifest (plugin.json)

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "What this plugin does",
  "category": "development",
  "keywords": ["keyword1"],
  "skills": ["skill-name"],
  "commands": [],
  "agents": []
}
```

## Project Manifest (plugin-manifests/*.json)

This repo uses project-level plugin manifests in `plugin-manifests/`:

```json
{
  "name": "claude-code-builders",
  "version": "1.0.1",
  "description": "Claude Code primitive builders",
  "skills": ["claude-code-expert", "agent-expert", ...],
  "commands": [],
  "agents": []
}
```

Source of truth stays in `.claude/`; marketplace is a publish target only.

## Marketplace Distribution

```bash
marketplace-publish              # Publish all changed plugins (auto patch bump)
marketplace-publish --dry-run    # Preview what would change
marketplace-publish --minor X    # Bump minor version for plugin X
```

**Publishing is user-gated.** A "ship it" / "commit-all" request does NOT imply marketplace publication.

Wiki-backed skills ship their pages natively inside the skill folder — no separate bundling step needed.

## Plugin Testing

```bash
claude --plugin-dir ./my-plugin   # Test plugin locally
/reload-plugins                   # Reload without restart
```

## Hook Integration in Plugins

Plugins can register hooks that fire on Claude Code lifecycle events. Hooks live inline in the manifest or in a `hooks/` directory. The 20+ hook event types are documented in the platform-features section.

See [hooks.md](../platform-features/hooks.md) for the complete hook architecture.

## Installing from Marketplace

```bash
claude plugin marketplace add radleta/claude-plugins
claude plugin install my-plugin@radleta   # Single plugin
```

## See Also

- [Session Data](../platform-features/session-data.md) — Session analysis for plugin-distributed workflows
- [Agent Teams](../platform-features/teams.md) — Teams feature as plugin-orchestrated multi-agent pattern
