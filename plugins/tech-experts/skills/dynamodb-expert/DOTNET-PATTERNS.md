# DynamoDB .NET SDK Patterns — Deep Dive

## DynamoDBContext Configuration

### Client Setup

```csharp
// Singleton — reuse across requests (connection pooling)
services.AddSingleton<IAmazonDynamoDB>(sp =>
{
    var config = new AmazonDynamoDBConfig { RegionEndpoint = RegionEndpoint.USEast1 };
    return new AmazonDynamoDBClient(credentials, config);
});

// Singleton — DynamoDBContext caches table metadata internally
services.AddSingleton<IDynamoDBContext>(sp =>
{
    var client = sp.GetRequiredService<IAmazonDynamoDB>();
    var config = new DynamoDBContextConfig
    {
        TableNamePrefix = "Production-",
        Conversion = DynamoDBEntryConversion.V2  // Use V2 for consistent type handling
    };
    return new DynamoDBContext(client, config);
});
```

**Key decisions:**
- **Singleton lifetime** for both client and context — they're thread-safe and cache connection pools + table metadata
- **V2 conversion** — consistent handling of empty strings, booleans, and nested types
- **TableNamePrefix** — avoids hardcoding environment-specific table names in entities
- **`DisableFetchingTableMetadata = true`** — set this to avoid DescribeTable calls on first use. Critical for Lambda cold starts and high-concurrency scenarios where DescribeTable can cause thread pool starvation. When enabled, describe keys and indexes accurately via .NET attributes on your entity classes

### Custom Type Converters

Register converters on `DynamoDBContext` for non-standard types:

```csharp
// Register before first use
public static void RegisterConverters(DynamoDBContext context)
{
    // Custom types (ShortGuid, etc.)
    context.ConverterCache.Add(typeof(ShortGuid), new ShortGuidConverter());

    // DateTime as ISO 8601 round-trip strings
    context.ConverterCache.Add(typeof(DateTime), new RoundTripDateTimeConverter());
    context.ConverterCache.Add(typeof(DateTime?), new NullableRoundTripDateTimeConverter());

    // Register all enum types dynamically
    foreach (var enumType in Assembly.GetAssembly(typeof(MyEntity))
        .GetTypes().Where(t => t.IsEnum))
    {
        var converterType = typeof(EnumIntConverter<>).MakeGenericType(enumType);
        context.ConverterCache.Add(enumType, (IPropertyConverter)Activator.CreateInstance(converterType));
    }
}
```

## Save Behavior: UpdateItem vs PutItem

`DynamoDBContext.SaveAsync` uses `UpdateItem` by default (not `PutItem`). This means:

| Behavior | UpdateItem (default) | PutItem |
|----------|---------------------|---------|
| Missing attributes | Preserved (partial update) | Deleted (full replacement) |
| Existing item | Merges attributes | Replaces entire item |
| New item | Creates with specified attributes | Creates with specified attributes |
| Mock in tests | Mock `UpdateItemAsync` | Mock `PutItemAsync` |

To use PutItem instead:
```csharp
var opConfig = new DynamoDBOperationConfig { SkipVersionCheck = true };
// DynamoDBContext uses PutItem when [DynamoDBVersion] attribute is present
// and SkipVersionCheck is false (default for versioned items)
```

**Best practice**: Understand which mode your entities use. For tests, mock **both** `UpdateItemAsync` and `PutItemAsync` to be safe.

## Transactions (TransactWriteItems / TransactGetItems)

### TransactWriteItems — Up to 100 Operations

```csharp
var transactRequest = new TransactWriteItemsRequest
{
    TransactItems = new List<TransactWriteItem>
    {
        new TransactWriteItem
        {
            Put = new Put
            {
                TableName = "Orders",
                Item = orderAttributes,
                ConditionExpression = "attribute_not_exists(OrderId)"  // Prevent overwrite
            }
        },
        new TransactWriteItem
        {
            Update = new Update
            {
                TableName = "Inventory",
                Key = new() { { "ProductId", new AttributeValue { S = productId } } },
                UpdateExpression = "SET Stock = Stock - :qty",
                ConditionExpression = "Stock >= :qty",  // Prevent oversell
                ExpressionAttributeValues = new()
                {
                    { ":qty", new AttributeValue { N = quantity.ToString() } }
                }
            }
        }
    },
    ClientRequestToken = idempotencyToken  // Idempotent for 10 minutes
};

try
{
    await _client.TransactWriteItemsAsync(transactRequest, ct);
}
catch (TransactionCanceledException ex)
{
    // ex.CancellationReasons tells which item failed and why
    foreach (var reason in ex.CancellationReasons)
    {
        if (reason.Code == "ConditionalCheckFailed")
            // Handle specific condition failure
    }
}
```

### Transaction Limits

| Limit | Value |
|-------|-------|
| Max items per transaction | 100 |
| Max item size | 400KB |
| Items must be in same region | Yes |
| Cross-table | Yes (same account + region) |
| Idempotency window | 10 minutes (via ClientRequestToken) |
| Cost | 2x WCU/RCU compared to non-transactional |

### TransactGetItems — Consistent Multi-Item Read

```csharp
var getRequest = new TransactGetItemsRequest
{
    TransactItems = new List<TransactGetItem>
    {
        new TransactGetItem
        {
            Get = new Get
            {
                TableName = "Orders",
                Key = new() { { "OrderId", new AttributeValue { S = orderId } } }
            }
        },
        new TransactGetItem
        {
            Get = new Get
            {
                TableName = "Customers",
                Key = new() { { "CustomerId", new AttributeValue { S = customerId } } }
            }
        }
    }
};

var response = await _client.TransactGetItemsAsync(getRequest, ct);
// response.Responses[0].Item → order attributes
// response.Responses[1].Item → customer attributes
```

## Pagination Pattern

### Cursor-Based Pagination

```csharp
public async Task<PagedResult<T>> QueryPagedAsync<T>(
    QueryRequest request, CancellationToken ct) where T : class
{
    var response = await _client.QueryAsync(request, ct);

    var documents = response.Items
        .Select(item => Document.FromAttributeMap(item))
        .ToList();
    var items = _context.FromDocuments<T>(documents).ToList();

    // Serialize ExclusiveStartKey as opaque pagination token
    string nextToken = response.LastEvaluatedKey?.Count > 0
        ? SerializeToken(response.LastEvaluatedKey)
        : null;

    return new PagedResult<T> { Items = items, NextToken = nextToken };
}

// Token serialization — Base64-encoded key-value pairs
public static string SerializeToken(Dictionary<string, AttributeValue> key)
{
    var parts = key.Select(kvp =>
        kvp.Value.S != null ? $"{kvp.Key}=S:{kvp.Value.S}" :
        kvp.Value.N != null ? $"{kvp.Key}=N:{kvp.Value.N}" : null)
        .Where(p => p != null);
    return Convert.ToBase64String(Encoding.UTF8.GetBytes(string.Join("|", parts)));
}
```

### Exhaustive Query (All Pages)

```csharp
public async Task<List<T>> QueryAllAsync<T>(QueryRequest request, CancellationToken ct)
    where T : class
{
    var allItems = new List<T>();

    do
    {
        ct.ThrowIfCancellationRequested();
        var response = await _client.QueryAsync(request, ct);

        var documents = response.Items
            .Select(item => Document.FromAttributeMap(item))
            .ToList();
        allItems.AddRange(_context.FromDocuments<T>(documents));

        request.ExclusiveStartKey = response.LastEvaluatedKey;
    }
    while (request.ExclusiveStartKey?.Count > 0);

    return allItems;
}
```

**Warning**: Unbounded queries can return massive datasets. Use only for known-bounded result sets (e.g., seats for a license with a 10,000 cap).

## Expression Patterns

### UpdateExpression Syntax

| Action | Syntax | Example |
|--------|--------|---------|
| SET | `SET attr = :val` | `SET #s = :status` |
| SET (increment) | `SET attr = attr + :val` | `SET ViewCount = ViewCount + :one` |
| SET (if not exists) | `SET attr = if_not_exists(attr, :default)` | `SET ViewCount = if_not_exists(ViewCount, :zero) + :one` |
| REMOVE | `REMOVE attr` | `REMOVE TempField` |
| ADD (number) | `ADD attr :val` | `ADD Score :increment` |
| ADD (set) | `ADD attr :set` | `ADD Tags :newTags` |
| DELETE (set) | `DELETE attr :set` | `DELETE Tags :removedTags` |

### ConditionExpression Patterns

| Pattern | Expression | Use Case |
|---------|-----------|----------|
| Item exists | `attribute_exists(PK)` | Update only existing items |
| Item not exists | `attribute_not_exists(PK)` | Insert only new items |
| Attribute equals | `#s = :val` | Optimistic locking |
| Attribute comparison | `Version = :expected` | Conflict detection |
| Combined | `attribute_exists(PK) AND #s = :active` | Conditional update |

### FilterExpression vs KeyConditionExpression

| Aspect | KeyConditionExpression | FilterExpression |
|--------|----------------------|-----------------|
| Evaluated | Before reading | After reading (items still consume RCU) |
| Cost | Efficient — reads only matching items | Wasteful — reads then discards |
| Supported on | PK and SK only | Any attribute |
| Operators | `=`, `<`, `>`, `<=`, `>=`, `between`, `begins_with` | Full set including `contains`, `size`, `attribute_type` |

**Rule**: Move as much filtering as possible into KeyConditionExpression (via GSI design). FilterExpression should only handle edge cases that can't be modeled in keys.

## Testing DynamoDB in .NET

### Mock Setup Pattern

```csharp
public class OrderServiceTests
{
    private readonly Mock<IAmazonDynamoDB> _mockClient;
    private readonly Mock<IDynamoDBContext> _mockContext;
    private readonly OrderService _service;

    public OrderServiceTests()
    {
        _mockClient = new Mock<IAmazonDynamoDB>();
        _mockContext = new Mock<IDynamoDBContext>();
        _service = new OrderService(_mockContext.Object, _mockClient.Object);

        // Default BatchWriteItem to succeed
        _mockClient
            .Setup(c => c.BatchWriteItemAsync(It.IsAny<BatchWriteItemRequest>(), default))
            .ReturnsAsync(new BatchWriteItemResponse());
    }
}
```

### Mocking DynamoDBContext Operations

```csharp
// LoadAsync — return entity or null
_mockContext
    .Setup(c => c.LoadAsync<Order>(orderId, It.IsAny<CancellationToken>()))
    .ReturnsAsync(new Order { OrderId = orderId, Status = "Active" });

// SaveAsync — verify it was called
_mockContext
    .Setup(c => c.SaveAsync(It.IsAny<Order>(), It.IsAny<CancellationToken>()))
    .Returns(Task.CompletedTask);

// Verify
_mockContext.Verify(c => c.SaveAsync(
    It.Is<Order>(o => o.Status == "Shipped"),
    It.IsAny<CancellationToken>()), Times.Once);
```

### Mocking QueryAsync Responses

```csharp
_mockClient
    .Setup(c => c.QueryAsync(It.IsAny<QueryRequest>(), It.IsAny<CancellationToken>()))
    .ReturnsAsync(new QueryResponse
    {
        Items = new List<Dictionary<string, AttributeValue>>
        {
            new()
            {
                { "OrderId", new AttributeValue { S = "order-1" } },
                { "Status", new AttributeValue { S = "Active" } },
                { "CreatedAt", new AttributeValue { S = DateTime.UtcNow.ToString("o") } }
            }
        }
    });
```

### Testing Retry Behavior

```csharp
[Fact]
public async Task RetryOnThrottle_RetriesAndSucceeds()
{
    var callCount = 0;
    _mockContext
        .Setup(c => c.LoadAsync<Order>(It.IsAny<string>(), It.IsAny<CancellationToken>()))
        .ReturnsAsync(() =>
        {
            callCount++;
            if (callCount < 3)
                throw new ProvisionedThroughputExceededException("throttled");
            return new Order { OrderId = "test" };
        });

    var result = await _service.GetOrderAsync("test");

    result.Should().NotBeNull();
    callCount.Should().Be(3);  // 2 retries + 1 success
}
```

### Common Mock Pitfalls

| Pitfall | Problem | Fix |
|---------|---------|-----|
| Missing `CancellationToken` in setup | Mock doesn't match — returns null | Use `It.IsAny<CancellationToken>()` or `default` |
| Only mocking `PutItemAsync` | `SaveAsync` uses `UpdateItemAsync` by default | Mock both `PutItemAsync` and `UpdateItemAsync` |
| Missing `DescribeTable` mocks | Real `DynamoDBContext` calls `DescribeTable` on first use | Mock all 4 overloads (sync string, sync request, async string, async request) OR use `IDynamoDBContext` interface |
| Wrong table name in mock | Prefix not included | Include prefix: `"Test-Orders"` not `"Orders"` |
| Forgetting custom converters | ShortGuid, DateTime, enum deserialization fails | Register converters on context before tests |

### In-Memory Testing with TestDynamo

[TestDynamo](https://github.com/fsprojects/TestDynamo) provides a full in-memory `IAmazonDynamoDB` — no Docker, no Java, no DynamoDB Local:

```csharp
using TestDynamo;

using var client = TestDynamoClient.CreateClient<AmazonDynamoDBClient>();
await client.CreateTableAsync(new CreateTableRequest { /* schema */ });

using var context = new DynamoDBContext(client);
RegisterConverters(context); // custom converters still needed for reads
```

**Gotcha: TestDynamo + custom types (ShortGuid)**

TestDynamo's internal mapper can't handle custom types for `DynamoDBContext.SaveAsync`. Seed data with raw `PutItemAsync` instead:

```csharp
// ❌ Crashes: TestDynamo mapper can't handle ShortGuid
await context.SaveAsync(new Seat { SeatId = ShortGuid.NewGuid(), ... });

// ✅ Works: seed with raw attributes, reads deserialize via registered converters
await client.PutItemAsync("Seat", new Dictionary<string, AttributeValue>
{
    ["SeatId"] = new() { S = ShortGuid.NewGuid().ToString() },
    ["Status"] = new() { N = ((int)SeatStatusEnum.Active).ToString() },
    ["AssignedAt"] = new() { S = DateTime.UtcNow.AddDays(-3).ToString("O") },
    // ... other attributes
});

// Reads work fine — DynamoDBContext uses registered converters
var search = context.ScanAsync<Seat>(conditions);
var seats = await search.GetNextSetAsync(ct); // ShortGuid deserialized correctly
```

**ScanCondition enum casting — pass enum values, not int casts:**

```csharp
// ❌ InvalidCastException: Unable to cast Int32 to Enum
new ScanCondition("Status", ScanOperator.Equal, (int)SeatStatusEnum.Active)

// ✅ DynamoDBContext handles enum-to-number conversion
new ScanCondition("Status", ScanOperator.Equal, SeatStatusEnum.Active)
```

### GSI Query Workaround: Table.Query + FromDocuments

`DynamoDBContext.QueryAsync` misroutes the key converter when the table hash key uses a custom converter (ShortGuid) and the GSI hash key is a different type (enum, string). Use the Document Model as a workaround:

```csharp
// ❌ Throws InvalidCastException — SDK tries ShortGuid converter on enum value
var search = _context.QueryAsync<License>(LicenseStatusEnum.Active, new DynamoDBOperationConfig
{
    IndexName = "Status-CreatedAt-index",
});

// ✅ Table.Query bypasses DynamoDBContext key converter routing
var table = _context.GetTargetTable<License>();
var filter = new QueryFilter("GsiStatus", QueryOperator.Equal, (int)status);
var search = table.Query(new QueryOperationConfig
{
    IndexName = "Status-CreatedAt-index",
    Filter = filter,
});

var results = new List<License>();
while (!search.IsDone)
{
    var docs = await search.GetNextSetAsync(ct);
    results.AddRange(_context.FromDocuments<License>(docs)); // converters work correctly here
}
```

**When this applies:** Any table where the hash key uses a custom `IPropertyConverter` (ShortGuid, custom ID types) AND you query a GSI whose hash key is a different type (enum, string, number).

### IDynamoDBContext vs DynamoDBContext for Testing

| Approach | Pros | Cons |
|----------|------|------|
| `IDynamoDBContext` | Clean mocking with Moq, no `DescribeTable` needed | Interface may not cover all methods |
| `DynamoDBContext` + mock client | Full SDK behavior | Must mock `DescribeTable` (4 overloads), more setup |

**Recommendation**: Use `IDynamoDBContext` for new code — simpler mocking, better testability. Use concrete `DynamoDBContext` only when you need SDK-specific behaviors (QueryAsync with pagination, ScanAsync).

**Known SDK Issue (#1801)**: In SDK V3, `DynamoDBContext` internally casts `IAmazonDynamoDB` to `AmazonDynamoDBClient`. Mocking `IAmazonDynamoDB` and passing it to `DynamoDBContext` can cause null reference failures. Workaround: use `IDynamoDBContext` interface or your own wrapper. SDK V4 (preview) fixes this with improved `IDynamoDBContext` and new `ITable` interface.

## Optimistic Locking with DynamoDBContext

`DynamoDBContext` supports built-in optimistic locking via `[DynamoDBVersion]`:

```csharp
[DynamoDBTable("Orders")]
public class Order
{
    [DynamoDBHashKey]
    public string OrderId { get; set; }
    public string Status { get; set; }

    [DynamoDBVersion]
    public int? VersionNumber { get; set; }  // Must be nullable int
}
```

**Behavior**: DynamoDBContext automatically assigns version 0 on first save, increments on each update, and adds a ConditionExpression to check the version matches. Throws `ConditionalCheckFailedException` on conflict.

**For low-level API optimistic locking**: Manually manage a version attribute in ConditionExpression (see SKILL.md conditional writes section).

## Error Handling Reference

| Exception | Cause | Action |
|-----------|-------|--------|
| `ProvisionedThroughputExceededException` | Throughput limit exceeded | Retry with exponential backoff |
| `ConditionalCheckFailedException` | ConditionExpression evaluated false | Re-read item, re-evaluate business logic |
| `TransactionCanceledException` | Transaction failed (one+ items) | Check `CancellationReasons` per item |
| `ItemCollectionSizeLimitExceededException` | Item collection > 10GB (LSI tables) | Redesign partition key or remove LSI |
| `ValidationException` | Malformed request (expression syntax, missing key) | Fix request — not transient |
| `ResourceNotFoundException` | Table doesn't exist | Check table name + prefix |
| `InternalServerError` | AWS internal error | Retry (transient) |

**Retry only transient errors**: `ProvisionedThroughputExceededException` and `InternalServerError`. Do NOT retry `ValidationException` or `ConditionalCheckFailedException` — they indicate logic errors.

## DynamoDB Service Checklist

### Client & Configuration (8 items)
- [ ] `AmazonDynamoDBClient` registered as **singleton** (thread-safe, connection pooling)
- [ ] `DynamoDBContext` / `IDynamoDBContext` registered as **singleton** (caches table metadata)
- [ ] `DynamoDBEntryConversion.V2` set on context config
- [ ] `TableNamePrefix` configured per environment (e.g., `Production-`, `Beta-`)
- [ ] `DisableFetchingTableMetadata = true` set (avoids DescribeTable cold-start calls)
- [ ] Custom converters registered (ShortGuid, DateTime, enums) before first use
- [ ] Entity attributes accurately describe keys/indexes (required when DisableFetchingTableMetadata=true)
- [ ] AWS credentials loaded from profile/role, not hardcoded

### Data Access Patterns (10 items)
- [ ] All DynamoDB calls wrapped with retry logic (attempter or explicit backoff)
- [ ] `CancellationToken` accepted on all public async methods as `= default`
- [ ] `CancellationToken` passed to every SDK async call
- [ ] `catch` blocks catch **specific** exceptions, not `Exception`
- [ ] `ProvisionedThroughputExceededException` retried with exponential backoff
- [ ] `ConditionalCheckFailedException` handled with re-read and business logic retry
- [ ] `UpdateItemAsync` used for atomic counter increments (not read-modify-write)
- [ ] Reserved words handled with `ExpressionAttributeNames` in all expressions
- [ ] GSI queries use `KeyConditionExpression` for primary filtering, not `FilterExpression`
- [ ] Queries use `Limit` + pagination, not unbounded reads

### Batch Operations (8 items)
- [ ] `BatchWriteItem` chunks to ≤ 25 items per request
- [ ] `BatchGetItem` chunks to ≤ 100 items per request
- [ ] `UnprocessedItems` checked and retried after every `BatchWriteItemAsync`
- [ ] `UnprocessedKeys` checked and retried after every `BatchGetItemAsync`
- [ ] Retry uses exponential backoff (not fixed delay)
- [ ] Final failure throws after max retries (not silently ignored)
- [ ] Bulk operation catch blocks narrow to business logic exceptions (e.g., `InvalidOperationException`)
- [ ] Infrastructure errors (throughput, network) bubble up to caller

### Transactions (5 items)
- [ ] TransactWriteItems ≤ 100 items per transaction
- [ ] `ClientRequestToken` used for idempotency on write transactions
- [ ] `TransactionCanceledException.CancellationReasons` inspected per item on failure
- [ ] Same item not targeted more than once in a single transaction
- [ ] Transaction cost (2x WCU/RCU) accounted for in capacity planning

### Testing (12 items)
- [ ] `IDynamoDBContext` used for mockable context (preferred over concrete `DynamoDBContext`)
- [ ] `IAmazonDynamoDB` mocked for low-level operations (Query, BatchWrite, UpdateItem)
- [ ] Both `PutItemAsync` and `UpdateItemAsync` mocked (SaveAsync uses UpdateItem by default)
- [ ] `CancellationToken` included in mock setups (`It.IsAny<CancellationToken>()` or `default`)
- [ ] QueryResponse mocked with populated `Items` list (Dictionary<string, AttributeValue>)
- [ ] BatchWriteItemResponse mocked with empty `UnprocessedItems` for success path
- [ ] Retry behavior tested (mock throws `ProvisionedThroughputExceededException`, then succeeds)
- [ ] Table name prefix included in mock setups (e.g., `"Test-Orders"` not `"Orders"`)
- [ ] Custom converters registered on real DynamoDBContext instances in tests
- [ ] If using concrete `DynamoDBContext`: all 4 `DescribeTable` overloads mocked
- [ ] ScanCondition uses enum values directly (not `(int)` cast — causes `InvalidCastException`)
- [ ] GSI queries with custom-converter hash keys use `Table.Query` + `FromDocuments<T>` (not `DynamoDBContext.QueryAsync`)

### Operational (7 items)
- [ ] Capacity mode chosen (on-demand for variable, provisioned for steady)
- [ ] GSI projections minimized (KEYS_ONLY where feasible)
- [ ] TTL configured for temporary/expirable data
- [ ] DynamoDB Streams enabled with appropriate view type if downstream processing needed
- [ ] Stream Lambda consumers are idempotent (handle at-least-once delivery)
- [ ] Table creation is idempotent (check existence before create)
- [ ] Monitoring: CloudWatch alarms on `ThrottledRequests` and `SystemErrors`
