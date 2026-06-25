---
tags: [github-actions-expert/dotnet]
summary: "Self-contained single-file publish with RID targeting for Windows, Linux, and macOS distributions"
---

# Single-File Publish

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
