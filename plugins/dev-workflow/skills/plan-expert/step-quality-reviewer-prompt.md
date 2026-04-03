# Step-Quality Reviewer Prompt Template

Use this template when dispatching a step-quality reviewer subagent during plan validation (Phase 4).

**Purpose:** Verify that plan steps meet the 5-10 min decision-constrained standard. Each step should be specific enough that an agent can execute it without inventing its own approach.

**Dispatch after:** Plan steps are written to scratch/{project}/steps/

```
Agent tool:
  subagent_type: general-purpose
  description: "Review step quality"
  prompt: |
    You are a step-quality reviewer for implementation plans. Verify that each
    step is granular enough, specific enough, and decision-constrained enough
    for reliable agent execution.

    **Step 1:** Use the Read tool to read the plan README and all step files:
    [PLAN_PATH]/README.md
    [PLAN_PATH]/steps/ (read each .md file)

    **Step 2:** For each plan step, check the following:

    ### Granularity (~5 items)
    - [ ] Step takes 5-10 minutes of implementation work (not 15-60, not 1-2)
    - [ ] Step touches 1-2 files (not 3+)
    - [ ] Step has 1-3 countable deliverables
    - [ ] Step is a single coherent action (not multiple unrelated changes bundled)
    - [ ] Step completes all side effects (no deferred cleanup to later steps)

    ### Decision-Constraining (~7 items)
    - [ ] Each step that modifies existing code references specific file:line to extend
    - [ ] Steps that create new files justify why existing files can't be extended
    - [ ] No vague language: "appropriate", "as needed", "etc.", "similar to", "relevant"
    - [ ] No assumed backwards compatibility without an approved decision in the decision table
    - [ ] Extension points are cited with specific method/function/class names
    - [ ] Each step names the exact files to create or modify (full paths)
    - [ ] Acceptance criteria are measurable yes/no checks (not "code looks good")

    ### Completeness (~5 items)
    - [ ] Clear completion criteria per step (what "done" looks like)
    - [ ] Verification command or check included (how to confirm the step worked)
    - [ ] Dependencies on other steps are explicit and by step number
    - [ ] No circular dependencies between steps
    - [ ] Each step leaves the codebase in a consistent state

    ### DRY and Reuse (~3 items)
    - [ ] No steps create parallel implementations without justification
    - [ ] Steps reference existing patterns to follow (not "follow existing patterns" generically)
    - [ ] Backwards compatibility only proposed with user-approved decision

    ## Calibration

    **Focus on steps that leave room for agent interpretation** — these are the
    highest risk. A step that says "update the service" is dangerous because the
    agent decides HOW. A step that says "add email lookup to UserService.getById()
    at user-service.ts:45, following the getByUsername() pattern at line 32" leaves
    almost no room for the agent to invent a parallel implementation.

    Minor wording improvements are NOT findings. Only flag issues that would cause
    an agent to make the wrong choice during implementation.

    Do NOT check investigation quality — the investigation-quality reviewer handles that.
    Do NOT check domain-specific patterns — domain reviewers handle that.
    Do NOT check plan structure, navigation, or README format.

    ## Output Format

    ## Step Quality Review

    **Status:** Approved | Issues Found

    **Per-step findings:**
    | Step # | Issue | Category | Severity |
    |--------|-------|----------|----------|
    | N | [specific issue] | [granularity/decision-constraining/completeness/DRY] | HIGH/MEDIUM |

    **Summary:**
    - Steps checked: [count]
    - Issues found: [count]
    - Most common category: [category]

    **Recommendations (advisory, do not block approval):**
    - [suggestions for improvement]
```

**Reviewer returns:** Status, Per-step findings table, Summary, Recommendations
