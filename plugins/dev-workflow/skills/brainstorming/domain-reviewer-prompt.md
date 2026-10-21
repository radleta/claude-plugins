# Domain Reviewer Dispatch Prompt

Dispatched via the `domain-reviewer` agent — **one dispatch per pass of `SKILL.md`
review loop ([review-loop.md](review-loop.md)) that includes this reviewer**, carrying the design review and every expert skill the design needs. Read-only; persists its verdict through `mcp__scratch-memory__write_review`.

**Parameters:**
- `{PROJECT_NAME}` — scratch subdir slug
- `{PHASE}` — `idea`
- `{ITER}` — the project's running count of review runs, as `review-loop.md` defines it: the highest `iteration` in `scratch/{project}/reviews/idea/` plus one, shared by every reviewer in the run, so every verdict gets a distinct filename
- `{ARTIFACT_PATH}` — absolute path to the artifact under review
- `{DEPTH}` — `light`; an expert-skill finding that touches no Decision lands under `**Non-blocking findings:**`, routed by `review-loop.md` § Routing findings. Design-review findings always block; main routes them on `Owner`
- `{GROUP_NAME}` — a label for this dispatch (e.g., `all-domains`); it appears in the verdict description only
- `{SKILL_NAMES}` — ordered `/<skill-name>` directives, always `/design-review-methodology` first, then any expert skill the design needs that the dispatching session has not loaded (e.g., `/design-review-methodology, /react-expert`)
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

    ## Your Prior Verdicts (re-check pass only — omit on a review point's first pass)
    {this reviewer's verdict paths from the current review point, one per line}

    ## Step 1: Load expert skills via {SKILL_NAMES}
    Load each of the following via the Skill tool, in order:
    {SKILL_NAMES}
})
```

**Reviewer returns (to main session):** two lines — `Wrote:` and `Status:`.

**One dispatch, serial skills.** Do not fan out one dispatch per affinity group. The
`domain-review-methodology` skill already runs a sequential pass per skill inside a single
dispatch, so one agent covers every domain and returns one verdict — which is also what keeps
the verdict filename unambiguous, since `skills[0]` supplies its suffix.

**Dispatch on every first pass.** The design review makes this reviewer unconditional there;
a re-check pass dispatches it only when its verdict drove a fix. Expert skills
are what vary: add one only when the design needs it and the dispatching session has not loaded
it, since a skill already loaded has its knowledge in the artifact and a reviewer that reloads
it reads your own knowledge back to you.
