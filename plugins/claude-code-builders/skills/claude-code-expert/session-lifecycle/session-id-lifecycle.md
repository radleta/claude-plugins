---
tags: [claude-code/session-lifecycle]
updated: 2026-04-22
summary: "How CLAUDE_SESSION_ID behaves across fresh startup, --resume, /clear, and /compact — the four SessionStart matchers"
---

## CLAUDE_SESSION_ID Lifecycle Across Session Events

The `session_id` returned in the SessionStart hook's `source` payload (also available as `$CLAUDE_SESSION_ID` in hook environments) behaves differently across the four SessionStart matchers. This directly affects any skill or hook architecture that uses session_id as a stable identifier (e.g., `scratch/S-{session_id}/` folders).

### The Lifecycle Rules

| Event | source value | session_id | Transcript file | Hook output reliability |
|---|---|---|---|---|
| Fresh `claude` startup | `startup` | **NEW** (freshly generated) | New transcript | **UNRELIABLE** — see GitHub issue #10373; hook may run but its stdout is not injected into context for brand-new sessions |
| `claude --resume` | `resume` | **RESTORED** (from prior session) | Existing transcript re-opened | Reliable |
| `/clear` in-session | `clear` | **NEW** (clear issues a new session_id) | New transcript file created | Reliable |
| `/compact` in-session | `compact` | **PERSISTS** (same ID as before) | Same transcript continues | Reliable |

### Key Implications

**1. `/compact` is the clean case.**
session_id is preserved, so any folder, file, or resource keyed on `{session_id}` is still valid after compaction. A SessionStart hook with matcher=`compact` can inject `scratch/S-${SESSION_ID}/` verbatim and Claude will find its own work.

**2. `/clear` issues a new session_id — treat it like a new session.**
The old transcript is orphaned (still on disk, but the current session has a different ID). Do NOT auto-load the old session's handoff after `/clear` — the user's intent was to start fresh. Either ignore or emit a soft hint ("N prior handoffs exist — `/handoff resume` to browse").

**3. Brand-new startup (`claude` without `--resume`) is the unreliable case for hooks.**
GitHub issue #10373 documents that SessionStart hook output is NOT consistently injected into context when `source=startup`. The hook itself runs, its exit code matters, but its stdout may not reach Claude. Any design that relies on SessionStart auto-injection for fresh startup will be flaky — an explicit user-initiated resume is the robust path.

**4. `--resume` is fully reliable.**
session_id is restored, matching folder exists, hook fires with `source=resume`, output is injected. This is the ideal "come back to yesterday's work" path — a handoff skill's cross-session resume should specifically target `--resume` as the supported flow.

### Design Consequences

- **session_id IS a stable key for in-session persistence** across compact. Safe to build `scratch/S-{session_id}/` around it without worrying about it changing under you during `/compact`.
- **session_id IS NOT stable across /clear.** Treat `/clear` as session termination for persistence purposes.
- **Do not rely on SessionStart-startup auto-injection** for cross-session resume — build explicit commands (`/handoff resume`) instead, or depend on `--resume` flow which is reliable.
- **The `scratch/S-{session_id}/` layout is safe** regardless of event, because any NEW session just creates a new folder; it never collides with an old one.

### Related Pages

- [Handoff → Clear → Pickup Flow](../handoff-patterns/handoff-clear-pickup-flow.md) — idiomatic flow that exploits these rules
- [Handoff Landscape Survey](../handoff-patterns/handoff-landscape.md) — how existing tools handle session persistence

### Sources

- [Claude Code Hooks Reference (official)](https://code.claude.com/docs/en/hooks)
- [GitHub issue #10373 — SessionStart hooks not working for new conversations](https://github.com/anthropics/claude-code/issues/10373)
- [Claude Code Session Hooks blog — claudefa.st](https://claudefa.st/blog/tools/hooks/session-lifecycle-hooks)

**Discovered:** During handoff skill brainstorming on 2026-04-22, while working out the resume UX. The user asked whether session_id persists across compaction — the answer turns out to be nuanced (yes for compact, no for clear, new for startup with injection unreliability).
