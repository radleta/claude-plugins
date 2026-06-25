---
tags: [github-actions-expert/security]
summary: "Workflow-level and per-job permissions with GITHUB_TOKEN — per-job declarations override workflow-level entirely"
---

# Principle of Least Privilege

Default permissions are read-only for `GITHUB_TOKEN`. Explicitly grant only what each job needs.

```yaml
# Workflow-level default (applies to all jobs unless overridden)
permissions:
  contents: read

jobs:
  release:
    permissions:
      contents: write    # needed to create releases and upload assets
    # ...

  deploy:
    permissions:
      contents: read
      deployments: write
    # ...
```

**Per-job permissions override workflow-level entirely** — they do not merge. If a job declares `permissions:`, it gets ONLY what it lists.

Common permission scopes:
| Scope | When Needed |
|-------|-------------|
| `contents: write` | Creating releases, pushing tags, uploading release assets |
| `packages: write` | Publishing to GHCR or GitHub Packages |
| `pull-requests: write` | Commenting on or labeling PRs |
| `issues: write` | Creating or commenting on issues |
| `id-token: write` | OIDC authentication (cloud provider auth without secrets) |
