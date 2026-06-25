---
tags: [google-sheets-expert/migration]
summary: "Migration patterns from ClosedXML local xlsx to Google Sheets API including interface abstraction"
---

# Migration Patterns: ClosedXML to Google Sheets

When adding Google Sheets as an alternative backend alongside local xlsx/ClosedXML:

| ClosedXML Concept | Google Sheets Equivalent |
|-------------------|--------------------------|
| `new XLWorkbook(path)` | `service.Spreadsheets.Get(spreadsheetId)` |
| `workbook.Worksheets` | `spreadsheet.Sheets` (from metadata GET) |
| `worksheet.Cell(row, col).Value` | `Values.Get()` with A1 range |
| `worksheet.Cell(row, col).SetValue()` | `Values.Update()` with `ValueRange` |
| `worksheet.Range("A1:D10")` | A1 notation string `"Sheet1!A1:D10"` |
| `cell.GetDateTime()` | Parse serial number via `DateTime.FromOADate()` |
| `cell.GetDouble()` | Cast `object` to `double` from `UNFORMATTED_VALUE` |
| `workbook.SaveAs(path)` | Writes are immediate (no save step) |
| Local file I/O | HTTP API calls (async, rate-limited) |

**Architecture recommendation:** Define an `ISpreadsheetReader` / `ISpreadsheetWriter` interface that both ClosedXML and Google Sheets implementations satisfy. This allows the CLI to switch backends via configuration without changing domain logic.

```csharp
public interface ISpreadsheetReader
{
    Task<IReadOnlyList<string>> GetSheetNamesAsync(CancellationToken ct);
    Task<IReadOnlyList<IReadOnlyList<object?>>> ReadRangeAsync(
        string sheetName, string range, CancellationToken ct);
}
```
