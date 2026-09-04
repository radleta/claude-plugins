---
tags: [claude-code/session-lifecycle, claude-code/handoff]
updated: 2026-05-06
summary: "/rename semantics and PID file storage (still accurate for Claude Code itself); scratch-memory folder naming is now caller-supplied session_id, not PID-derived slug"
---

## /rename and Session Folder Labels

### What `/rename` Does (unchanged)

Running `/rename my-feature` writes a `.name` field and `.updatedAt` timestamp into the process-scoped PID file at `~/.claude/sessions/{pid}.json`:

```json
{
  "pid": 47860,
  "sessionId": "756db9bc-6826-46bd-b3e6-98f23cda0b0f",
  "cwd": "D:\\dev\\github\\claude-code-ref",
  "name": "my-feature",
  "updatedAt": 1776977880603
}
```

The rename is **process-scoped**: it is bound to the OS process (PID), not to the session UUID. The same name persists across `/clear` within the same process, because `/clear` mints a new session UUID but does not restart the process.

### Where the Name Lives and Its Lifecycle (unchanged)

| Event | Effect on name |
|---|---|
| `/rename foo` | Writes `.name = "foo"` to `~/.claude/sessions/{pid}.json` |
| `/clear` | No effect — same process, PID file unchanged |
| `/rename bar` (again) | Overwrites `.name = "bar"` in same PID file |
| Process exit | PID file deleted; name is gone |
| New Claude Code launch (`--resume` or fresh) | New PID file, no `.name` field |

The name does **not** propagate to `~/.claude/projects/{cwd-hash}/sessions-index.json`. There is no harness env var (`CLAUDE_SESSION_NAME` does not exist), no template substitution (`${CLAUDE_SESSION_NAME}` does not exist), and `$PPID` from the Bash tool returns `1` (sandboxed). Consumers must read the PID file directly.

### How scratch-memory Names Session Folders (post-redesign, 2026-05-05)

**Post-redesign (handoff-sid-fix):** Session folder naming is **caller-supplied**, not server-derived. The user passes `session_id` as an explicit argument to `/handoff <session_id>` and `/pickup <from_session_id>`. The server creates `scratch/S-{session_id}/` directly — no PID-file reading, no slug derivation, no cwd matching.

```
/handoff my-feature   → scratch/S-my-feature/
/handoff some-uuid    → scratch/S-some-uuid/
```

The `session_id` is opaque to the server: any non-empty, filesystem-safe string that does not contain path separators, `..`, a leading dot, newlines, or null bytes. The user decides what label to use; the system does not impose one.

**Pre-redesign history:** Before 2026-05-05, `server.mjs` resolved the slug by scanning PID files: filter by `cwd`, match `sessionId ∈ {current} ∪ session_chain`, tiebreak on `updatedAt`, derive slug from `.name`. This mechanism is preserved in Claude Code itself (the `/rename` command still writes PID files) but is no longer used by scratch-memory for workstream folder naming.

### Session Folder Naming (post-redesign)

| How user invokes | Folder label |
|---|---|
| `/handoff my-feature` | `scratch/S-my-feature/` |
| `/handoff some-uuid` | `scratch/S-some-uuid/` |
| `/pickup old-session --to-session-id new-session` | renames `scratch/S-old-session/` → `scratch/S-new-session/` |

`session_chain[]` in `HANDOFF.md` frontmatter stores the prior session ids as opaque strings (post-redesign: exact-equality lookup, no UUID-specific logic).

### Known Limitations (post-redesign)

The PID-file-based limitations (name lost on restart, first-handoff after rename+clear edge case, mid-workstream rename churn) no longer apply — the user controls the label entirely.

**Remaining collision case:** If two sessions both try to use the same `session_id` for different workstreams, `scratch-memory pickup` returns `PICKUP_COLLISION` (exit 1). User must choose a different `session_id`.

### Related Pages

- [Session-ID Lifecycle](session-id-lifecycle.md) — how `CLAUDE_SESSION_ID` behaves across startup, clear, compact, and resume
- [Handoff → Clear → Pickup Flow](../handoff-patterns/handoff-clear-pickup-flow.md) — how session folders integrate with the full handoff workflow

**Reference skills:**
- `.claude/skills/handoff-methodology/SKILL.md` — `/handoff` and `/pickup` command protocols, session name resolution post-redesign
- `.claude/skills/scratch-memory/SKILL.md` — `write_session` and `pickup` tool/CLI schemas, error codes, return fields

**Pre-redesign discovery:** During session-name-folders implementation on 2026-04-23. The PID-file resolver was replaced in the handoff-sid-fix refactor on 2026-05-05.
