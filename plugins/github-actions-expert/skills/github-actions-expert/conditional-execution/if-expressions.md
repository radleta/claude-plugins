---
tags: [github-actions-expert/conditional]
summary: "if: expressions for branch, event, and combined condition filters on steps and jobs"
---

# if: Expressions

```yaml
# Run only on main branch
- if: github.ref == 'refs/heads/main'

# Run only when PR merged (not just closed)
- if: github.event.pull_request.merged == true

# Run only for specific event
- if: github.event_name == 'push'

# Combine conditions
- if: github.ref == 'refs/heads/main' && github.event_name == 'push'
```
