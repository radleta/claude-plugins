---
tags: [github-actions-expert/release]
summary: "Tag-driven releases with softprops/action-gh-release, multi-platform artifact pipelines, and checksum generation"
---

# Release Automation

## Tag-Driven Releases with softprops/action-gh-release

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

## Multi-Platform Release Pipeline

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
      - uses: softprops/action-gh-release@c95fe4860a8d12e4d48a897133e40baa5b7b0e7e # v2.2.1
        with:
          files: |
            ./artifacts/**/*.exe
            ./artifacts/**/*.tar.gz
            ./artifacts/SHA256SUMS.txt
```

See [PATTERNS.md](PATTERNS.md) for cross-platform checksum generation patterns per shell (bash `sha256sum` vs PowerShell `Get-FileHash`).
