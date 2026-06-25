---
tags: [google-sheets-expert/gotchas]
summary: "Common pitfalls: object typing, trimmed trailing rows, indexing mismatches, jagged rows, and write requirements"
---

# Common Gotchas

## 1. All values arrive as `object` (typically `string` or `double`)

The API returns `IList<IList<object>>`. Values are either `string` or numeric types depending on `ValueRenderOption`. Parse explicitly:

```csharp
// With UNFORMATTED_VALUE, numbers come as double/long
decimal amount = Convert.ToDecimal(row[1]);

// With SERIAL_NUMBER, dates come as double
double serial = Convert.ToDouble(row[2]);
DateTime date = DateTime.FromOADate(serial);  // OLE Automation date = Sheets serial
```

`DateTime.FromOADate()` correctly converts Google Sheets serial numbers because both use the same epoch (Dec 30, 1899).

## 2. Empty trailing rows and columns are trimmed

The API silently strips trailing empty rows and columns from responses. A range `A1:D10` may return only 7 rows if rows 8-10 are empty. Always check `response.Values?.Count` and handle `null` (entirely empty range returns `null` for `Values`).

## 3. Row/column indexing mismatch

- **A1 notation**: 1-indexed rows, letter-indexed columns (`A1` = row 1, col A).
- **GridRange** (used in formatting/structural requests): 0-indexed for both `StartRowIndex` and `StartColumnIndex`.
- **SheetId**: 0-based but non-sequential. The first sheet is typically `SheetId = 0`, but new sheets get auto-assigned IDs that are not sequential.

## 4. Short rows in jagged data

If row 1 has values in columns A-D but row 2 only has values in A-B, the returned `IList<object>` for row 2 has only 2 elements, not 4. Always check the count before indexing:

```csharp
object GetCell(IList<object> row, int colIndex)
{
    return colIndex < row.Count ? row[colIndex] : null;
}
```

## 5. Sheet name quoting in ranges

Sheet names with spaces or special characters must be single-quoted in A1 notation: `'My Sheet'!A1:B5`. Forgetting quotes causes `400 Bad Request`. See [A1 Notation Reference](a1-notation.md).

## 6. ValueInputOption is required on writes

`Update` and `BatchUpdate` for values fail if `ValueInputOption` is not set. There is no default. See [Writing Data](writing-data.md).

## 7. Formula locale sensitivity with USER_ENTERED

When using `USER_ENTERED`, the API parses formulas using the spreadsheet's locale. Function names and argument separators may differ (e.g., `SOMME` vs `SUM`, semicolons vs commas). Use `RAW` if writing pre-computed values to avoid locale parsing surprises.
