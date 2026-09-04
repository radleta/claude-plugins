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

## Pages

- [NuGet Packages](nuget-packages.md) — NuGet package references for Google Sheets API v4 with version pinning guidance
- [Authentication](authentication.md) — Authentication patterns for Google Sheets API: service account, OAuth 2.0, and API key
- [Reading Data](reading-data.md) — Reading spreadsheet data via ValuesResource: single range, batch read, and render options
- [Writing Data](writing-data.md) — Writing spreadsheet data: single range update, batch write, append rows, and ValueInputOption
- [Sheet Metadata](sheet-metadata.md) — Reading spreadsheet and sheet properties (names, IDs, grid dimensions) with field masks
- [Creating and Formatting Sheets](creating-formatting-sheets.md) — Structural operations via spreadsheets.batchUpdate: add/delete sheets, format cells, request types
- [A1 Notation Reference](a1-notation.md) — A1 notation reference: range syntax, sheet name quoting, and common patterns
- [Rate Limits and Quotas](rate-limits-quotas.md) — API quota limits, exponential backoff implementation, and quota-reduction strategies
- [Common Gotchas](common-gotchas.md) — Common pitfalls: object typing, trimmed trailing rows, indexing mismatches, jagged rows, and write requirements
- [ClosedXML Migration](closedxml-migration.md) — Migration patterns from ClosedXML local xlsx to Google Sheets API including interface abstraction
- [Scopes Reference](scopes-reference.md) — OAuth scope constants for Google Sheets and Drive APIs with access level guidance

## Meta

- [Operations Log](log.md) — Timestamped wiki operations log (ingest, lint, query filings)
- [Schema](schema.md) — Wiki conventions and page-type definitions
