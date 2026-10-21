---
description: Comprehensive release readiness audit — discovers what to check, analyzes everything, writes actionable report with linked issues to scratch/
disable-model-invocation: true
argument-hint: "[existing scratch/verify-release-* path for re-validation]"
context: fork
model: claude-opus-5-5
effort: low
---

Audit the repository A to Z for release readiness: discover what to check from what the repo
contains, run every applicable check, and write a report whose issues are each linked for team
triage.

**This is a pre-release audit.** It runs before the version bump and the release process, and asks
whether the code as it stands is ready to release, not whether a release has happened. These are
the expected pre-release state, reported as INFO at most, summarizing what the release will include,
and never as BLOCKER or WARNING:
- commits since the last release tag (the changes about to be released)
- the manifest version matching the last release (the bump happens during the release)
- a development branch ahead of main/master (the merge is part of the release)
- a CHANGELOG `[Unreleased]` section with pending entries

**The audit reads and reports; the team fixes.** Write only inside the `scratch/verify-release-*`
output directory: no edits to project files, no commits, pushes or releases.

## Current State

!`git branch --show-current`
!`git log --oneline -1`

## Fresh run or re-validation

**Fresh run** — `$0` is empty or names no existing `scratch/verify-release-*` directory. Create
`scratch/verify-release-[YYYYMMDD-HHMM]/` holding `README.md` (summary and verdicts), `TODO.md`
(checklist linking every issue) and `issues/NNN-[slug].md`, one per finding.

**Re-validation** — `$0` is an existing `scratch/verify-release-*` directory.
1. Read its `TODO.md` and every `issues/*.md`, noting which items are marked `[x]` or tagged DEFERRED.
2. Re-run every check from scratch.
3. Compare: previously found and now fixed → RESOLVED; still present → OPEN; previously deferred →
   DEFERRED with its original notes; not in the prior report → NEW.
4. Update `README.md`, `TODO.md` and `issues/` in that same directory, adding the re-validation
   timestamp to `README.md`. Keep every team note and DEFERRED status in the issue files.

## Step 1: Discover

Read the project's own account of itself before scanning: `CLAUDE.md` and `.claude/CLAUDE.md`,
`AGENTS.md`, `.claude/rules/*.md`, `README.md` (even when a `CLAUDE.md` exists), `CONTRIBUTING.md`
or `docs/CONTRIBUTING.md`, `package.json` `scripts`, and `Makefile` targets. From them, take the
exact build, test, lint and format commands, the project's conventions and restrictions, any
documented release process, and any quality gates.

Then fill only the gaps the docs leave — project type, test, lint, type-check, build, CI and
security tooling, source and test layout — from manifests, config files and a directory listing.

**Done when** every instruction file present is read and the check plan names, for each domain
below, the command it will run (documented over inferred) or the reason it is skipped.

## Step 2: Analyze

Run the domains in this order. Use the project's documented commands, never an alternative guess,
and only checks that fit the project's ecosystem. Skip a domain whose tooling is absent and record
why; anything you cannot check (missing tool, external access) is SKIPPED with its reason. Record
PASS, WARN or FAIL per check with its captured output as evidence, and collect every finding before
writing the report. Where the docs describe a release process or quality gates, check those too.

| Domain | Checks | Skip when |
|---|---|---|
| Git health | uncommitted changes (`git status`); untracked files that should be committed or ignored; ahead/behind its own remote tracking branch; recent commits in conventional format with no WIP, fixup or squash commits; no merge conflict markers in any file; the latest tag, noted for context; no binaries over 1 MB in git. Flag only what would break the release process itself. | — |
| Tests | the runner is configured; the suite runs, with pass, fail and skip counts; coverage percentage when available, not enforced; skipped or disabled tests listed, flagged if excessive; test files exist for source files (a rough map); no focused tests (`.only`, `fdescribe`, `fit`) | no runner or test files |
| Lint and format | the linter passes; the formatter's check passes; the type checker passes when configured; no conflicting linter and formatter configs | no linter or formatter config |
| Build | the build completes; no warnings that indicate problems; build output is gitignored | no build step |
| Dependencies | the lock file exists and matches the manifest; the ecosystem's security audit; no pinned versions with known vulnerabilities; no unused dependencies, when a tool detects them; license compatibility, when detectable | — |
| Security | no secrets (API keys, tokens, passwords, private keys); `.gitignore` covers sensitive files; `.env.example` exists when `.env` is ignored; no hardcoded internal or staging URLs; HTTPS for every external URL in code | — |
| Documentation | a substantive `README.md` with description, setup, usage and contributing; a current CHANGELOG or HISTORY; a LICENSE; API docs where applicable; breaking changes documented for a major bump | — |
| CI/CD | CI config exists and parses; CI runs tests, lint and build; no `continue-on-error` step masking failures | no CI config |
| Version | the manifest version; it matches the latest tag (the last release was clean); no `0.0.0` or placeholder; unreleased changes since the tag summarized, and a semver bump suggested from conventional commits, both informational | — |
| Claude files | `CLAUDE.md` exists and is well structured; valid YAML frontmatter on `.claude/commands/*.md` and `.claude/skills/*/SKILL.md`; no secrets or sensitive paths in Claude configuration; `scripts/check-scratch-refs.sh` — a `[published]` hit is a BLOCKER, because the plugin manifest stages that primitive and the citation will not resolve in an installed copy, and a `[local]` hit is a WARNING | no `.claude/` or `CLAUDE.md` |
| Project hygiene | `.gitignore` fits the project type; no temporary files that should be ignored; TODO/FIXME/HACK/XXX comments in production code, listed; no `console.log`, `print` or `debugger` left in production code; no commented-out code blocks; an EditorConfig or documented formatting standard | — |

**Done when** every applicable domain is analyzed, every skipped one has its reason, and every
finding has its evidence.

## Step 3: Write the report

Write to the fresh directory, or update the `$0` directory on a re-validation.

**Severity:**
- **BLOCKER** — would cause release failure, data loss, a security incident or a broken user
  experience: test or build failures, vulnerabilities, merge conflicts, secrets, broken dependencies.
- **WARNING** — will not break the release but carries risk, debt or poor practice: missing docs,
  skipped tests, TODO comments, outdated dependencies, lint warnings, a missing changelog entry.
- **INFO** — noteworthy and not affecting readiness: hygiene suggestions, optional improvements,
  tool configuration recommendations.

**Verdict:** GO with zero blockers and every warning acknowledged; NO-GO with one or more blockers;
CONDITIONAL with no blockers but unresolved warnings for the team to weigh.

`README.md`:

```markdown
# Release Readiness Report

**Repository:** [repo name]
**Branch:** [current branch]
**Generated:** [timestamp]
**Re-validated:** [timestamp, if re-run]
**Verdict:** [GO | NO-GO | CONDITIONAL]

## Executive Summary
[2-3 sentences: overall readiness, critical blockers, key risks]

## Verdicts by Domain

| Domain | Status | Issues | Notes |
|--------|--------|--------|-------|
| [each domain from Step 2, in order] | PASS/WARN/FAIL/SKIPPED | [count] | [brief] |

## Blockers (must fix before release)
[FAIL items that block release]

## Warnings (should fix or acknowledge)
[WARN items for team review]

## Skipped Checks
[Domains skipped and why]

## How to Use This Report
- Review TODO.md for the actionable checklist
- Each issue in issues/ has full details and remediation steps
- Mark items [x] in TODO.md as you address them
- Re-run `/verify-release [this-directory-path]` to re-validate
```

`TODO.md`:

```markdown
# Release Checklist

**Status:** [X of Y items resolved]

## Blockers
- [ ] [brief description] → [issues/001-slug.md](issues/001-slug.md)

## Warnings
- [ ] [brief description] → [issues/002-slug.md](issues/002-slug.md)

## Informational
- [ ] [brief description] → [issues/003-slug.md](issues/003-slug.md)

## Deferred
- [~] [description] — DEFERRED: [reason]

## Resolved
- [x] [description] — RESOLVED [re-validation timestamp]
```

`issues/NNN-slug.md`, numbered from `001` and slugged from the finding (`002-test-failures.md`,
`003-npm-audit-high.md`):

```markdown
# [Issue Title]

**ID:** NNN
**Domain:** [check domain]
**Severity:** BLOCKER | WARNING | INFO
**Status:** OPEN | RESOLVED | DEFERRED

## Description
[What was found]

## Evidence
[Exact command output, file:line references, or tool results]

## Remediation
[Specific steps to fix this issue]

## Notes
[Team triage notes; resolution notes added on re-validation]
```

**Done when** `README.md` carries the verdict and the domain table, every finding has its own
issue file with remediation steps, and every `TODO.md` item links to its issue file by a valid
relative path.

## Step 4: Summary

Show the user the verdict, the blocker and warning counts, the output directory, and how to review
and re-validate it.

## Additional Context

$ARGUMENTS
