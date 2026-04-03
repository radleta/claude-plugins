---
description: Create conventional commit with security checks, smart staging triage, and proper formatting
argument-hint: [additional context]
---

Launch the **commit-worker** agent via the Agent tool, providing a summary of the session (files changed, why, key decisions) as the prompt. Do not run any git commands yourself.

If the agent returns an error or needs user input, relay the message to the user. Once the user resolves the issue, resume the same agent via SendMessage with the user's response — do not launch a fresh agent.

Invoke `/local-memory sync`, then report the commit result as a short summary (commit hash + message).

Additional instructions (when provided) override the above:
$ARGUMENTS
