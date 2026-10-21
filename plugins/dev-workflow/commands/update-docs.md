---
description: Update documentation impacted by code changes — dispatches doc-updater, which checks all docs for accuracy with no pre-filtering by change size
disable-model-invocation: true
argument-hint: "[list of changed files and summary of changes]"
---

Launch the **doc-updater** agent via the Agent tool. Provide a concise paragraph as the prompt summarizing:

- What files were changed and what the changes do
- The scope of changes (project `.claude/` vs user `~/.claude/`, or both)
- Any new APIs, conventions, or config shapes introduced

The agent runs in an isolated context with no conversation history — your summary is all it knows. It reads CLAUDE.md and every doc in the matching scope itself, checks each for accuracy, and updates only what is now wrong. It never edits a wiki page: with no `learned/` directory in the prompt, it names each stale wiki claim in its report's `Drift captures written` section instead, so relay that section to the user.

Do not update documentation yourself — the agent has its methodology skill loaded.

If the agent returns an error or needs user input, relay the message to the user. After resolution, resume the same agent via SendMessage — preserves the agent's analysis context and avoids re-reading all files.

Additional instructions (when provided) override the above:
$ARGUMENTS
