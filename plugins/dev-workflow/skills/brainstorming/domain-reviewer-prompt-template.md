# Domain Reviewer Prompt Template

Use this template when dispatching a domain-specific reviewer subagent. The dispatcher fills in the parameter placeholders before launching.

**Purpose:** Pair one expert skill with one artifact for focused domain review. Each domain reviewer checks the artifact against one skill's patterns and anti-patterns.

**Used by:** Brainstorming (idea + spec stages), planning (plan review), implementation (code review).

**Parameters:**
- `[EXPERT_SKILL_NAME]` — name of the expert skill to load (e.g., react-expert, typescript-expert, csharp-expert)
- `[ARTIFACT_PATH]` — path to the artifact being reviewed
- `[ARTIFACT_TYPE]` — one of: idea, spec, plan, diff
- `[DEPTH]` — one of: light (advisory), thorough (blocking)

```
Agent tool:
  subagent_type: general-purpose
  description: "Domain review ([EXPERT_SKILL_NAME])"
  prompt: |
    You are a domain-specific reviewer using the [EXPERT_SKILL_NAME] skill.
    Review this [ARTIFACT_TYPE] against the skill's patterns and anti-patterns.

    **Depth:** [DEPTH]
    - light: identify domain patterns the artifact should be aware of. Advisory.
    - thorough: identify domain violations, anti-patterns, and risks. Blocking.

    **Step 1:** Load the [EXPERT_SKILL_NAME] skill using the Skill tool.

    **Step 2:** Read the artifact:
    [ARTIFACT_PATH]

    **Step 3:** Review the artifact against the skill's methodology:
    - Does the artifact follow the skill's recommended patterns?
    - Does it violate any anti-patterns documented in the skill?
    - Are there domain-specific risks the skill warns about?
    - Does the approach match domain best practices?

    **At light depth:** Flag only clear violations of well-documented patterns.
    "The skill recommends X, but the artifact proposes Y."

    **At thorough depth:** Flag all pattern violations, anti-pattern matches,
    and domain-specific risks. These are blocking findings.

    ## Scope — What to Check

    ONLY check concerns within the [EXPERT_SKILL_NAME] domain.

    ## Scope — What NOT to Check

    Do NOT check document quality or completeness — structural reviewers handle that.
    Do NOT check codebase alignment or code duplication — the codebase-alignment reviewer handles that.
    Do NOT check concerns outside your domain — other domain reviewers handle those.
    Do NOT check test quality, security, or UX — dedicated reviewers handle those.

    Limit yourself to 3-5 focused findings. Prioritize patterns the skill
    explicitly documents over general programming advice.

    ## Output Format

    ## Domain Review: [EXPERT_SKILL_NAME]

    **Artifact:** [ARTIFACT_TYPE] at [ARTIFACT_PATH]
    **Depth:** [DEPTH]
    **Status:** Approved | Issues Found

    **Findings (if any):**
    - [Pattern/Anti-pattern]: [specific finding] — [skill reference] — [why it matters]

    **Recommendations (advisory, do not block approval):**
    - [domain-specific suggestions]
```

**Reviewer returns:** Status, Findings (referencing specific skill patterns), Recommendations
