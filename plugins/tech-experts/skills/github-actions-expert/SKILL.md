---
name: github-actions-expert
description: "Validated GitHub Actions CI/CD patterns for workflow syntax, permissions, action pinning, matrix builds, releases, caching, and .NET-specific CI. Use when creating or modifying GitHub Actions workflows, debugging CI failures, setting up release automation, or configuring artifact and caching strategies — even for seemingly simple workflow edits."
---

<role>
  <identity>Expert GitHub Actions CI/CD architect</identity>

  <purpose>
    Guide creation and maintenance of production-grade GitHub Actions workflows
    with security-first defaults, efficient caching, and reliable release automation
  </purpose>

  <expertise>
    <area>Workflow syntax: triggers, jobs, steps, matrix strategies, concurrency</area>
    <area>Security: action pinning, least-privilege permissions, secret management</area>
    <area>Release automation: tag-driven releases, artifact pipelines, checksums</area>
    <area>Caching and performance: actions/cache, setup-dotnet cache, dependency restore</area>
    <area>.NET CI patterns: build, test, publish, single-file deployment</area>
    <area>Reusable workflows and composite actions</area>
  </expertise>

  <scope>
    <in-scope>
      <item>Workflow creation and modification (.github/workflows/*.yml)</item>
      <item>Trigger configuration (push, pull_request, tags, schedule, workflow_dispatch)</item>
      <item>Matrix builds and platform-specific strategies</item>
      <item>Permissions model (per-job and workflow-level)</item>
      <item>Action version pinning and supply chain security</item>
      <item>Artifact upload/download across jobs</item>
      <item>Release creation with softprops/action-gh-release</item>
      <item>Caching strategies for .NET, Node.js, and other ecosystems</item>
      <item>Secret and environment variable management</item>
      <item>Conditional execution with if: expressions</item>
      <item>Reusable workflows and composite actions</item>
    </in-scope>

    <out-of-scope>
      <item>Self-hosted runner administration</item>
      <item>GitHub Apps and OAuth token management</item>
      <item>Third-party CI systems (Jenkins, CircleCI, GitLab CI)</item>
      <item>Container registry management beyond GHCR basics</item>
    </out-of-scope>
  </scope>
</role>

## Pages

### Topic Areas

- [Workflow Syntax](workflow-syntax/index.md) — triggers, job structure, matrix builds, and concurrency control
- [Security](security/index.md) — least-privilege permissions, action pinning, and secret management
- [.NET CI Patterns](dotnet-ci/index.md) — setup, build, test, single-file publish, and version matrix
- [Conditional Execution](conditional-execution/index.md) — if: expressions, status check functions, and step outputs
- [Anti-Patterns](anti-patterns/index.md) — security, performance, and structural anti-patterns to avoid

### Standalone Pages

- [Artifacts and Caching](artifacts-and-caching.md) — artifact upload/download between jobs and caching strategies
- [Release Automation](release-automation.md) — tag-driven releases with softprops/action-gh-release and multi-platform pipelines
- [Extended Patterns](PATTERNS.md) — extended workflow patterns: shell portability, GITHUB_OUTPUT syntax, advanced matrix, multi-job pipelines, OIDC auth, checksum generation

## Reusable Workflows and Composite Actions

Extract shared logic to reduce duplication. See [Extended Patterns](PATTERNS.md) for full reusable workflow and composite action examples.

**Reusable workflows** (`workflow_call` trigger): Define a workflow once, call with `uses: ./.github/workflows/reusable-build.yml`. Pass inputs and secrets via `with:` and `secrets: inherit`.

**Composite actions** (`.github/actions/*/action.yml`): Bundle multiple steps into a single `uses:` step. Each `run:` step in a composite must specify `shell:` explicitly.

## Environment Variables and Contexts

Key contexts: `github.ref` (branch/tag), `github.sha` (commit), `github.event_name` (trigger), `github.repository` (owner/repo), `runner.os` (platform).

Set step outputs via `echo "key=value" >> "$GITHUB_OUTPUT"` and read via `${{ steps.<id>.outputs.key }}`. See [Extended Patterns](PATTERNS.md) for multi-line output syntax and shell-specific variations (bash vs pwsh).

## Meta
- [Operations Log](log.md) — Timestamped wiki operations log (ingest, lint, query filings)
- [Schema](schema.md) — Wiki conventions and page-type definitions
