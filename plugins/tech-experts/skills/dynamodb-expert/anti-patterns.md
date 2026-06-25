---
tags: [dynamodb-expert/anti-patterns]
summary: Common DynamoDB anti-patterns and their fixes — scan abuse, hot partitions, missing retry logic, unbounded queries, and GSI misuse.
---

# DynamoDB Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Scan for queries | Reads entire table, O(N) cost | Design GSI for access pattern |
| Large items (>400KB) | Approaching limit, high RCU/WCU | Store blobs in S3, reference by key |
| Hot partition | Single PK gets all traffic | Write-sharding or redesign key |
| Missing UnprocessedItems retry | Silent data loss on batch writes | Always retry unprocessed items |
| `catch (Exception)` on DynamoDB | Swallows throttling signals | Catch specific exceptions |
| No CancellationToken | Caller can't cancel | Propagate to all SDK calls |
| FilterExpression for heavy filtering | Wastes RCU (reads then discards) | Move filter to KeyConditionExpression via GSI |
| Unbounded Query | Returns up to 1MB, timeout risk | Use Limit + pagination |
| `ScanCondition` with `(int)` enum cast | `InvalidCastException: Unable to cast Int32 to Enum` | Pass enum value directly: `ScanOperator.Equal, MyEnum.Value` |
| `DynamoDBContext.QueryAsync` on GSI with custom converter | SDK misroutes table hash key converter (e.g., ShortGuid) to GSI query value | Use `Table.Query` (Document Model) + `FromDocuments<T>` — see [DOTNET-PATTERNS.md](DOTNET-PATTERNS.md) |
