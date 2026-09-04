---
tags: [gcp-expert/auth]
summary: Load a GoogleCredential from a JSON string stored in an environment variable or secret store.
---

# Pattern 4: FromJson String

Use when the JSON credential is stored in an environment variable or secret store as a string.

```csharp
string json = Environment.GetEnvironmentVariable("GCP_CREDENTIALS_JSON")!;
GoogleCredential credential = GoogleCredential
    .FromJson(json)
    .CreateScoped(SheetsService.Scope.Spreadsheets);
```
