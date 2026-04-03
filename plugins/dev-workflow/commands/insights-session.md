---
description: Extract knowledge insights discovered during the current session for expert skill creation
---

Launch the **insight-extractor** agent via the Agent tool. Provide a concise summary of the session as the prompt covering:

- What was explored, discovered, and learned
- Decisions made and patterns identified
- Key technical findings or gotchas encountered

Instruct the agent to apply the 3-filter knowledge distillation framework and return categorized insight recommendations with priority, compact forms, and token estimates.

**Example prompt to the agent:**

> Evaluate these session discoveries for domain knowledge insights: (1) MSYS ln -sf silently creates copies instead of symlinks on Windows — use cmd //c mklink from elevated terminal. (2) Commands with "Summarize then launch" wording cause Claude to narrate before acting — imperative "Launch X, providing Y" goes straight to action. (3) Auto-staging all changes by default simplifies commit flows since security screening still catches secrets post-stage. Apply the 3-filter framework.

Report the agent's findings back as a concise summary with the prioritized insight list and recommendations for skill inclusion.

Additional instructions (when provided) override the above:
$ARGUMENTS
