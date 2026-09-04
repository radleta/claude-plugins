---
source: implementation/step-09
type: gotcha
scope: project
target-domain: wiki-memory
status: captured
tags: [wiki-memory/testing]
summary: "Unguarded grep captures turn test regressions into silent suite aborts"
---

## An Unguarded `$(grep ...)` Capture Turns a Test Regression Into a Silent Suite Abort

`test-wiki-write.sh` runs under `set -euo pipefail`. An assertion that snapshots
file content with a bare command substitution —

```bash
_ghost_after="$(grep -F '](ghost-page.md)' "$SKILL_MD")"
```

— is fine while the line exists, and **fatal the moment it does not**. `grep`
exits 1 on no-match, `set -e` kills the script at the assignment, and the run
ends with no `FAIL:` line, no `Results:` block, and no indication which
assertion died. The regression is detected only as a bare non-zero exit.

That failure mode defeats the acceptance criteria this plan's step files are
written against, which count failures with
`grep -cE '^[[:space:]]*FAIL:'` → `0`. An aborted run prints **zero** `FAIL:`
lines, so a criterion checking only that count passes on a suite that never
finished. Pair every such count with the `Results:` line or the suite's exit
code — one without the other is not a green signal.

Caught by mutation-testing rather than by reading: deleting nav bullets inside
the regenerator produced `exit=1` with an empty failure list, which looked at
first like the new assertions had no teeth.

Fix, matching the convention Group 10 already uses for `grep -c`: append
`|| true` to every capture whose match is the thing under test, and add a
non-vacuity guard (`-n "$_before"`) so a fixture typo cannot make a
before/after comparison pass with both sides empty.

```bash
_ghost_before="$(grep -F '](ghost-page.md)' "$SKILL_MD" || true)"
assert_eq "yes" "$([[ -n "$_ghost_before" && "$_ghost_before" == "$_ghost_after" ]] && echo yes || echo no)" "..."
```

`grep -oE ... | sort | tr` needs the same guard: under `pipefail` the failing
`grep` fails the whole pipeline.

**Discovered:** Mutation-testing Group 11's twelve new assertions in step 09.
**Impact:** Every byte-identity / verbatim-preservation assertion in these
suites, and every acceptance criterion that counts `FAIL:` lines without also
checking the `Results:` line or exit code.
