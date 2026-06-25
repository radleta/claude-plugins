---
tags: [gcp-expert/auth]
summary: Load a GoogleCredential from a stream — use when credentials come from an embedded resource or secret manager.
---

# Pattern 2: Load from Stream (Embedded or Dynamic)

Use when credentials come from a stream (embedded resource, secret manager, etc.).

```csharp
using var stream = File.OpenRead(credentialPath);
GoogleCredential credential = GoogleCredential
    .FromStream(stream)
    .CreateScoped(SheetsService.Scope.SpreadsheetsReadonly);
```
