# Domain Reviewer Dispatch Prompt

Dispatched via the `domain-reviewer` agent — one dispatch per affinity group. Read-only; persists its verdict through `mcp__scratch-memory__write_review`.

**Parameters:**
- `{PROJECT_NAME}` — scratch subdir slug
- `{PHASE}` — `idea` | `spec`
- `{ITER}` — 1-based iteration number within the review loop
- `{ARTIFACT_PATH}` — absolute path to the idea or spec doc
- `{DEPTH}` — `light` (idea, advisory) | `thorough` (spec, blocking)
- `{GROUP_NAME}` — affinity group name (e.g., `frontend`, `backend-net`) or solo expert skill name
- `{SKILL_NAMES}` — ordered `/<skill-name>` directives (e.g., `/react-expert, /typescript-expert`)
- `{SKILL_ARRAY}` — same names without `/`, as JSON array; first entry becomes the verdict filename suffix

```
Agent({
  subagent_type: "domain-reviewer",
  description: "Domain {GROUP_NAME} {PHASE} iter-{ITER}",
  prompt: |
    Agent's system prompt holds the contract — do not duplicate it here.

    ## Inputs
    - phase: {PHASE}
    - artifact_path: {ARTIFACT_PATH}
    - project: {PROJECT_NAME}
    - depth: {DEPTH}
    - iteration: {ITER}
    - group: {GROUP_NAME}
    - skills (ordered): {SKILL_NAMES}

    ## Your Prior Verdicts (iteration 2+ only — read these first)
    {one bullet per path in PRIOR_DOMAIN_{GROUP}_PATHS, in iteration order}
    (Omit this block entirely on iter 1 — no prior verdicts exist.)

    ## Step 1: Load expert skills via {SKILL_NAMES}
    Load each of the following via the Skill tool, in order:
    {SKILL_NAMES}
})
```

**Reviewer returns (to main session):** two lines — `Wrote:` and `Status:`.

**Parallel dispatch.** Each affinity group gets its own `domain-reviewer` dispatch in the same
parallel Agent-tool wave. The `skills` array's first entry disambiguates verdict filenames
so multiple parallel domain reviewers don't collide.
