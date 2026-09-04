---
tags: [google-sheets-expert/nuget]
summary: "NuGet package references for Google Sheets API v4 with version pinning guidance"
---

# NuGet Packages

Install these three packages. They share a version line (currently 1.73.x):

```xml
<PackageReference Include="Google.Apis.Sheets.v4" Version="1.73.0.4061" />
<PackageReference Include="Google.Apis.Auth" Version="1.73.0" />
<PackageReference Include="Google.Apis" Version="1.73.0" />
```

`Google.Apis.Sheets.v4` transitively pulls in `Google.Apis` and `Google.Apis.Auth`, so a single reference often suffices. Pin explicit versions in production to avoid surprise upgrades.

**Target framework**: .NET 6.0+, .NET Standard 2.0, .NET Framework 4.6.2+.
