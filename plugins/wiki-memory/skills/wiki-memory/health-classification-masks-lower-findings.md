---
tags: [wiki-memory/operations]
summary: "wiki-health reports one classification; clearing the top finding exposes lower pre-existing findings"
---

## `wiki-health` Reports One Classification, So a Clean Baseline Can Hide Findings That Surface When You Fix Something Else

`wiki-health <domain> --verbose` emits a single classification per run. Clearing
the finding that produced it does not leave the domain cleaner — it exposes
whatever the classification was outranking.

Measured on `plan-expert` during unit 3 of the pipeline-redesign build:

| When | Output | Exit |
|---|---|---|
| Baseline, before any edit | `partial-migration` — SKILL.md is 473 lines (threshold: 400) | 0 |
| After reducing SKILL.md to 280 lines | `unhealthy` — three `tag prefix != plan-expert` findings | 5 |

The three tag-prefix violations were **pre-existing and untouched** — `planning/review`,
`plan/acceptance-criteria`, `planning/acceptance-criteria` on pages the edit never
opened. Nothing regressed. The line-count finding had simply been the one reported,
and removing it promoted the others from invisible to blocking.

The practical trap is the exit code. `partial-migration` exits 0, so a baseline
capture that records "exit 0, healthy enough" reads as a clean starting point — and
then an improvement to an unrelated part of the domain turns the same command into
exit 5, which looks like the improvement broke something. This is the mirror image
of the existing `plan-expert/wiki-health-baseline-gotcha.md`, which warns that
pre-existing failures make your post-change check fail: here a pre-existing failure
makes your *pre*-change check pass.

**What to do:** when a plan step's acceptance criterion is `wiki-health <domain>` at
exit 0, capture the baseline as the full `--verbose` body, not the exit code, and
expect to fix whatever the baseline classification was masking as part of that step.
Budget for it — the fix is usually mechanical (a tag prefix, a nav summary), but it
is not zero and it lands on files the step did not otherwise plan to touch.

**Discovered:** Unit 3 of the pipeline-redesign build, after reducing
`plan-expert/SKILL.md` from 473 to 280 lines cleared the `partial-migration`
classification.
**Impact:** Any build step whose acceptance criterion is a `wiki-health` exit code,
and any step that shrinks a wiki-backed `SKILL.md` past the 400-line threshold.
