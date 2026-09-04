---
tags: [gcp-expert/auth]
summary: Common Google API scope constants for Sheets and Drive — which scope to use and when, with least-privilege guidance.
---

# Common API Scopes

| Scope Constant | Permission | Use When |
|----------------|------------|----------|
| `SheetsService.Scope.Spreadsheets` | Read/write all sheets | Full CRUD access needed |
| `SheetsService.Scope.SpreadsheetsReadonly` | Read-only sheets | Only reading data |
| `DriveService.Scope.DriveReadonly` | Read-only Drive files | Listing/downloading files |
| `DriveService.Scope.DriveFile` | Files created by the app | App-scoped file access |

Apply least privilege: use `SpreadsheetsReadonly` when you only read data. Scope mismatches cause `403 Insufficient Authentication Scopes`.
