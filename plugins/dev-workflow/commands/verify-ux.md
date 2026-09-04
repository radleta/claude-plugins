---
description: UX verification - visual-first review of accessibility, responsiveness, design polish, and user experience quality
argument-hint: [plan name or path — auto-detected if omitted]
---

Launch the **ux-verifier** agent via the Agent tool. Provide a concise paragraph as the prompt summarizing:

- What files were changed and why
- What UI components, pages, or CLI tools were affected
- What the user should see or experience as a result of the changes
- Dev server URL if running (e.g., `http://localhost:3000`)
- Plan path if used (e.g., `scratch/*/`)
- Todo/task file path if used (e.g., `scratch/*/todos.md`)

The agent runs in an isolated context with no conversation history — your summary is all it knows.

**Example prompt to the agent:**

> Redesigned the settings page. Changed: src/components/SettingsPanel.tsx (new tabbed layout), src/components/SettingsForm.tsx (form validation), src/styles/settings.css (responsive grid). Dev server: http://localhost:5173. Plan: scratch/settings-redesign/README.md

Do not run verification yourself — the agent has its methodology skill loaded.

If the agent returns an error or needs user input, relay the message to the user. After resolution, resume the same agent via SendMessage — preserves the agent's analysis context and avoids re-reading all files.

Additional instructions (when provided) override the above:
$ARGUMENTS
