---
tags: [github-actions-expert/artifacts]
summary: "Artifact upload/download between jobs and caching strategies for NuGet, Node.js, and other ecosystems"
---

# Artifacts and Caching

## Artifact Upload/Download

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

## Caching

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
