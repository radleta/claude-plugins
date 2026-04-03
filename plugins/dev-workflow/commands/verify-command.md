---
description: Command verification - validates command/skill files against claude-command-builder quality standards
argument-hint: [command name or path — e.g., "verify-ux" or ".claude/commands/my-command.md"]
---

Launch the **command-verifier** agent via the Agent tool. Provide a concise paragraph as the prompt covering:

- Which command file(s) to verify (from $ARGUMENTS or recently changed command files in session)
- Full path if a specific command was given
- What was changed in the command and why

The agent runs in an isolated context with no conversation history — your summary is all it knows.

**Example prompt to the agent:**

> Verify the commit command at .claude/commands/commit.md. Rewrote as thin launcher — delegates to commit-worker agent with session summary, added error relay + resume via SendMessage, moved $ARGUMENTS to end with override semantics.

Do not run verification yourself — the agent has its methodology skill loaded.

If the agent returns an error or needs user input, relay the message to the user. After resolution, resume the same agent via SendMessage — preserves the agent's analysis context and avoids re-reading all files.

Additional instructions (when provided) override the above:
$ARGUMENTS
