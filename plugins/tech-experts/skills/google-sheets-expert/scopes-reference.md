---
tags: [google-sheets-expert/auth]
summary: "OAuth scope constants for Google Sheets and Drive APIs with access level guidance"
---

# Scopes Reference

| Scope Constant | Value | Access |
|----------------|-------|--------|
| `SheetsService.Scope.Spreadsheets` | `https://www.googleapis.com/auth/spreadsheets` | Full read/write |
| `SheetsService.Scope.SpreadsheetsReadonly` | `https://www.googleapis.com/auth/spreadsheets.readonly` | Read only |
| `DriveService.Scope.DriveFile` | `https://www.googleapis.com/auth/drive.file` | Files created/opened by app |
| `DriveService.Scope.DriveReadonly` | `https://www.googleapis.com/auth/drive.readonly` | Read file metadata |

Use the narrowest scope possible. For read-only tools, use `SpreadsheetsReadonly`.

See [Authentication](authentication.md) for how to apply scopes via `GoogleCredential.CreateScoped()`.
