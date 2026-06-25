# Claude-Code Wiki — Schema

## Scope

General Claude Code platform knowledge: features, session lifecycle, context management, primitive building (skills, agents, commands, plugins, CLAUDE.md), platform features (hooks, session data, dash-p, teams), and cross-cutting behaviors. The only narrower expert still separate is `claude-cowork-expert`.

Pages here cover: session lifecycle, context-window mechanics, `/clear` vs `/compact` vs `/pickup` flows, handoff/resume patterns, skill/agent/command/plugin authoring, hooks configuration, session data parsing, `claude -p` orchestration, and agent teams.

## Page Types

- **Knowledge page**: Core domain content with frontmatter (tags, summary)
- **Group index**: `index.md` hub for a subdirectory group (tags, summary required)

## Subdirectory Groups

| Group | Coverage |
|-------|---------|
| `builders/` | Skill, agent, command, plugin, CLAUDE.md authoring |
| `platform-features/` | Hooks, session data, dash-p, agent teams |
| `command-architecture/` | Command dispatch patterns, cache economics |
| `agent-design/` | Agent registration, constraint drift |
| `session-lifecycle/` | CLAUDE_SESSION_ID, /rename, session folder labels |
| `handoff-patterns/` | /handoff → /clear → /pickup, landscape survey |

## Conventions

- Filenames: kebab-case, descriptive
- Links: standard markdown (`[Page](page.md)`)
- Frontmatter: `tags` and `summary` required on all knowledge pages
- Tags use `claude-code/{subtopic}` namespace (e.g., `claude-code/builders`, `claude-code/platform-features`)
- Group index files use tags matching the group: `claude-code/builders`, `claude-code/platform-features`, etc.
- Index cap: ~100-150 lines per hub SKILL.md

## Evolution

Review and update this schema after every 10-20 ingests. The `builders/` and `platform-features/` groups were added during the Phase 2 9→1 consolidation (2026-04-30).
