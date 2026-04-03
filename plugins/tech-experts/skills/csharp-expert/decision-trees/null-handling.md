# Decision Tree: Null Handling Strategy

**Purpose**: Decide how to handle nullable values in C# 8+ with Nullable Reference Types.

## Decision Flow

```
Start: Is null a valid value for this parameter/property/return?
├─ YES: Null is valid (e.g., user not found, optional parameter)
│   ├─ Annotate as nullable with ?
│   │   └─ string? name, User? GetUser(), void Process(int? id)
│   │
│   ├─ How to access nullable value safely?
│   │   ├─ Need default value if null?
│   │   │   └─ Use ?? (null-coalescing)
│   │   │       └─ var name = user?.Name ?? "Unknown"
│   │   │
│   │   ├─ Chain multiple potential nulls?
│   │   │   └─ Use ?. (null-conditional)
│   │   │       └─ var city = user?.Address?.City?.Name
│   │   │
│   │   └─ Execute code only if not null?
│   │       └─ Use if (x != null) or pattern matching
│   │           └─ if (user is not null) { ... }
│   │
│   └─ How to return null safely?
│       └─ Use nullable return type
│           └─ public User? FindUser(int id)
│
└─ NO: Null is NOT valid (e.g., required parameter)
    ├─ Annotate as non-nullable (no ?)
    │   └─ string name, User GetUser(), void Process(int id)
    │
    ├─ Validate parameters at public API boundary
    │   └─ ArgumentNullException.ThrowIfNull(parameter)
    │
    └─ If compiler can't prove non-null, when to use ! ?
        ├─ After complex initialization compiler can't track?
        │   └─ Use ! (null-forgiving operator)
        └─ Otherwise?
            └─ Fix the code, don't suppress warning
```

## Operator Reference

### ?. (Null-Conditional Operator)

**Use**: Safe navigation through potentially null references

```csharp
// Returns null if any part is null
var cityName = user?.Address?.City?.Name;

// Equivalent to:
string? cityName = null;
if (user != null && user.Address != null && user.Address.City != null)
{
    cityName = user.Address.City.Name;
}
```

### ?? (Null-Coalescing Operator)

**Use**: Provide default value when null

```csharp
var name = user?.Name ?? "Unknown";
var count = numbers?.Length ?? 0;

// Equivalent to:
var name = user?.Name != null ? user.Name : "Unknown";
```

### ??= (Null-Coalescing Assignment)

**Use**: Assign only if currently null (lazy initialization)

```csharp
private List<string>? _cache;

public List<string> GetCache()
{
    _cache ??= new List<string>(); // Initialize only if null
    return _cache;
}
```

### ! (Null-Forgiving Operator)

**Use**: Tell compiler "I know this is not null" (use sparingly!)

```csharp
private User? _currentUser;

public void Initialize(User user)
{
    _currentUser = user ?? throw new ArgumentNullException(nameof(user));
}

public string GetCurrentUserName()
{
    // We know it's initialized, compiler doesn't
    return _currentUser!.Name; // ! says "trust me, not null"
}
```

⚠️ **Warning**: Overusing ! defeats null safety. Only use when compiler can't infer non-null.

## Common Patterns

### Pattern 1: Optional Parameter

```csharp
public void SendEmail(string to, string? subject = null)
{
    subject ??= "No Subject"; // Default if null
    // Use subject (now guaranteed non-null)
}
```

### Pattern 2: Nullable Return (Not Found)

```csharp
public User? FindUser(int id)
{
    var user = _users.FirstOrDefault(u => u.Id == id);
    return user; // May be null if not found
}

// Caller handles null
var user = FindUser(123);
if (user != null)
{
    Console.WriteLine(user.Name);
}
```

### Pattern 3: Non-Nullable Parameter Validation

```csharp
public void ProcessUser(User user) // Non-nullable
{
    ArgumentNullException.ThrowIfNull(user); // Validate at boundary
    // user is guaranteed non-null here
    Console.WriteLine(user.Name);
}
```

### Pattern 4: Safe Property Access

```csharp
public string GetUserCity(User? user)
{
    // Safe navigation with default
    return user?.Address?.City?.Name ?? "Unknown";
}
```

### Pattern 5: Pattern Matching (C# 9+)

```csharp
public void ProcessUser(User? user)
{
    if (user is not null)
    {
        // Compiler knows user is non-null in this block
        Console.WriteLine(user.Name);
    }
}

// Or with pattern matching
public string GetUserName(User? user) => user switch
{
    null => "Unknown",
    _ => user.Name
};
```

## When to Use Each Annotation

### Use T? (Nullable)

✅ Optional parameters
✅ Return values that might not exist (FindUser, TryGet)
✅ Properties that can be null
✅ Database fields that allow NULL

### Use T (Non-Nullable)

✅ Required parameters
✅ Properties that must have value
✅ Return values that always exist
✅ After validation (ArgumentNullException.ThrowIfNull)

## Anti-Patterns

❌ **Suppressing valid warnings with !**
```csharp
public void Process(User? user)
{
    Console.WriteLine(user!.Name); // BAD: What if user is null?
}
```

❌ **Not handling nullable returns**
```csharp
var user = FindUser(123); // Returns User?
Console.WriteLine(user.Name); // Warning! Could be null
```

❌ **Using ? everywhere "to be safe"**
```csharp
public string? GetName() // BAD: Always returns name, never null
{
    return "John"; // Should be string, not string?
}
```

## Summary

**Null valid**: Use `?`, handle with `?.`, `??`, or null checks
**Null invalid**: No `?`, validate with ArgumentNullException.ThrowIfNull
**Null-conditional**: `?.` for safe navigation
**Null-coalescing**: `??` for default values
**Null-forgiving**: `!` only when compiler can't infer (rare)
