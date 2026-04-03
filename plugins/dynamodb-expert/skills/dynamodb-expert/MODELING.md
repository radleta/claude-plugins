# DynamoDB Data Modeling — Deep Dive

## Access Pattern-First Design

DynamoDB modeling starts from access patterns, not entity relationships. Define every query the application needs **before** designing tables.

### Access Pattern Template

| # | Access Pattern | PK | SK | GSI? | Frequency |
|---|---------------|----|----|------|-----------|
| 1 | Get order by ID | `OrderId` | — | No | High |
| 2 | List orders by customer | `CustomerId` | `Order#<timestamp>` | Yes (GSI1) | Medium |
| 3 | Orders by status | `Status` | `CreatedAt` | Yes (GSI2) | Low |

Fill this table for every access pattern before writing any code. Each row maps to a DynamoDB query.

## Composite Sort Key Patterns

Sort keys enable range queries and hierarchical data within a partition.

### Hierarchical Prefix Pattern

```
PK = "ORG#acme"
SK = "DEPT#engineering"               → Department
SK = "DEPT#engineering#EMP#12345"     → Employee in department
SK = "DEPT#engineering#EMP#12345#PROJ#alpha"  → Project assignment
```

`begins_with(SK, "DEPT#engineering#EMP#")` returns all employees in engineering.

### Time-Series Sort Key

```
PK = "SENSOR#temp-01"
SK = "2024-01-15T14:30:00Z"

KeyConditionExpression: PK = :pk AND SK BETWEEN :start AND :end
```

ISO 8601 strings sort lexicographically = chronologically. Enables efficient time range queries.

### Version Sort Key

```
PK = "DOC#readme"
SK = "v0"        → Current version metadata
SK = "v00001"    → Version 1
SK = "v00002"    → Version 2 (zero-padded for sort)
```

## Item Collection Patterns

An item collection is all items sharing the same partition key value. Max 10GB per collection (for tables with local secondary indexes).

### One-to-Many Within a Partition

```
PK = "ORDER#123"
SK = "ORDER#123"           → Order header (type = "Order")
SK = "ITEM#widget-a"       → Line item (type = "OrderItem")
SK = "ITEM#widget-b"       → Line item
SK = "SHIPMENT#ship-001"   → Shipment record (type = "Shipment")
```

Single `Query(PK = "ORDER#123")` returns the entire order graph. Filter by SK prefix for specific entity types.

### Adjacency List (Many-to-Many)

```
PK = "USER#alice"    SK = "GROUP#admins"     → Alice is in Admins
PK = "USER#alice"    SK = "GROUP#devs"       → Alice is in Devs
PK = "GROUP#admins"  SK = "USER#alice"       → Admins contains Alice
PK = "GROUP#admins"  SK = "USER#bob"         → Admins contains Bob
```

GSI with inverted PK/SK enables both directions: "groups for user" and "users in group."

## GSI Overloading

A single GSI serves multiple access patterns by storing different entity types with different key semantics.

```
Base Table:
PK          SK              GSI1PK           GSI1SK
ORDER#123   ORDER#123       CUST#alice       ORDER#2024-01-15
ORDER#123   ITEM#widget     PROD#widget      ORDER#123
USER#alice  PROFILE         EMAIL#alice@co   USER#alice
```

GSI1 serves: "orders by customer" AND "orders containing product" AND "user by email." The PK/SK values carry different semantics per entity type.

**Trade-off**: Powerful but complex. Use only when you need to minimize GSI count for cost or when entities are queried together.

## TTL Strategies

| Pattern | TTL Source | Use Case |
|---------|-----------|----------|
| **Fixed duration** | `CreatedAt + 90 days` | Session tokens, temp data |
| **Event-relative** | `LastAccessedAt + 30 days` | Idle cleanup |
| **Business logic** | `ExpiresAt` from domain | License expiry, offers |
| **Sliding window** | Updated on each access | LRU-style eviction |

```csharp
// TTL must be Unix epoch seconds (NUMBER type)
public long? Ttl { get; set; }

public static long CalculateTtl(DateTime from, TimeSpan duration)
{
    return new DateTimeOffset(from.Add(duration), TimeSpan.Zero).ToUnixTimeSeconds();
}
```

**DynamoDB deletes TTL items within ~48 hours** of expiry (not instantly). Filter expired items in queries:

```
FilterExpression = "Ttl > :now OR attribute_not_exists(Ttl)"
```

## Capacity Planning

### Read Capacity Units (RCU)

| Read Type | Items ≤ 4KB | Items > 4KB |
|-----------|-------------|-------------|
| Strongly consistent | 1 RCU | ceil(size/4) RCU |
| Eventually consistent | 0.5 RCU | ceil(size/4) × 0.5 RCU |
| Transactional | 2 RCU | ceil(size/4) × 2 RCU |

### Write Capacity Units (WCU)

| Write Type | Items ≤ 1KB | Items > 1KB |
|-----------|-------------|-------------|
| Standard | 1 WCU | ceil(size/1) WCU |
| Transactional | 2 WCU | ceil(size/1) × 2 WCU |

### Item Size Calculation

```
Item size = sum of:
  - Attribute name lengths (UTF-8 bytes)
  - Attribute value sizes
  - 100 bytes overhead per item (approximate)
```

**String**: UTF-8 byte length + 1
**Number**: up to 38 digits of precision + 1
**Binary**: raw byte length + 1
**List/Map**: sum of nested elements + 3 bytes overhead each
**Boolean/Null**: 1 byte

### Burst Capacity

DynamoDB provides up to 300 seconds of unused capacity as burst. After burst is consumed, requests are throttled. Design for sustained throughput, not peak bursts.

## Reserved Words

DynamoDB reserves ~580 words (case-insensitive). Common ones that cause errors:

| Word | Problem | Solution |
|------|---------|----------|
| `Status` | Reserved | `#s` → `"Status"` in ExpressionAttributeNames |
| `Name` | Reserved | `#n` → `"Name"` |
| `Type` | Reserved | `#t` → `"Type"` |
| `Date` | Reserved | `#d` → `"Date"` |
| `Count` | Reserved | `#c` → `"Count"` |
| `Size` | Reserved | `#sz` → `"Size"` |
| `Key` | Reserved | `#k` → `"Key"` |
| `Value` | Reserved | `#v` → `"Value"` |

**Best practice**: Always use ExpressionAttributeNames for attribute names in expressions. It costs nothing and prevents reserved-word surprises.

```csharp
ExpressionAttributeNames = new Dictionary<string, string>
{
    { "#s", "Status" },
    { "#n", "Name" }
},
KeyConditionExpression = "#s = :status"
```

## Table Design Checklist

- [ ] All access patterns listed before designing keys
- [ ] PK has high cardinality (no hot partitions)
- [ ] SK supports range queries where needed
- [ ] GSIs created only for required access patterns (not speculative)
- [ ] GSI projections minimized (KEYS_ONLY when possible)
- [ ] Item size estimated (< 400KB limit, prefer < 4KB for read efficiency)
- [ ] TTL configured for temporary data
- [ ] DynamoDB Streams enabled if downstream processing needed
- [ ] Capacity mode chosen (on-demand for unpredictable, provisioned for steady)
- [ ] Reserved words handled with ExpressionAttributeNames
- [ ] Composite sort key format documented
- [ ] Pagination strategy defined for large result sets
