---
tags: [claude-code-expert/session-lifecycle]
summary: "Group hub for session lifecycle pages"
---

## Pages

- [Session-ID Lifecycle](session-id-lifecycle.md) — How `CLAUDE_SESSION_ID` behaves across fresh startup, `--resume`, `/clear`, and `/compact`. Includes reliability notes on SessionStart hook output injection.
- [/rename Persistence Mechanism](rename-persistence-mechanism.md) — Process-scoped name storage via `~/.claude/sessions/{pid}.json`. Survives `/clear`, lost on process exit. Deterministic PID file matching via cwd + session_chain.
- [/rename and Session Folder Labels](rename-and-session-labels.md) — `/rename` PID file storage (still accurate for Claude Code itself); post-redesign scratch-memory uses caller-supplied `session_id` at `/handoff`/`/pickup` for folder naming — no PID-file lookup.
