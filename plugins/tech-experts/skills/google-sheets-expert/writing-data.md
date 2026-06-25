---
tags: [google-sheets-expert/writing]
summary: "Writing spreadsheet data: single range update, batch write, append rows, and ValueInputOption"
---

# Writing Data

## Single Range Update

```csharp
var valueRange = new ValueRange
{
    Values = new List<IList<object>>
    {
        new List<object> { "Name", "Amount", "Date" },
        new List<object> { "Rent", 1500.00, "2025-01-01" }
    }
};

var request = service.Spreadsheets.Values.Update(
    valueRange, spreadsheetId, "Sheet1!A1:C2");
request.ValueInputOption = SpreadsheetsResource.ValuesResource.UpdateRequest
    .ValueInputOptionEnum.USERENTERED;

UpdateValuesResponse response = await request.ExecuteAsync(cancellationToken);
```

## Batch Write (multiple ranges, single HTTP call)

```csharp
var batchRequest = new BatchUpdateValuesRequest
{
    ValueInputOption = "USER_ENTERED",
    Data = new List<ValueRange>
    {
        new ValueRange
        {
            Range = "Sheet1!A1:C1",
            Values = new List<IList<object>>
            {
                new List<object> { "Name", "Amount", "Date" }
            }
        },
        new ValueRange
        {
            Range = "Sheet2!A1:B1",
            Values = new List<IList<object>>
            {
                new List<object> { "Category", "Total" }
            }
        }
    }
};

var request = service.Spreadsheets.Values.BatchUpdate(batchRequest, spreadsheetId);
BatchUpdateValuesResponse response = await request.ExecuteAsync(cancellationToken);
```

## Append Rows

```csharp
var valueRange = new ValueRange
{
    Values = new List<IList<object>>
    {
        new List<object> { "New Entry", 250.00, "2025-03-15" }
    }
};

var request = service.Spreadsheets.Values.Append(
    valueRange, spreadsheetId, "Sheet1!A:C");
request.ValueInputOption = SpreadsheetsResource.ValuesResource.AppendRequest
    .ValueInputOptionEnum.USERENTERED;
request.InsertDataOption = SpreadsheetsResource.ValuesResource.AppendRequest
    .InsertDataOptionEnum.INSERTROWS;

AppendValuesResponse response = await request.ExecuteAsync(cancellationToken);
```

## ValueInputOption

| Option | Behavior | Use When |
|--------|----------|----------|
| `RAW` | Values stored as-is (strings) | Preserving exact text: ZIP codes, product codes, IDs |
| `USER_ENTERED` | Parsed as if typed into UI (numbers, dates, formulas evaluated) | Most cases: financial data, formulas, dates |

Default to `USER_ENTERED` unless you need verbatim string storage.

**Gotcha:** `ValueInputOption` is required on `Update` and `BatchUpdate` — there is no default. See [Common Gotchas](common-gotchas.md) for this and other write pitfalls.
