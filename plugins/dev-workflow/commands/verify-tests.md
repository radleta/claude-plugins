---
description: Test quality verification - detects shallow tests, missing assertions, and coverage gaps before security review
argument-hint: [plan name or path — auto-detected if omitted]
---

Launch the **test-verifier** agent via the Agent tool. Provide a concise paragraph as the prompt summarizing:

- What files were changed and why
- What was implemented, fixed, or refactored
- Key decisions or constraints that affect verification
- Plan path if used (e.g., `scratch/*/`)
- Todo/task file path if used (e.g., `scratch/*/todos.md`)

The agent runs in an isolated context with no conversation history — your summary is all it knows.

**Example prompt to the agent:**

> Added unit tests for the payment service. Changed: src/services/payment.test.ts (new), src/services/payment.ts (refactored for testability). Testing edge cases: expired cards, insufficient funds, network timeouts. Plan: scratch/payments/README.md

Do not run verification yourself — the agent has its methodology skill loaded.

If the agent returns an error or needs user input, relay the message to the user. After resolution, resume the same agent via SendMessage — preserves the agent's analysis context and avoids re-reading all files.

Additional instructions (when provided) override the above:
$ARGUMENTS
