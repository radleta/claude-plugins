# Extended GitHub Actions Patterns

## Shell Portability

GitHub Actions runs `bash` on Linux/macOS and `pwsh` on Windows by default. Explicitly set `shell:` when portability matters.

```yaml
# Force bash on all platforms (including Windows, where Git Bash is available)
- run: echo "hello"
  shell: bash

# Force PowerShell on Windows
- run: Get-ChildItem
  shell: pwsh
```

### GITHUB_OUTPUT Syntax by Shell

```bash
# bash / sh
echo "key=value" >> "$GITHUB_OUTPUT"

# Multi-line in bash
{
  echo "body<<EOF"
  cat NOTES.md
  echo "EOF"
} >> "$GITHUB_OUTPUT"
```

```powershell
# pwsh
"key=value" | Out-File -FilePath $env:GITHUB_OUTPUT -Append -Encoding utf8

# Multi-line in pwsh
@"
body<<EOF
$(Get-Content NOTES.md -Raw)
EOF
"@ | Out-File -FilePath $env:GITHUB_OUTPUT -Append -Encoding utf8
```

### Line Continuation

```yaml
# bash: use backslash
- run: |
    dotnet publish src/App/App.csproj \
      --configuration Release \
      --runtime ${{ matrix.rid }}
  shell: bash

# pwsh: use backtick
- run: |
    dotnet publish src/App/App.csproj `
      --configuration Release `
      --runtime ${{ matrix.rid }}
  shell: pwsh
```

## Advanced Matrix Strategies

### Include/Exclude

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest]
    dotnet: ["8.0.x", "9.0.x"]
    include:
      # Add a specific combination with extra variables
      - os: ubuntu-latest
        dotnet: "10.0.x"
        dotnet-quality: preview
    exclude:
      # Remove a specific combination
      - os: windows-latest
        dotnet: "8.0.x"
```

### Dynamic Matrix from JSON

```yaml
jobs:
  prepare:
    outputs:
      matrix: ${{ steps.set-matrix.outputs.matrix }}
    steps:
      - id: set-matrix
        run: |
          echo 'matrix={"rid":["win-x64","win-arm64","linux-x64"]}' >> "$GITHUB_OUTPUT"

  build:
    needs: prepare
    strategy:
      matrix: ${{ fromJSON(needs.prepare.outputs.matrix) }}
```

## Multi-Job Pipelines

### Build-Test-Release Pattern

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: dotnet build
      - uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: ./bin/

  test:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: build-output
          path: ./bin/
      - run: dotnet test --no-build

  release:
    needs: [build, test]
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/download-artifact@v4
        with:
          path: ./artifacts
      - uses: softprops/action-gh-release@SHA
        with:
          files: ./artifacts/**/*
```

### Cross-Platform Build with Single Release

```yaml
jobs:
  build:
    strategy:
      matrix:
        include:
          - os: windows-latest
            rid: win-x64
          - os: ubuntu-latest
            rid: linux-x64
          - os: macos-latest
            rid: osx-arm64
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: "9.0.x"
      - run: dotnet publish -c Release -r ${{ matrix.rid }} --self-contained
      - uses: actions/upload-artifact@v4
        with:
          name: app-${{ matrix.rid }}
          path: ./publish/

  release:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/download-artifact@v4
        with:
          path: ./artifacts
      - run: |
          for dir in ./artifacts/*/; do
            (cd "$dir" && sha256sum * >> ../SHA256SUMS.txt)
          done
      - uses: softprops/action-gh-release@SHA
        with:
          generate_release_notes: true
          files: |
            ./artifacts/**/*
            ./artifacts/SHA256SUMS.txt
```

## Reusable Workflow Patterns

### Caller-Callee with Secrets

```yaml
# Reusable workflow (.github/workflows/deploy.yml)
on:
  workflow_call:
    inputs:
      environment:
        type: string
        required: true
    secrets:
      deploy-key:
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    steps:
      - run: deploy --key "${{ secrets.deploy-key }}"
```

```yaml
# Caller
jobs:
  deploy-staging:
    uses: ./.github/workflows/deploy.yml
    with:
      environment: staging
    secrets:
      deploy-key: ${{ secrets.STAGING_DEPLOY_KEY }}
```

### Workflow Outputs

```yaml
# Reusable workflow with outputs
on:
  workflow_call:
    outputs:
      version:
        value: ${{ jobs.build.outputs.version }}

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.ver.outputs.version }}
    steps:
      - id: ver
        run: echo "version=1.2.3" >> "$GITHUB_OUTPUT"
```

## OIDC Authentication (Secretless Cloud Auth)

Replace long-lived cloud credentials with short-lived OIDC tokens:

```yaml
jobs:
  deploy:
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789:role/github-actions
          aws-region: us-east-1
      # No AWS_ACCESS_KEY_ID secret needed
```

## Path-Based Workflow Triggering

Run different workflows based on which files changed:

```yaml
on:
  push:
    paths:
      - "src/**"
      - "tests/**"
      - "*.csproj"
    paths-ignore:
      - "**.md"
      - ".github/**"
      - "docs/**"
```

## Timeout and Retry Patterns

```yaml
jobs:
  flaky-integration:
    runs-on: ubuntu-latest
    timeout-minutes: 30    # kill job if it hangs
    steps:
      - name: Run with retry
        uses: nick-fields/retry@v3
        with:
          timeout_minutes: 10
          max_attempts: 3
          command: dotnet test --filter "Category=Integration"
```

## Checksum Generation Patterns

```yaml
# Linux (sha256sum)
- run: |
    cd dist
    sha256sum *.zip > SHA256SUMS.txt

# Windows (PowerShell)
- shell: pwsh
  run: |
    $file = Get-ChildItem ./publish/*.exe
    $hash = (Get-FileHash $file.FullName -Algorithm SHA256).Hash.ToLower()
    "$hash  $($file.Name)" | Out-File -FilePath ./publish/SHA256SUMS.txt -Encoding utf8

# Cross-platform merge
- run: cat ./artifacts/*/SHA256SUMS.txt > ./artifacts/SHA256SUMS.txt
```
