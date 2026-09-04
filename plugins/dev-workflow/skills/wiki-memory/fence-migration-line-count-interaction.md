---
tags: [wiki-memory/fence-migration]
summary: "Fencing email-campaign-expert crosses wiki-health's 400-line partial-migration threshold"
---

## Fencing `email-campaign-expert` Crosses the 400-Line `partial-migration` Threshold

`email-campaign-expert/SKILL.md` sits at exactly 400 lines before any fencing work. Its `##
Pages` section has one run of one bullet (a C10 domain — the `---` after `## Pages` sits outside
the run). Inserting the two C10 marker lines (`<!-- BEGIN:PAGES -->` / `<!-- END:PAGES -->`)
raises the body to 402 lines, which crosses `wiki-health.sh`'s unrelated 400-line
`partial-migration` threshold check (the same check already flagged for `plan-expert` in the
captured baseline). The domain's classified state moves from `healthy` to `partial-migration`
purely because of line count — the fence insertion itself is correct and insertion-only; the
state change is a side effect of the file's length, not a grammar or transform defect.

`wiki-fence-migrate.sh`'s per-domain post-write verification (the "no domain leaves healthy"
invariant, spec.md's Risk 1 mitigation) correctly detects this state change and restores the
domain via `git checkout --`, marking it `failed` and the run exit `3` rather than silently
letting `email-campaign-expert` regress. Confirmed directly: fencing only this one domain in a
throwaway copy reproduces `wiki-health.sh email-campaign-expert` reporting
`partial-migration — SKILL.md body is 402 lines (threshold: 400)` immediately after the two-line
insertion, with no other change to the file.

**Discovered:** During step 04 implementation, running the plan's own apply-mode acceptance
criterion (`wiki-fence-migrate.sh` against a throwaway copy of the full fleet). The measured
result was `48 fenced, 1 failed` / `added=150` (not the plan's expected `49 fenced` /
`added=152`) — `email-campaign-expert` is the one domain that fails.

**Impact:** Step 06 (execute the fleet migration) is written to require
`wiki-fence-migrate: 49 fenced, 0 already-fenced, <S> skipped, 0 failed` and "exactly 49 files
changed" as acceptance criteria. As currently scoped, running the migration over the real fleet
will NOT meet that bar — `email-campaign-expert` will fail its post-write check and be restored,
leaving 48 fenced / 1 failed / 150 added lines. Whoever executes steps 05/06 needs to either
bring `email-campaign-expert/SKILL.md`'s body under 400 lines before migrating (e.g. decompose
some prose to a page) or explicitly revise the plan's expected census and acceptance criteria to
account for one domain staying unfenced. `mcp-expert`, the other C10 domain, is well under the
threshold (94 lines) and is not affected — this is specific to `email-campaign-expert`'s current
length, not a property of the C10 shape itself.
