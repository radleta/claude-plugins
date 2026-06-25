---
tags: [mdite/workflows]
updated: 2026-04-07
summary: "LLM wiki maintenance workflows, CI/CD integration, pre-commit hooks, anti-patterns, and troubleshooting"
---

# Workflows

## LLM Wiki Maintenance

When maintaining markdown wikis generated or curated by LLMs, use mdite to enforce graph integrity:

**Validate after every edit:**
```bash
mdite lint --format json | jq '.[] | select(.severity=="error")'
```

**Find and fix orphans:**
```bash
mdite files --orphans                   # List orphaned files
mdite deps docs/orphan.md --incoming    # Confirm nothing references it
# Either link to it from another doc or remove it
```

**Impact analysis before renaming/moving:**
```bash
mdite deps docs/old-name.md --incoming --format list
# Update all incoming references before renaming
```

## CI/CD Integration

**Pre-commit hook pattern:**
```bash
#!/bin/sh
changed_md=$(git diff --cached --name-only | grep '\.md$')
[ -z "$changed_md" ] && exit 0
mdite lint $changed_md --depth 1 --quiet || exit 1
```

**CI pipeline validation:**
```bash
mdite lint --format json --quiet || exit 1
```

Use `--format json` in CI for machine-readable output that can be parsed by reporting tools.

## Common Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|--------------|---------|-----------------|
| `mdite lint` without CI integration | Drift accumulates | Add to CI pipeline or pre-commit hook |
| Ignoring orphan warnings | Dead docs confuse readers | Link orphans to graph or delete them |
| `--depth 1` on full validation | Misses deep broken links | Use unlimited depth for full runs |
| Excluding too many patterns | Hides real problems | Exclude only truly irrelevant paths |
| Skipping `--respect-gitignore` | Lints generated/vendor files | Enable when repo has generated docs |

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Exit code 1 but no visible errors | Errors suppressed by format | Run with `--format text` or `--verbose` |
| Orphan detected for valid file | File not linked from entrypoint chain | Add link from a reachable file |
| Dead link for existing file | Path is relative to wrong directory | Use path relative to linking file |
| Dead anchor for existing heading | Heading slug mismatch (case, special chars) | Check exact slug with `mdite deps --format json` |
| Too many files processed | No exclusions configured | Add `exclude` patterns or `--respect-gitignore` |
| Colors in piped output | Terminal detection override | Set `NO_COLOR=1` or use `--no-colors` |
