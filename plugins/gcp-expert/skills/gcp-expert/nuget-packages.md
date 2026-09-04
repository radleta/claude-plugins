---
tags: [gcp-expert/nuget]
summary: NuGet packages required for Google Cloud Platform .NET/C# integration including auth, base types, Sheets, and Drive clients.
---

# NuGet Packages

| Package | Purpose | Install |
|---------|---------|---------|
| `Google.Apis.Auth` | Core auth: `GoogleCredential`, `ServiceAccountCredential`, ADC | `dotnet add package Google.Apis.Auth` |
| `Google.Apis` | Base types: `BaseClientService.Initializer`, `ExponentialBackOff` | `dotnet add package Google.Apis` |
| `Google.Apis.Sheets.v4` | Sheets API client (`SheetsService`) | `dotnet add package Google.Apis.Sheets.v4` |
| `Google.Apis.Drive.v3` | Drive API client (sharing, permissions) | `dotnet add package Google.Apis.Drive.v3` |

All packages target .NET Standard 2.0+ and .NET 6+. The `Google.Apis.Sheets.v4` package is in maintenance mode but fully supported.
