# Domain Reviewer Dispatch Prompt

Dispatched via the `domain-reviewer` agent — **one dispatch total**, carrying every
relevant expert skill. Read-only; persists its verdict through `mcp__scratch-memory__write_review`.

**Parameters:**
- `{PROJECT_NAME}` — scratch subdir slug
- `{PHASE}` — `idea`
- `{ITER}` — `1`; there is one pass
- `{ARTIFACT_PATH}` — absolute path to the artifact under review
- `{DEPTH}` — `light`; its notes are advisory and main moves the ones that matter into `idea.md`'s `## Implementation Notes`
- `{GROUP_NAME}` — a label for this dispatch (e.g., `all-domains`); it appears in the verdict description only
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

    ## Your Prior Verdicts (omit — there is one pass and no prior verdict)

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

**When to dispatch at all.** Skip this reviewer entirely when the expert skills relevant to the
design are already loaded in the dispatching session: their knowledge is already in the artifact,
and a reviewer that reloads them reads your own knowledge back to you at the cost of a dispatch.
Dispatch when the design introduces technology those loaded skills do not cover.
