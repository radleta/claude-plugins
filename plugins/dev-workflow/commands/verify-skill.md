---
description: Skill verification - validates SKILL.md files against claude-skill-builder quality standards
argument-hint: [skill name or path — e.g., "ux-verification" or ".claude/skills/my-skill/SKILL.md"]
---

Launch the **skill-verifier** agent via the Agent tool. Provide a concise paragraph as the prompt covering:

- Which skill file(s) to verify (from $ARGUMENTS or recently changed skill files in session)
- Full path if a specific skill was given
- What was changed in the skill and why

The agent runs in an isolated context with no conversation history — your summary is all it knows.

**Example prompt to the agent:**

> Verify the scratch-management skill at .claude/skills/scratch-management/SKILL.md. Updated script references from node {path}/scratch.mjs to bare `scratch` command, simplified protocol files to use bare command names.

Do not run verification yourself — the agent has its methodology skill loaded.

If the agent returns an error or needs user input, relay the message to the user. After resolution, resume the same agent via SendMessage — preserves the agent's analysis context and avoids re-reading all files.

Additional instructions (when provided) override the above:
$ARGUMENTS
