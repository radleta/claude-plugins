---
tags: [google-sheets-expert/rate-limits]
summary: "API quota limits, exponential backoff implementation, and quota-reduction strategies"
---

# Rate Limits and Quotas

| Limit | Value |
|-------|-------|
| Read requests | 300 per minute per project |
| Write requests | 300 per minute per project |
| Requests per user | 60 per minute per user per project |
| Requests per project | 500 per 100 seconds |
| Daily limit | Unlimited (no hard cap) |

When exceeded, the API returns HTTP 429 (`Too Many Requests`).

## Exponential Backoff Strategy

```csharp
async Task<T> ExecuteWithRetry<T>(
    Func<Task<T>> operation,
    int maxRetries = 5,
    CancellationToken ct = default)
{
    for (int attempt = 0; attempt <= maxRetries; attempt++)
    {
        try
        {
            return await operation();
        }
        catch (Google.GoogleApiException ex)
            when (ex.HttpStatusCode == System.Net.HttpStatusCode.TooManyRequests
                  && attempt < maxRetries)
        {
            // Exponential backoff: 1s, 2s, 4s, 8s, 16s + jitter
            int delayMs = (1 << attempt) * 1000
                + Random.Shared.Next(0, 1000);
            await Task.Delay(delayMs, ct);
        }
    }

    throw new InvalidOperationException("Unreachable");
}
```

## Quota-Reduction Strategies

- **Batch over individual**: Use `BatchGet`/`BatchUpdate` instead of per-range calls.
- **Field masks**: Always set `request.Fields` on `spreadsheets.get` to avoid transferring entire grid data.
- **Cache metadata**: Fetch sheet names/properties once, not before every operation.
- **Coalesce writes**: Buffer cell changes in memory and flush in a single batch.
- **Respect per-user limit**: 60/min per user is the binding constraint for most apps.

See [Reading Data](reading-data.md) and [Writing Data](writing-data.md) for batch operation patterns.
