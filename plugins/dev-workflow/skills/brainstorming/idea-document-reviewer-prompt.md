# Idea Document Reviewer Dispatch Prompt

Dispatched via the `idea-doc-reviewer` agent. Read-only; persists its
verdict through `mcp__scratch-memory__write_review`.

**Parameters:**
- `{PROJECT_NAME}` — scratch subdir slug
- `{ITER}` — 1-based iteration number within the idea review loop
- `{IDEA_PATH}` — absolute path to `scratch/{project}/idea.md`

```
Agent({
  subagent_type: "idea-doc-reviewer",
  description: "Idea doc review iter-{ITER}",
  prompt: |
    Agent's system prompt holds the contract — do not duplicate it here.

    ## Inputs
    - phase: idea
    - artifact_path: {IDEA_PATH}
    - project: {PROJECT_NAME}
    - iteration: {ITER}

    ## Your Prior Verdicts (iteration 2+ only — read these first)
    {one bullet per path in PRIOR_DOC_PATHS, in iteration order}
    (Omit this block entirely on iter 1 — no prior verdicts exist.)
})
```

**Reviewer returns (to main session):** two lines — `Wrote:` and `Status:`.
