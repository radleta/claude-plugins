---
tags: [github-actions-expert/dotnet]
summary: "dotnet setup, restore, build with TreatWarningsAsErrors, and test steps chained with --no-restore and --no-build flags"
---

# Setup and Build

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
