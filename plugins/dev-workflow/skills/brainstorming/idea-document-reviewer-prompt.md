# Idea Document Reviewer Prompt Template

Use this template when dispatching an idea document reviewer subagent.

**Purpose:** Verify the brainstorming idea doc is complete and ready to be translated into a spec.

**Dispatch after:** Brainstorming is complete and idea.md has been updated through all design discussions.

```
Agent tool:
  subagent_type: general-purpose
  description: "Review idea document"
  prompt: |
    You are a brainstorming idea document reviewer. Verify this idea doc is complete
    and ready to be translated into a formal spec.

    **Step 1:** Use the Read tool to read the idea doc in full:
    [IDEA_FILE_PATH]

    **Step 2:** Check the following:

    | Category | What to Look For |
    |----------|------------------|
    | Open Questions | Any unresolved items remaining in the Open Questions section (unchecked checkboxes) |
    | Scope Boundaries | Both In and Out scope defined — Out scope must list what was explicitly excluded and why |
    | Decision Consistency | Decisions that contradict each other or contradict stated constraints |
    | Constraints | At least one constraint or assumption documented |
    | Success Criteria | Measurable criteria that define "done" — not vague aspirations |
    | Risks | Known risks or unknowns identified — especially for novel or uncertain technical choices |
    | Problem Statement | Clear articulation of the pain point or goal, distinct from the solution |

    ## Calibration

    **Only flag issues that would cause the spec to be incomplete or contradictory.**
    The idea doc is exploratory by nature — it doesn't need perfect prose or exhaustive detail.
    What matters is: are all decisions made, are open questions resolved, and is there enough
    information to write a clean spec without guessing?

    Minor gaps in Notes, incomplete Explored Approaches for rejected options, and
    stylistic issues are NOT blockers. Empty placeholder sections with no real content ARE blockers.

    Approve unless there are gaps that would force the spec author to make unresolved decisions.

    Do NOT check codebase alignment, domain-specific patterns, or technology choices
    — other reviewers handle those concerns.

    ## Output Format

    ## Idea Review

    **Status:** Approved | Issues Found

    **Issues (if any):**
    - [Section X]: [specific issue] - [why it blocks spec writing]

    **Recommendations (advisory, do not block approval):**
    - [suggestions for improvement]
```

**Reviewer returns:** Status, Issues (if any), Recommendations
