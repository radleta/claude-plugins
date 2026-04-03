---
name: gcp-expert
description: "Validated Google Cloud Platform patterns for .NET/C# authentication, service accounts, API client configuration, and security best practices. Use when authenticating with Google APIs, configuring service accounts, setting up Google Sheets API access, managing credentials in CLI tools, or troubleshooting GCP auth errors -- even for seemingly simple credential loading."
---

<role>
  <identity>Expert in Google Cloud Platform authentication and API integration for .NET applications</identity>
  <purpose>
    Provide accurate, current GCP authentication patterns for .NET/C# applications
    with emphasis on service accounts, credential management, and secure API client configuration
  </purpose>
  <expertise>
    <area>GCP service account creation, key management, and workload identity federation</area>
    <area>.NET authentication via GoogleCredential (FromFile, FromStream, ADC)</area>
    <area>Google Sheets API client initialization with SheetsService</area>
    <area>Credential scoping, domain-wide delegation, and impersonation</area>
    <area>IAM roles, least privilege, key rotation, and security hardening</area>
    <area>Retry policies, exponential backoff, and quota management</area>
    <area>Environment-based credential configuration for CLI tools</area>
  </expertise>
  <scope>
    <in-scope>
      <item>GCP authentication patterns for .NET 6+ / C# applications</item>
      <item>Service account setup and credential loading</item>
      <item>Google Workspace API integration (Sheets, Drive, etc.)</item>
      <item>Security best practices for credential management</item>
      <item>Retry and error handling for Google API calls</item>
      <item>Environment configuration for local dev and CI/CD</item>
    </in-scope>
    <out-of-scope>
      <item>GCP infrastructure provisioning (Terraform, Pulumi)</item>
      <item>Google Cloud hosted services (GKE, Cloud Run, App Engine deployment)</item>
      <item>Non-.NET languages (Python, Java, Go GCP SDKs)</item>
      <item>Firebase or Google Analytics APIs</item>
    </out-of-scope>
  </scope>
</role>

## NuGet Packages

| Package | Purpose | Install |
|---------|---------|---------|
| `Google.Apis.Auth` | Core auth: `GoogleCredential`, `ServiceAccountCredential`, ADC | `dotnet add package Google.Apis.Auth` |
| `Google.Apis` | Base types: `BaseClientService.Initializer`, `ExponentialBackOff` | `dotnet add package Google.Apis` |
| `Google.Apis.Sheets.v4` | Sheets API client (`SheetsService`) | `dotnet add package Google.Apis.Sheets.v4` |
| `Google.Apis.Drive.v3` | Drive API client (sharing, permissions) | `dotnet add package Google.Apis.Drive.v3` |

All packages target .NET Standard 2.0+ and .NET 6+. The `Google.Apis.Sheets.v4` package is in maintenance mode but fully supported.

## Credential Loading Patterns

### Pattern 1: Load from JSON Key File (Explicit Path)

Use when the credential file path is known at runtime -- typical for CLI tools with configurable paths.

```csharp
GoogleCredential credential = GoogleCredential
    .FromFile(credentialPath)
    .CreateScoped(SheetsService.Scope.Spreadsheets);
```

- `FromFile(string)` reads a service account JSON key file
- `CreateScoped()` restricts the credential to specific API scopes -- required for service accounts
- The credential is thread-safe and reusable across requests

### Pattern 2: Load from Stream (Embedded or Dynamic)

Use when credentials come from a stream (embedded resource, secret manager, etc.).

```csharp
using var stream = File.OpenRead(credentialPath);
GoogleCredential credential = GoogleCredential
    .FromStream(stream)
    .CreateScoped(SheetsService.Scope.SpreadsheetsReadonly);
```

### Pattern 3: Application Default Credentials (ADC)

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

### Pattern 4: FromJson String

Use when the JSON credential is stored in an environment variable or secret store as a string.

```csharp
string json = Environment.GetEnvironmentVariable("GCP_CREDENTIALS_JSON")!;
GoogleCredential credential = GoogleCredential
    .FromJson(json)
    .CreateScoped(SheetsService.Scope.Spreadsheets);
```

## API Client Initialization

### SheetsService Setup

```csharp
var sheetsService = new SheetsService(new BaseClientService.Initializer
{
    HttpClientInitializer = credential,
    ApplicationName = "my-app"
});
```

Key properties of `BaseClientService.Initializer`:
- `HttpClientInitializer` -- the `GoogleCredential` (implements `IConfigurableHttpClientInitializer`)
- `ApplicationName` -- identifies your app in API logs and quota tracking

### Reading a Spreadsheet

```csharp
var request = sheetsService.Spreadsheets.Values.Get(spreadsheetId, "Sheet1!A1:D10");
ValueRange response = await request.ExecuteAsync(cancellationToken);
IList<IList<object>> values = response.Values;
```

### Writing to a Spreadsheet

```csharp
var valueRange = new ValueRange { Values = new List<IList<object>> { row } };
var request = sheetsService.Spreadsheets.Values.Update(valueRange, spreadsheetId, "Sheet1!A1");
request.ValueInputOption = SpreadsheetsResource.ValuesResource.UpdateRequest.ValueInputOptionEnum.USERENTERED;
await request.ExecuteAsync(cancellationToken);
```

## Common API Scopes

| Scope Constant | Permission | Use When |
|----------------|------------|----------|
| `SheetsService.Scope.Spreadsheets` | Read/write all sheets | Full CRUD access needed |
| `SheetsService.Scope.SpreadsheetsReadonly` | Read-only sheets | Only reading data |
| `DriveService.Scope.DriveReadonly` | Read-only Drive files | Listing/downloading files |
| `DriveService.Scope.DriveFile` | Files created by the app | App-scoped file access |

Apply least privilege: use `SpreadsheetsReadonly` when you only read data. Scope mismatches cause `403 Insufficient Authentication Scopes`.

## Service Account Setup

### Creating a Service Account

1. Go to GCP Console > IAM & Admin > Service Accounts
2. Create service account with descriptive name (e.g., `my-app-sheets-reader`)
3. Grant only required roles (see IAM Roles below)
4. Create JSON key (Keys tab > Add Key > JSON) -- download and store securely
5. Share target Google Sheets with the service account email (`name@project.iam.gserviceaccount.com`)

Step 5 is frequently missed -- the service account email must be added as an editor or viewer on each spreadsheet it accesses.

### Domain-Wide Delegation

For accessing Google Workspace user data (impersonating a user), enable domain-wide delegation:

```csharp
GoogleCredential credential = GoogleCredential
    .FromFile(credentialPath)
    .CreateWithUser("user@yourdomain.com")
    .CreateScoped(SheetsService.Scope.Spreadsheets);
```

Requirements:
- Domain-wide delegation enabled on the service account in GCP Console
- OAuth scopes authorized in Google Workspace Admin Console (Security > API Controls > Domain-wide Delegation)
- `CreateWithUser()` must be called before `CreateScoped()`

## IAM Roles and Least Privilege

| Role | Permissions | Use When |
|------|-------------|----------|
| `roles/viewer` | Read-only project access | Minimal project-level access |
| `roles/iam.serviceAccountTokenCreator` | Generate tokens | Service account impersonation |
| `roles/iam.serviceAccountUser` | Act as service account | Attaching SA to resources |

For Google Sheets API specifically, IAM roles are secondary -- access is controlled by sharing the spreadsheet with the service account email. No project-level Sheets role is needed.

Principle of least privilege:
- Create dedicated service accounts per application or function
- Grant only the scopes and roles each account needs
- Prefer `SpreadsheetsReadonly` scope over `Spreadsheets` when possible
- Review and audit permissions periodically

## Security Best Practices

### Credential Hierarchy (Most to Least Secure)

1. **Workload Identity Federation** -- no keys, short-lived tokens, automatic rotation. Use for CI/CD (GitHub Actions, Azure DevOps) and cloud-to-cloud.
2. **Attached service accounts** -- for workloads running on GCP (GCE, Cloud Run, GKE). No key files needed.
3. **Service account impersonation** -- user credentials temporarily act as a service account. Good for local dev with `gcloud auth application-default login --impersonate-service-account=SA_EMAIL`.
4. **Service account JSON key files** -- downloaded keys. Required for local CLI tools accessing Google APIs without gcloud. Highest risk -- manage carefully.

### Key Management Rules

- Rotate keys every 90 days or less
- Never commit key files to source control (add `*.json` patterns to `.gitignore` if storing in project)
- Store key file paths in environment variables or config files, not hardcoded
- Use `GOOGLE_APPLICATION_CREDENTIALS` env var for portability
- Delete unused keys immediately
- Validate credentials from external sources before use (security advisory from Google)

### CLI Tool Configuration Pattern

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

## Retry and Rate Limiting

### Built-in Exponential Backoff

Google.Apis provides `ExponentialBackOff` and `BackOffHandler` for automatic retries:

```csharp
var initializer = new BaseClientService.Initializer
{
    HttpClientInitializer = credential,
    ApplicationName = "my-app",
    DefaultExponentialBackOffPolicy = ExponentialBackOffPolicy.Exception
        | ExponentialBackOffPolicy.UnsuccessfulResponse503
};
```

Default behavior:
- Retries on HTTP 503 (Service Unavailable) with exponential backoff
- Starting delay: 250ms, doubles each retry
- Max retries: 10 (configurable)
- Jitter added to prevent thundering herd

### Custom Retry for Rate Limits (429/403)

By default, 403 rate-limit errors are not retried. Add a custom handler:

```csharp
var backOff = new ExponentialBackOff(TimeSpan.FromMilliseconds(500), maxRetries: 5);
var handler = new BackOffHandler(new BackOffHandler.Initializer(backOff)
{
    HandleUnsuccessfulResponseFunc = response =>
        Task.FromResult(
            (int)response.StatusCode == 429
            || ((int)response.StatusCode == 403
                && response.ReasonPhrase?.Contains("rate", StringComparison.OrdinalIgnoreCase) == true))
});
```

### Google Sheets API Quotas

| Quota | Limit |
|-------|-------|
| Read requests per minute per project | 300 |
| Write requests per minute per project | 300 |
| Read requests per minute per user | 60 |
| Write requests per minute per user | 60 |

Batch reads/writes when possible to stay within quotas. Use `Spreadsheets.Values.BatchGet` and `BatchUpdate` for multiple ranges.

## Common Gotchas

### Credential file not found
`FileNotFoundException` or `InvalidOperationException` when loading credentials.
- Verify the path is correct and the file exists
- Check `GOOGLE_APPLICATION_CREDENTIALS` is set to an absolute path
- On Windows, ensure backslashes are escaped or use forward slashes

### 403 Insufficient Authentication Scopes
The credential was created without the required scope.
- Ensure `CreateScoped()` is called with the correct scope constants
- Service account credentials require explicit scoping -- ADC from `gcloud auth` may also need scopes
- Scopes must be set before creating the API service client

### 403 The caller does not have permission
The service account lacks access to the resource.
- For Sheets: share the spreadsheet with the service account email address
- For Drive: share the folder or file with the service account email
- This is the most common new-user error -- GCP IAM roles alone do not grant access to individual Workspace resources

### 403 Quota exceeded / Rate limit
Too many requests in a short period.
- Implement exponential backoff (see Retry section above)
- Batch multiple reads/writes into single requests
- Check quota usage in GCP Console > APIs & Services > Dashboard

### Quota project not set
`The request is missing a valid API key` or billing-related 403 errors.
- Set the quota project: `credential = credential.CreateWithQuotaProject("your-project-id")`
- Or set `GOOGLE_CLOUD_QUOTA_PROJECT` environment variable
- Ensure the project has billing enabled and the API is activated

### Serialization of dates and numbers
Google Sheets API returns all cell values as strings. Numeric and date values need parsing.
- Use `double.TryParse` / `DateTime.TryParse` for cell values
- Sheets stores dates as serial numbers (days since Dec 30, 1899) -- same as Excel
- Consider using `ValueRenderOption = UNFORMATTED_VALUE` for raw numeric data

### Token refresh failures
Tokens expire after 1 hour. The SDK handles refresh automatically, but:
- Ensure the credential object is retained (not re-created per request)
- Network errors during refresh cause transient failures -- implement retry
- `ServiceAccountCredential` handles token caching and refresh internally

## Environment Configuration for CLI Tools

### Recommended Configuration Hierarchy

```
1. Command-line argument (--credential-path)
2. Environment variable (GOOGLE_APPLICATION_CREDENTIALS)
3. Config file (appsettings.json / .env)
4. ADC fallback (gcloud auth application-default login)
```

### appsettings.json Example

```json
{
  "GoogleSheets": {
    "CredentialPath": "./data/credentials/service-account.json",
    "SpreadsheetId": "YOUR_SPREADSHEET_ID_HERE"
  }
}
```

### .env Example

```
GOOGLE_APPLICATION_CREDENTIALS=./data/credentials/service-account.json
GOOGLE_SHEETS_SPREADSHEET_ID=YOUR_SPREADSHEET_ID_HERE
```

Keep credential files in gitignored directories (`data/credentials/` or similar). Document the expected credential location in project setup instructions.

## Workload Identity Federation (Keyless Auth)

For CI/CD pipelines and cloud workloads, prefer WIF over downloaded keys:

### GitHub Actions Example

```yaml
- uses: google-github-actions/auth@v2
  with:
    workload_identity_provider: 'projects/PROJECT_NUM/locations/global/workloadIdentityPools/POOL/providers/PROVIDER'
    service_account: 'sa-name@project.iam.gserviceaccount.com'
```

Benefits:
- No long-lived keys to manage or rotate
- Short-lived tokens (1 hour, auto-refreshed)
- Identity mapped from external provider (GitHub, Azure AD, AWS)
- Audit trail in Cloud Audit Logs

For local CLI development, WIF is not practical -- use service account key files with the security practices above.

## Quick Reference: Minimal Sheets API Setup

```csharp
// 1. Install packages
// dotnet add package Google.Apis.Sheets.v4
// dotnet add package Google.Apis.Auth

// 2. Load credential
var credential = GoogleCredential
    .FromFile("service-account.json")
    .CreateScoped(SheetsService.Scope.SpreadsheetsReadonly);

// 3. Create service
var service = new SheetsService(new BaseClientService.Initializer
{
    HttpClientInitializer = credential,
    ApplicationName = "my-app"
});

// 4. Read data
var response = await service.Spreadsheets.Values
    .Get("SPREADSHEET_ID", "Sheet1!A1:Z")
    .ExecuteAsync();
```
