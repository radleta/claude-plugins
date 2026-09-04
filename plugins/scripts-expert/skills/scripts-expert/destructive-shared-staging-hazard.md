---
tags: [bash/concurrency, cli-design]
summary: "Destructive operations on a shared global staging path silently clobber concurrent writers; use per-process staging or atomic tmpfile+rename"
code-cites: []
---

## Destructive Staging at a Shared Path Silently Clobbers Concurrent Writers

Any CLI that (1) uses a staging directory at a global path, (2) destructively wipes that staging at the start of an operation, and (3) has a separate later phase that reads/commits from staging is a concurrency hazard. A second invocation between the two phases of a first invocation silently destroys the first's in-progress work AND corrupts the eventual commit.

### Failure mode — two concurrent sessions A, B against `prepare → edit → commit`

| Step | A | B | Result |
|------|---|---|--------|
| 1 | `prepare X` → creates `$STAGING/X` + snapshot | — | A's staging created |
| 2 | — | `prepare X` → `rm -rf $STAGING/X` then recreate | A's snapshot + edits destroyed |
| 3 | edits files in `$STAGING/X` | — | A is now editing B's staging |
| 4 | — | `commit X` → atomic replace of live with B's staging contents | Live target gets A's edits + B's edits, mixed silently |
| 5 | `commit X` → fails "not staged" (B's later cleanup) | — | A's work unrecoverable |

The signature `rm -rf "$STAGING/$name"` early in a `prepare` verb is the red flag. Comment text that says "clean this session's staging" is misleading when the path is not session-scoped.

### Mitigations (ranked)

1. **Per-process staging.** Encode PID or session-id in the staging path: `$STAGING/$name.$$/` or `$STAGING/$name.${CLAUDE_SESSION_ID}/`. Two concurrent invocations get two paths; no clobber possible. Best when the workflow truly needs a multi-step edit phase.
2. **Atomic tmpfile + rename.** Eliminate the staging directory entirely. Write payload to `mktemp "${TARGET}.tmp.XXXXXXXXXX"` in the same directory as the target, then `mv -f tmpfile target`. `rename(2)` is atomic on a single filesystem — concurrent writers race the rename, last write wins, but no torn writes and no clobbered staging. Best when each invocation writes one file with no intermediate edit phase. See `.claude/skills/wiki-memory/scripts/wiki-write.sh` lines 420-470 for the canonical in-repo implementation (tmpfile in same dir as target, trap cleanup, mv -f for atomic replace).
3. **Pre-acquire guard + sentinel file.** If shared staging is unavoidable, check for an existing staging dir before `rm -rf`, and write a `.session-${id}.lock` sentinel after prepare that commit verifies. Reduces but does not eliminate the hazard — a TOCTOU race remains between guard-check and `rm -rf`. Treat as last resort.

### Detection symptoms in code review

- `rm -rf "$STAGING/..."` in a `prepare`/`pull`/`init` verb where the path does not include `$$`, `$BASHPID`, `$CLAUDE_SESSION_ID`, or another per-invocation token
- Two-phase API: a "stage" verb and a separate "commit"/"push" verb sharing the same path
- Comments claiming session scoping (`"clean this session's staging"`) on paths that are not actually session-scoped — words and code disagree
- No sentinel/lock file written by `prepare` that `commit` verifies

### Why "just document the guard" is not enough

Userland concurrency guards (every caller checks before invoking) push the failure mode from the script into every consumer. The race is also racy at the guard layer — TOCTOU between guard-check and the actual `rm -rf`. Fix it at the script level, once, by using mitigation 1 or 2 above.
