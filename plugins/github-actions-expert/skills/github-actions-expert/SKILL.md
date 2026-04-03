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

## Workflow Syntax Fundamentals

### Trigger Configuration

Configure `on:` with the minimum required events. Avoid overly broad triggers that waste runner minutes.

```yaml
# PR validation — runs on PR open/update targeting main or develop
on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, develop]

# Tag-driven release — runs only on version tags
on:
  push:
    tags: ["v*"]

# Scheduled workflow
on:
  schedule:
    - cron: "0 6 * * 1"  # Monday 6 AM UTC

# Manual trigger with inputs
on:
  workflow_dispatch:
    inputs:
      environment:
        type: choice
        options: [staging, production]
```

Use `paths:` and `paths-ignore:` filters to skip CI on docs-only changes:

```yaml
on:
  push:
    branches: [main]
    paths-ignore:
      - "**.md"
      - "docs/**"
```

### Job Structure and Dependencies

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # ... build steps

  test:
    needs: build          # explicit dependency
    runs-on: ubuntu-latest

  deploy:
    needs: [build, test]  # fan-in from multiple jobs
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
```

### Matrix Builds

Use `strategy.matrix` to run jobs across multiple configurations. Use `fail-fast: false` when all variants must complete regardless of individual failures.

```yaml
strategy:
  fail-fast: false
  matrix:
    rid: [win-x64, win-arm64]
    # Or multi-dimensional:
    os: [ubuntu-latest, windows-latest]
    dotnet: ["8.0.x", "9.0.x"]
    exclude:
      - os: windows-latest
        dotnet: "8.0.x"
```

Access matrix values via `${{ matrix.rid }}` in steps.

### Concurrency Control

Prevent duplicate runs for the same branch/PR:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true  # cancel older runs when new push arrives
```

## Security: Permissions Model

### Principle of Least Privilege

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

### Action Pinning

Pin third-party actions to full SHA for supply chain security. Tag references (e.g., `@v4`) are mutable and can be redirected.

```yaml
# Secure: SHA-pinned with version comment
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
- uses: softprops/action-gh-release@c95fe4860a8d12e4d48a897133e40baa5b7b0e7e # v2.2.1

# Acceptable for first-party (actions/*) only: tag reference
- uses: actions/checkout@v4

# AVOID: unpinned or branch references
- uses: some-org/some-action@main     # mutable, insecure
- uses: some-org/some-action@v1       # major tag, can change
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

### Secret Management

```yaml
# Reference secrets — never echo or log them
env:
  API_KEY: ${{ secrets.API_KEY }}

# Step-level secrets (preferred — narrower scope)
steps:
  - name: Deploy
    env:
      DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
    run: deploy --token "$DEPLOY_TOKEN"
```

Secrets are automatically masked in logs, but avoid patterns that could leak them:
- Never use `toJSON(secrets)` — dumps all secrets
- Avoid piping secrets through commands that might echo (`set -x`, `echo`, `tee`)
- Use `add-mask` for dynamically generated sensitive values

## Artifacts and Caching

### Artifact Upload/Download

Artifacts transfer files between jobs within a workflow run.

```yaml
# Job 1: Upload
- uses: actions/upload-artifact@v4
  with:
    name: build-output-${{ matrix.rid }}
    path: ./publish/${{ matrix.rid }}/
    retention-days: 5  # default: 90, reduce to save storage

# Job 2: Download (in a job with needs: [job1])
- uses: actions/download-artifact@v4
  with:
    name: build-output-${{ matrix.rid }}
    path: ./artifacts

# Download ALL artifacts at once
- uses: actions/download-artifact@v4
  with:
    path: ./artifacts    # each artifact in its own subdirectory
```

Use unique artifact names when uploading from matrix jobs — duplicate names cause failures.

### Caching

```yaml
# Explicit cache (any ecosystem)
- uses: actions/cache@v4
  with:
    path: ~/.nuget/packages
    key: nuget-${{ runner.os }}-${{ hashFiles('**/*.csproj') }}
    restore-keys: |
      nuget-${{ runner.os }}-

# Built-in cache with setup-dotnet (simpler)
- uses: actions/setup-dotnet@v4
  with:
    dotnet-version: "9.0.x"
    cache: true                    # caches NuGet packages automatically
    cache-dependency-path: "**/*.csproj"
```

Cache key strategies:
- Include `runner.os` to avoid cross-platform cache hits
- Use `hashFiles()` on lock files or project files for cache invalidation
- Provide `restore-keys` for partial cache hits (prefix matching)
- Cache size limit: 10 GB per repository

## Release Automation

### Tag-Driven Releases with softprops/action-gh-release

```yaml
on:
  push:
    tags: ["v*"]

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: softprops/action-gh-release@c95fe4860a8d12e4d48a897133e40baa5b7b0e7e # v2.2.1
        with:
          generate_release_notes: true    # auto-generate from commits
          files: |
            ./artifacts/*.exe
            ./artifacts/SHA256SUMS.txt
          draft: false
          prerelease: ${{ contains(github.ref, '-rc') || contains(github.ref, '-beta') }}
```

**Common patterns:**
- Separate build job (with matrix) from release job (single, `needs: build`)
- Generate SHA256 checksums for all release binaries
- Use `generate_release_notes: true` for automatic changelogs from commits/PRs
- Mark pre-releases based on tag naming conventions (`-rc`, `-beta`)

### Multi-Platform Release Pipeline

```yaml
jobs:
  build:
    strategy:
      matrix:
        rid: [win-x64, win-arm64, linux-x64]
    steps:
      # ... build per platform, upload artifacts with unique names

  release:
    needs: build
    permissions:
      contents: write
    steps:
      - uses: actions/download-artifact@v4
        with:
          path: ./artifacts
      # Merge checksums from all platforms
      - run: cat ./artifacts/*/SHA256SUMS.txt > ./artifacts/SHA256SUMS.txt
      - uses: softprops/action-gh-release@SHA
        with:
          files: |
            ./artifacts/**/*.exe
            ./artifacts/**/*.tar.gz
            ./artifacts/SHA256SUMS.txt
```

## .NET CI Patterns

### Setup and Build

```yaml
- uses: actions/setup-dotnet@v4
  with:
    dotnet-version: "9.0.x"
    # For preview SDKs:
    dotnet-quality: "preview"

- name: Restore
  run: dotnet restore

- name: Build
  run: dotnet build --no-restore --configuration Release /p:TreatWarningsAsErrors=true

- name: Test
  run: dotnet test --no-build --configuration Release --verbosity normal
```

Use `--no-restore` on build (after explicit restore) and `--no-build` on test (after explicit build) to avoid redundant work.

### Single-File Publish

```yaml
- name: Publish
  run: |
    dotnet publish src/MyApp/MyApp.csproj \
      --configuration Release \
      --runtime ${{ matrix.rid }} \
      --self-contained true \
      -p:PublishSingleFile=true \
      -p:IncludeNativeLibrariesForSelfExtract=true \
      --output ./publish/${{ matrix.rid }}
```

### .NET Version Matrix

```yaml
strategy:
  matrix:
    dotnet: ["8.0.x", "9.0.x"]
steps:
  - uses: actions/setup-dotnet@v4
    with:
      dotnet-version: ${{ matrix.dotnet }}
```

## Conditional Execution

### if: Expressions

```yaml
# Run only on main branch
- if: github.ref == 'refs/heads/main'

# Run only when PR merged (not just closed)
- if: github.event.pull_request.merged == true

# Run only for specific event
- if: github.event_name == 'push'

# Combine conditions
- if: github.ref == 'refs/heads/main' && github.event_name == 'push'
```

### Status Check Functions

```yaml
# Run even if previous steps failed (cleanup, notifications)
- if: always()

# Run only if a previous step failed
- if: failure()

# Run only if workflow was cancelled
- if: cancelled()

# Run only if all previous steps succeeded (default behavior)
- if: success()
```

### Step Outputs and Conditionals

```yaml
- name: Parse tag
  id: tag
  run: |
    TAG="${GITHUB_REF#refs/tags/}"
    echo "version=${TAG#v}" >> "$GITHUB_OUTPUT"

- name: Use output
  run: echo "Deploying version ${{ steps.tag.outputs.version }}"
```

## Reusable Workflows and Composite Actions

Extract shared logic to reduce duplication. See [PATTERNS.md](PATTERNS.md) for full reusable workflow and composite action examples.

**Reusable workflows** (`workflow_call` trigger): Define a workflow once, call with `uses: ./.github/workflows/reusable-build.yml`. Pass inputs and secrets via `with:` and `secrets: inherit`.

**Composite actions** (`.github/actions/*/action.yml`): Bundle multiple steps into a single `uses:` step. Each `run:` step in a composite must specify `shell:` explicitly.

## Anti-Patterns and Common Mistakes

### Security Anti-Patterns

| Anti-Pattern | Risk | Fix |
|---|---|---|
| `uses: org/action@main` | Mutable ref, supply chain attack | Pin to full SHA with version comment |
| `permissions: write-all` | Overly broad token scope | Declare minimum per-job permissions |
| `echo "${{ secrets.TOKEN }}"` | Secret leaked in logs | Use env vars, never echo directly |
| `toJSON(secrets)` in logs | Dumps ALL secrets | Remove entirely |
| Workflow triggered by `pull_request_target` with checkout of PR head | Allows PRs to run arbitrary code with write permissions | Use `pull_request` trigger, or validate PR source carefully |

### Performance Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| No caching | Slow builds, wasted minutes | Add cache for package manager |
| Redundant restore/build | Double compilation | Chain `--no-restore` and `--no-build` |
| Missing `paths-ignore` | CI runs on docs changes | Filter out non-code paths |
| Missing `concurrency` | Duplicate runs pile up | Add concurrency group with cancel-in-progress |
| Large artifacts with long retention | Storage costs | Set `retention-days` explicitly |

### Structural Anti-Patterns

| Anti-Pattern | Problem | Fix |
|---|---|---|
| All logic in one job | No parallelism, slow feedback | Split build/test/deploy into separate jobs |
| Duplicate steps across workflows | Maintenance burden | Extract to reusable workflow or composite action |
| Hardcoded versions | Drift, forgotten updates | Use matrix or variables, enable Dependabot |
| Missing `fail-fast: false` on matrix | One failure cancels all | Set `fail-fast: false` when all variants matter |
| Workflow-level `permissions: write` | All jobs get write access | Scope permissions per-job |

## Environment Variables and Contexts

Key contexts: `github.ref` (branch/tag), `github.sha` (commit), `github.event_name` (trigger), `github.repository` (owner/repo), `runner.os` (platform).

Set step outputs via `echo "key=value" >> "$GITHUB_OUTPUT"` and read via `${{ steps.<id>.outputs.key }}`. See [PATTERNS.md](PATTERNS.md) for multi-line output syntax and shell-specific variations (bash vs pwsh).

## Reference

[PATTERNS.md](PATTERNS.md) - Extended workflow patterns, shell portability notes, GITHUB_OUTPUT syntax across shells, and advanced matrix techniques. Load when building complex multi-job pipelines or cross-platform workflows.
