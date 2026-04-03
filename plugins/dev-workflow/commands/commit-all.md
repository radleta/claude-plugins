---
description: Multi-repo commit — surveys all sub-repos via .subrepos, creates coordinated conventional commits
argument-hint: [session context]
---

Launch the **commit-worker** agent via the Agent tool, providing a summary of the session (files changed across repos, why, key decisions) as the prompt with instructions to follow the **Multi-Repo Workflow (commit-all)** section of the commit-methodology skill. Do not run any git commands yourself.

If the agent returns an error or needs user input, relay the message to the user. Once the user resolves the issue, resume the same agent via SendMessage with the user's response — do not launch a fresh agent.

Invoke `/local-memory sync`, then report the commit result as the structured commit-all summary (committed, skipped, failed repos).

Additional instructions (when provided) override the above:
$ARGUMENTS
