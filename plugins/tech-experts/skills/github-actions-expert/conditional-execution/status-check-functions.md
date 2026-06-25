---
tags: [github-actions-expert/conditional]
summary: "always(), failure(), cancelled(), success() status check functions for cleanup steps and error handling"
---

# Status Check Functions

```yaml
# Run even if previous steps failed (cleanup, notifications)
- if: always()

# Run only if a previous step failed
- if: failure()

# Run only if workflow was cancelled
- if: cancelled()

# Run only if all previous steps succeeded (default behavior)
- if: success()
```
