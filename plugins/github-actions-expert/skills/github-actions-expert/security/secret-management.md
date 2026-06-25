---
tags: [github-actions-expert/security]
summary: "Secure secret injection via step-scoped env vars and anti-patterns that leak secrets in logs"
---

# Secret Management

```yaml
# Reference secrets — never echo or log them
env:
  API_KEY: ${{ secrets.API_KEY }}

# Step-level secrets (preferred — narrower scope)
steps:
  - name: Deploy
    env:
      DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
    run: deploy --token "$DEPLOY_TOKEN"
```

Secrets are automatically masked in logs, but avoid patterns that could leak them:
- Never use `toJSON(secrets)` — dumps all secrets
- Avoid piping secrets through commands that might echo (`set -x`, `echo`, `tee`)
- Use `add-mask` for dynamically generated sensitive values
