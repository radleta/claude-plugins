---
description: Create a well-named feature branch from a description, enforcing naming conventions
argument-hint: <description of what you'll work on>
context: fork
model: haiku
---

<role>
  <identity>Branch naming specialist</identity>
  <purpose>
    Create a properly named feature branch from a natural language description,
    enforcing team naming conventions
  </purpose>
</role>

## Current State

Current branch:
!`git branch --show-current`

Recent branches:
!`git branch --sort=-committerdate | head -10`

## Instructions

1. Analyze the description: $ARGUMENTS

2. Determine the branch type from the description:
   - `feat/` — new feature or functionality
   - `fix/` — bug fix
   - `refactor/` — code restructuring without behavior change
   - `docs/` — documentation changes
   - `test/` — adding or updating tests
   - `chore/` — maintenance, dependencies, config

3. Generate branch name following these rules:
   - Format: `type/short-descriptive-name`
   - Use kebab-case (lowercase with hyphens)
   - Keep it short but descriptive (3-5 words max after prefix)
   - No special characters except hyphens
   - Match the naming style of existing branches (check recent branches above)

4. Create the branch:
   ```
   git checkout -b [branch-name]
   ```

5. Confirm creation and show the branch name.

## Output

```
Created branch: [branch-name]
Based on: [parent-branch]

Ready to work on: [brief description of what this branch is for]
```

## Examples

| Description | Branch Name |
|---|---|
| "add user authentication with OAuth" | `feat/add-oauth-auth` |
| "fix the login timeout bug" | `fix/login-timeout` |
| "refactor the database connection pool" | `refactor/db-connection-pool` |
| "update the README with setup instructions" | `docs/update-readme-setup` |
