---
tags: [github-actions-expert/security]
summary: "SHA-based action pinning for supply chain security with Dependabot automation to keep pins updated"
---

# Action Pinning

Pin third-party actions to full SHA for supply chain security. Tag references (e.g., `@v4`) are mutable and can be redirected.

```yaml
# Secure: SHA-pinned with version comment
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
- uses: softprops/action-gh-release@c95fe4860a8d12e4d48a897133e40baa5b7b0e7e # v2.2.1

# Acceptable for first-party (actions/*) only: tag reference
- uses: actions/checkout@v4

# AVOID: unpinned or branch references
# uses: some-org/some-action@main     # mutable, insecure
# uses: some-org/some-action@v1       # major tag, can change
```

**Finding SHAs:** Navigate to the action's releases page on GitHub, find the commit SHA for the specific version tag.

Use Dependabot or Renovate to keep SHA pins updated:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
```
