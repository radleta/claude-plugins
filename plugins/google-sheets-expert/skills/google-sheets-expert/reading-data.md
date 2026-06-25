---
tags: [google-sheets-expert/reading]
summary: "Reading spreadsheet data via ValuesResource: single range, batch read, and render options"
---

# Reading Data

## Single Range

```csharp
var request = service.Spreadsheets.Values.Get(spreadsheetId, "Sheet1!A1:D10");
request.ValueRenderOption = SpreadsheetsResource.ValuesResource.GetRequest
    .ValueRenderOptionEnum.UNFORMATTEDVALUE;
request.DateTimeRenderOption = SpreadsheetsResource.ValuesResource.GetRequest
    .DateTimeRenderOptionEnum.SERIALNUMBER;

ValueRange response = await request.ExecuteAsync(cancellationToken);
IList<IList<object>> rows = response.Values;
```

## Batch Read (multiple ranges, single HTTP call)

```csharp
var request = service.Spreadsheets.Values.BatchGet(spreadsheetId);
request.Ranges = new List<string> { "Sheet1!A1:D10", "Sheet2!A1:B5" };
request.ValueRenderOption = SpreadsheetsResource.ValuesResource.BatchGetRequest
    .ValueRenderOptionEnum.UNFORMATTEDVALUE;

BatchGetValuesResponse response = await request.ExecuteAsync(cancellationToken);
foreach (var valueRange in response.ValueRanges)
{
    // valueRange.Range, valueRange.Values
}
```

Prefer `BatchGet` over multiple `Get` calls to reduce quota consumption.

## Value Render Options

| Option | Behavior | Use When |
|--------|----------|----------|
| `FORMATTED_VALUE` | Returns display string (e.g., "$1,234.56") | Human-readable output |
| `UNFORMATTED_VALUE` | Returns raw typed value (number, bool) | Data processing and calculations |
| `FORMULA` | Returns formula text (e.g., "=SUM(A1:A10)") | Copying formulas between sheets |

## DateTime Render Options

| Option | Behavior | Example |
|--------|----------|---------|
| `SERIAL_NUMBER` | Lotus 1-2-3 serial number (days since Dec 30, 1899) | `44927` for Jan 1, 2023 |
| `FORMATTED_STRING` | Locale-formatted string | `"1/1/2023"` |

`SERIAL_NUMBER` is the default. Ignored when `ValueRenderOption` is `FORMATTED_VALUE`.

See [Common Gotchas](common-gotchas.md) for type conversion pitfalls (jagged rows, null Values, date serial numbers).
