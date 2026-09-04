---
tags: [wiki-memory/testing]
summary: "A reason token appears in wiki-health.sh --json only; --verbose assertions are vacuous"
---

## A `wiki-health.sh` Reason Token Appears in `--json` Only — Asserting It Against `--verbose` Is Always Vacuous

`_classify_skill()` stores every reason as a `CODE:detail` compound, but the two output modes
split that compound differently:

| Mode | What it emits | Example |
|---|---|---|
| `--verbose` | detail **only** — the `CODE:` prefix is stripped | `  - ## Pages bullet run at SKILL.md:8-8 is not wrapped in ...` |
| `--json` | an **object** per reason, at `.reasons[]` | `{"code":"MISSING_PAGES_FENCE","detail":"## Pages bullet run at ..."}` |

Two consequences that bite test authors, both observed while writing Group 22:

1. **`assert_contains "MISSING_PAGES_FENCE" "$verbose_output"` can never pass**, and its mirror
   `assert_not_contains "MISSING_PAGES_FENCE" "$verbose_output"` can never *fail*. A must-NOT-trip
   fixture guarded that way is permanently green and proves nothing — it stays green even when the
   check fires hard enough to flip the domain `unhealthy`. This is precisely the "an exit code can
   be right for the wrong reason" hazard, one level subtler: the assertion itself is the wrong
   instrument. Match the reason **wording** in `--verbose` (`is not wrapped in`), and the **token**
   in `--json` at `.reasons[].code`.

2. **`jq '.reasons | map(startswith("X")) | any'` errors**, it does not return false:
   `jq: error: startswith() requires string inputs`. `.reasons` holds objects, not strings. The
   working forms are `jq -e '[.reasons[].code] | any(. == "X")'` or
   `jq -e '.reasons | map(.code == "X") | any'`.

Under `set -euo pipefail` the erroring form is doubly dangerous: piped into an unguarded
capture it aborts the suite rather than failing one assertion, reproducing the step-09
silent-abort failure mode.

The `pages.*` sibling keys (`unfenced_runs`, `unbalanced_fences`, `forbidden_updated_field`) are
plain string arrays and are unaffected — the object shape is specific to `.reasons`. That
asymmetry is what makes the mistake easy: adjacent keys in the same JSON document take opposite
jq idioms.

**Discovered:** Step 11, writing Group 22's `--verbose` / `--json` assertion pairs. Three of that
step's acceptance criteria encoded the wrong shape (criteria 4, 12, 14, 15), which is what
surfaced it.
**Impact:** Every `test-wiki-health.sh` assertion that names a reason token, and every plan step
that writes such a criterion. Verify which mode carries the token before choosing the needle.
