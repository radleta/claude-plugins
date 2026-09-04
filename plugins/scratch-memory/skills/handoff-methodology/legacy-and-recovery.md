# Handoff — Legacy Migration & Recovery

Cold-path companion to [SKILL.md](SKILL.md): how to upgrade V1/V2 folders to v3 and how to recover a corrupt or missing pointer.

## Upgrading older folders to v3

The old 10-section `HANDOFF.md` (V1 / V2) is superseded by the v3 thin-pointer format documented in handoff-methodology/SKILL.md. Upgrades are **just-in-time and per-folder** — there is no bulk-sweep verb, and folders you never touch are left exactly as they are (no churn). Two starting shapes:

- **V1 folder** — a single `HANDOFF.md`, no `sessions/` directory. The first `/pickup` mechanically migrates it V1→V2 (it writes the prior body into a `*-legacy.md` session file and rewrites `HANDOFF.md` as a V2 skeleton). The very next `/handoff` then regenerates a v3 thin pointer via `rewrite-pointer`. This is the kept two-hop path; pickup does not jump V1→v3 directly.
- **V2 folder** — already has a `sessions/` log. The next `/handoff` auto-upgrades it to v3 in place by calling `rewrite-pointer` on the hot path — JIT, no sweep, no manual step.

You can also force a regeneration at any time with `scratch-memory rewrite-pointer <session-dir>`; it is idempotent. Legacy session files lacking the `summary:` field are handled by the read-side derivation fallback built into `cat-sessions` (see `## Assembly Protocol` in handoff-methodology/SKILL.md). Running `handoff commit` or `handoff validate` on a non-v3 folder no longer mutates it — both print a JIT signpost pointing at `rewrite-pointer` and exit 0.

## Recovery Procedures

**No `.bak/` files exist in the v3 design.** `HANDOFF.md` is a derived cache — the immutable session log in `sessions/` is the source of truth. Any pointer corruption or missing pointer is recovered by re-running `rewrite-pointer`.

**HANDOFF.md missing, empty, or corrupt after `/handoff`:**
```bash
scratch-memory rewrite-pointer scratch/S-{id}/
```
Regenerates `HANDOFF.md` atomically from the session log. The session file written by `write_session` is already durable; only the pointer needs refreshing.

**`/handoff` reports a STALE-POINTER WARNING (`write_session` returned `pointer.written === false`):**
The per-session file is already safely written. Run the recovery CLI verb:
```bash
scratch-memory rewrite-pointer scratch/S-{id}/
```
Do not re-run `/handoff` — the session file already exists and is immutable.

**Legacy folder (sessions lack `summary:`, old synthesized HANDOFF.md present):**
```bash
scratch-memory rewrite-pointer scratch/S-{id}/
```
`rewrite-pointer` calls the assembly module (`cat-sessions --format json`), which applies the read-side `summary:` derivation fallback for any session file missing the field. No manual data migration or agent dispatch needed.

**Full pointer rebuild from the session log (any reason):**
```bash
scratch-memory rewrite-pointer scratch/S-{id}/
```
Idempotent. Safe to run at any time; always produces the correct v3 pointer from the current `sessions/` contents.

## summary: derivation fallback for legacy sessions

Legacy session files lacking the `summary:` frontmatter field are handled by `cat-sessions` at read time:

1. **Derived:** extract the `## Next best step` heading content + first non-empty line of `## Done` (mirrors the write-side derived branch in `/handoff`).
2. **Placeholder:** `⚠ no summary — see source` + first ~300 chars of the session body.

Never a blank row in the Sessions table.

## Legacy frontmatter divergence (pre-redesign session_id)

For pre-redesign workstreams whose HANDOFF.md was written before the explicit-arg redesign (handoff-sid-fix, 2026-05-05), the frontmatter `session_id` may be a UUID while the folder slug (`S-{slug}`) is the PID-file-derived session name. These two values may diverge. Post-redesign, `session_id` in frontmatter matches the folder slug exactly — both equal the caller-supplied `session_id` argument passed to `/handoff` or `/pickup`.

## Pre-redesign session naming (PID files)

PID files at `~/.claude/sessions/{pid}.json` provided the session name via the `.name` field, written by `/rename`. The server resolved the name by matching the calling PID to the correct JSON file via cwd comparison plus `.sessionId ∈ {session_id} ∪ session_chain`. When multiple PID files matched, the one with the most-recent `updatedAt` won. The slug was then normalized to `[a-z0-9-]`, max 64 chars, whitespace → `-`, leading/trailing hyphens stripped. That mechanism is preserved in Claude Code itself (the `/rename` command still writes PID files) but is no longer used by scratch-memory for workstream folder naming.

**Known limitation:** after a process restart the `/rename`-assigned name is gone unless the user runs `/rename` again. The `session_name` field in HANDOFF.md frontmatter is the durable record — the interactive picker reads it to show a human-readable label for long-exited sessions. This limitation still applies to the `/rename` mechanism even though scratch-memory no longer reads PID files for workstream naming.
