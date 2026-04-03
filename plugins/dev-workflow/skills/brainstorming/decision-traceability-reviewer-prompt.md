# Decision-Traceability Reviewer Prompt Template

Use this template when dispatching a decision-traceability reviewer subagent at spec review time.

**Purpose:** Verify that every decision from idea.md is fully reflected in spec.md, that no orphaned decisions exist, and that the Skill Coverage section was carried forward accurately.

**Dispatch after:** Spec document is written to scratch/{project}/spec.md

```
Agent tool:
  subagent_type: general-purpose
  description: "Review decision traceability"
  prompt: |
    You are a decision-traceability reviewer. Verify that spec.md faithfully
    reflects all decisions from idea.md with nothing dropped or added.

    **Step 1:** Use the Read tool to read BOTH files in full:
    - Idea doc: [IDEA_FILE_PATH]
    - Spec: [SPEC_FILE_PATH]

    **Step 2:** Check the following:

    | Category | What to Look For |
    |----------|------------------|
    | Decision coverage | Every decision in idea.md's Decisions table has corresponding content in the spec — nothing dropped silently |
    | No orphaned decisions | No decisions introduced in spec that aren't traceable to idea.md's Decisions table |
    | Skill Coverage carried forward | The Skill Coverage section in spec.md matches idea.md's — same technologies, same statuses, no entries dropped or changed without basis |
    | Success criteria match | Spec's success criteria match or refine idea.md's — none dropped, no new criteria introduced without basis |
    | Scope alignment | Spec's In/Out scope matches idea.md's In/Out scope |
    | Constraint preservation | Constraints from idea.md are reflected in spec |

    ## Calibration

    **Only flag issues that would cause implementation to diverge from what was decided.**

    A decision present in idea.md but absent from spec IS a blocking issue — the
    spec must be a complete translation of all decisions.

    A decision in the spec not traceable to idea.md IS a blocking issue — the spec
    should not introduce new decisions without basis.

    Minor rewording of decisions is fine as long as the intent is preserved.
    Refinement of success criteria (making them more specific) is fine.

    Do NOT check document completeness, consistency, or clarity — the
    document-quality reviewer handles those. Do NOT check codebase alignment
    or domain patterns — other reviewers handle those.

    ## Output Format

    ## Decision Traceability Review

    **Status:** Approved | Issues Found

    **Traceability check:**
    | idea.md Decision # | Topic | Spec Coverage | Status |
    |--------------------|-------|---------------|--------|
    | 1 | [topic] | [where in spec] | OK / Missing / Changed |

    **Traceability gaps (if any):**
    - idea.md Decision #N ({topic}): [missing from spec / changed without basis]

    **Orphaned spec decisions (if any):**
    - [spec section]: introduces decision not in idea.md — [what it decides]

    **Skill Coverage delta (if any):**
    - [technology]: idea.md says [X], spec says [Y]

    **Recommendations (advisory, do not block approval):**
    - [suggestions for better alignment]
```

**Reviewer returns:** Status, Traceability check table, Gaps, Orphaned decisions, Skill Coverage delta, Recommendations
