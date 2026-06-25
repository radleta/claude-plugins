---
tags: [planning/wiki-operations, plan-expert/operational-gotchas]
summary: "wiki-health pre-existing condition check: baseline state must be established before validating plan acceptance criteria"
---

## Wiki-Health Baseline Checks Must Precede Acceptance Validation

When a plan includes an Acceptance Criterion such as "run `wiki-health {skill} --full` and confirm exit code 0 (healthy)", you must first establish the baseline state of wiki-health BEFORE making the planned changes. Pre-existing partial-migration states or missing cross-references will cause post-implementation wiki-health checks to fail even if your changes are correct.

### The Gotcha

Running `wiki-health plan-expert --full` may return `partial-migration` (exit code 4) as a pre-existing condition, not due to your changes. If the plan says "post-commit wiki-health must return healthy," this pre-existing state will make that criterion fail silently:

```
plan-expert: partial-migration
  - 1 page pair(s) with missing cross-references (Step 5b deep scan)
```

### Mitigation

1. **Establish baseline BEFORE planning:** Run `wiki-health {skill} --full` at the start of the implementation session and document the exit code.
2. **Distinguish pre-existing from new issues:** If baseline is `healthy` (exit 0) and post-change becomes `partial-migration`, your changes introduced the issue. If baseline is already `partial-migration`, you must *remedia­te* the pre-existing condition as part of the plan step that modifies the wiki.
3. **Enumerate missing pairs explicitly:** Run `wiki-health {skill} --full --verbose` (or `--json`) to identify specific page pairs flagged by Step 5b cross-link validation.
4. **Add cross-reference link in the same commit:** If you find pre-existing missing pairs, add a `## See Also` link in the appropriate page(s) to establish the connection. This is part of the step implementation, not a deferred cleanup task.

### When This Matters

- Plans that include wiki-health validation as an Acceptance Criterion
- Changes to wiki-backed skills (new pages, renames, restructuring)
- Migration scenarios where structural lint must pass post-migration
