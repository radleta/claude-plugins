# Decision-Traceability Reviewer Dispatch Prompt

Dispatched via the `decision-traceability-reviewer` agent at spec-review time. Read-only; persists its verdict through `mcp__scratch-memory__write_review`.

**Parameters:**
- `{PROJECT_NAME}` — scratch subdir slug
- `{ITER}` — 1-based iteration number within the spec review loop
- `{IDEA_PATH}` — absolute path to `scratch/{project}/idea.md`
- `{SPEC_PATH}` — absolute path to `scratch/{project}/spec.md`

```
Agent({
  subagent_type: "decision-traceability-reviewer",
  description: "Decision traceability iter-{ITER}",
  prompt: |
    Agent's system prompt holds the contract — do not duplicate it here.

    ## Inputs
    - phase: spec
    - idea_path: {IDEA_PATH}
    - spec_path: {SPEC_PATH}
    - project: {PROJECT_NAME}
    - iteration: {ITER}

    ## Your Prior Verdicts (iteration 2+ only — read these first)
    {one bullet per path in PRIOR_DECISION_PATHS, in iteration order}
    (Omit this block entirely on iter 1 — no prior verdicts exist.)
})
```

**Reviewer returns (to main session):** two lines — `Wrote:` and `Status:`.
