# Decision Tree: Collection Type Selection

**Purpose**: Choose the correct collection type (List, HashSet, Dictionary, Array) for the use case.

## Decision Flow

```
Start: What operations are needed?
├─ Need fast lookup by key?
│   └─ Use Dictionary<TKey, TValue>
│       └─ O(1) lookup by key
│
├─ Need unique values only (no duplicates)?
│   └─ Use HashSet<T>
│       └─ O(1) add/contains, automatically enforces uniqueness
│
├─ Need ordered sequential access?
│   ├─ Size known and fixed?
│   │   └─ Use Array (T[])
│   │       └─ Best performance, fixed size
│   └─ Size dynamic?
│       └─ Use List<T>
│           └─ O(1) index access, dynamic size
│
├─ Need sorted order?
│   ├─ By value?
│   │   └─ Use SortedSet<T>
│   └─ By key?
│       └─ Use SortedDictionary<TKey, TValue>
│
└─ Need queue/stack behavior?
    ├─ First-in, first-out (FIFO)?
    │   └─ Use Queue<T>
    └─ Last-in, first-out (LIFO)?
        └─ Use Stack<T>
```

## List<T> - Sequential Access

✅ **Use when**:
- Need ordered collection
- Access by index frequently
- Size is dynamic (add/remove items)
- No need for fast Contains/lookup

```csharp
var users = new List<User>();
users.Add(user); // O(1) amortized
var first = users[0]; // O(1) index access
var exists = users.Contains(user); // O(n) - slow!
```

❌ **Don't use for**:
- Fast lookups (use HashSet or Dictionary instead)
- Checking if item exists frequently (Contains is O(n))

## HashSet<T> - Unique Values

✅ **Use when**:
- Need unique values (no duplicates)
- Frequent Contains checks
- Don't care about order
- Set operations (union, intersect, except)

```csharp
var uniqueIds = new HashSet<int>();
uniqueIds.Add(1); // O(1), automatically prevents duplicates
uniqueIds.Add(1); // Does nothing (already exists)
var exists = uniqueIds.Contains(1); // O(1) - fast!
```

✅ **Perfect for**:
- Removing duplicates from collection
- Checking membership quickly
- Set algebra operations

## Dictionary<TKey, TValue> - Key-Value Pairs

✅ **Use when**:
- Need fast lookup by key
- Mapping keys to values
- Key-based access pattern

```csharp
var userById = new Dictionary<int, User>();
userById[1] = user; // O(1) add
var user = userById[1]; // O(1) lookup by key
var exists = userById.ContainsKey(1); // O(1) - fast!
```

✅ **Perfect for**:
- Caching (key → cached value)
- Index by ID (userId → User)
- Configuration (setting name → value)

## Array (T[]) - Fixed Size

✅ **Use when**:
- Size is known and won't change
- Performance-critical (hotpath)
- Interfacing with low-level APIs

```csharp
var numbers = new int[100]; // Fixed size
numbers[0] = 42; // O(1) access
```

⚠️ **Limitations**:
- Cannot resize (size fixed at creation)
- Use List<T> if size unknown

## Performance Comparison

| Operation | List<T> | HashSet<T> | Dictionary<TKey,TValue> | Array |
|-----------|---------|------------|-------------------------|-------|
| Add | O(1) | O(1) | O(1) | N/A |
| Access by index | O(1) | N/A | N/A | O(1) |
| Access by key | O(n) | N/A | O(1) | N/A |
| Contains | O(n) | O(1) | O(1) key | O(n) |
| Remove | O(n) | O(1) | O(1) | N/A |
| Insert at position | O(n) | N/A | N/A | N/A |

## Common Mistake: Wrong Collection Type

❌ **WRONG**: List for lookups
```csharp
var userIds = new List<int> { 1, 2, 3, 4, 5 };

foreach (var order in orders)
{
    if (userIds.Contains(order.UserId)) // O(n) lookup!
    {
        // Process order
    }
}
```

✅ **CORRECT**: HashSet for lookups
```csharp
var userIds = new HashSet<int> { 1, 2, 3, 4, 5 };

foreach (var order in orders)
{
    if (userIds.Contains(order.UserId)) // O(1) lookup!
    {
        // Process order
    }
}
```

## LINQ Materialization Decision

**When to materialize** (ToList/ToArray/ToHashSet):
- Multiple enumeration needed
- Collection will be modified
- Need to freeze query results

```csharp
// Materialize if enumerating multiple times
var activeUsers = _context.Users.Where(u => u.IsActive).ToList();
var count = activeUsers.Count; // No re-query
foreach (var user in activeUsers) { } // No re-query

// Or materialize to HashSet for fast lookups
var activeUserIds = _context.Users
    .Where(u => u.IsActive)
    .Select(u => u.Id)
    .ToHashSet(); // O(1) lookups
```

## Summary

**Fast lookups**: Use HashSet or Dictionary
**Sequential access**: Use List
**Fixed size, performance-critical**: Use Array
**Unique values**: Use HashSet
**Key-value mapping**: Use Dictionary
**Default choice**: List<T> (most common, flexible)
