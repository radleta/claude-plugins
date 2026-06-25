---
tags: [bash/globals]
summary: "Command substitution forks a subshell — function global assignments don't propagate to parent"
---

## Bash Command Substitution Forks a Subshell — Global Variable Assignments Do Not Propagate

When a function assigns global variables AND is called via `result="$(func)"` (command substitution), the assignments happen in a child process. The parent shell sees the original (pre-call) values of those globals after the substitution returns. Only stdout is captured; side-effects on globals are silently lost.

### Real-world defect (wiki-health.sh)

`_freshness_one_page` set `FRESH_WIKI_MTIME` and `FRESH_NEWEST_CITED_COMMIT` as globals, but `_run_freshness` called it via `result="$(_freshness_one_page "$p")"` in the JSON path. The parent's globals stayed at their initialization values (0 and "null") for every page with code-cites. The defect was masked because the test page had no code-cites, for which 0/null are the correct values.

### Correct pattern for bash global-return functions

```bash
# WRONG — globals set inside func are lost
result="$(func arg)"

# CORRECT — call directly; globals propagate to parent
func arg > /dev/null   # discard stdout if only need globals
# OR
func arg               # let stdout flow through (plain text path)
# OR
func arg > "$tmpfile"  # capture stdout without subshell (use process substitution or temp file)
```

### Impact on testing

Test coverage for global-return functions must use pages/inputs where the correct global value is non-zero/non-null to avoid silent masking. A test that only exercises the `0`/`null` codepath will pass even if the global assignment is broken.

