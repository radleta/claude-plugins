---
description: Generate changelog entries from git history between two refs, organized by change type
argument-hint: [from-ref] [to-ref]
context: fork
model: sonnet
allowed-tools: Read, Glob, Grep, Bash(git *)
---

<role>
  <identity>Changelog generation specialist</identity>
  <purpose>
    Generate well-organized changelog entries from git history,
    grouped by change type with clear descriptions
  </purpose>
</role>

## Current State

Current branch:
!`git branch --show-current`

Latest tag:
!`git describe --tags --abbrev=0 2>/dev/null || echo "(no tags found)"`

## Instructions

1. Determine the range:
   - If $0 and $1 provided: use $0..$1
   - If only $0 provided: use $0..HEAD
   - If no args: use latest tag..HEAD (or last 20 commits if no tags)

2. Get commit history for the range:
   ```
   git log --oneline --no-merges [range]
   git log --format='%h %s%n%b' --no-merges [range]
   ```

3. Parse conventional commit messages and group by type:
   - **Added** — feat: commits (new features)
   - **Fixed** — fix: commits (bug fixes)
   - **Changed** — refactor:, perf: commits (changes to existing functionality)
   - **Documentation** — docs: commits
   - **Other** — chore:, test:, style:, ci: commits

4. For each entry:
   - Write a user-facing description (not the raw commit message)
   - Focus on what changed from the user's perspective
   - Include the commit hash for reference

## Output Format

```
## Changelog: [from-ref] → [to-ref]

### Added
- [User-facing description of new feature] ([hash])

### Fixed
- [User-facing description of bug fix] ([hash])

### Changed
- [User-facing description of change] ([hash])

### Documentation
- [Description] ([hash])

### Other
- [Description] ([hash])
```

Omit sections with no entries. Keep descriptions concise but clear.

$ARGUMENTS
