---
tags: [gcp-expert/auth]
summary: Load a GoogleCredential from a JSON key file path — the standard pattern for CLI tools with configurable credential paths.
---

# Pattern 1: Load from JSON Key File (Explicit Path)

Use when the credential file path is known at runtime — typical for CLI tools with configurable paths.

```csharp
GoogleCredential credential = GoogleCredential
    .FromFile(credentialPath)
    .CreateScoped(SheetsService.Scope.Spreadsheets);
```

- `FromFile(string)` reads a service account JSON key file
- `CreateScoped()` restricts the credential to specific API scopes — required for service accounts
- The credential is thread-safe and reusable across requests
