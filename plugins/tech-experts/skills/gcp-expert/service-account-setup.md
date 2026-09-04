---
tags: [gcp-expert/iam]
summary: Creating GCP service accounts, generating JSON keys, and configuring domain-wide delegation for Google Workspace user impersonation.
---

# Service Account Setup

## Creating a Service Account

1. Go to GCP Console > IAM & Admin > Service Accounts
2. Create service account with descriptive name (e.g., `my-app-sheets-reader`)
3. Grant only required roles (see [IAM Roles](iam-roles.md))
4. Create JSON key (Keys tab > Add Key > JSON) — download and store securely
5. Share target Google Sheets with the service account email (`name@project.iam.gserviceaccount.com`)

Step 5 is frequently missed — the service account email must be added as an editor or viewer on each spreadsheet it accesses.

## Domain-Wide Delegation

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
