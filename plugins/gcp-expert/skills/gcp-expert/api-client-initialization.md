---
tags: [gcp-expert/sheets]
summary: Initializing Google API service clients in .NET — SheetsService setup, reading spreadsheets, and writing to spreadsheets.
---

# API Client Initialization

## SheetsService Setup

```csharp
var sheetsService = new SheetsService(new BaseClientService.Initializer
{
    HttpClientInitializer = credential,
    ApplicationName = "my-app"
});
```

Key properties of `BaseClientService.Initializer`:
- `HttpClientInitializer` — the `GoogleCredential` (implements `IConfigurableHttpClientInitializer`)
- `ApplicationName` — identifies your app in API logs and quota tracking

## Reading a Spreadsheet

```csharp
var request = sheetsService.Spreadsheets.Values.Get(spreadsheetId, "Sheet1!A1:D10");
ValueRange response = await request.ExecuteAsync(cancellationToken);
IList<IList<object>> values = response.Values;
```

## Writing to a Spreadsheet

```csharp
var valueRange = new ValueRange { Values = new List<IList<object>> { row } };
var request = sheetsService.Spreadsheets.Values.Update(valueRange, spreadsheetId, "Sheet1!A1");
request.ValueInputOption = SpreadsheetsResource.ValuesResource.UpdateRequest.ValueInputOptionEnum.USERENTERED;
await request.ExecuteAsync(cancellationToken);
```
