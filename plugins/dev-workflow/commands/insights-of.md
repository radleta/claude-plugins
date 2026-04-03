---
description: Extract and evaluate domain knowledge from files or directories for expert skill creation
argument-hint: <file or directory path(s) to analyze>
---

Launch the **insight-extractor** agent via the Agent tool. Provide a prompt instructing it to:

- Read and analyze the source material at the path(s) specified below
- Apply the 3-filter knowledge distillation framework
- Return categorized insight recommendations with priority, compact forms, and token estimates

**Example prompt to the agent:**

> Analyze the following source material for domain knowledge insights: .claude/skills/commit-methodology/ — Read all files, apply the 3-filter knowledge distillation framework, and return categorized insight recommendations.

Report the agent's findings back as a concise summary with the prioritized insight list and recommendations for skill inclusion.

Additional instructions (when provided) override the above:
$ARGUMENTS
