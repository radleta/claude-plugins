---
tags: [claude-code/session-lifecycle]
updated: 2026-04-23
summary: "/rename persists to ~/.claude/sessions/{pid}.json — process-scoped, not session-scoped"
---

## /rename Persistence Mechanism

The `/rename` command persists session names to a process-scoped PID file at `~/.claude/sessions/{pid}.json`, separate from the session_id lifecycle. This enables human-readable naming of work in progress without changing the session's canonical ID.

### Storage Location

After a user runs `/rename foo`, the session's PID file gains a `.name` field and `.updatedAt` timestamp:

```json
{
  "pid": 47860,
  "sessionId": "756db9bc-6826-46bd-b3e6-98f23cda0b0f",
  "cwd": "D:\\dev\\github\\claude-code-ref",
  "startedAt": 1776957070876,
  "version": "2.1.118",
  "peerProtocol": 1,
  "kind": "interactive",
  "entrypoint": "cli",
  "name": "marketplace-publish-gating",
  "updatedAt": 1776977880603
}
```

### Key Properties

**Process-scoped, not session-scoped:** The name is bound to the Claude Code process PID, not to `sessionId`. Survives `/clear` (same process). Lost when the process exits.

**`.sessionId` in the PID file is the startup id:** Not updated on `/clear`. After `/clear`, the live session id (exposed via `${CLAUDE_SESSION_ID}` template) differs from `.sessionId` in the PID file — the PID file retains the original startup id.

**`.cwd` is stable:** The project directory Claude Code was invoked in; doesn't change mid-process.

**`.updatedAt` bumps on rename:** Timestamp in milliseconds. Likely bumps on other events too, not investigated.

### Important: Does NOT Persist Across Process Restart

The project-scoped index at `~/.claude/projects/{cwd-hash}/sessions-index.json` does not have a `name` field. Renamed sessions do not appear with their name in the index.

**Implication:** Names do not survive process restart. A session renamed mid-process loses its name when the process exits. On `--resume`, the new process gets a fresh PID file without a name.

### Finding "Our" PID File

Multiple Claude Code processes can share a cwd (normal in multi-window workflows). Use deterministic matching:

1. Filter `~/.claude/sessions/*.json` where `.cwd == process.cwd()`.
2. Further filter where `.sessionId ∈ {current_session_id} ∪ session_chain` (the union covers any number of `/clear` rotations because the PID file's startup id stays in the session's chain).
3. Tiebreak (rare): pick the entry with the most-recent `.updatedAt`.

**Edge case:** Fresh process + `/rename` + `/clear` + first `/handoff` — no `session_chain` exists yet AND `session_id` is post-clear while PID file holds pre-clear. No match; name is lost. Workaround: re-run `/rename` after `/clear`.

### No Environment Variable or Template Substitution

- `CLAUDE_SESSION_NAME` — does not exist
- `${CLAUDE_SESSION_NAME}` template — does not exist
- `$PPID` from Bash tool returns `1` (sandboxed; cannot identify Claude Code's PID from the shell)

Consumers must read the PID file directly from the filesystem.

### When This Matters

Any consumer that wants to show the user a human label instead of a 36-char UUID needs to implement the cwd + chain match pattern. Examples:

- Status line (could show `[marketplace-publish-gating]` instead of session prefix)
- Handoff folder naming (`scratch/S-{slug}/` instead of `scratch/S-{uuid}/`)
- MCP tools that want to emit human-friendly output

### Verified On

- Claude Code 2.1.118
- Windows 10 Pro (path separators are backslashes in `.cwd`)
- Timestamps are Unix epoch ms

### Unknowns

- What other events besides `/rename` bump `.updatedAt`
- Whether future Claude Code versions might propagate names to `sessions-index.json`
- Whether `/resume {sessionId}` carries the prior name (presumably no, since PID files are deleted on process exit)

### Related Pages

- [Session-ID Lifecycle](session-id-lifecycle.md) — complementary behavior of `CLAUDE_SESSION_ID` across startup/resume/clear/compact
- [Handoff → Clear → Pickup Flow](../handoff-patterns/handoff-clear-pickup-flow.md) — uses this mechanism for human-friendly folder naming

**Discovered:** During session-name-folders planning on 2026-04-23. The session-name-folders project aims to use `/rename` to drive human-readable folder naming (`scratch/S-{slug}/`), which requires understanding the PID file storage and matching semantics.
