# Creative Alternatives Reviewer Dispatch Prompt

Dispatched via the `creative-reviewer` agent after the idea validators all return APPROVED. Advisory — never blocking. Runs once.

**Parameters:**
- `{PROJECT_NAME}` — scratch subdir slug
- `{ITER}` — 1-based iteration number within the idea review loop (use the iteration that achieved validator APPROVED)
- `{IDEA_PATH}` — absolute path to `scratch/{project}/idea.md`
- `{SKILL_NAMES}` — comma-separated list of covered expert skills from idea.md Skill Coverage section (empty if none / all waived)

```
Agent({
  subagent_type: "creative-reviewer",
  description: "Creative alternatives iter-{ITER}",
  prompt: |
    Agent's system prompt holds the contract — do not duplicate it here.

    ## Inputs
    - phase: idea
    - artifact_path: {IDEA_PATH}
    - project: {PROJECT_NAME}
    - iteration: {ITER}
    - covered_skills: {SKILL_NAMES}   (may be empty)

    ## Step 1: Load expert skills via {SKILL_NAMES}
    Load each skill in {SKILL_NAMES} via the Skill tool. Skip if empty.
})
```

**Reviewer returns (to main session):** two lines — `Wrote:` and `Status:`.
