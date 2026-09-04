---
tags: [claude-code-expert/platform-features]
summary: "Group hub for Claude Code platform feature pages — hooks, session data, dash-p orchestration, and agent teams"
---

# Claude Code Platform Features

Knowledge hub covering Claude Code platform-level features: the hooks event system, local session data storage and parsing, headless `claude -p` orchestration, and the experimental agent teams feature.

## Pages

- [Hooks](hooks.md) — Claude Code hooks system: event types, settings.json structure, matcher patterns, exit code semantics, stdin/stdout/stderr contracts, and loop prevention
- [Session Data](session-data.md) — Parsing Claude Code local session data — JSONL transcripts, result.json, stream-json events, MCP reports, and hook progress — for token analysis and workflow profiling
- [claude -p Orchestration](dash-p.md) — Orchestrating `claude -p` (print/headless mode) from inside a running session: path-as-reference I/O, session continuity, output formats, and multi-turn flows
- [Agent Teams](teams.md) — Agent teams feature: enablement, tools (TeamCreate, TaskCreate, SendMessage), display modes, hooks (TeammateIdle, TaskCreated, TaskCompleted), permissions, token costs, and troubleshooting
- [Skill Listing Budget](skill-listing-budget.md) — skillListingBudgetFraction and skillListingMaxDescChars settings, two-pass truncation algorithm, usage-decay ranking in ~/.claude.json, /skills behavior, and practical tuning guidance
