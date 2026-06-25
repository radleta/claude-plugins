---
tags: [gcp-expert/sheets]
summary: Minimal Google Sheets API setup in .NET — four-step pattern covering package install, credential loading, service creation, and data read.
---

# Quick Reference: Minimal Sheets API Setup

```csharp
// 1. Install packages
// dotnet add package Google.Apis.Sheets.v4
// dotnet add package Google.Apis.Auth

// 2. Load credential
var credential = GoogleCredential
    .FromFile("service-account.json")
    .CreateScoped(SheetsService.Scope.SpreadsheetsReadonly);

// 3. Create service
var service = new SheetsService(new BaseClientService.Initializer
{
    HttpClientInitializer = credential,
    ApplicationName = "my-app"
});

// 4. Read data
var response = await service.Spreadsheets.Values
    .Get("SPREADSHEET_ID", "Sheet1!A1:Z")
    .ExecuteAsync();
```
