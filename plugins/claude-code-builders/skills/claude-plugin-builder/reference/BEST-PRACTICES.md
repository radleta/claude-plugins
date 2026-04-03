# Plugin Best Practices

Validated patterns for building high-quality, efficient Claude Code plugins.

## Context Budget Management

Every plugin component consumes context window space. Manage this carefully:

### Token Budget Rules

- **Skills**: Description loaded at startup (~100-400 chars each); full SKILL.md loaded on invocation
- **Commands**: YAML frontmatter visible in `/` autocomplete; body loaded on invocation
- **MCP Servers**: Tool schemas loaded at startup — the biggest budget consumer
- **Hooks**: Zero context cost (run as external processes)

### MCP Server Limits

MCP servers are the primary context budget concern:

- **Practical limit**: 5-8 MCP servers per plugin before context crowding
- **Tool Search mitigation**: Claude Code's Tool Search (late 2025) reduced MCP token usage from ~134K to ~5K for large tool libraries by lazy-loading schemas
- **Deferred tools**: Tools not immediately needed are deferred — their schemas load only when matched by a search query
- **Recommendation**: Prefer fewer, well-scoped MCP servers over many narrow ones

### Skill Description Budget

Skills share a description context budget (~2% of context window, ~16K chars fallback):

| Installed Skills | Max Description Length |
|------------------|-----------------------|
| 10-20 | Up to 400 chars |
| 20-40 | Under 300 chars |
| 40-60 | Under 200 chars |
| 60+ | Under 150 chars |

When plugins add many skills, keep descriptions concise to avoid budget overflow where skills get silently hidden.

## Component Design Patterns

### Single-Concern Plugins

Each plugin should solve one problem well:

```
# Good: focused plugins
code-review-plugin/     # Just code review
test-runner-plugin/     # Just test execution
doc-generator-plugin/   # Just documentation

# Bad: kitchen-sink plugin
everything-plugin/      # Code review + testing + docs + deployment + ...
```

**Why**: Users install what they need. Focused plugins are easier to maintain, test, and update. Kitchen-sink plugins waste context budget on unused components.

### Skill-First Design

Start with skills, add other components as needed:

1. **Skill** — Core domain knowledge (always start here)
2. **Commands** — User-invocable actions that use the skill
3. **Agents** — Autonomous workers using the skill (thin agent pattern)
4. **Hooks** — Automation triggered by events
5. **MCP servers** — External integrations (add last, highest cost)

### Component Interaction Patterns

**Command + Skill**: Command provides the "what to check" context; skill provides the "how to check" methodology.

```
commands/review.md  →  loads skill  →  skills/review-expert/SKILL.md
```

**Command + Agent + Skill**: Command orchestrates, agent works in isolation, skill provides methodology.

```
commands/verify.md  →  spawns  →  agents/verifier.md  →  loads  →  skills/verification/SKILL.md
```

**Hook + Command**: Hook detects event, triggers command logic.

```
hooks/on-commit.sh  →  validates  →  commands/pre-commit-check.md
```

## Testing Strategies

### Local Development Loop

```bash
# Start Claude Code with your plugin loaded
claude --plugin-dir ./my-plugin

# Inside the session:
# 1. Test skill auto-discovery
#    Type queries that should trigger your skill
#    Verify it loads (check system prompt mentions)

# 2. Test commands
#    Type / and verify your command appears
#    Run it and check output

# 3. Test hooks
#    Trigger the event your hook listens for
#    Check hook output (logs, side effects)

# 4. After changes, reload without restart:
/reload-plugins
```

### Validation Checklist

The comprehensive 45-item validation checklist is in SKILL.md Step 6 (the canonical location). It covers 8 categories: Manifest (8), Skills (8), Commands (6), Agents (5), Hooks (5), MCP Servers (4), Documentation (5), Integration (4).

## Common Anti-Patterns

### Over-Bundling

**Problem**: Stuffing many unrelated components into one plugin.

**Fix**: Split into focused plugins. Users can install multiple plugins.

### Missing Descriptions

**Problem**: Skills or commands without descriptions don't auto-discover.

**Fix**: Every skill needs a YAML description following the WHAT + WHEN formula. Every command needs a description for `/` autocomplete.

### Heavy MCP Servers

**Problem**: Many MCP servers with large tool schemas consuming context.

**Fix**: Limit to 5-8 servers. Use Tool Search (deferred tools) when possible. Combine related tools into fewer servers.

### No Local Testing

**Problem**: Publishing without testing leads to broken plugins.

**Fix**: Always test with `--plugin-dir` before publishing. Use `/reload-plugins` for rapid iteration.

### Hardcoded Paths

**Problem**: Absolute paths that break on other machines.

**Fix**: Use relative paths from the plugin root. Use environment variables for user-specific locations.

### Ignoring Hot-Reload

**Problem**: Telling users to restart after installing/updating.

**Fix**: Skills and commands hot-reload automatically since v2.1. New agents need a session restart to appear in `@` autocomplete, but edits to existing agents take effect immediately.

## Plugin Naming Conventions

- **Plugin name**: kebab-case, descriptive, no reserved words
- **Skill names**: Match parent directory, kebab-case
- **Command files**: kebab-case `.md` files
- **Agent files**: kebab-case `.md` files
- **Hook scripts**: Descriptive names indicating the event they handle

Examples:
```
Plugin:  code-review-toolkit
Skills:  code-review-expert, pr-analysis
Commands: review-code.md, check-pr.md
Agents:  code-reviewer.md
Hooks:   pre-commit-check.sh, on-push-validate.js
```

## Version Management

- Use semantic versioning: `MAJOR.MINOR.PATCH`
- **MAJOR**: Breaking changes (renamed components, removed features)
- **MINOR**: New components or capabilities (backward compatible)
- **PATCH**: Bug fixes, documentation updates
- Update `version` in both `plugin.json` and `marketplace.json` entries
- Marketplace supports version tracking — users see update notifications
