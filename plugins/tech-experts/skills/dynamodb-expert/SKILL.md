---
name: dynamodb-expert
description: "Validated DynamoDB patterns for .NET/C#: single-table design, GSI overloading, partition keys, AWS SDK patterns, batch operations, transactions, Streams, cost optimization, and testing. Use when designing DynamoDB tables, writing data access services, optimizing queries, handling throughput errors, or debugging DynamoDB issues — even for simple CRUD operations."
---

# DynamoDB Expert

<role>
  <identity>Expert in Amazon DynamoDB architecture and .NET SDK patterns</identity>

  <purpose>
    Provide authoritative guidance on DynamoDB data modeling, .NET SDK usage,
    performance optimization, and operational best practices
  </purpose>

  <expertise>
    <area>Data modeling: single-table design, GSI overloading, partition key strategies</area>
    <area>.NET SDK: IAmazonDynamoDB vs DynamoDBContext, async patterns, retry</area>
    <area>Batch operations, transactions, conditional writes</area>
    <area>DynamoDB Streams, Lambda triggers, idempotency</area>
    <area>Cost optimization: capacity modes, GSI projections, item sizing</area>
    <area>Testing: mocking IAmazonDynamoDB and DynamoDBContext in .NET</area>
  </expertise>

  <scope>
    <in-scope>
      <item>DynamoDB table and index design</item>
      <item>.NET SDK data access patterns (AWSSDK.DynamoDBv2)</item>
      <item>Performance tuning and cost optimization</item>
      <item>Retry strategies, error handling, throughput management</item>
      <item>Batch writes/reads, transactions, conditional expressions</item>
      <item>DynamoDB Streams and event processing</item>
      <item>Unit testing DynamoDB services in .NET</item>
    </in-scope>

    <out-of-scope>
      <item>Project-specific entity conventions (see project's data-expert skill, if one exists)</item>
      <item>Elasticsearch indexing pipeline (see project's data-expert skill, if one exists)</item>
      <item>Caching layers (FusionCache, Redis — separate concern)</item>
      <item>DynamoDB Local setup and administration</item>
      <item>AWS CDK/CloudFormation table definitions (infrastructure-as-code)</item>
    </out-of-scope>
  </scope>
</role>

## Investigation Protocol

Before applying patterns from this skill, discover how the project currently structures DynamoDB access:

| Discover | Why It Matters |
|----------|---------------|
| Client type: `IDynamoDBContext` vs `DynamoDBContext` vs `IAmazonDynamoDB` | Determines testing approach and service patterns |
| Table name prefixing strategy | Must match environment naming (e.g., `Production-`, `Beta-`) |
| Existing retry/attempter wrappers | Avoid duplicating retry logic already in place |
| Converter registrations | Custom types (ShortGuid, enums, DateTime) need converter setup |
| Batch write patterns | Check for existing UnprocessedItems handling |
| Capacity mode (on-demand vs provisioned) | Affects error handling and cost guidance |
| DI registration (singleton vs transient) | Client/context lifetime must match existing patterns |

Follow established project conventions over defaults in this skill.

## Core Principles

| # | Principle | Rationale |
|---|-----------|-----------|
| 1 | **Access Patterns First** | DynamoDB modeling starts from queries, not entities — design keys to serve reads |
| 2 | **Handle Partial Failures** | BatchWriteItem and Streams deliver at-least-once — always retry UnprocessedItems, design idempotent consumers |
| 3 | **Propagate CancellationToken** | SDK respects cancellation for in-flight HTTP — callers need the ability to cancel |
| 4 | **Retry Only Transient Errors** | Retry `ProvisionedThroughputExceededException`; do NOT retry `ValidationException` or `ConditionalCheckFailedException` |
| 5 | **Minimize GSI Cost** | Every GSI write doubles WCU — use KEYS_ONLY projections and sparse indexes where possible |
| 6 | **Singleton Clients** | `AmazonDynamoDBClient` and `DynamoDBContext` are thread-safe, cache connections — create once, reuse |
| 7 | **Catch Specific, Not General** | `catch (Exception)` swallows throttling signals — catch `ProvisionedThroughputExceededException` explicitly |

## .NET SDK Quick Reference

| Level | Class | When to Use |
|-------|-------|-------------|
| **High-level ORM** | `DynamoDBContext` / `IDynamoDBContext` | CRUD on single items (Load, Save, Delete, Query, Scan) |
| **Low-level client** | `IAmazonDynamoDB` | Batch ops, transactions, conditional writes, UpdateItem expressions, table management |

**Inject both** when a service needs ORM simplicity for basic CRUD plus raw API for complex operations.

| Pattern | Key Rule |
|---------|----------|
| **Retry** | Wrap all DynamoDB calls with exponential backoff on `ProvisionedThroughputExceededException` |
| **CancellationToken** | Accept `CancellationToken ct = default` on all public async methods, pass to every SDK call |
| **Batch writes** | Max 25 items per `BatchWriteItem`. Always check + retry `UnprocessedItems` |
| **Batch reads** | Max 100 items per `BatchGetItem`. Always check + retry `UnprocessedKeys` |
| **Conditional writes** | Use `ConditionExpression` for optimistic locking. Catch `ConditionalCheckFailedException` |
| **Atomic counters** | `SET Counter = Counter + :val` is atomic — no read-modify-write needed |
| **Transactions** | Up to 100 items via `TransactWriteItems`. Use `ClientRequestToken` for idempotency (10min window) |
| **SaveAsync behavior** | Uses `UpdateItem` by default (not `PutItem`) — mock both in tests |

For code examples, DynamoDBContext config, transactions, pagination, expression syntax, optimistic locking, testing mocks, and the 43-item service checklist, see [DOTNET-PATTERNS.md](DOTNET-PATTERNS.md).

## Cost Optimization

| Strategy | Impact | When |
|----------|--------|------|
| **On-demand** | Pay per request, **50% cheaper since Nov 2024** | Unpredictable traffic, new tables, peak:avg > 4x |
| **Provisioned + auto-scaling** | Lower cost for very steady workloads | Peak:avg < 4x, predictable traffic |
| **Reserved capacity** | Up to 77% savings | Committed baseline throughput (1yr/3yr) |
| **TTL** | Free deletes (no WCU cost) | Temporary data (sessions, tokens, requests) |
| **KEYS_ONLY GSI** | ~50-80% GSI write savings | Index used only for existence checks |
| **Smaller items** | Less RCU/WCU per op | Compress large attributes, trim unused fields |

**Item size math**: 1 WCU = 1 write/sec for items ≤ 1KB. 1 RCU = 1 strongly-consistent read/sec for items ≤ 4KB.

## DynamoDB Streams

| Aspect | Detail |
|--------|--------|
| **Delivery** | At-least-once (design for idempotency) |
| **Ordering** | Per-item ordering guaranteed within a shard |
| **View types** | `KEYS_ONLY`, `NEW_IMAGE`, `OLD_IMAGE`, `NEW_AND_OLD_IMAGES` |
| **Retention** | 24 hours |
| **Lambda trigger** | Event source mapping, batches of 1-10000 records |
| **Idempotency** | Use `eventID` or natural key dedup to handle replays |

## Pages

- [Data Modeling Patterns](data-modeling.md) — Partition key design, single-table vs multi-table decisions, and GSI design strategies.
- [Anti-Patterns](anti-patterns.md) — Common DynamoDB anti-patterns and their fixes — scan abuse, hot partitions, missing retry logic, unbounded queries, and GSI misuse.
- [Data Modeling Deep Dive](MODELING.md) — Access patterns, composite sort keys, item collections, GSI overloading, TTL strategies, capacity planning, and reserved words.
- [.NET SDK Patterns Deep Dive](DOTNET-PATTERNS.md) — DynamoDBContext config, transactions, pagination, expressions, optimistic locking, testing mocks, TestDynamo, error handling, and 43-item checklist.

## Meta
- [Operations Log](log.md) — Timestamped wiki operations log (ingest, lint, query filings)
- [Schema](schema.md) — Wiki conventions and page-type definitions
