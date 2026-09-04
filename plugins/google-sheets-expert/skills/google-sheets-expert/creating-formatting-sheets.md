---
tags: [google-sheets-expert/formatting]
summary: "Structural operations via spreadsheets.batchUpdate: add/delete sheets, format cells, request types"
---

# Creating and Formatting Sheets

Use `spreadsheets.batchUpdate` (not the values variant) for structural operations.

## Add a New Sheet

```csharp
var addSheetRequest = new Request
{
    AddSheet = new AddSheetRequest
    {
        Properties = new SheetProperties
        {
            Title = "Summary",
            GridProperties = new GridProperties
            {
                RowCount = 100,
                ColumnCount = 20
            }
        }
    }
};

var batchUpdate = new BatchUpdateSpreadsheetRequest
{
    Requests = new List<Request> { addSheetRequest }
};

var request = service.Spreadsheets.BatchUpdate(batchUpdate, spreadsheetId);
BatchUpdateSpreadsheetResponse response = await request.ExecuteAsync(cancellationToken);

// New sheet ID from the response
int newSheetId = response.Replies[0].AddSheet.Properties.SheetId.Value;
```

## Format Cells (bold header row)

```csharp
var formatRequest = new Request
{
    RepeatCell = new RepeatCellRequest
    {
        Range = new GridRange
        {
            SheetId = sheetId,
            StartRowIndex = 0,
            EndRowIndex = 1  // first row only
        },
        Cell = new CellData
        {
            UserEnteredFormat = new CellFormat
            {
                TextFormat = new TextFormat { Bold = true },
                BackgroundColor = new Color
                {
                    Red = 0.9f, Green = 0.9f, Blue = 0.9f
                }
            }
        },
        Fields = "userEnteredFormat(textFormat,backgroundColor)"
    }
};

var batchUpdate = new BatchUpdateSpreadsheetRequest
{
    Requests = new List<Request> { formatRequest }
};

await service.Spreadsheets.BatchUpdate(batchUpdate, spreadsheetId)
    .ExecuteAsync(cancellationToken);
```

## Common Request Types for spreadsheets.batchUpdate

| Request | Purpose |
|---------|---------|
| `AddSheetRequest` | Create a new tab |
| `DeleteSheetRequest` | Remove a tab |
| `UpdateSheetPropertiesRequest` | Rename, resize, freeze rows/cols |
| `RepeatCellRequest` | Apply formatting to a range |
| `AutoResizeDimensionsRequest` | Auto-fit column widths |
| `MergeCellsRequest` | Merge cell ranges |
| `UpdateBordersRequest` | Add/modify cell borders |
| `AddConditionalFormatRuleRequest` | Conditional formatting |
| `SetDataValidationRequest` | Add dropdown / validation |
| `SortRangeRequest` | Sort data within a range |

Bundle multiple requests in a single `BatchUpdateSpreadsheetRequest` to minimize API calls.

See [Common Gotchas](common-gotchas.md) for the GridRange 0-indexed row/column indexing vs A1 notation 1-indexed mismatch.
