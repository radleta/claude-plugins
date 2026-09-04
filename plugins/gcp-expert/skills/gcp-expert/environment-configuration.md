---
tags: [gcp-expert/config]
summary: Recommended credential configuration hierarchy for .NET CLI tools — command-line args, env vars, config files, and ADC fallback with examples.
---

# Environment Configuration for CLI Tools

## Recommended Configuration Hierarchy

```
1. Command-line argument (--credential-path)
2. Environment variable (GOOGLE_APPLICATION_CREDENTIALS)
3. Config file (appsettings.json / .env)
4. ADC fallback (gcloud auth application-default login)
```

## appsettings.json Example

```json
{
  "GoogleSheets": {
    "CredentialPath": "./data/credentials/service-account.json",
    "SpreadsheetId": "YOUR_SPREADSHEET_ID_HERE"
  }
}
```

## .env Example

```
GOOGLE_APPLICATION_CREDENTIALS=./data/credentials/service-account.json
GOOGLE_SHEETS_SPREADSHEET_ID=YOUR_SPREADSHEET_ID_HERE
```

Keep credential files in gitignored directories (`data/credentials/` or similar). Document the expected credential location in project setup instructions.
