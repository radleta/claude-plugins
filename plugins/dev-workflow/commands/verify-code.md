---
description: Code verification - unified quality and requirements review in a single pass before security review
argument-hint: [plan name or path — auto-detected if omitted]
---

Launch the **code-verifier** agent via the Agent tool. Provide a concise paragraph as the prompt summarizing:

- What files were changed and why
- What was implemented, fixed, or refactored
- Key decisions or constraints that affect verification
- Plan path if used (e.g., `scratch/*/`)
- Todo/task file path if used (e.g., `scratch/*/todos.md`)

The agent runs in an isolated context with no conversation history — your summary is all it knows.

**Example prompt to the agent:**

> Implemented OAuth2 login flow. Changed: src/auth/oauth.ts (new provider integration), src/auth/types.ts (token types), src/middleware/auth.ts (session validation). Key constraint: must support both cookie and bearer token auth. Plan: scratch/oauth/README.md

Do not run verification yourself — the agent has its methodology skill loaded.

If the agent returns an error or needs user input, relay the message to the user. After resolution, resume the same agent via SendMessage — preserves the agent's analysis context and avoids re-reading all files.

Additional instructions (when provided) override the above:
$ARGUMENTS
