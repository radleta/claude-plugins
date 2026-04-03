# C# Code Generation Validation Checklist

**Purpose**: Verify generated C# code prevents Top 10 mistakes and follows best practices.

## Critical Rules (Must Pass)

### Async/Await (Rules #1-#3, #8)

- [ ] **No async void** (except event handlers with try-catch)
  - All async methods return `Task` or `Task<T>`
  - Event handlers use `async void` only with exception handling inside

- [ ] **No .Result or .Wait()** blocking calls
  - All Task results accessed with `await`
  - No deadlock-prone blocking

- [ ] **CancellationToken parameter** on async I/O methods
  - Methods performing I/O have `CancellationToken` parameter with `= default`
  - Token passed through entire async chain

- [ ] **OperationCanceledException handled** correctly
  - Catch and re-throw OperationCanceledException
  - Don't swallow cancellation exceptions

- [ ] **Async suffix** on async method names
  - Methods returning Task have `Async` suffix
  - Sync methods don't have `Async` suffix

**Verification**:
```bash
# Check for async void
grep -n "async void" --exclude="*Event*" *.cs
# Expected: Only in event handlers or none

# Check for blocking calls
grep -n "\.Result\|\.Wait()" *.cs
# Expected: None

# Check for CancellationToken
grep -n "async Task" *.cs | grep -v "CancellationToken"
# Expected: Only short sync-over-async or pass-through methods
```

### Resource Management (Rule #4)

- [ ] **using statements** for all IDisposable objects created
  - FileStream, HttpClient (if not DI), DbContext (if ad-hoc) wrapped in `using`
  - Prefer `using var` declaration (C# 8+)

- [ ] **IDisposable implementation** when class owns IDisposable resources
  - Full IDisposable pattern with Dispose(bool disposing)
  - GC.SuppressFinalize(this) in Dispose()
  - _disposed flag to prevent double-disposal

- [ ] **Don't dispose DI-injected objects**
  - HttpClient from IHttpClientFactory not disposed
  - DbContext from DI not disposed
  - Only dispose resources you create

- [ ] **ObjectDisposedException.ThrowIf** in methods after disposal possible
  - Public methods check _disposed flag

**Verification**:
```bash
# Check IDisposable implementation
grep -A 10 "class.*:" *.cs | grep "IDisposable"
# Verify proper pattern if found

# Check for using statements with FileStream
grep -B 2 "new FileStream" *.cs | grep "using"
# Expected: All FileStream creations have using
```

### Null Safety (Rule #5)

- [ ] **Nullable annotations** correct (`?` when null valid, no `?` when required)
  - Parameters: `User? user` if null valid, `User user` if required
  - Returns: `User?` if may return null, `User` if always returns

- [ ] **ArgumentNullException.ThrowIfNull** on non-nullable parameters
  - Public API methods validate non-nullable parameters
  - Fail fast at boundary

- [ ] **Null-conditional operators** for safe navigation
  - Use `?.` for chained property access on nullable
  - Use `??` for default values

- [ ] **Null-forgiving operator** used sparingly
  - `!` only when compiler can't infer non-null
  - Not used to suppress valid warnings

**Verification**:
```bash
# Check if nullable enabled
grep "Nullable>enable" *.csproj
# Expected: Found (for new projects)

# Check constructor parameter validation
grep -A 5 "public.*(" *.cs | grep "ArgumentNullException"
# Expected: Found for non-nullable parameters
```

### Naming Conventions (Rule #6)

- [ ] **Interfaces** have `I-` prefix (IPascalCase)
  - `IUserService`, `IRepository<T>`

- [ ] **Classes, methods, properties** use PascalCase
  - `UserService`, `GetUser`, `UserName`

- [ ] **Parameters, local variables** use camelCase
  - `userId`, `userName`, `result`

- [ ] **Private fields** use `_camelCase` with underscore
  - `_repository`, `_logger`, `_httpClient`

- [ ] **Async suffix** on async methods
  - `GetUserAsync`, `SaveDataAsync`

- [ ] **Boolean properties** named as questions
  - `IsActive`, `HasPermission`, `CanEdit`

**Verification**:
```bash
# Check interfaces have I-prefix
grep -n "interface [^I]" *.cs
# Expected: None (all interfaces start with I)

# Check async methods have Async suffix
grep -n "async Task" *.cs | grep -v "Async"
# Expected: None or only pass-through methods
```

## High Priority Rules

### LINQ Best Practices (Rule #7)

- [ ] **Materialize before multiple enumeration**
  - `.ToList()` or `.ToArray()` if enumerating multiple times
  - Not re-executing queries

- [ ] **No queries inside loops** (N+1 problem)
  - Use `.Include()` for related data
  - Batch fetch with `WHERE IN` instead of loop queries

- [ ] **Filter before materializing**
  - `.Where()` before `.ToList()` (SQL WHERE clause)

- [ ] **Project before materializing**
  - `.Select()` before `.ToList()` (SQL SELECT specific columns)

- [ ] **Use Any() not Count() > 0** for existence checks
  - `if (items.Any())` instead of `if (items.Count() > 0)`

**Verification**:
```bash
# Check for Count() > 0
grep -n "Count() > 0\|Count()>0" *.cs
# Expected: None (use Any() instead)

# Check for ToList inside Where
grep -n "ToList()" *.cs
# Verify comes after Where/Select, not before
```

### Dependency Injection (Rule #9)

- [ ] **Constructor injection** used (not property injection)
  - Dependencies in constructor parameters

- [ ] **Correct lifetimes** registered
  - DbContext as Scoped
  - HttpClient via IHttpClientFactory
  - Stateless services as Singleton or Scoped

- [ ] **No captive dependencies**
  - Singleton doesn't inject Scoped
  - Singleton doesn't inject Transient IDisposable

- [ ] **Don't dispose injected dependencies**
  - No `_httpClient?.Dispose()` for DI-injected HttpClient

**Verification**:
```bash
# Check DI registrations
grep "AddDbContext\|AddScoped\|AddSingleton\|AddTransient" Program.cs
# Verify DbContext is Scoped (default), no Singleton injecting Scoped
```

### Collection Types (Rule #10)

- [ ] **HashSet for fast lookups** (not List.Contains)
  - Use `HashSet<T>` when checking Contains frequently

- [ ] **Dictionary for key-value** lookups
  - Use `Dictionary<TKey, TValue>` for key-based access

- [ ] **List for sequential** access
  - Use `List<T>` for ordered, indexed access

**Verification**: Manual review of collection usage patterns

## Build Verification

### Compilation

```bash
dotnet build
# Expected: Build succeeded, 0 Warning(s), 0 Error(s)
```

### Analyzer Warnings

```bash
dotnet build /warnaserror
# Expected: Build succeeded (no warnings promoted to errors)
```

### Nullable Warnings

```bash
# If nullable enabled in .csproj
grep -n "CS8600\|CS8601\|CS8602\|CS8603" build-output.txt
# Expected: None (no nullable warnings)
```

## Top 10 Mistakes Verification Summary

| Mistake | Verification Method | Expected Result |
|---------|---------------------|-----------------|
| #1: async void | `grep "async void"` | None (except event handlers) |
| #2: Missing async/await | Review async methods | All use await |
| #3: .Result/.Wait() | `grep "\.Result\|\.Wait()"` | None |
| #4: Missing IDisposable | Review resource usage | All wrapped in using |
| #5: Null handling | Check nullable annotations | Correct ? usage |
| #6: Naming conventions | Check I-prefix, PascalCase | All correct |
| #7: LINQ enumeration | Review ToList calls | After Where/Select |
| #8: Missing cancellation | Check CancellationToken | Present on I/O methods |
| #9: Captive dependencies | Review DI registrations | No Singleton→Scoped |
| #10: Wrong collection types | Review Contains calls | HashSet for frequent checks |

## Final Checklist

Before submitting generated code:

- [ ] All Critical Rules pass
- [ ] All High Priority Rules pass
- [ ] Code compiles without warnings
- [ ] Nullable reference types handled correctly
- [ ] No Top 10 mistakes present
- [ ] Code follows project conventions (detected in investigation)

---

**This checklist prevents the Top 10 C# agent mistakes and ensures production-ready code!**
