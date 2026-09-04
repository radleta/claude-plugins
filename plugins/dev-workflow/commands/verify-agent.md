---
description: Agent verification - validates agent files against claude-agent-builder quality standards
argument-hint: [agent name or path — e.g., "ux-verifier" or ".claude/agents/my-agent.md"]
---

Launch the **agent-verifier** agent via the Agent tool. Provide a concise paragraph as the prompt covering:

- Which agent file(s) to verify (from $ARGUMENTS or recently changed agent files in session)
- Full path if a specific agent was given
- What was changed in the agent and why

The agent runs in an isolated context with no conversation history — your summary is all it knows.

**Example prompt to the agent:**

> Verify the commit-worker agent at .claude/agents/commit-worker.md. Changed the auto-staging constraint from "never auto-stage" to "auto-stage by default" and added fail-fast error handling for security flags.

Do not run verification yourself — the agent has its methodology skill loaded.

If the agent returns an error or needs user input, relay the message to the user. After resolution, resume the same agent via SendMessage — preserves the agent's analysis context and avoids re-reading all files.

Additional instructions (when provided) override the above:
$ARGUMENTS
