---
tags: [google-sheets-expert/auth]
summary: "Authentication patterns for Google Sheets API: service account, OAuth 2.0, and API key"
---

# Authentication

## Service Account (headless CLI / server)

Service accounts are the correct choice for unattended apps. Create one in the Google Cloud Console, download the JSON key file, and share the target spreadsheet with the service account email.

```csharp
using Google.Apis.Auth.OAuth2;
using Google.Apis.Sheets.v4;
using Google.Apis.Services;

// Load credential from JSON key file
GoogleCredential credential;
using (var stream = new FileStream("service-account-key.json", FileMode.Open, FileAccess.Read))
{
    credential = GoogleCredential.FromStream(stream)
        .CreateScoped(SheetsService.Scope.Spreadsheets);
}

// Initialize service
var service = new SheetsService(new BaseClientService.Initializer
{
    HttpClientInitializer = credential,
    ApplicationName = "my-app"
});
```

**Key points:**
- `GoogleCredential.FromStream()` or `GoogleCredential.FromFile(path)` or `GoogleCredential.FromJson(jsonString)` all work.
- Call `.CreateScoped()` with the required scope. `SheetsService.Scope.Spreadsheets` grants read/write. `SheetsService.Scope.SpreadsheetsReadonly` for read-only.
- The service account has its own email (e.g., `my-sa@project.iam.gserviceaccount.com`). Share the spreadsheet with that email as Editor or Viewer.
- Never commit the JSON key file to source control.

## OAuth 2.0 User Consent (interactive)

For user-facing apps where the user authorizes access to their own sheets. Less common for CLI tools but included for completeness:

```csharp
using Google.Apis.Auth.OAuth2;
using Google.Apis.Util.Store;

var credential = await GoogleWebAuthorizationBroker.AuthorizeAsync(
    GoogleClientSecrets.FromFile("client_secrets.json").Secrets,
    new[] { SheetsService.Scope.Spreadsheets },
    "user",
    CancellationToken.None,
    new FileDataStore("token-store", true));
```

## API Key (public sheets only)

For reading publicly shared spreadsheets with no auth prompt:

```csharp
var service = new SheetsService(new BaseClientService.Initializer
{
    ApplicationName = "my-app",
    ApiKey = "AIza..."
});
```

API keys only support read operations on public sheets. Use service accounts for private or write access.

See [Scopes Reference](scopes-reference.md) for the full list of available OAuth scopes.
