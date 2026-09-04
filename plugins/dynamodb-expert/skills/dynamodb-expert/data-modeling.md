---
tags: [dynamodb-expert/modeling]
summary: Partition key design, single-table vs multi-table decisions, and GSI design strategies for DynamoDB data modeling.
---

# DynamoDB Data Modeling Patterns

## Partition Key Design

| Pattern | When to Use | Example |
|---------|-------------|---------|
| **High-cardinality natural key** | Unique entity lookups | `UserId`, `OrderId`, `SessionId` |
| **Composite key** | Access patterns need PK+SK | PK=`CustomerId`, SK=`Order#2024-01-15` |
| **Write-sharding** | Hot write partition (counters) | `MetricName#shard-{0..N}` |
| **Time-based partition** | Time-series with even distribution | `SensorId#2024-01-15` |

```
❌ Low cardinality: PK = "StatusActive" (all active items on one partition)
✅ High cardinality: PK = UserId or OrderId (uniform distribution)
✅ Composite: PK = TenantId, SK = "Order#" + OrderId (access pattern aligned)
```

## Single-Table vs Multi-Table

| Approach | Pros | Cons | When |
|----------|------|------|------|
| **Single-table** | Fewer round-trips, transaction scope | Complex queries, harder to understand | Transactional entity groups |
| **Multi-table** | Simpler modeling, independent scaling | More API calls, cross-table joins impossible | Independent entities, different access patterns |

**Decision rule**: Use single-table when entities are frequently accessed together in transactions. Use multi-table when entities have independent lifecycles, different throughput profiles, or different TTL requirements.

## GSI Design

| Strategy | Description | Trade-off |
|----------|-------------|-----------|
| **Sparse index** | Only items with the GSI attribute appear | Efficient for filtering subsets |
| **Overloaded GSI** | `GSI1PK`/`GSI1SK` carry different entity types | Maximizes index reuse, complex to read |
| **Inverted index** | GSI swaps PK↔SK from base table | Enables reverse lookups |
| **Projection: KEYS_ONLY** | Only key attributes projected | Lowest cost, requires `GetItem` for details |
| **Projection: ALL** | All attributes projected | Highest cost, no extra reads |

For advanced item collection patterns, composite sort key design, TTL strategies, capacity planning, and reserved words, see [MODELING.md](MODELING.md).
