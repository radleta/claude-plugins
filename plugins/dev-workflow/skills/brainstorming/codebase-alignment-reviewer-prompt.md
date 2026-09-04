# Codebase-Alignment Reviewer Dispatch Prompt

Dispatched via the `codebase-alignment-reviewer` agent. Read-only; persists its verdict through `mcp__scratch-memory__write_review`.

**Parameters:**
- `{PROJECT_NAME}` — scratch subdir slug
- `{PHASE}` — `idea`
- `{ITER}` — `1`; there is one pass
- `{ARTIFACT_PATH}` — absolute path to `idea.md`
- `{DEPTH}` — `thorough`

`idea.md` is the binding artifact the build derives from directly, so an alignment
conflict left advisory here reaches the coder unchallenged: findings land in
`## Issues` and block approval. A non-blocking note the reviewer emits under
`## Implementation Notes` is moved by main into `idea.md`'s own
`## Implementation Notes`.

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

    ## Your Prior Verdicts (omit — there is one pass and no prior verdict)
})
```

**Reviewer returns (to main session):** two lines — `Wrote:` and `Status:`.
