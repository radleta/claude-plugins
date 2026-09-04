# Spec Document Reviewer Dispatch Prompt

Dispatched via the `idea-doc-reviewer` agent — same thin agent serves both idea and spec document-quality checks, with `phase` distinguishing them. Read-only; persists its verdict through `mcp__scratch-memory__write_review`.

**Parameters:**
- `{PROJECT_NAME}` — scratch subdir slug
- `{ITER}` — 1-based iteration number within the spec review loop
- `{SPEC_PATH}` — absolute path to `scratch/{project}/spec.md`

```
Agent({
  subagent_type: "idea-doc-reviewer",
  description: "Spec doc review iter-{ITER}",
  prompt: |
    Agent's system prompt holds the contract — do not duplicate it here.

    ## Inputs
    - phase: spec
    - artifact_path: {SPEC_PATH}
    - project: {PROJECT_NAME}
    - iteration: {ITER}

    ## Your Prior Verdicts (iteration 2+ only — read these first)
    {one bullet per path in PRIOR_DOC_PATHS, in iteration order}
    (Omit this block entirely on iter 1 — no prior verdicts exist.)
})
```

**Reviewer returns (to main session):** two lines — `Wrote:` and `Status:`.
