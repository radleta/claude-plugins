---
tags: [wiki-memory/operations]
summary: "A state-gating check in wiki-health.sh invalidates test fixtures that predate the invariant, requiring intent-aware fixture migration rather than blanket transforms"
---

## A State-Gating Check in `wiki-health.sh` Invalidates Every Test Fixture That Predates the Invariant

`test-wiki-health.sh` builds ~48 throwaway skill domains inline via heredocs. Almost all of them
were written before marker fences existed, so their `## Pages` sections carry bare bullet runs
with no `<!-- BEGIN:PAGES -->` / `<!-- END:PAGES -->` wrapper. Measured at step 10:

```
grep -c '^## Pages'   test-wiki-health.sh  ->  48
grep -c 'BEGIN:PAGES' test-wiki-health.sh  ->   3   # Group 21 only, added in step 03
```

The moment a new check writes into `unhealthy_reasons` for a condition those fixtures violate,
every fixture asserted `healthy` / `exit 0` flips to `unhealthy` / `exit 5`. Wiring
`MISSING_PAGES_FENCE` as state-gating (D6) took the suite from **231 passed / 0 failed** to
**210 passed / 21 failed** without touching a single assertion. Re-fencing the fixture heredocs
and changing nothing else took it back to **231 passed / 0 failed** — but only once the
re-fencing was scoped by intent rather than applied blanket. A blanket transform lands at 227/4;
the residual 4 are fixtures that are *deliberately* unfenced because they are the fence
detector's own inputs.

Two consequences worth carrying forward:

1. **A migration that sweeps `.claude/skills/*/SKILL.md` does not reach test fixtures.** Step 06
   made all 49 real domains compliant and the fleet sweep confirmed it (`--all` exit 6, zero
   `unhealthy`, three ledgered deltas). That result says nothing about the fixtures, because they
   are constructed at runtime under `$TMPDIR_ROOT` and no on-disk sweep can see them. "The fleet
   is compliant" and "the suite is green" are independent facts.

2. **Fixture re-fencing is not blanket-applicable.** Group 21's fence-scan fixtures
   (`fence-flat`, `fence-trailing-rule`) are unfenced *on purpose* — they assert the detector
   emits `fenced=0` and the run's end line. Fencing them silently inverts what they test. Any
   fixture migration has to be per-fixture and intent-aware, which makes it review-worthy work
   rather than a mechanical sweep.

   The rule that made the migration land at 231/0 with zero residuals, stated mechanically: a
   fixture needs fencing **iff** its heredoc target is a `SKILL.md` **and** the fixture is
   reached by `_classify_skill()`. Two exclusions follow from the first half — the suite's
   `## Pages` sections also appear in `group/index.md` nav-hub heredocs and in `*.sh` code
   fixtures, and `_classify_skill()` reads only `SKILL.md`, so both are out of scope. One
   exclusion follows from the second half — all five Group 21 domains are exercised solely
   through the `fence-scan` subcommand, which never classifies, and their assertions pin
   literal fixture line numbers (8, 13, 17, 9) that fencing would shift. Fixtures whose
   `## Pages` section holds no bullets at all need no fencing either: there is no run to wrap.
   Applying exactly that rule fenced 35 heredocs / 37 runs (+74 lines, zero deletions, zero
   assertion edits).

The general shape: in this repo, adding a state-gating check to `wiki-health.sh` costs the four
documented edit sites **plus** a fixture-migration pass over `test-wiki-health.sh`. A plan that
budgets only the four sites and asserts "existing suite totals must not move" has an
unsatisfiable pair of requirements whenever the new invariant is one the old fixtures violate.

**Discovered:** Step 10, wiring `MISSING_PAGES_FENCE` and `UNBALANCED_PAGES_FENCE` into
`_classify_skill()`. Iteration 1 passed every in-scope acceptance criterion but could not pass
the suite criterion, because the required fix lives in a file the step originally forbade
modifying; the step was then amended to authorize the fixture migration, and iteration 2 landed
it at 231/0.
**Impact:** Every future `unhealthy_reasons` addition to `wiki-health.sh`, and any plan step that
pairs "add a gating check" with "do not move existing test totals".
