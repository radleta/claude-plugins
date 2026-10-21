# Codebase-Alignment Reviewer Dispatch Prompt

Dispatched via the `codebase-alignment-reviewer` agent. Read-only; persists its verdict through `mcp__scratch-memory__write_review`.

**Parameters:**
- `{PROJECT_NAME}` — scratch subdir slug
- `{PHASE}` — `idea`
- `{ITER}` — the project's running count of review runs, as `review-loop.md` defines it: the highest `iteration` in `scratch/{project}/reviews/idea/` plus one, shared by every reviewer in the run, so every verdict gets a distinct filename
- `{ARTIFACT_PATH}` — absolute path to `idea.md`
- `{DEPTH}` — `thorough`

`idea.md` is the binding artifact the build derives from directly, so an alignment
conflict left advisory here reaches the coder unchallenged: findings land in
`## Issues` and block approval. A finding the reviewer emits under
`## Non-blocking findings` is routed by main as `review-loop.md` § Routing findings says.

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

    ## Your Prior Verdicts (re-check pass only — omit on a review point's first pass)
    {this reviewer's verdict paths from the current review point, one per line}
})
```

**Reviewer returns (to main session):** two lines — `Wrote:` and `Status:`.
