---
name: code-change
description: "Systematic methodology for high-quality code changes including project investigation, quality checklists, and testing protocols. Use when implementing features, fixing bugs, refactoring, or updating code — even for seemingly simple one-file changes."
---

# Code Change Skill

Every change runs these steps in order. Where a project convention conflicts with a default
here, follow the project.

## 1. Investigate the project

Start here: a change that ignores the project's patterns comes back as rework. Establish the
stack, the patterns near the change, and the project's documentation, testing, style and
version-control conventions, by the protocols in @INVESTIGATION.md.

**When the request names an issue** in `scratch/issues/`, run `lane-methodology` § Held check on it
first, loading that skill for it, then `/refresh-issue {slug}`.

**Done when:** an investigation report documents the findings, in the template
@INVESTIGATION.md gives.

## 2. Plan the changes

Name the files, tests and documentation the change touches, following the patterns step 1
found; a breaking change carries a migration guide. Get user confirmation where the change
needs it — skip when an orchestrator owns confirmation (e.g. an autonomous pipeline like
`/implement-code` that proceeds through its verify-fix loop without per-step sign-off).
Owner: user-decision-rubric (tests)

## 3. Implement

**Before the first edit, the build point.** With no lane branch checked out and no orchestrator
that owns the branch (`/implement-code`), run `lane-methodology` § When a lane opens, loading that
skill for it: it opens or offers the lane, or stops at a launch-only repo, as the repo's lane line
says. On a lane already, edit there.

Write the code to the conventions step 1 found and @CHECKLISTS.md → Code Quality Checklist.
Prove the change: **load the completeness-expert skill** for the evidence each change type
needs, and say plainly what could not be verified.

**Consult the contract before changing.** When the dispatch names an approved `idea.md`, read
its `## Contracts & Acceptance` interface contracts for a method, class, or state handler before
modifying it. The contract, not the current implementation, is the source of truth for what the
code must do: refactoring internals to satisfy current tests can still break a contract clause
the tests don't cover.

## 4. Create or update tests

Tests follow the project's naming and organization and cover the new and modified code to the
project's coverage standard, per @CHECKLISTS.md → Testing Checklist. **Done when:** they pass
locally.

## 5. Update documentation

Update the inline docs, README, API and architecture docs the change affects, per
@CHECKLISTS.md → Documentation Checklist. Every change gets a CHANGELOG entry
(@CHECKLISTS.md → CHANGELOG Checklist, `templates/changelog-entry.txt`) — skip when an
orchestrator owns doc updates (e.g. `/implement-code` defers doc and changelog rollups to
`doc-updater` at its boundary-2 sweep).

## 6. Validate

**Done when:** the build, the full test suite, the linter, the formatter and the type checker
(where the project has one) all pass with no new warnings, per @CHECKLISTS.md → Post-Change
Validation Checklist.

## 7. Close the issue

When the change completes an issue in `scratch/issues/`, close it at its commit: load
`issue-groom-methodology` and follow its § Entry: /close-issue with `{slug} {oldest}^..{newest}`,
the change's own commits (one commit `X` is `X^..X`); it refuses an epic or a spike and names
where that one settles. Skip this step when an orchestrator owns the close (e.g. `/implement-code`,
which names `/close-issue` next).

On a lane, commit the change on the lane branch, path-scoped (`git add -- {paths}`, then
`git commit -m "…" -- {paths}`) after screening it as `commit-methodology` Step 2 does, a path inside an extra lane repo
by `lane-methodology` § Lane repos; add its line to the lane record's
`## Log` (`lane-methodology` `record.md` § Sections), committed by `lane-methodology` § Scratch commit, whose `lane push` pushes every lane branch; and skip this step:
`/end-lane` closes the issues a lane settled.
Off a lane the commit is the user's to make. While the change is uncommitted, say the issue closes
at its commit, and close it once the commit exists.

## Reference

- @CHECKLISTS.md — the six checklists: pre-change investigation, code quality, testing,
  documentation, CHANGELOG, post-change validation. Not every item applies to every change.
- @EXAMPLES.md — complete runs for a feature, a bug fix, a refactor, a documentation update, a
  breaking change and a security fix.
- `templates/` — `changelog-entry.txt`, `commit-message.txt` and `pr-description.txt`, starting
  points to fit to the project's format.
