---
tags: [github-actions-expert/workflow-syntax]
summary: "Concurrency groups and cancel-in-progress to prevent duplicate workflow runs for the same branch or PR"
---

# Concurrency Control

Prevent duplicate runs for the same branch/PR:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true  # cancel older runs when new push arrives
```
