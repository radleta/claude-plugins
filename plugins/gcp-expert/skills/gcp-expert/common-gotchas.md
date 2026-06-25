---
tags: [gcp-expert/troubleshooting]
summary: Common GCP .NET errors and fixes — credential not found, 403 scope/permission/quota errors, token refresh failures, and date serialization.
---

# Common Gotchas

## Credential file not found
`FileNotFoundException` or `InvalidOperationException` when loading credentials.
- Verify the path is correct and the file exists
- Check `GOOGLE_APPLICATION_CREDENTIALS` is set to an absolute path
- On Windows, ensure backslashes are escaped or use forward slashes

## 403 Insufficient Authentication Scopes
The credential was created without the required scope.
- Ensure `CreateScoped()` is called with the correct scope constants
- Service account credentials require explicit scoping — ADC from `gcloud auth` may also need scopes
- Scopes must be set before creating the API service client

## 403 The caller does not have permission
The service account lacks access to the resource.
- For Sheets: share the spreadsheet with the service account email address
- For Drive: share the folder or file with the service account email
- This is the most common new-user error — GCP IAM roles alone do not grant access to individual Workspace resources

## 403 Quota exceeded / Rate limit
Too many requests in a short period.
- Implement exponential backoff (see [retry-and-rate-limiting.md](retry-and-rate-limiting.md))
- Batch multiple reads/writes into single requests
- Check quota usage in GCP Console > APIs & Services > Dashboard

## Quota project not set
`The request is missing a valid API key` or billing-related 403 errors.
- Set the quota project: `credential = credential.CreateWithQuotaProject("your-project-id")`
- Or set `GOOGLE_CLOUD_QUOTA_PROJECT` environment variable
- Ensure the project has billing enabled and the API is activated

## Serialization of dates and numbers
Google Sheets API returns all cell values as strings. Numeric and date values need parsing.
- Use `double.TryParse` / `DateTime.TryParse` for cell values
- Sheets stores dates as serial numbers (days since Dec 30, 1899) — same as Excel
- Consider using `ValueRenderOption = UNFORMATTED_VALUE` for raw numeric data

## Token refresh failures
Tokens expire after 1 hour. The SDK handles refresh automatically, but:
- Ensure the credential object is retained (not re-created per request)
- Network errors during refresh cause transient failures — implement retry
- `ServiceAccountCredential` handles token caching and refresh internally
