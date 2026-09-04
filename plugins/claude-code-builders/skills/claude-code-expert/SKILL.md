---
name: claude-code-expert
description: "General Claude Code platform knowledge: session lifecycle (startup/resume/clear/compact), CLAUDE_SESSION_ID behavior, context-window and compaction mechanics, /handoff → /clear → /pickup flows, scratch/ conventions, skill/agent/command/plugin primitive building, hooks system, session data analysis, claude -p orchestration, and agent teams. Use when designing session-scoped workflows, debugging compaction or resume, picking between /clear and /compact, building Claude Code primitives, or answering general 'how does Claude Code work' questions — even when a narrower expert seems closer."
---

You are an expert in general Claude Code platform behavior — the cross-cutting knowledge that does not belong in a narrower expert skill. This wiki also covers primitive building (skill-builder, agent-builder, command-builder, plugin-builder, md-builder) and platform features (hooks, session-data, dash-p, teams).

## Pages

### Topic Areas

- [builders/](builders/index.md) — skill, agent, command, plugin, and CLAUDE.md authoring patterns
- [platform-features/](platform-features/index.md) — hooks system, session data analysis, claude -p orchestration, and agent teams
- [command-architecture/](command-architecture/index.md) — command dispatch patterns, cache economics, model-tier delegation
- [agent-design/](agent-design/index.md) — agent registration, constraint drift, and design gotchas
- [session-lifecycle/](session-lifecycle/index.md) — CLAUDE_SESSION_ID behavior, /rename persistence, session folder labels
- [handoff-patterns/](handoff-patterns/index.md) — /handoff → /clear → /pickup flow, handoff landscape survey

### Standalone Pages

- [builders/skill-edit-bypass-permissions-exemption.md](builders/skill-edit-bypass-permissions-exemption.md) — Bypass-permissions exemption for .claude/skills/ writes landed in v2.1.120 (broadened in v2.1.126); default-mode allow-list still prompts (#36497)
- [wiki-health-cross-links.md](wiki-health-cross-links.md) — wiki-health --full detects missing cross-reference pairs and downgrades state
- [subagent-model-tier-inheritance.md](subagent-model-tier-inheritance.md) — Subagent model tier is declared in its own YAML frontmatter, not inherited from parent --model flag

## Meta

- [Operations Log](log.md) — Timestamped wiki operations log (ingest, lint, query filings)
- [Schema](schema.md) — Wiki conventions and page-type definitions

## Scope Boundaries

This is the **general** Claude Code expert. All builder skills and platform feature skills have been absorbed into this wiki.

- **Cowork plugins, Cowork adaptation** → `claude-cowork-expert` (remains standalone)

What lives **here**: session lifecycle (startup / resume / clear / compact), `CLAUDE_SESSION_ID` behavior, context-window management, `/handoff` → `/clear` → `/pickup` flows, compaction failure modes, cross-session resume patterns, scratch-folder conventions, skill/agent/command/plugin building patterns, hooks system, session data parsing and analysis, `claude -p` orchestration, and agent teams configuration.
