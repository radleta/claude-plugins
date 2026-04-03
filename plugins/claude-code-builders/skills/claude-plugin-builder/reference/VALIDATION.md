# Plugin Validation Checklist

Comprehensive 45-item checklist for validating Claude Code plugins. This is the canonical checklist — BEST-PRACTICES.md references this location.

## Manifest (8 items)

- [ ] `plugin.json` is valid JSON (no trailing commas, proper quoting)
- [ ] `name` is kebab-case, no reserved words (`anthropic`, `claude`)
- [ ] `version` follows semantic versioning (MAJOR.MINOR.PATCH)
- [ ] `description` is concise and describes the plugin's purpose
- [ ] All `source` / path references resolve to existing files/directories
- [ ] No secrets, credentials, or API keys in any file
- [ ] `keywords` are relevant and specific (not generic filler)
- [ ] `author` and `repository` fields populated for marketplace listing

## Skills (8 items)

- [ ] Each skill has valid YAML frontmatter (`name` + `description`)
- [ ] `name` field matches parent directory name
- [ ] Description follows WHAT + WHEN formula with 3+ trigger scenarios
- [ ] No reserved words in skill names (`anthropic`, `claude`)
- [ ] SKILL.md under 400 lines (supporting files for overflow)
- [ ] Role definition present (identity, purpose, expertise, scope)
- [ ] Content uses imperative voice with concrete examples
- [ ] File loading protocol present if multi-file

## Commands (6 items)

- [ ] Each command has valid YAML frontmatter with `description`
- [ ] `allowed-tools` specified if command uses restricted tools
- [ ] `argument-hint` documents expected arguments
- [ ] `user-invocable: true` set for user-facing commands
- [ ] Command body is clear, actionable, and complete
- [ ] No hardcoded paths or environment-specific assumptions

## Agents (5 items)

- [ ] Thin agent pattern followed (wiring only, methodology in skills)
- [ ] `skills:` field references valid, installed skill names
- [ ] `model` field appropriate for task complexity
- [ ] Tool restrictions match agent's actual needs (principle of least privilege)
- [ ] Description follows WHAT + WHEN formula for auto-discovery

## Hooks (6 items)

- [ ] Exit codes correct (0=continue, 2=block, other=error)
- [ ] Stdin JSON parsed safely with missing-field handling
- [ ] Execution is fast (no network calls in synchronous hooks)
- [ ] Matchers filter to specific tools when applicable
- [ ] Error messages are descriptive (shown to Claude as block reason)
- [ ] No unhandled exceptions (always exit cleanly)

## MCP Servers (5 items)

- [ ] Server starts and responds to tool requests
- [ ] Tool schemas concise (minimize context consumption)
- [ ] No more than 5-8 servers per plugin (context budget)
- [ ] Environment variables used for credentials (not hardcoded)
- [ ] Error handling for server unavailability (graceful degradation)

## Documentation (5 items)

- [ ] README.md with installation instructions and usage examples
- [ ] Component list with brief descriptions
- [ ] Prerequisites documented (runtimes, API keys, tools)
- [ ] Version history or changelog maintained
- [ ] License specified

## Integration (4 items)

- [ ] Plugin loads without errors via `--plugin-dir`
- [ ] Skills auto-discover on relevant queries
- [ ] Commands appear in `/` autocomplete
- [ ] `/reload-plugins` picks up changes without restart

## See Also

- [SKILL.md](../SKILL.md) — Main orchestrator (references this checklist in Step 6)
- [BEST-PRACTICES.md](BEST-PRACTICES.md) — Anti-patterns and design guidance
