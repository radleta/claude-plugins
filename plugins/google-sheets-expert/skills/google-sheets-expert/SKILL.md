---
name: google-sheets-expert
description: "Google Sheets API v4 patterns for .NET/C# including service account auth, SheetsService initialization, cell read/write with ValuesResource, batch operations, sheet metadata, formatting, rate limits, and A1 notation. Use when integrating Google Sheets as a data backend, reading or writing spreadsheet data via API, authenticating with service accounts, or migrating from ClosedXML to Google Sheets — even for simple single-range reads."
---

<role>
  <identity>Expert in Google Sheets API v4 integration for .NET/C# applications</identity>

  <purpose>
    Provide accurate, current patterns for reading, writing, and managing
    Google Sheets from .NET applications using the official Google API client
    libraries, with emphasis on service account auth, batch operations,
    rate limit compliance, and type-safe data handling
  </purpose>

  <expertise>
    <area>Google.Apis.Sheets.v4 NuGet package and SheetsService initialization</area>
    <area>Service account authentication with Google.Apis.Auth</area>
    <area>Cell data reading and writing via SpreadsheetsResource.ValuesResource</area>
    <area>Batch operations and spreadsheet structure manipulation</area>
    <area>Rate limit management and exponential backoff</area>
    <area>A1 notation, value rendering, and type conversion gotchas</area>
  </expertise>

  <scope>
    <in-scope>
      <item>Google Sheets API v4 operations from C#/.NET</item>
      <item>Service account and OAuth credential patterns</item>
      <item>Reading, writing, creating, and formatting sheets</item>
      <item>Rate limit compliance and retry strategies</item>
      <item>Data type handling (dates, numbers, formulas)</item>
      <item>Migration patterns from ClosedXML local xlsx to Google Sheets</item>
    </in-scope>
    <out-of-scope>
      <item>Google Apps Script (server-side JavaScript in Sheets)</item>
      <item>Google Drive API beyond sharing/permissions for Sheets</item>
      <item>ClosedXML itself (use xlsx skill)</item>
      <item>Google Sheets UI or add-on development</item>
      <item>Other Google Workspace APIs (Docs, Slides, Calendar)</item>
    </out-of-scope>
  </scope>
</role>

---

## NuGet Packages

Install these three packages. They share a version line (currently 1.73.x):

```xml
<PackageReference Include="Google.Apis.Sheets.v4" Version="1.73.0.4061" />
<PackageReference Include="Google.Apis.Auth" Version="1.73.0" />
<PackageReference Include="Google.Apis" Version="1.73.0" />
```

`Google.Apis.Sheets.v4` transitively pulls in `Google.Apis` and `Google.Apis.Auth`, so a single reference often suffices. Pin explicit versions in production to avoid surprise upgrades.

**Target framework**: .NET 6.0+, .NET Standard 2.0, .NET Framework 4.6.2+.

---

## Authentication

### Service Account (headless CLI / server)

Service accounts are the correct choice for unattended apps. Create one in the Google Cloud Console, download the JSON key file, and share the target spreadsheet with the service account email.

```csharp
using Google.Apis.Auth.OAuth2;
using Google.Apis.Sheets.v4;
using Google.Apis.Services;

// Load credential from JSON key file
GoogleCredential credential;
using (var stream = new FileStream("service-account-key.json", FileMode.Open, FileAccess.Read))
{
    credential = GoogleCredential.FromStream(stream)
        .CreateScoped(SheetsService.Scope.Spreadsheets);
}

// Initialize service
var service = new SheetsService(new BaseClientService.Initializer
{
    HttpClientInitializer = credential,
    ApplicationName = "my-app"
});
```

**Key points:**
- `GoogleCredential.FromStream()` or `GoogleCredential.FromFile(path)` or `GoogleCredential.FromJson(jsonString)` all work.
- Call `.CreateScoped()` with the required scope. `SheetsService.Scope.Spreadsheets` grants read/write. `SheetsService.Scope.SpreadsheetsReadonly` for read-only.
- The service account has its own email (e.g., `my-sa@project.iam.gserviceaccount.com`). Share the spreadsheet with that email as Editor or Viewer.
- Never commit the JSON key file to source control.

### OAuth 2.0 User Consent (interactive)

For user-facing apps where the user authorizes access to their own sheets. Less common for CLI tools but included for completeness:

```csharp
using Google.Apis.Auth.OAuth2;
using Google.Apis.Util.Store;

var credential = await GoogleWebAuthorizationBroker.AuthorizeAsync(
    GoogleClientSecrets.FromFile("client_secrets.json").Secrets,
    new[] { SheetsService.Scope.Spreadsheets },
    "user",
    CancellationToken.None,
    new FileDataStore("token-store", true));
```

### API Key (public sheets only)

For reading publicly shared spreadsheets with no auth prompt:

```csharp
var service = new SheetsService(new BaseClientService.Initializer
{
    ApplicationName = "my-app",
    ApiKey = "AIza..."
});
```

API keys only support read operations on public sheets. Use service accounts for private or write access.

---

## Reading Data

### Single Range

```csharp
var request = service.Spreadsheets.Values.Get(spreadsheetId, "Sheet1!A1:D10");
request.ValueRenderOption = SpreadsheetsResource.ValuesResource.GetRequest
    .ValueRenderOptionEnum.UNFORMATTEDVALUE;
request.DateTimeRenderOption = SpreadsheetsResource.ValuesResource.GetRequest
    .DateTimeRenderOptionEnum.SERIALNUMBER;

ValueRange response = await request.ExecuteAsync(cancellationToken);
IList<IList<object>> rows = response.Values;
```

### Batch Read (multiple ranges, single HTTP call)

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

### Value Render Options

| Option | Behavior | Use When |
|--------|----------|----------|
| `FORMATTED_VALUE` | Returns display string (e.g., "$1,234.56") | Human-readable output |
| `UNFORMATTED_VALUE` | Returns raw typed value (number, bool) | Data processing and calculations |
| `FORMULA` | Returns formula text (e.g., "=SUM(A1:A10)") | Copying formulas between sheets |

### DateTime Render Options

| Option | Behavior | Example |
|--------|----------|---------|
| `SERIAL_NUMBER` | Lotus 1-2-3 serial number (days since Dec 30, 1899) | `44927` for Jan 1, 2023 |
| `FORMATTED_STRING` | Locale-formatted string | `"1/1/2023"` |

`SERIAL_NUMBER` is the default. Ignored when `ValueRenderOption` is `FORMATTED_VALUE`.

---

## Writing Data

### Single Range Update

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

### Batch Write (multiple ranges, single HTTP call)

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

### Append Rows

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

### ValueInputOption

| Option | Behavior | Use When |
|--------|----------|----------|
| `RAW` | Values stored as-is (strings) | Preserving exact text: ZIP codes, product codes, IDs |
| `USER_ENTERED` | Parsed as if typed into UI (numbers, dates, formulas evaluated) | Most cases: financial data, formulas, dates |

Default to `USER_ENTERED` unless you need verbatim string storage.

---

## Sheet Metadata

### Get Spreadsheet Properties (sheet names, IDs)

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

---

## Creating and Formatting Sheets

Use `spreadsheets.batchUpdate` (not the values variant) for structural operations.

### Add a New Sheet

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

### Format Cells (bold header row)

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

### Common Request Types for spreadsheets.batchUpdate

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

---

## A1 Notation Reference

| Notation | Meaning |
|----------|---------|
| `Sheet1!A1` | Single cell A1 on Sheet1 |
| `Sheet1!A1:D10` | Range A1 through D10 |
| `Sheet1!A:A` | Entire column A |
| `Sheet1!1:1` | Entire row 1 |
| `Sheet1!A1:D` | A1 to end of column D |
| `A1:D10` | Range on the first (default) sheet |
| `'My Sheet'!A1:B5` | Sheet name with spaces requires single quotes |

**Gotcha:** Sheet names containing spaces, special characters, or starting with a digit must be wrapped in single quotes.

---

## Rate Limits and Quotas

| Limit | Value |
|-------|-------|
| Read requests | 300 per minute per project |
| Write requests | 300 per minute per project |
| Requests per user | 60 per minute per user per project |
| Requests per project | 500 per 100 seconds |
| Daily limit | Unlimited (no hard cap) |

When exceeded, the API returns HTTP 429 (`Too Many Requests`).

### Exponential Backoff Strategy

```csharp
async Task<T> ExecuteWithRetry<T>(
    Func<Task<T>> operation,
    int maxRetries = 5,
    CancellationToken ct = default)
{
    for (int attempt = 0; attempt <= maxRetries; attempt++)
    {
        try
        {
            return await operation();
        }
        catch (Google.GoogleApiException ex)
            when (ex.HttpStatusCode == System.Net.HttpStatusCode.TooManyRequests
                  && attempt < maxRetries)
        {
            // Exponential backoff: 1s, 2s, 4s, 8s, 16s + jitter
            int delayMs = (1 << attempt) * 1000
                + Random.Shared.Next(0, 1000);
            await Task.Delay(delayMs, ct);
        }
    }

    throw new InvalidOperationException("Unreachable");
}
```

### Quota-Reduction Strategies

- **Batch over individual**: Use `BatchGet`/`BatchUpdate` instead of per-range calls.
- **Field masks**: Always set `request.Fields` on `spreadsheets.get` to avoid transferring entire grid data.
- **Cache metadata**: Fetch sheet names/properties once, not before every operation.
- **Coalesce writes**: Buffer cell changes in memory and flush in a single batch.
- **Respect per-user limit**: 60/min per user is the binding constraint for most apps.

---

## Common Gotchas

### 1. All values arrive as `object` (typically `string` or `double`)

The API returns `IList<IList<object>>`. Values are either `string` or numeric types depending on `ValueRenderOption`. Parse explicitly:

```csharp
// With UNFORMATTED_VALUE, numbers come as double/long
decimal amount = Convert.ToDecimal(row[1]);

// With SERIAL_NUMBER, dates come as double
double serial = Convert.ToDouble(row[2]);
DateTime date = DateTime.FromOADate(serial);  // OLE Automation date = Sheets serial
```

`DateTime.FromOADate()` correctly converts Google Sheets serial numbers because both use the same epoch (Dec 30, 1899).

### 2. Empty trailing rows and columns are trimmed

The API silently strips trailing empty rows and columns from responses. A range `A1:D10` may return only 7 rows if rows 8-10 are empty. Always check `response.Values?.Count` and handle `null` (entirely empty range returns `null` for `Values`).

### 3. Row/column indexing mismatch

- **A1 notation**: 1-indexed rows, letter-indexed columns (`A1` = row 1, col A).
- **GridRange** (used in formatting/structural requests): 0-indexed for both `StartRowIndex` and `StartColumnIndex`.
- **SheetId**: 0-based but non-sequential. The first sheet is typically `SheetId = 0`, but new sheets get auto-assigned IDs that are not sequential.

### 4. Short rows in jagged data

If row 1 has values in columns A-D but row 2 only has values in A-B, the returned `IList<object>` for row 2 has only 2 elements, not 4. Always check the count before indexing:

```csharp
object GetCell(IList<object> row, int colIndex)
{
    return colIndex < row.Count ? row[colIndex] : null;
}
```

### 5. Sheet name quoting in ranges

Sheet names with spaces or special characters must be single-quoted in A1 notation: `'My Sheet'!A1:B5`. Forgetting quotes causes `400 Bad Request`.

### 6. ValueInputOption is required on writes

`Update` and `BatchUpdate` for values fail if `ValueInputOption` is not set. There is no default.

### 7. Formula locale sensitivity with USER_ENTERED

When using `USER_ENTERED`, the API parses formulas using the spreadsheet's locale. Function names and argument separators may differ (e.g., `SOMME` vs `SUM`, semicolons vs commas). Use `RAW` if writing pre-computed values to avoid locale parsing surprises.

---

## Migration Patterns: ClosedXML to Google Sheets

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

---

## Scopes Reference

| Scope Constant | Value | Access |
|----------------|-------|--------|
| `SheetsService.Scope.Spreadsheets` | `https://www.googleapis.com/auth/spreadsheets` | Full read/write |
| `SheetsService.Scope.SpreadsheetsReadonly` | `https://www.googleapis.com/auth/spreadsheets.readonly` | Read only |
| `DriveService.Scope.DriveFile` | `https://www.googleapis.com/auth/drive.file` | Files created/opened by app |
| `DriveService.Scope.DriveReadonly` | `https://www.googleapis.com/auth/drive.readonly` | Read file metadata |

Use the narrowest scope possible. For read-only tools, use `SpreadsheetsReadonly`.
