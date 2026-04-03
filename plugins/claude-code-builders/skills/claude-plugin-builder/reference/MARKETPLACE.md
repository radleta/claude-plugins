# Marketplace Reference

Plugin marketplaces are curated directories of plugins distributed as Git repositories. Anyone can create a marketplace — Anthropic provides the official one, but organizations and communities can run their own.

## marketplace.json Schema

Every marketplace repository must contain a `marketplace.json` at its root:

```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "my-marketplace",
  "version": "1.0.0",
  "description": "A curated collection of plugins for X",
  "owner": {
    "name": "Organization Name",
    "url": "https://example.com"
  },
  "plugins": [
    {
      "name": "plugin-name",
      "description": "What this plugin does",
      "source": "./plugins/plugin-name",
      "category": "development",
      "version": "1.0.0"
    }
  ]
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Marketplace identifier (kebab-case) |
| `version` | string | Semantic version of the marketplace itself |
| `plugins` | array | List of plugin entries |
| `plugins[].name` | string | Plugin identifier |
| `plugins[].source` | string | Relative path to plugin directory |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `description` | string | Marketplace description |
| `owner` | object | Name and URL of maintainer |
| `plugins[].description` | string | Plugin description for listing |
| `plugins[].category` | string | Category for filtering |
| `plugins[].version` | string | Plugin version |
| `plugins[].keywords` | array | Search keywords |

### Plugin Categories

Common categories used in the official marketplace:

- `development` — Developer tools, code quality, testing
- `productivity` — Workflow automation, task management
- `documentation` — Doc generation, writing tools
- `integration` — External service connectors
- `security` — Security scanning, compliance
- `data` — Data processing, analysis
- `devops` — CI/CD, infrastructure, deployment

## Creating a Marketplace

### Step 1: Repository Structure

```
my-marketplace/
  marketplace.json
  plugins/
    plugin-a/
      .claude-plugin/
        plugin.json
      skills/
      commands/
    plugin-b/
      .claude-plugin/
        plugin.json
      skills/
```

### Step 2: Write marketplace.json

List all plugins with metadata. Each plugin's `source` points to its directory relative to the repository root.

### Step 3: Publish Repository

Push to GitHub (or any Git host). The repository URL becomes the marketplace identifier.

### Step 4: Users Add Your Marketplace

```
/plugin marketplace add your-org/your-marketplace
```

After adding, plugins from your marketplace appear in `/plugin install` listings.

## Official Marketplaces

### anthropics/claude-plugins-official

The primary curated marketplace. **Automatically available** — no setup required.

- 100+ curated plugins (as of early 2026)
- Categories: development, productivity, documentation, integration
- Quality-reviewed by Anthropic
- Submit via pull request

### anthropics/claude-code (Bundled Plugins)

Plugins that ship with Claude Code itself in the `/plugins` directory:

- Core development tools
- Built-in integrations
- Updated with Claude Code releases

### anthropics/knowledge-work-plugins (Cowork)

Enterprise-focused plugins for Claude Cowork:

- 15 plugins covering sales, marketing, finance, legal, engineering, operations, HR, design
- 85+ skills, 69+ commands, 40+ MCP connectors
- Tool-agnostic design (workflows by category, not specific products)
- Available on Team and Enterprise plans

## Distribution Strategies

### For Individual Developers

1. Create plugin in a public Git repository
2. Share the repository URL
3. Users install directly: `/plugin install` from the repo

### For Teams/Organizations

1. Create a private marketplace repository
2. Add organization plugins to `marketplace.json`
3. Team members add marketplace: `/plugin marketplace add org/repo`
4. Supports per-user provisioning and auto-install

### For the Community

1. Build high-quality plugins
2. Submit PR to `anthropics/claude-plugins-official`
3. Follow contribution guidelines (README, tests, documentation)
4. Anthropic reviews and merges

### Community Directories

Several community sites aggregate plugins beyond the official marketplace:

- `claudemarketplaces.com` — Directory with voting and reviews
- `claude-plugins.dev` — Community registry with CLI integration
- `buildwithclaude.com` — Plugin marketplace
- `claudepluginhub.com` — Plugin discovery hub

## Marketplace Best Practices

- **Version semantically** — marketplace supports version tracking and update notifications
- **Write clear descriptions** — they appear in `/plugin install` listings
- **Categorize accurately** — helps users find relevant plugins
- **Include README.md** — in each plugin directory for documentation
- **Test before publishing** — use `--plugin-dir` locally first
- **Keep plugins focused** — one concern per plugin, not kitchen-sink bundles
- **Document dependencies** — if your plugin needs specific tools or runtimes
- **Provide examples** — show expected inputs/outputs for commands and skills

## See Also

- [SKILL.md](../SKILL.md) — Main orchestrator with plugin architecture, creation workflow, and validation checklist
- [HOOKS.md](HOOKS.md) — Hook event reference and development patterns
- [BEST-PRACTICES.md](BEST-PRACTICES.md) — Context budget, component design, testing strategies
