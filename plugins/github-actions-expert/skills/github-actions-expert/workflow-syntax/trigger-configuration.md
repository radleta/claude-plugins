---
tags: [github-actions-expert/workflow-syntax]
summary: "on: event configuration including push, PR, schedule, workflow_dispatch, and path filters"
---

# Trigger Configuration

Configure `on:` with the minimum required events. Avoid overly broad triggers that waste runner minutes.

```yaml
# PR validation — runs on PR open/update targeting main or develop
on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, develop]

# Tag-driven release — runs only on version tags
on:
  push:
    tags: ["v*"]

# Scheduled workflow
on:
  schedule:
    - cron: "0 6 * * 1"  # Monday 6 AM UTC

# Manual trigger with inputs
on:
  workflow_dispatch:
    inputs:
      environment:
        type: choice
        options: [staging, production]
```

Use `paths:` and `paths-ignore:` filters to skip CI on docs-only changes:

```yaml
on:
  push:
    branches: [main]
    paths-ignore:
      - "**.md"
      - "docs/**"
```
