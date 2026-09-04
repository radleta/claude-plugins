---
tags: [gcp-expert/security]
summary: GCP credential security hierarchy, key management rules, and CLI tool configuration pattern for .NET applications.
---

# Security Best Practices

## Credential Hierarchy (Most to Least Secure)

1. **Workload Identity Federation** — no keys, short-lived tokens, automatic rotation. Use for CI/CD (GitHub Actions, Azure DevOps) and cloud-to-cloud (see [workload-identity-federation.md](workload-identity-federation.md)).
2. **Attached service accounts** — for workloads running on GCP (GCE, Cloud Run, GKE). No key files needed.
3. **Service account impersonation** — user credentials temporarily act as a service account. Good for local dev with `gcloud auth application-default login --impersonate-service-account=SA_EMAIL`.
4. **Service account JSON key files** — downloaded keys. Required for local CLI tools accessing Google APIs without gcloud. Highest risk — manage carefully.

## Key Management Rules

- Rotate keys every 90 days or less
- Never commit key files to source control (add `*.json` patterns to `.gitignore` if storing in project)
- Store key file paths in environment variables or config files, not hardcoded
- Use `GOOGLE_APPLICATION_CREDENTIALS` env var for portability
- Delete unused keys immediately
- Validate credentials from external sources before use (security advisory from Google)

## CLI Tool Configuration Pattern

For a .NET CLI tool that reads credentials from configuration:

```csharp
// Options class
public sealed record GoogleSheetsOptions
{
    public string? CredentialPath { get; init; }
    public string? SpreadsheetId { get; init; }
}

// Resolution order: explicit path > env var > ADC
GoogleCredential LoadCredential(GoogleSheetsOptions options)
{
    if (!string.IsNullOrEmpty(options.CredentialPath))
        return GoogleCredential.FromFile(options.CredentialPath);

    var envPath = Environment.GetEnvironmentVariable("GOOGLE_APPLICATION_CREDENTIALS");
    if (!string.IsNullOrEmpty(envPath))
        return GoogleCredential.FromFile(envPath);

    return GoogleCredential.GetApplicationDefaultAsync().GetAwaiter().GetResult();
}
```
