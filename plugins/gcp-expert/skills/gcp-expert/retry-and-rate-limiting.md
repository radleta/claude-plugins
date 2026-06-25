---
tags: [gcp-expert/reliability]
summary: Exponential backoff, custom retry handlers for 429/403 rate limits, and Google Sheets API quota limits for .NET applications.
---

# Retry and Rate Limiting

## Built-in Exponential Backoff

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

## Custom Retry for Rate Limits (429/403)

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

## Google Sheets API Quotas

| Quota | Limit |
|-------|-------|
| Read requests per minute per project | 300 |
| Write requests per minute per project | 300 |
| Read requests per minute per user | 60 |
| Write requests per minute per user | 60 |

Batch reads/writes when possible to stay within quotas. Use `Spreadsheets.Values.BatchGet` and `BatchUpdate` for multiple ranges.
