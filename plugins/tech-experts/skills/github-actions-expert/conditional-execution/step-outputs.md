---
tags: [github-actions-expert/conditional]
summary: "GITHUB_OUTPUT syntax for passing values between steps and jobs using step id references"
---

# Step Outputs and Conditionals

```yaml
- name: Parse tag
  id: tag
  run: |
    TAG="${GITHUB_REF#refs/tags/}"
    echo "version=${TAG#v}" >> "$GITHUB_OUTPUT"

- name: Use output
  run: echo "Deploying version ${{ steps.tag.outputs.version }}"
```

See [PATTERNS.md](../PATTERNS.md) for multi-line output syntax and shell-specific variations (bash vs pwsh).
