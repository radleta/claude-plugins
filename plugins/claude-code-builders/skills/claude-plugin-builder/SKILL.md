---
name: claude-plugin-builder
description: "Validated patterns for building Claude Code plugins with manifest configuration, component wiring, marketplace distribution, and hook integration. Use when creating plugins, packaging skills/commands/agents for distribution, setting up plugin marketplaces, or publishing to the Anthropic ecosystem — even for simple single-component plugins."
---

# Claude Plugin Builder

<role>
  <identity>Expert Claude Code plugin architect and marketplace specialist</identity>

  <purpose>
    Guide creation, validation, packaging, and distribution of Claude Code plugins —
    from single-component packages to full marketplace ecosystems
  </purpose>

  <expertise>
    <area>Plugin architecture and manifest configuration (plugin.json)</area>
    <area>Component wiring: skills, commands, agents, hooks, MCP servers, LSP servers</area>
    <area>Marketplace creation, curation, and distribution (marketplace.json)</area>
    <area>Hook event system (20+ event types with block/modify semantics)</area>
    <area>Testing workflows (--plugin-dir, /reload-plugins, validation)</area>
    <area>Anthropic ecosystem patterns (official, community, enterprise)</area>
  </expertise>

  <scope>
    <in-scope>
      <item>Creating new plugins (structure, manifest, components)</item>
      <item>Packaging existing skills/commands/agents into plugins</item>
      <item>Building and distributing plugin marketplaces</item>
      <item>Hook development within plugins</item>
      <item>MCP server integration within plugins</item>
      <item>Plugin testing, validation, and iteration</item>
      <item>Publishing to official or community marketplaces</item>
    </in-scope>

    <out-of-scope>
      <item>Writing skill content (use claude-skill-builder)</item>
      <item>Writing agent definitions (use claude-agent-builder)</item>
      <item>Writing command prompts (use claude-command-builder)</item>
      <item>MCP server implementation details (use claude-api skill)</item>
      <item>Claude Code usage basics (not plugin-specific)</item>
    </out-of-scope>
  </scope>
</role>

## Plugin Architecture Overview

A Claude Code plugin bundles one or more component types into a distributable package:

| Component | Purpose | File Pattern |
|-----------|---------|-------------|
| **Skills** | Domain knowledge loaded into context | `skills/*/SKILL.md` |
| **Commands** | User-invocable slash commands | `commands/*.md` |
| **Agents** | Autonomous workers with isolated context | `agents/*.md` |
| **Hooks** | Event-driven automation (20+ events) | Inline in manifest or `hooks/` |
| **MCP Servers** | External tool/API integrations | `.mcp.json` or inline |
| **LSP Servers** | Language intelligence providers | `lsp/` or inline |
| **Output Styles** | Custom output formatting | `styles/` |

## Directory Structure

```
my-plugin/
  .claude-plugin/
    plugin.json          # Manifest (only name required)
  commands/              # Slash commands (.md files)
  agents/                # Subagent definitions (.md files)
  skills/                # Skill directories (each with SKILL.md)
    my-skill/
      SKILL.md
  hooks/                 # Hook configurations (optional)
  .mcp.json              # MCP server configurations (optional)
  README.md              # Documentation for marketplace listing
```

**Critical**: Components go at the plugin root, NOT inside `.claude-plugin/`. Only `plugin.json` belongs in `.claude-plugin/`.

## Manifest (plugin.json)

The manifest is the only required configuration file. Only `name` is required — all other fields are optional with sensible defaults:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "Brief description for marketplace listing",
  "author": {
    "name": "Author Name",
    "email": "author@example.com",
    "url": "https://example.com"
  },
  "homepage": "https://docs.example.com",
  "repository": "https://github.com/user/repo",
  "license": "MIT",
  "keywords": ["keyword1", "keyword2"],
  "commands": "commands/",
  "agents": "agents/",
  "skills": "skills/",
  "hooks": "hooks/",
  "mcpServers": ".mcp.json",
  "lspServers": "lsp/",
  "outputStyles": "styles/"
}
```

**Auto-discovery**: If component paths are omitted, Claude Code scans default locations (`commands/`, `agents/`, `skills/`, etc.). Specify paths only when using non-standard locations.

**Inline vs file paths**: `hooks`, `mcpServers`, and `lspServers` accept either a file path (string) or an inline object.

## Installation Scopes

| Scope | Flag | Location | Visibility |
|-------|------|----------|-----------|
| **User** (default) | `--scope user` | `~/.claude/plugins/` | All your projects |
| **Project** | `--scope project` | `.claude/plugins/` | All collaborators |
| **Local** | `--scope local` | `.claude.local/plugins/` | Just you, one repo |

## Development Workflow

1. **Create structure** — Set up directories and `plugin.json`
2. **Add components** — Skills, commands, agents, hooks, MCP servers
3. **Test locally** — `claude --plugin-dir ./my-plugin` (loads without installing)
4. **Iterate** — Run `/reload-plugins` inside Claude Code for hot-reload
5. **Validate** — Use plugin-dev toolkit or manual checks
6. **Distribute** — Push to marketplace, share repo, or install directly

When `--plugin-dir` loads a plugin with the same name as an installed marketplace plugin, the local copy takes precedence for that session.

## File Loading Protocol

<loading-decision>
  <file path="reference/HOOKS.md">
    <load-when>Building plugins with hook integrations or event automation</load-when>
    <provides>Complete hook event reference (20+ types), block/modify semantics, configuration patterns</provides>
  </file>

  <file path="reference/MARKETPLACE.md">
    <load-when>Creating or publishing to plugin marketplaces</load-when>
    <provides>marketplace.json schema, distribution workflow, official/community marketplace details</provides>
  </file>

  <file path="reference/BEST-PRACTICES.md">
    <load-when>Validating plugin quality, managing context budget, or designing component interactions</load-when>
    <provides>Context budget management, component design patterns, testing strategies, detailed validation checklist, naming conventions, anti-patterns</provides>
  </file>

  <file path="reference/VALIDATION.md">
    <load-when>Validating a plugin or running the full validation checklist</load-when>
    <provides>Comprehensive 47-item checklist across 8 categories (manifest, skills, commands, agents, hooks, MCP, docs, integration)</provides>
  </file>

  <file path="examples/PLUGIN-TEMPLATES.md">
    <load-when>Need concrete plugin examples or starter templates</load-when>
    <provides>Minimal, moderate, and comprehensive plugin templates with complete file contents</provides>
  </file>
</loading-decision>

## Quick Reference: CLI Commands

| Command | Purpose |
|---------|---------|
| `/plugin` | Interactive plugin management menu |
| `/plugin install <name>` | Install from marketplace |
| `/plugin install <name>@<marketplace>` | Install from specific marketplace |
| `/plugin list` | List installed plugins |
| `/plugin update` | Update installed plugins |
| `/plugin remove <name>` | Uninstall a plugin |
| `/plugin marketplace add <org/repo>` | Add a marketplace source |
| `/reload-plugins` | Hot-reload all plugin components |
| `claude --plugin-dir ./path` | Load plugin locally for testing |

## Ecosystem Context

**Official Anthropic repositories:**

| Repository | Contents |
|------------|----------|
| `anthropics/claude-code` (bundled) | Plugins shipping with Claude Code |
| `anthropics/claude-plugins-official` | Curated directory of 100+ plugins |
| `anthropics/knowledge-work-plugins` | 15 Cowork plugins for enterprise |

The official marketplace (`claude-plugins-official`) is automatically available — no setup required.

**Requires:** Claude Code v1.0.33 or later for full plugin support.

## Core Principles

### 1. Single-Concern Design

Each plugin solves one problem well. Users install what they need — a focused plugin is easier to maintain, test, and update.

```
# Good: focused plugins
code-review-plugin/     # Just code review
test-runner-plugin/     # Just test execution

# Bad: kitchen-sink plugin
everything-plugin/      # Code review + testing + docs + deployment
```

### 2. Skill-First Composition

Start with skills (domain knowledge), then layer commands, agents, hooks, and MCP servers — in that order. Skills are cheapest on context budget; MCP servers are most expensive. Most plugins need only 1-2 component types.

### 3. Context Budget Awareness

Every component consumes context window space. Skill descriptions load at startup (~100-400 chars each). MCP server schemas are the biggest consumer — limit to 5-8 per plugin. Hooks have zero context cost (external processes). When in doubt, fewer components = better.

### 4. Investigate Before Building

Discover what already exists before creating a plugin. A duplicate plugin wastes effort and fragments the ecosystem.

```
# Good: checked first, found gap
/plugin list → no code-review plugin exists → build one

# Bad: built blindly, duplicates existing
Created my-review-plugin → already 3 review plugins in marketplace
```

### 5. Test Before Publish

Always verify with `--plugin-dir` locally before distributing. Broken plugins erode trust and are hard to recall once distributed.

### 6. Progressive Complexity

Start with the simplest structure that works (single skill, minimal manifest). Add components only when justified by real needs, not speculative reasoning.

```
# Good: minimal first, grow later
v1.0: 1 skill, minimal manifest
v1.1: added command for user invocation
v2.0: added hook for automation

# Bad: over-engineered from day one
v1.0: 3 skills, 4 commands, 2 agents, 3 hooks, 1 MCP server (most unused)
```

## Investigation Protocol

Before building a plugin, discover context that shapes your design:

### Existing Plugin Landscape

**What to discover:** Does a similar plugin already exist?
**Why it matters:** Duplicating existing functionality wastes effort and fragments the ecosystem.
**How to find out:** Run `/plugin list` for installed plugins. Browse `/plugin` interactive menu for marketplace. Search `anthropics/claude-plugins-official` for official offerings. Check community directories for prior art.

### Component Requirements

**What to discover:** Which component types does this problem actually require?
**Why it matters:** Most plugins need 1-3 components, not all 7 types. Over-engineering wastes context budget and increases maintenance burden.
**How to find out:** Start with "what's the core knowledge?" (skill) and "what's the user action?" (command). Add agents only if autonomous isolation is needed. Add hooks only if event-driven automation is required. Add MCP servers only if external API integration is needed.

### Target Audience and Scope

**What to discover:** Who will use this plugin, and what installation scope fits?
**Why it matters:** Solo developers need user-scope plugins. Teams need project-scope. Enterprise needs private marketplace distribution.
**How to find out:** Consider: Is this personal tooling (user scope), team convention enforcement (project scope), or one-repo customization (local scope)? Monorepos may prefer project-scope plugins shared across packages. Library authors may prefer minimal, user-scope plugins.

### Existing Primitives to Package

**What to discover:** Are there existing skills, commands, or agents that should be packaged rather than rewritten?
**Why it matters:** Packaging existing, tested primitives is faster and more reliable than rebuilding from scratch.
**How to find out:** Review `.claude/skills/`, `.claude/commands/`, and `.claude/agents/` in the current project. Check `~/.claude/` for user-scoped primitives that could benefit from distribution.

### Security and Credentials

**What to discover:** Does this plugin need API keys, tokens, or other credentials? How will they be managed?
**Why it matters:** Hardcoded secrets in plugin files are a critical security risk — plugins are often shared via public Git repositories.
**How to find out:** Identify which components need external access (MCP servers, hooks calling APIs). Plan environment variable usage for all credentials. Verify no secrets end up in `plugin.json`, skill files, or hook scripts.

## Plugin Creation Workflow

**Prerequisites:** claude-skill-builder (for skills), claude-command-builder (for commands), and/or claude-agent-builder (for agents) skills should be available for Step 4.

### Step 1: Investigate and Plan

Determine what your plugin needs based on investigation findings:

- What problem does it solve? (confirmed gap from investigation)
- Which component types are required? (minimum: 1 skill or 1 command)
- Does it need hooks for automation?
- Does it need MCP servers for external integrations?
- What's the target audience? (developers, teams, enterprise)

### Step 2: Create Structure

```bash
mkdir -p my-plugin/.claude-plugin my-plugin/skills/my-skill my-plugin/commands
```

### Step 3: Write Manifest

Start minimal — add fields as needed:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "What this plugin does"
}
```

### Step 4: Implement Components

Follow the respective builder skills for each component type:
- Skills: Follow claude-skill-builder patterns (YAML frontmatter, description formula)
- Commands: Follow claude-command-builder patterns (argument handling, allowed-tools)
- Agents: Follow claude-agent-builder patterns (thin agent + skill pattern)

### Step 5: Test

```bash
claude --plugin-dir ./my-plugin
```

Inside the session, verify:
- Skills auto-discover on relevant queries
- Commands appear in `/` autocomplete
- Agents respond to `@` mentions
- Hooks fire on expected events

Use `/reload-plugins` after changes — no restart needed.

### Step 6: Validate

Run the comprehensive 47-item validation checklist. Use Read tool on `reference/VALIDATION.md` for the full checklist covering 8 categories:

| Category | Items | Key Checks |
|----------|-------|-----------|
| Manifest | 8 | Valid JSON, kebab-case name, no secrets |
| Skills | 8 | YAML frontmatter, WHAT+WHEN description, role definition |
| Commands | 6 | Description, allowed-tools, argument-hint |
| Agents | 5 | Thin pattern, skill references, model selection |
| Hooks | 6 | Exit codes, fast execution, matchers |
| MCP Servers | 5 | Schema conciseness, credential handling, budget limit |
| Documentation | 5 | README, prerequisites, license |
| Integration | 4 | --plugin-dir loads, auto-discovery works |

### Step 7: Distribute

Options from simplest to most structured:
1. **Direct install** — Share the directory, user runs `/plugin install`
2. **Git repository** — Publish repo, users add as marketplace source
3. **Marketplace** — Create `marketplace.json`, curate multiple plugins
4. **Official submission** — PR to `anthropics/claude-plugins-official`

## Common Pitfalls

**Components inside `.claude-plugin/`** — Only `plugin.json` belongs there. Components go at plugin root.

**Missing skill descriptions** — Without YAML frontmatter with a WHAT + WHEN description, skills never auto-discover:
```yaml
# Bad                          # Good
---                            ---
name: my-skill                 name: my-skill
---                            description: "Code review patterns..."
                               ---
```

**Over-bundling MCP servers** — Keep to 5-8 max per plugin; each consumes context budget.

**No local testing** — Always test with `claude --plugin-dir ./my-plugin` before publishing.

**Monolithic plugins** — Split into focused, single-concern packages. Users install what they need.

## Output Format

When reporting plugin validation or investigation results:

```markdown
## Plugin Validation: [plugin-name]
**Components:** [count] skills, [count] commands, [count] agents, [count] hooks, [count] MCP servers
**Scope:** user | project | local | **Version:** [version]

### Investigation Findings
- Existing overlap: [none | list]
- Component requirements: [justified list]
- Target audience: [solo | team | enterprise]

### Validation Results
| Category | Pass | Fail | Items |
|----------|------|------|-------|
| Manifest | X/8 | Y/8 | [details] |

### Issues Found
1. [SEVERITY] [description] — [fix]

### Verdict: [PASS | PASS WITH WARNINGS | FAIL] — [summary]
```

## Token Efficiency

- **SKILL.md** (initial load): ~390 lines
- **Total content**: ~1,500 lines across 8 files
- **Initial load ratio**: ~26% — remaining 74% loaded on-demand via file loading protocol
- **Reference files**: Loaded only when building hooks, marketplaces, validating, or needing templates
