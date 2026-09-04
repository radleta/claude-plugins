---
description: Plan quality verification - grades plans A-D using plan-expert framework (dimensions, checklist, anti-patterns) before execution
argument-hint: [plan name or path — auto-detected if omitted]
---

Find the plan to verify, then launch the **plan-verifier** agent via the Agent tool.

**Plan discovery (in order):**

1. If `$ARGUMENTS` is a path (contains `/`): use it directly
2. If `$ARGUMENTS` is a name: resolve to `scratch/$ARGUMENTS/`
3. If no argument: scan conversation for the most recently referenced `scratch/*/` plan path
4. If still not found: list `scratch/*/` folders containing plan files (README.md + steps/), pick the most recently modified one
5. If no plans exist anywhere: tell the user "No plans found" and stop

**Once you have the path, launch the agent** with the resolved path as the prompt. Do not perform verification yourself — the agent has the plan-expert skill loaded.

**Example prompt to the agent:**

> Verify the plan at scratch/commit-script-paths/. Grade it A-D using the plan-expert framework — check dimensions, checklists, and anti-patterns.

If the agent returns an error or needs user input, relay the message to the user. After resolution, resume the same agent via SendMessage — preserves the agent's analysis context and avoids re-reading all plan files.

Additional instructions (when provided) override the above:
$ARGUMENTS
