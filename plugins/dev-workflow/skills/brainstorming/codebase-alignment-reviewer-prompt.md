# Codebase-Alignment Reviewer Dispatch Prompt

Dispatched via the `codebase-alignment-reviewer` agent. Read-only; persists its verdict through `mcp__scratch-memory__write_review`.

**Parameters:**
- `{PROJECT_NAME}` — scratch subdir slug
- `{PHASE}` — `idea` | `spec`
- `{ITER}` — 1-based iteration number within the review loop
- `{ARTIFACT_PATH}` — absolute path to the idea or spec doc
- `{DEPTH}` — `light` (idea, advisory) | `thorough` (spec, blocking)

```
Agent({
  subagent_type: "codebase-alignment-reviewer",
  description: "Codebase alignment {PHASE} iter-{ITER}",
  prompt: |
    Agent's system prompt holds the contract — do not duplicate it here.

    ## Inputs
    - phase: {PHASE}
    - artifact_path: {ARTIFACT_PATH}
    - project: {PROJECT_NAME}
    - depth: {DEPTH}
    - iteration: {ITER}

    ## Your Prior Verdicts (iteration 2+ only — read these first)
    {one bullet per path in PRIOR_CODEBASE_PATHS, in iteration order}
    (Omit this block entirely on iter 1 — no prior verdicts exist.)
})
```

**Reviewer returns (to main session):** two lines — `Wrote:` and `Status:`.
