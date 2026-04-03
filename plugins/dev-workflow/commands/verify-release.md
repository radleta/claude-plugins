---
description: Comprehensive release readiness audit — discovers what to check, analyzes everything, writes actionable report with linked issues to scratch/
argument-hint: [existing scratch/verify-release-* path for re-validation]
context: fork
---

<role>
  <identity>Release readiness auditor</identity>
  <purpose>
    Perform a comprehensive A-Z audit of the repository to determine release readiness.
    Discovers what should be checked based on what exists in the repo, analyzes everything,
    and produces an actionable report with individually-linked issues for team triage.

    CRITICAL CONTEXT: This is a PRE-RELEASE audit — it runs BEFORE the version bump and
    release process. Unreleased commits, fixes not yet on main, and version numbers that
    haven't been bumped yet are the EXPECTED state, not problems. The question this audit
    answers is: "Is the code in its current state READY to be released?" — not "Has a
    release already been performed?"
  </purpose>
  <scope>
    <in-scope>
      <item>Reading project docs (CLAUDE.md, AGENTS.md, README) first, then scanning for gaps</item>
      <item>Running all discoverable checks (tests, lint, build, security)</item>
      <item>Analyzing git history, documentation, dependencies, and project health</item>
      <item>Writing structured report to scratch/verify-release-[timestamp]/</item>
      <item>Re-validating an existing report (idempotent re-run)</item>
    </in-scope>
    <out-of-scope>
      <item>Fixing issues (report only — team decides what to fix)</item>
      <item>Making commits, pushing, or creating releases</item>
      <item>Modifying any project files</item>
    </out-of-scope>
  </scope>
</role>

## Current State

!`git branch --show-current`
!`git log --oneline -1`

## Idempotency Protocol

<idempotency>
  <first-run condition="$0 is empty OR $0 does not match an existing scratch/verify-release-* path">
    Fresh audit. Create new output directory:
    scratch/verify-release-[YYYYMMDD-HHMM]/

    Structure:
    scratch/verify-release-[ts]/
    ├── README.md          — Executive summary and verdicts
    ├── TODO.md            — Checklist with links to issues
    └── issues/
        ├── 001-[slug].md  — Individual issue detail
        ├── 002-[slug].md
        └── ...
  </first-run>

  <re-run condition="$0 is a path to an existing scratch/verify-release-* directory">
    Re-validation of prior report.
    1. Read existing TODO.md and all issues/*.md files
    2. Note which issues were marked [x] (addressed) or tagged DEFERRED
    3. Re-run ALL checks from scratch
    4. Compare new findings against prior:
       - Previously found, now fixed → mark RESOLVED in updated report
       - Previously found, still present → keep as OPEN
       - Previously deferred → keep as DEFERRED with original notes
       - New issue not in prior report → mark as NEW
    5. Update README.md, TODO.md, and issues/ in the SAME directory
    6. Add re-validation timestamp to README.md
  </re-run>
</idempotency>

## Workflow

<workflow type="sequential">
  <step id="1-discover" order="first">
    <description>Learn about the project from its own docs first, then fill gaps with file scanning</description>

    <phase name="1a-read-project-instructions" priority="critical" order="FIRST">
      <description>
        Read the project's own documentation about itself BEFORE scanning for files.
        These files are the fastest path to understanding what the project is,
        how it builds, how to test, what conventions matter, and what tooling exists.
      </description>

      <sources priority-order="true">
        <source name="CLAUDE.md" locations="./CLAUDE.md, ./.claude/CLAUDE.md">
          Primary project instruction file. Often contains:
          - Project setup and build commands
          - Test commands and conventions
          - Git hooks and commit conventions
          - Directory structure and key paths
          - Coding standards and patterns
          - What NOT to do (blocked paths, restricted operations)
        </source>

        <source name="AGENTS.md" locations="./AGENTS.md, ./.claude/AGENTS.md">
          Agent-specific instructions. May contain:
          - Workflow conventions
          - Tool restrictions
          - Release and deployment procedures
        </source>

        <source name=".claude/rules/" locations=".claude/rules/*.md">
          Path-specific rules that may document per-directory conventions,
          testing requirements, or build-specific instructions.
        </source>

        <source name="README.md" locations="./README.md">
          Often has setup instructions, build/test commands, project description.
          Read for context even if CLAUDE.md exists.
        </source>

        <source name="CONTRIBUTING.md" locations="./CONTRIBUTING.md, ./docs/CONTRIBUTING.md">
          May document release process, testing requirements, lint rules,
          PR conventions, and quality gates.
        </source>

        <source name="package.json scripts" locations="./package.json">
          If present, read the "scripts" section — it's a map of all available
          commands (test, lint, build, format, etc.) without guessing.
        </source>

        <source name="Makefile" locations="./Makefile, ./makefile, ./GNUmakefile">
          If present, read targets — they document available operations.
        </source>
      </sources>

      <what-to-extract>
        From these files, extract:
        - How to build the project (exact commands)
        - How to run tests (exact commands, expected frameworks)
        - How to lint/format (exact commands)
        - Project conventions (commit format, branch naming, file structure)
        - Known restrictions (blocked paths, forbidden patterns)
        - Release process if documented
        - Any project-specific quality gates or checks
      </what-to-extract>

      <acceptance-criteria>
        <criterion priority="critical">All available instruction files read</criterion>
        <criterion priority="critical">Extracted commands and conventions documented</criterion>
        <criterion priority="high">Project context understood before file scanning</criterion>
      </acceptance-criteria>
    </phase>

    <phase name="1b-fill-gaps-with-scanning" priority="high" order="SECOND">
      <description>
        For anything NOT covered by project docs, fall back to file-based discovery.
        Skip scanning for things already learned from instruction files.
      </description>

      <action name="project-type" condition="not already clear from docs">
        Detect project type and ecosystem from manifest files:
        - package.json → Node.js/JavaScript/TypeScript
        - Cargo.toml → Rust
        - go.mod → Go
        - pyproject.toml / setup.py / requirements.txt → Python
        - *.csproj / *.sln → .NET/C#
        - pom.xml / build.gradle → Java
        - Gemfile → Ruby
        - Multiple ecosystems (monorepo)
      </action>

      <action name="tooling" condition="gaps remain after reading docs">
        Scan for config files not mentioned in project docs:
        - Test runners: jest.config.*, vitest.config.*, pytest.ini, .mocharc.*, etc.
        - Linters: .eslintrc.*, .prettierrc.*, ruff.toml, .golangci.yml, etc.
        - Type checkers: tsconfig.json, mypy.ini, pyright
        - Build systems: webpack.config.*, vite.config.*, Dockerfile, etc.
        - CI/CD: .github/workflows/*.yml, .gitlab-ci.yml, Jenkinsfile, etc.
        - Security: .snyk, .npmrc (audit), Dependabot config
      </action>

      <action name="project-structure" condition="not documented">
        Map source, test, docs, and config directories via directory listing.
      </action>
    </phase>

    <acceptance-criteria>
      <criterion priority="critical">Project context understood (from docs or scanning)</criterion>
      <criterion priority="critical">Build/test/lint commands known (from docs or inferred)</criterion>
      <criterion priority="critical">Check plan built — preferring documented commands over guesses</criterion>
    </acceptance-criteria>
  </step>

  <step id="2-analyze" order="second">
    <description>Run all applicable checks based on discovery</description>

    <check-domains>
      <domain name="git-health" priority="critical">
        <description>Git history and branch state</description>
        <pre-release-note>
          Commits ahead of the last release tag are the changes ABOUT to be released.
          A branch having unreleased commits is the normal, expected pre-release state.
          Only flag git issues that would cause problems WITH the release process itself
          (e.g., merge conflicts, dirty working tree, WIP commits).
        </pre-release-note>
        <checks>
          <check>Uncommitted changes: git status</check>
          <check>Untracked files that should be committed or gitignored</check>
          <check>Branch state: ahead/behind its own remote tracking branch</check>
          <check>Recent commit quality: conventional format, no WIP/fixup/squash commits</check>
          <check>No merge conflict markers in any files: grep for &lt;&lt;&lt;&lt;&lt;&lt;&lt; / ======= / &gt;&gt;&gt;&gt;&gt;&gt;&gt;</check>
          <check>Git tags: latest tag noted for context (NOT a blocker if commits exist since tag)</check>
          <check>Large files that shouldn't be in git (>1MB binaries)</check>
        </checks>
      </domain>

      <domain name="tests" priority="critical">
        <description>Test suite health</description>
        <checks>
          <check>Test runner exists and is configured</check>
          <check>Run test suite: capture pass/fail/skip counts</check>
          <check>Test coverage if available (report percentage, don't enforce threshold)</check>
          <check>Skipped/disabled tests: list them, flag if excessive</check>
          <check>Test files exist for source files (rough coverage map)</check>
          <check>No focused tests (.only, fdescribe, fit) left in</check>
        </checks>
        <skip-if>No test runner or test files detected</skip-if>
      </domain>

      <domain name="lint-format" priority="high">
        <description>Code quality tooling</description>
        <checks>
          <check>Linter configured and passes: run detected linter</check>
          <check>Formatter configured and passes: run detected formatter --check</check>
          <check>Type checker passes if configured (tsc --noEmit, mypy, pyright)</check>
          <check>No linter/formatter config conflicts</check>
        </checks>
        <skip-if>No linter or formatter config detected</skip-if>
      </domain>

      <domain name="build" priority="high">
        <description>Build health</description>
        <checks>
          <check>Build command exists and completes successfully</check>
          <check>No build warnings that indicate problems</check>
          <check>Build output is gitignored (dist/, build/, out/)</check>
        </checks>
        <skip-if>No build step detected</skip-if>
      </domain>

      <domain name="dependencies" priority="critical">
        <description>Dependency health</description>
        <checks>
          <check>Lock file exists and is consistent with manifest (package-lock.json matches package.json, etc.)</check>
          <check>Security audit: npm audit / pip-audit / cargo audit / etc.</check>
          <check>No pinned versions with known vulnerabilities</check>
          <check>No unused dependencies (if detection tool available)</check>
          <check>License compatibility: no GPL in MIT projects, etc. (if detectable)</check>
        </checks>
      </domain>

      <domain name="security" priority="critical">
        <description>Security posture</description>
        <checks>
          <check>No secrets in codebase: scan for API keys, tokens, passwords, private keys</check>
          <check>.gitignore covers sensitive files (.env, *.key, *.pem, credentials.*)</check>
          <check>.env.example exists if .env is gitignored (documents required env vars)</check>
          <check>No hardcoded URLs pointing to internal/staging environments</check>
          <check>HTTPS used for all external URLs in code</check>
        </checks>
      </domain>

      <domain name="documentation" priority="high">
        <description>Documentation completeness</description>
        <checks>
          <check>README.md exists and is substantive (not just a title)</check>
          <check>README has: description, install/setup, usage, and contributing sections</check>
          <check>CHANGELOG or HISTORY file exists and is current (mentions recent changes)</check>
          <check>LICENSE file exists</check>
          <check>API documentation if applicable (OpenAPI spec, JSDoc, etc.)</check>
          <check>Breaking changes documented if version bump is major</check>
        </checks>
      </domain>

      <domain name="ci-cd" priority="high">
        <description>CI/CD pipeline health</description>
        <checks>
          <check>CI config exists (.github/workflows/, .gitlab-ci.yml, etc.)</check>
          <check>CI config is syntactically valid (YAML parse check)</check>
          <check>CI runs tests, lint, and build (covers the basics)</check>
          <check>No CI steps with continue-on-error that mask failures</check>
        </checks>
        <skip-if>No CI configuration detected</skip-if>
      </domain>

      <domain name="version" priority="high">
        <description>Version and release metadata</description>
        <pre-release-note>
          This audit runs BEFORE the release process. The version in the manifest
          is expected to match the LAST release tag, not the upcoming one. Commits
          existing since the last tag are the changes ABOUT to be released — their
          presence is expected and must NOT be flagged as a blocker or warning.
        </pre-release-note>
        <checks>
          <check>Version in manifest (package.json, Cargo.toml, pyproject.toml, etc.)</check>
          <check>Version in manifest matches latest git tag (confirms last release was clean)</check>
          <check>No version 0.0.0 or placeholder versions</check>
          <check>Summarize unreleased changes since last tag (informational, NOT a blocker)</check>
          <check>Suggest appropriate semver bump type based on conventional commits (informational)</check>
        </checks>
      </domain>

      <domain name="claude-files" priority="medium">
        <description>Claude Code project configuration (if present)</description>
        <checks>
          <check>CLAUDE.md exists and is well-structured</check>
          <check>.claude/commands/*.md files have valid YAML frontmatter</check>
          <check>.claude/skills/*/SKILL.md files have valid YAML frontmatter</check>
          <check>No secrets or sensitive paths in Claude configuration</check>
        </checks>
        <skip-if>No .claude/ directory or CLAUDE.md detected</skip-if>
      </domain>

      <domain name="project-hygiene" priority="medium">
        <description>General project health</description>
        <checks>
          <check>.gitignore is comprehensive for the project type</check>
          <check>No temporary/scratch files that should be gitignored</check>
          <check>No TODO/FIXME/HACK/XXX comments in production code (list them)</check>
          <check>No console.log/print/debugger statements in production code</check>
          <check>No commented-out code blocks (dead code)</check>
          <check>EditorConfig or formatting standard documented</check>
        </checks>
      </domain>
    </check-domains>

    <execution-notes>
      - Use exact commands from CLAUDE.md/README/package.json when available — don't guess
      - Run checks in domain order (critical domains first)
      - For each domain: skip gracefully if tooling not detected
      - Capture stdout/stderr from tool runs for evidence
      - Record PASS/WARN/FAIL for each individual check
      - Collect all findings before writing report (don't write incrementally)
      - If project docs describe a release process or quality gates, verify those too
    </execution-notes>

    <acceptance-criteria>
      <criterion priority="critical">Every applicable domain analyzed</criterion>
      <criterion priority="critical">Skipped domains noted with reason</criterion>
      <criterion priority="critical">Evidence captured for all findings</criterion>
    </acceptance-criteria>
  </step>

  <step id="3-write-report" order="third">
    <description>Generate report files in scratch/</description>

    <output-directory>
      Fresh run: scratch/verify-release-[YYYYMMDD-HHMM]/
      Re-run: update existing directory from $0
    </output-directory>

    <file name="README.md">
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
      | Git Health | PASS/WARN/FAIL | [count] | [brief] |
      | Tests | PASS/WARN/FAIL/SKIPPED | [count] | [brief] |
      | Lint &amp; Format | PASS/WARN/FAIL/SKIPPED | [count] | [brief] |
      | Build | PASS/WARN/FAIL/SKIPPED | [count] | [brief] |
      | Dependencies | PASS/WARN/FAIL | [count] | [brief] |
      | Security | PASS/WARN/FAIL | [count] | [brief] |
      | Documentation | PASS/WARN/FAIL | [count] | [brief] |
      | CI/CD | PASS/WARN/FAIL/SKIPPED | [count] | [brief] |
      | Version | PASS/WARN/FAIL | [count] | [brief] |
      | Claude Files | PASS/WARN/FAIL/SKIPPED | [count] | [brief] |
      | Project Hygiene | PASS/WARN/FAIL | [count] | [brief] |

      ## Blockers (must fix before release)
      [List of FAIL items that block release]

      ## Warnings (should fix or acknowledge)
      [List of WARN items for team review]

      ## Skipped Checks
      [Domains skipped and why — e.g., "No CI config detected"]

      ## How to Use This Report
      - Review TODO.md for the actionable checklist
      - Each issue in issues/ has full details and remediation steps
      - Mark items [x] in TODO.md as you address them
      - Re-run `/verify-release [this-directory-path]` to re-validate
    </file>

    <file name="TODO.md">
      # Release Checklist

      **Status:** [X of Y items resolved]

      ## Blockers
      - [ ] [brief description] → [issues/001-slug.md](issues/001-slug.md)
      - [ ] [brief description] → [issues/002-slug.md](issues/002-slug.md)

      ## Warnings
      - [ ] [brief description] → [issues/003-slug.md](issues/003-slug.md)

      ## Informational
      - [ ] [brief description] → [issues/004-slug.md](issues/004-slug.md)

      ## Deferred
      [Items the team has decided to defer — moved here during re-validation]
      - [~] [description] — DEFERRED: [reason]

      ## Resolved
      [Items confirmed fixed during re-validation]
      - [x] [description] — RESOLVED [re-validation timestamp]
    </file>

    <file name="issues/NNN-slug.md">
      Each issue gets its own file with a zero-padded number prefix.

      # [Issue Title]

      **ID:** NNN
      **Domain:** [which check domain]
      **Severity:** BLOCKER | WARNING | INFO
      **Status:** OPEN | RESOLVED | DEFERRED

      ## Description
      [What was found, with evidence]

      ## Evidence
      [Exact command output, file:line references, or tool results]

      ## Remediation
      [Specific steps to fix this issue]

      ## Notes
      [Space for team to add triage notes during review]
      [On re-validation: resolution notes added here]
    </file>

    <naming-convention>
      Issue slugs derived from the finding:
      - 001-uncommitted-changes.md
      - 002-test-failures.md
      - 003-npm-audit-high.md
      - 004-missing-changelog.md
      - 005-todo-comments.md
      etc.
    </naming-convention>

    <acceptance-criteria>
      <criterion priority="critical">README.md has verdict and domain table</criterion>
      <criterion priority="critical">TODO.md has every issue linked to its detail file</criterion>
      <criterion priority="critical">Each finding has its own issues/NNN-slug.md</criterion>
      <criterion priority="critical">All links between TODO.md and issues/ are valid relative paths</criterion>
      <criterion priority="high">Severity correctly assigned (blockers are truly blocking)</criterion>
    </acceptance-criteria>
  </step>

  <step id="4-summary" order="last">
    <description>Display summary to user</description>

    <output>
      Show the user:
      1. The verdict (GO / NO-GO / CONDITIONAL)
      2. Blocker count and warning count
      3. The output directory path
      4. Instructions for team review and re-validation
    </output>
  </step>
</workflow>

## Additional Context

$ARGUMENTS

## Verdict Logic

<verdict-rules>
  <rule name="GO">
    Zero BLOCKER issues. Warnings may exist but are acknowledged.
  </rule>
  <rule name="NO-GO">
    One or more BLOCKER issues that must be resolved before release.
  </rule>
  <rule name="CONDITIONAL">
    No blockers remain, but unresolved warnings warrant team review.
    The team may decide to GO or defer based on risk assessment.
  </rule>
</verdict-rules>

## Severity Classification

<severity-guide>
  <level name="BLOCKER">
    Would cause release failure, data loss, security incident, or broken user experience.
    Examples: test failures, security vulnerabilities, build failures, merge conflicts,
    secrets in codebase, broken dependencies.
  </level>
  <level name="WARNING">
    Won't break the release but represents risk, debt, or poor practice.
    Examples: missing docs, skipped tests, TODO comments, outdated deps,
    lint warnings, missing changelog entry.
  </level>
  <level name="INFO">
    Noteworthy observation that doesn't affect release readiness.
    Examples: project hygiene suggestions, optional improvements,
    tool configuration recommendations.
  </level>

  <never-a-blocker>
    The following are NORMAL pre-release states and must NEVER be classified as BLOCKER or WARNING:
    - Unreleased commits existing since the last tag (these are the changes about to be released)
    - Version in manifest matching the LAST release (bump happens during the release process)
    - A development branch being ahead of main/master (merge is part of the release process)
    - CHANGELOG having an [Unreleased] section with pending entries
    These should be reported as INFO at most, summarizing what will be included in the release.
  </never-a-blocker>
</severity-guide>

## Constraints

<constraints>
  <constraint priority="critical">
    This is a READ-ONLY audit. Do NOT modify any project files.
    Only write to the scratch/verify-release-* output directory.
  </constraint>

  <constraint priority="critical">
    Be honest about what you CANNOT check. If a tool isn't available
    or a check would require external access, note it as SKIPPED with reason.
  </constraint>

  <constraint priority="critical">
    On re-validation: preserve team notes and DEFERRED statuses from prior issues.
    Never discard human-written notes in issue files.
  </constraint>

  <constraint priority="high">
    Use the project's own documented commands. If CLAUDE.md says "npm test" or
    README says "make check", use those — don't guess alternative commands.
    Fall back to file scanning only for things the docs don't cover.
    Don't run npm audit on a Python project. Discovery drives the check plan.
  </constraint>

  <constraint priority="high">
    Every issue in TODO.md MUST link to a corresponding issues/NNN-slug.md file.
    Every issues/ file MUST include remediation steps, not just a description.
  </constraint>
</constraints>
