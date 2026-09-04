---
tags: [wiki-memory/operations]
last-verified: "2026-08-25"
summary: "A consume-from flag for wiki-write was already proposed and explicitly rejected"
---

## A `--consume-from` Flag for wiki-write Was Already Proposed and Explicitly Rejected

Commit `4129aa9` ("fix(wiki-memory): ban the updated: field mechanically and
clean up write payloads") states in its body: *"Docs-only by decision -- no
`--consume-from` flag."* The originating issue,
`scratch/issues/wiki-write-from-payload-files-persist-in.md`, carries
`status: resolved`.

The resolution chosen instead was caller-side cleanup: `mktemp` plus a
`_tmpfiles[]` accumulate-array plus a single `trap ... EXIT INT TERM`, with the
researcher agent deliberately exempted (its `PreToolUse` character allowlist
blocks `mktemp`, `trap`, `rm`, `&&`, and `$(...)`, so its payloads land in a
deterministic per-slug `/tmp` path the OS reclaims).

Fourteen doc surfaces across `.claude/` now assert "wiki-write never deletes its
`--from` payload" as load-bearing contract.

**Discovered:** A later plan re-proposed the same feature without finding this record.
**Impact:** Before proposing payload-consumption behavior in wiki-write again,
read this commit and issue first — the design space was already explored and
closed. Re-opening it requires engaging that record, not restating the problem.
