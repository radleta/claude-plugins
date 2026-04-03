# LINQ Best Practices

LINQ (Language Integrated Query) uses deferred execution, which is powerful but dangerous when misused. Common mistakes cause **multiple database queries**, **O(n²) performance**, **modified collection exceptions**, and **unexpected behavior**.

## The Problem: Deferred Execution

LINQ queries don't execute immediately. They're executed when enumerated (foreach, ToList, Count, etc.). This leads to:
- **Multiple enumeration** → Same query executed multiple times, double database calls
- **Captured variables** → Query captures variable reference, not value
- **Modified collection** → Enumerating while modifying throws exception
- **Inefficient queries** → N+1 queries, missing indexes, Cartesian products

**Key insight**: LINQ queries are blueprints, not results. They execute when enumerated, not when created.

---

## Rule 1: Materialize Queries Before Multiple Enumeration

**Statement**: If you'll enumerate an `IEnumerable` more than once, call `.ToList()` or `.ToArray()` to materialize it.

### Why This Matters

Each enumeration re-executes the query. For database queries, this means multiple round-trips. For expensive computations, this means repeated work.

### ❌ WRONG: Multiple Enumeration of Database Query

```csharp
// This is WRONG - query executed twice (2 database calls!)
public async Task ProcessUsersAsync()
{
    var users = _dbContext.Users.Where(u => u.IsActive); // IQueryable, not executed yet

    // First enumeration - database query 1
    var count = users.Count(); // SELECT COUNT(*) FROM Users WHERE IsActive = 1

    // Second enumeration - database query 2 (same query again!)
    foreach (var user in users) // SELECT * FROM Users WHERE IsActive = 1
    {
        Console.WriteLine(user.Name);
    }
}
```

**What breaks**: Database queried twice with same query. Doubled latency. Wasted connection time.

### ❌ WRONG: Multiple Enumeration of Expensive Computation

```csharp
// This is WRONG - computation runs twice
public void ProcessNumbers(List<int> numbers)
{
    var expensive = numbers.Select(n => ExpensiveCalculation(n)); // Deferred

    var max = expensive.Max(); // Runs ExpensiveCalculation for all numbers
    var min = expensive.Min(); // Runs ExpensiveCalculation for all numbers again!
}
```

**What breaks**: `ExpensiveCalculation` called 2N times instead of N times. Doubled computation time.

### ✅ CORRECT: Materialize with ToList()

```csharp
// Materialize before multiple uses
public async Task ProcessUsersAsync()
{
    var users = await _dbContext.Users
        .Where(u => u.IsActive)
        .ToListAsync(); // Database query executes here, returns List<User>

    var count = users.Count; // No database call, uses List.Count property
    foreach (var user in users) // No database call, enumerates List
    {
        Console.WriteLine(user.Name);
    }
}
```

**Why this works**: `.ToListAsync()` executes query once and stores results. Subsequent operations use the in-memory list. One database call.

### ✅ CORRECT: Materialize Expensive Computation

```csharp
public void ProcessNumbers(List<int> numbers)
{
    var results = numbers
        .Select(n => ExpensiveCalculation(n))
        .ToList(); // Executes immediately, stores results

    var max = results.Max(); // No re-computation, uses List
    var min = results.Min(); // No re-computation, uses List
}
```

**Why this works**: `.ToList()` executes `Select` once and caches results. N computations instead of 2N.

---

## Rule 2: Don't Enumerate Inside Loops (N+1 Query Problem)

**Statement**: Don't execute queries inside loops. It causes N+1 queries. Fetch all data upfront or use joins.

### Why This Matters

Querying inside a loop executes N queries (one per iteration) instead of one query. This is the classic N+1 problem: 1 query for main data + N queries for related data.

### ❌ WRONG: Query Inside Loop (N+1 Problem)

```csharp
// This is WRONG - N+1 queries to database
public async Task<List<OrderDto>> GetOrdersWithCustomersAsync()
{
    var orders = await _dbContext.Orders.ToListAsync(); // 1 query

    var result = new List<OrderDto>();
    foreach (var order in orders) // N iterations
    {
        // Database query inside loop - N queries!
        var customer = await _dbContext.Customers
            .FirstOrDefaultAsync(c => c.Id == order.CustomerId); // Query per order

        result.Add(new OrderDto
        {
            OrderId = order.Id,
            CustomerName = customer?.Name
        });
    }
    return result;
}
```

**What breaks**: If there are 100 orders, this makes 101 database queries (1 for orders + 100 for customers). Terrible performance.

### ✅ CORRECT: Use Include for Related Data

```csharp
// Use Include to fetch related data in one query
public async Task<List<OrderDto>> GetOrdersWithCustomersAsync()
{
    var orders = await _dbContext.Orders
        .Include(o => o.Customer) // Joins Customer table
        .ToListAsync(); // Single query with JOIN

    var result = orders.Select(order => new OrderDto
    {
        OrderId = order.Id,
        CustomerName = order.Customer?.Name
    }).ToList();

    return result;
}
```

**Why this works**: `.Include()` generates SQL JOIN. One database query instead of N+1. Massively faster.

### ✅ CORRECT: Fetch All, Then Join in Memory

```csharp
// Alternative: Fetch both collections, join in memory
public async Task<List<OrderDto>> GetOrdersWithCustomersAsync()
{
    var orders = await _dbContext.Orders.ToListAsync(); // Query 1
    var customerIds = orders.Select(o => o.CustomerId).Distinct().ToList();
    var customers = await _dbContext.Customers
        .Where(c => customerIds.Contains(c.Id))
        .ToListAsync(); // Query 2 (WHERE IN)

    // Join in memory (no more database calls)
    var result = orders.Select(order => new OrderDto
    {
        OrderId = order.Id,
        CustomerName = customers.FirstOrDefault(c => c.Id == order.CustomerId)?.Name
    }).ToList();

    return result;
}
```

**Why this works**: Two database queries total (orders + customers). Join happens in memory. Much better than N+1.

---

## Rule 3: Don't Call ToList() Too Early

**Statement**: Don't materialize queries before filtering/projecting. Let database do the work.

### Why This Matters

Calling `.ToList()` early fetches all data into memory, then filters in C#. Better to filter in database (SQL WHERE clause) which is optimized and indexed.

### ❌ WRONG: ToList Before Filtering

```csharp
// This is WRONG - fetches all users, filters in C#
public async Task<List<User>> GetActiveUsersAsync()
{
    var allUsers = await _dbContext.Users.ToListAsync(); // Fetches ALL users from DB

    // Filters in C# (in memory), not in SQL
    var activeUsers = allUsers.Where(u => u.IsActive).ToList();
    return activeUsers;
}
```

**What breaks**: Fetches 1 million users from database, then filters in C# to 10,000. Wasted network bandwidth, memory, and time.

### ✅ CORRECT: Filter Before Materializing

```csharp
// Filter in database, then materialize
public async Task<List<User>> GetActiveUsersAsync()
{
    var activeUsers = await _dbContext.Users
        .Where(u => u.IsActive) // SQL WHERE clause
        .ToListAsync(); // Fetches only active users

    return activeUsers;
}
```

**Why this works**: Database filters with `WHERE IsActive = 1`. Only active users returned. Much less data transferred and processed.

### ❌ WRONG: ToList Before Projection

```csharp
// This is WRONG - fetches all columns, then projects
public async Task<List<string>> GetUserNamesAsync()
{
    var users = await _dbContext.Users.ToListAsync(); // SELECT * (all columns)

    return users.Select(u => u.Name).ToList(); // Projects in C#
}
```

**What breaks**: Fetches all columns from database (Name, Email, Password, etc.), but only uses Name. Wasted bandwidth.

### ✅ CORRECT: Project Before Materializing

```csharp
// Project in database, then materialize
public async Task<List<string>> GetUserNamesAsync()
{
    return await _dbContext.Users
        .Select(u => u.Name) // SQL SELECT Name
        .ToListAsync(); // Fetches only Name column
}
```

**Why this works**: Database returns only Name column. Less data transferred. Faster query.

---

## Rule 4: Use Any() Instead of Count() > 0

**Statement**: To check if elements exist, use `.Any()` instead of `.Count() > 0`. It's faster.

### Why This Matters

`.Count()` enumerates entire collection (or runs `SELECT COUNT(*)`). `.Any()` stops at first element. For existence checks, `.Any()` is O(1) vs `.Count()` O(n).

### ❌ WRONG: Count() for Existence Check

```csharp
// This is WRONG - counts all elements just to check if > 0
if (_dbContext.Users.Count() > 0) // SELECT COUNT(*) FROM Users
{
    Console.WriteLine("Users exist");
}

if (numbers.Count() > 0) // Enumerates entire collection
{
    Console.WriteLine("Numbers exist");
}
```

**What breaks**: Counts every element. For database, runs `SELECT COUNT(*)` (scans table). Slow for large collections.

### ✅ CORRECT: Any() for Existence Check

```csharp
// Use Any() - stops at first element
if (await _dbContext.Users.AnyAsync()) // SELECT TOP 1 (much faster)
{
    Console.WriteLine("Users exist");
}

if (numbers.Any()) // Checks first element only
{
    Console.WriteLine("Numbers exist");
}
```

**Why this works**: `.Any()` stops at first element. For database, generates `SELECT TOP 1` (instant). For collections, O(1) instead of O(n).

---

## Rule 5: Avoid Modifying Collection During Enumeration

**Statement**: Don't add/remove items from a collection while enumerating it. It throws `InvalidOperationException`.

### ❌ WRONG: Modifying During Enumeration

```csharp
// This is WRONG - throws InvalidOperationException
var numbers = new List<int> { 1, 2, 3, 4, 5 };

foreach (var number in numbers)
{
    if (number % 2 == 0)
    {
        numbers.Remove(number); // Exception: Collection was modified
    }
}
```

**What breaks**: `foreach` holds an enumerator. Modifying collection invalidates enumerator. Throws `InvalidOperationException: Collection was modified; enumeration operation may not execute.`

### ✅ CORRECT: ToList() Before Modifying

```csharp
// Create snapshot with ToList(), iterate snapshot
var numbers = new List<int> { 1, 2, 3, 4, 5 };

foreach (var number in numbers.ToList()) // Iterate copy
{
    if (number % 2 == 0)
    {
        numbers.Remove(number); // Modifying original, safe
    }
}
```

**Why this works**: `.ToList()` creates a copy. We enumerate the copy, modify the original. No conflict.

### ✅ CORRECT: Use LINQ to Create New Collection

```csharp
// Better: Use LINQ to create new filtered collection
var numbers = new List<int> { 1, 2, 3, 4, 5 };
var oddNumbers = numbers.Where(n => n % 2 != 0).ToList();
```

**Why this works**: Doesn't modify original. Creates new collection. Cleaner and safer.

---

## Rule 6: Understand IQueryable vs IEnumerable

**Statement**: `IQueryable` builds SQL (database-side execution). `IEnumerable` executes in C# (client-side execution). Use IQueryable for database queries.

### Key Difference

- **IQueryable<T>**: Expression tree, translated to SQL, executed by database
- **IEnumerable<T>**: Delegates, executed in C# memory

### ❌ WRONG: Forcing IEnumerable on Database Query

```csharp
// This is WRONG - casts to IEnumerable, forces client-side execution
public async Task<List<User>> GetActiveUsersAsync()
{
    IEnumerable<User> users = _dbContext.Users; // Cast to IEnumerable

    // This Where runs in C#, not SQL!
    var activeUsers = users.Where(u => u.IsActive).ToList(); // Fetches ALL users, filters in C#
    return activeUsers;
}
```

**What breaks**: Casting to `IEnumerable` breaks query translation. Database returns all users, then C# filters. Terrible performance.

### ✅ CORRECT: Keep IQueryable for Database Queries

```csharp
// Keep IQueryable to build SQL query
public async Task<List<User>> GetActiveUsersAsync()
{
    IQueryable<User> query = _dbContext.Users; // IQueryable

    // This Where translates to SQL WHERE clause
    var activeUsers = await query
        .Where(u => u.IsActive) // Part of SQL query
        .ToListAsync(); // Executes SQL with WHERE

    return activeUsers;
}
```

**Why this works**: `IQueryable` builds SQL. `WHERE` clause in SQL. Database does filtering. Efficient.

---

## Summary Checklist

Before writing LINQ queries:

- [ ] **Materialize if enumerating multiple times** (ToList/ToArray)
- [ ] **No queries inside loops** (N+1 problem) - use Include or batch fetch
- [ ] **Filter before materializing** (Where before ToList)
- [ ] **Project before materializing** (Select before ToList)
- [ ] **Use Any() for existence checks**, not Count() > 0
- [ ] **Don't modify collection during enumeration** (ToList() first)
- [ ] **Keep IQueryable for database queries** (don't cast to IEnumerable early)
- [ ] **Use FirstOrDefault, not First** (avoid exceptions for missing elements)
- [ ] **Use async methods** (ToListAsync, FirstOrDefaultAsync, etc.)

---

**These LINQ patterns prevent performance issues, multiple database queries, and runtime exceptions!**
