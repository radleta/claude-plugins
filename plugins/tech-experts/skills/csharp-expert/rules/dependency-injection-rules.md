# Dependency Injection Rules

Dependency Injection (DI) in .NET has strict rules about service lifetimes (Transient, Scoped, Singleton). Violating lifetime rules causes **memory leaks**, **captive dependencies**, **stale data**, **ObjectDisposedException**, and **race conditions**.

## The Problem: Why DI Lifetimes Matter

The DI container manages object lifetimes, but wrong lifetime choices break applications:
- **Captive dependencies** → Singleton captures Scoped service, causes stale data
- **Memory leaks** → Transient services never disposed, accumulate in Singleton
- **Disposed services** → Scoped service accessed outside request, ObjectDisposedException
- **Race conditions** → Singleton service not thread-safe, multiple threads corrupt state

**Key insight**: Lifetime rules are strict. Shorter-lived services must never be injected into longer-lived services.

---

## Rule 1: Understand the Three Lifetimes

**Statement**: .NET has three service lifetimes. Each has specific use cases and rules.

### Lifetimes Overview

**Transient** (`AddTransient`):
- New instance created every time requested
- Not shared, not cached
- Disposed when consumer is disposed

**Scoped** (`AddScoped`):
- One instance per scope (typically one HTTP request)
- Shared within scope, not across scopes
- Disposed when scope ends (end of request)

**Singleton** (`AddSingleton`):
- One instance for application lifetime
- Shared across all requests and threads
- Disposed when application shuts down

### Lifetime Hierarchy Rule

**Critical**: Longer-lived services must NOT inject shorter-lived services.

```
Singleton (longest)
    ↓ Can inject
Scoped (medium)
    ↓ Can inject
Transient (shortest)
```

**Allowed**:
- Transient can inject: Singleton, Scoped, Transient ✅
- Scoped can inject: Singleton, Scoped, Transient ✅
- Singleton can inject: Singleton only ✅

**Forbidden (Captive Dependency)**:
- Singleton injecting Scoped ❌ → Stale data
- Singleton injecting Transient ❌ → Memory leak
- Scoped injecting Transient in constructor ⚠️ → Effectively Scoped lifetime

---

## Rule 2: Never Inject Scoped Services into Singleton (Captive Dependency)

**Statement**: Singleton services must NOT inject Scoped services. This is a captive dependency and causes stale data.

### Why This Matters

Singleton lives for the application lifetime. Scoped lives for one request. If Singleton captures Scoped, the Scoped service never changes, holding stale data from the first request.

### ❌ WRONG: Singleton Captures Scoped

```csharp
// This is WRONG - Singleton captures Scoped DbContext
public class UserCache : IUserCache // Registered as Singleton
{
    private readonly AppDbContext _dbContext; // DbContext is Scoped!

    public UserCache(AppDbContext dbContext) // Captive dependency!
    {
        _dbContext = dbContext; // This DbContext frozen from first request
    }

    public User GetUser(int id)
    {
        return _dbContext.Users.Find(id); // Stale data!
    }
}

// Registration
builder.Services.AddDbContext<AppDbContext>(); // Scoped by default
builder.Services.AddSingleton<IUserCache, UserCache>(); // Captures DbContext!
```

**What breaks**:
1. First request creates `UserCache` with request 1's `DbContext`
2. Subsequent requests reuse same `UserCache` instance
3. `DbContext` from request 1 is still used (stale data, wrong user context)
4. May also get `ObjectDisposedException` if DbContext was disposed

### ✅ CORRECT: Inject IServiceProvider and Resolve Scoped

```csharp
// Use IServiceProvider to resolve Scoped service on-demand
public class UserCache : IUserCache // Registered as Singleton
{
    private readonly IServiceProvider _serviceProvider;

    public UserCache(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider; // Inject provider, not DbContext
    }

    public User GetUser(int id)
    {
        // Create scope and resolve Scoped service
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return dbContext.Users.Find(id); // Fresh DbContext each call
    }
}
```

**Why this works**: `IServiceProvider.CreateScope()` creates new scope each time. Gets fresh `DbContext` for each call. No captive dependency.

### ✅ CORRECT: Change Singleton to Scoped

```csharp
// Better: Make UserCache Scoped instead of Singleton
public class UserCache : IUserCache // Registered as Scoped
{
    private readonly AppDbContext _dbContext; // Both Scoped, same lifetime

    public UserCache(AppDbContext dbContext) // No captive dependency
    {
        _dbContext = dbContext;
    }

    public User GetUser(int id)
    {
        return _dbContext.Users.Find(id);
    }
}

// Registration
builder.Services.AddDbContext<AppDbContext>(); // Scoped
builder.Services.AddScoped<IUserCache, UserCache>(); // Scoped, matches DbContext
```

**Why this works**: Both services have same lifetime (Scoped). No captive dependency. Both disposed at end of request.

---

## Rule 3: DbContext Must Be Scoped

**Statement**: `DbContext` must always be registered as Scoped. Never Singleton or Transient.

### Why This Matters

- **Singleton**: DbContext is NOT thread-safe. Singleton + multiple requests = race conditions and data corruption
- **Transient**: Each DbContext connection is expensive. Transient creates unnecessary connections.
- **Scoped**: Perfect for request-scoped lifetime. One DbContext per request, disposed at end.

### ❌ WRONG: Singleton DbContext

```csharp
// This is WRONG - DbContext is not thread-safe
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(connectionString), ServiceLifetime.Singleton); // Race conditions!
```

**What breaks**: Multiple requests use same DbContext simultaneously. DbContext is not thread-safe. Data corruption, race conditions, crashes.

### ❌ WRONG: Transient DbContext

```csharp
// This is WRONG - creates too many connections
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(connectionString), ServiceLifetime.Transient); // Connection overhead!
```

**What breaks**: Every injection creates new DbContext and database connection. Expensive. Connection pool exhaustion.

### ✅ CORRECT: Scoped DbContext (Default)

```csharp
// Correct - Scoped lifetime (default)
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(connectionString)); // Scoped by default
```

**Why this works**: One DbContext per request. Reused within request. Disposed at end of request. Perfect for web APIs.

---

## Rule 4: HttpClient Must Use IHttpClientFactory

**Statement**: Never register `HttpClient` directly. Always use `IHttpClientFactory` with `AddHttpClient`.

### Why This Matters

Creating `HttpClient` directly causes socket exhaustion. `IHttpClientFactory` manages HttpClient lifetime and socket recycling correctly.

### ❌ WRONG: Registering HttpClient Directly

```csharp
// This is WRONG - socket exhaustion
builder.Services.AddScoped<HttpClient>(); // Don't do this!
builder.Services.AddSingleton(new HttpClient()); // Don't do this either!
```

**What breaks**: Socket exhaustion. Even disposing HttpClient doesn't close sockets immediately. Eventually "cannot assign requested address" error.

### ✅ CORRECT: Use AddHttpClient

```csharp
// Correct - IHttpClientFactory manages lifecycle
builder.Services.AddHttpClient<IMyService, MyService>();

public class MyService : IMyService
{
    private readonly HttpClient _httpClient;

    // HttpClient injected, managed by IHttpClientFactory
    public MyService(HttpClient httpClient)
    {
        _httpClient = httpClient; // Don't dispose this!
    }
}
```

**Why this works**: `IHttpClientFactory` manages HttpClient lifetime and socket recycling. No socket exhaustion.

---

## Rule 5: Transient Services with IDisposable Cause Memory Leaks

**Statement**: If a Transient service implements IDisposable, it's tracked by the container and only disposed when the container/scope is disposed. Can cause memory leaks.

### Why This Matters

Transient services are created frequently. If they implement IDisposable, the container tracks them for disposal. In long-lived scopes (e.g., Singleton consumer), Transient instances accumulate and never dispose until application shutdown.

### ❌ WRONG: Transient IDisposable Injected into Singleton

```csharp
public class MyDisposableService : IDisposable // Implements IDisposable
{
    public void Dispose() { /* cleanup */ }
}

// Registered as Transient
builder.Services.AddTransient<MyDisposableService>();

// Injected into Singleton
public class MySingleton
{
    private readonly MyDisposableService _service; // Memory leak!

    public MySingleton(MyDisposableService service) // Transient never disposed
    {
        _service = service;
    }
}
```

**What breaks**: Singleton creates one instance of `MyDisposableService` at startup. Container tracks it for disposal. But Singleton lives until shutdown. `MyDisposableService` never disposed until shutdown. Memory leak if holding resources.

### ✅ CORRECT: Use Scoped or Singleton Instead

```csharp
// If service is IDisposable, prefer Scoped or Singleton lifetime
builder.Services.AddScoped<MyDisposableService>(); // Disposed at end of scope

// Or if truly stateless
builder.Services.AddSingleton<MyDisposableService>(); // Disposed at shutdown
```

**Why this works**: Scoped is disposed at end of request. Singleton disposed at shutdown. Clear disposal points.

---

## Rule 6: Constructor Injection, Not Property Injection

**Statement**: Use constructor injection for required dependencies. Property injection should be rare.

### Why This Matters

Constructor injection makes dependencies explicit and required. Property injection allows incomplete initialization.

### ❌ WRONG: Property Injection

```csharp
public class UserService
{
    // This is WRONG - property injection
    public IUserRepository Repository { get; set; } // Could be null!

    public async Task<User> GetUserAsync(int id)
    {
        return await Repository.GetUserAsync(id); // NullReferenceException if not set!
    }
}
```

**What breaks**: `Repository` could be null. No compile-time enforcement. Can forget to set property.

### ✅ CORRECT: Constructor Injection

```csharp
public class UserService
{
    private readonly IUserRepository _repository;

    // Constructor injection - required dependency
    public UserService(IUserRepository repository)
    {
        _repository = repository ?? throw new ArgumentNullException(nameof(repository));
    }

    public async Task<User> GetUserAsync(int id)
    {
        return await _repository.GetUserAsync(id); // Safe, always initialized
    }
}
```

**Why this works**: Constructor enforces dependency is provided. Compiler ensures `_repository` is initialized. No nulls possible.

---

## Summary Checklist

Before registering services, verify:

- [ ] **Lifetime hierarchy**: Longer-lived never inject shorter-lived
- [ ] **No captive dependencies**: Singleton never injects Scoped/Transient
- [ ] **DbContext is Scoped** (default lifetime)
- [ ] **HttpClient via IHttpClientFactory** (AddHttpClient)
- [ ] **Transient + IDisposable** → Consider Scoped instead
- [ ] **Constructor injection** for required dependencies
- [ ] **Thread safety** for Singleton services (immutable or locks)
- [ ] **Dispose only what you create**, not injected dependencies

---

**These DI rules prevent memory leaks, captive dependencies, and stale data!**
