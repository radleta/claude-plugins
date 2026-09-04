---
tags: [github-actions-expert/anti-patterns]
summary: "Security anti-patterns: mutable action refs, overly broad permissions, secret leakage, and pull_request_target risks"
---

# Security Anti-Patterns

| Anti-Pattern | Risk | Fix |
|---|---|---|
| `uses: org/action@main` | Mutable ref, supply chain attack | Pin to full SHA with version comment |
| `permissions: write-all` | Overly broad token scope | Declare minimum per-job permissions |
| `echo "${{ secrets.TOKEN }}"` | Secret leaked in logs | Use env vars, never echo directly |
| `toJSON(secrets)` in logs | Dumps ALL secrets | Remove entirely |
| Workflow triggered by `pull_request_target` with checkout of PR head | Allows PRs to run arbitrary code with write permissions | Use `pull_request` trigger, or validate PR source carefully |

See [action-pinning.md](../security/action-pinning.md) for SHA-pinning patterns and Dependabot automation.
