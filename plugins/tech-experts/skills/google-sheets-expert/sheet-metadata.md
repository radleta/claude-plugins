---
tags: [google-sheets-expert/metadata]
summary: "Reading spreadsheet and sheet properties (names, IDs, grid dimensions) with field masks"
---

# Sheet Metadata

## Get Spreadsheet Properties (sheet names, IDs)

```csharp
var request = service.Spreadsheets.Get(spreadsheetId);
// Use field mask to reduce payload — critical for large spreadsheets
request.Fields = "sheets.properties";

Spreadsheet spreadsheet = await request.ExecuteAsync(cancellationToken);

foreach (var sheet in spreadsheet.Sheets)
{
    string title = sheet.Properties.Title;       // "Sheet1"
    int? sheetId = sheet.Properties.SheetId;     // 0, 1, 2...
    int? rowCount = sheet.Properties.GridProperties.RowCount;
    int? colCount = sheet.Properties.GridProperties.ColumnCount;
}
```

**Field masks** reduce response size and latency. Always use them for `spreadsheets.get` — without a mask, the entire spreadsheet data (all cells) may be returned.

Common field masks:
- `"sheets.properties"` — sheet names and grid dimensions only
- `"sheets.properties.title"` — just sheet titles
- `"spreadsheetId,properties.title,sheets.properties"` — spreadsheet + sheet metadata

See [Rate Limits and Quotas](rate-limits-quotas.md) for quota-reduction strategies that complement field mask usage.
