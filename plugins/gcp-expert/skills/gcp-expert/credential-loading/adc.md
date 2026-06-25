---
tags: [gcp-expert/auth]
summary: Application Default Credentials (ADC) — environment-portable credential loading that works in dev, CI, and production without code changes.
---

# Pattern 3: Application Default Credentials (ADC)

Use for environment-portable code that works in dev, CI, and production without changes.

```csharp
GoogleCredential credential = GoogleCredential
    .GetApplicationDefaultAsync().Result
    .CreateScoped(SheetsService.Scope.Spreadsheets);
```

ADC resolution order:
1. `GOOGLE_APPLICATION_CREDENTIALS` environment variable (path to JSON key file)
2. gcloud CLI default credentials (`gcloud auth application-default login`)
3. Attached service account (GCE, Cloud Run, GKE with Workload Identity)

For CLI tools, set the env var:
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

On Windows:
```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\service-account-key.json"
```
