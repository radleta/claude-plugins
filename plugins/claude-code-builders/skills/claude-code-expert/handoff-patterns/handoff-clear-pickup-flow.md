---
tags: [claude-code/handoff]
updated: 2026-04-24
summary: "The /handoff → /clear → /pickup flow that bypasses context rot; folders named S-{session_id} where session_id is caller-supplied at /handoff and /pickup"
---

## The `/handoff` → `/clear` → `/pickup` Flow (Context-Rot Bypass)

Richard's idiomatic flow for managing context across long work, discovered during handoff skill brainstorming on 2026-04-22.

### The Pattern

```
work... approaching 150k–400k tokens
  ↓
/handoff <session_id>   # write structured session state to scratch/S-{session_id}/HANDOFF.md
  ↓
/clear            # mint a new session_id, fresh context (NOT /compact)
  ↓
/pickup           # load the HANDOFF.md from the prior session → fully restored
  ↓
continue work...
```

### Why This Beats `/compact`

Anthropic's `/compact` summarizes the entire conversation and replaces history with that summary. Known failure modes (see [Handoff Landscape Survey](handoff-landscape.md) for sources):

- Behavioral erosion ("ghost lexicon," altered tool-call patterns)
- Nuance loss (decisions reduced to their conclusions, losing rationale)
- Failed-attempts loss (what didn't work is the first thing dropped)
- Cumulative degradation across multiple compactions in one session

The handoff-clear-pickup flow replaces compaction's lossy summary with a structured, explicit state document. `/clear` wipes ALL partial/degraded context (including context rot that may have already set in); `/pickup` rehydrates from the hi-fi document. No accumulated damage, no loss of rationale or failed-attempts.

### Why It Requires Two Commands, Not One

- `/handoff` is the WRITE path — only action is capturing state
- `/pickup` is the READ path — only action is restoring state
- Separating them eliminates "what does /handoff mean in this context" ambiguity
- Matches the asymmetry of the operation: writing is the user saying "I'm about to lose context, save this"; reading is the user saying "I'm in a fresh session, pull in prior state"

### The PreCompact Hook as Belt-and-Suspenders

The primary flow does NOT invoke `/compact`. But users sometimes forget `/handoff` before `/compact`, or auto-compact fires at 95% before manual intervention. For these cases:

- PreCompact hook automatically runs the `/handoff` logic (a degraded-but-present snapshot of whatever context Claude has at the time)
- SessionStart hook with matcher=`compact` injects a pointer to Claude: "Read `scratch/S-$CLAUDE_SESSION_ID/HANDOFF.md` — it was just written as a safety net"
- Claude Reads the file as first action post-compact → recovered, even though `/compact` mangled the conversational context

### Why /clear Works Even With a New session_id

Per [Session-ID Lifecycle](../session-lifecycle/session-id-lifecycle.md), `/clear` mints a new session_id. This is a FEATURE, not a bug, for this flow:

- `/pickup` renames the prior session's `scratch/S-{from-session-id}/` folder to `scratch/S-{to-session-id}/` — the workstream migrates atomically into the new session using the caller-supplied session ids
- Prior session's HANDOFF.md is now at `scratch/S-{new-slug-or-uuid}/HANDOFF.md` — already in the right place for the next `/handoff` write
- Ownership history is recorded in the frontmatter `session_chain` array (e.g., `[old_id, new_id]`); `first_written` is preserved from the original session
- Accumulated `scratch/S-*/` folders represent active workstreams (not session archives); `scratch-management` archives or deletes them by S- prefix when the workstream is done

### How the Folder Name Is Set (post-redesign, 2026-05-05)

The folder name `S-{session_id}` uses the caller-supplied `session_id` argument passed to `/handoff <session_id>` and `/pickup <from_session_id>`. No PID-file lookup; no slug derivation. The user decides what label to use.

See [/rename and Session Folder Labels](../session-lifecycle/rename-and-session-labels.md) for the pre-redesign PID-file mechanism history and the current caller-supplied model.

### Design Invariants This Establishes

1. **One workstream = one folder.** `scratch/S-{session_id}/HANDOFF.md` exists once per active workstream; the folder suffix is the caller-supplied `session_id` passed to `/handoff` or `/pickup`. After `/pickup` renames the folder, the suffix reflects the current live session. `session_chain` in frontmatter records all prior session ids as opaque strings for audit.
2. **Writer is main session only.** The session whose id matches the folder name is the only writer — no concurrency concerns within a folder.
3. **`/pickup` transfers ownership via rename.** `/pickup` does not read-only peek at another session's folder; it atomically renames the folder to the current session's id. After a successful pickup, the source folder no longer exists.
4. **No versioning within a session.** In-place merge replaces the need for `HANDOFF-{ts}.md` files — history is preserved in the file's growth (append-dedup sections: Done, Decisions, What to avoid, Key files).

### Related Pages

- [Session-ID Lifecycle](../session-lifecycle/session-id-lifecycle.md) — why `/clear` works despite issuing a new session_id
- [Handoff Landscape Survey](handoff-landscape.md) — external patterns that inform this design

**Discovered:** During handoff skill brainstorming (2026-04-22). The user proposed separating `/pickup` as its own command and clarified his typical workflow is clear-not-compact-based.
**Impact:** Defines the core UX for the handoff skill and sets a template for any future session-scoped mechanisms in this repo (e.g., session-level learned-file routing, session-level decision logs).
