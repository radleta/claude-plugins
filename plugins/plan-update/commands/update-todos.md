---
description: Update plan progress — dispatches plan-updater to mark completed checkboxes and progress-table rows in scratch/ plan files (the "todos" here are plan steps, not a freeform TODO.md)
argument-hint: "[plan-path] [summary of completed work]"
---

Launch the **plan-updater** agent via the Agent tool. Provide a concise paragraph as the prompt summarizing:

- The plan path (e.g., `scratch/my-feature/`) — or note that none was given so the agent can scan `scratch/` for the most recently modified plan
- What work was completed, so the agent can match it against the plan's steps and checkboxes

The agent runs in an isolated context with no conversation history — your summary is all it knows. It reads the plan's README.md and step files itself, cross-references completed work, and edits only the plan's checkboxes and progress table.

Do not update plan files yourself — the agent has its methodology skill loaded.

If the agent returns an error or needs user input, relay the message to the user. After resolution, resume the same agent via SendMessage — preserves the agent's analysis context and avoids re-reading all files.

Additional instructions (when provided) override the above:
$ARGUMENTS
