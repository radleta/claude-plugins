# Decision Tree: Dependency Injection Lifetimes

**Purpose**: Choose correct DI lifetime (Transient, Scoped, Singleton) for services.

## Decision Flow

```
Start: What is the service?
├─ Does service hold state or mutable data?
│   ├─ YES: State management
│   │   ├─ Is state per-request (HttpContext, user-specific)?
│   │   │   └─ Use Scoped → New instance per HTTP request
│   │   └─ Is state long-lived (cache, configuration)?
│   │       ├─ Is service thread-safe?
│   │       │   └─ Use Singleton → One instance, shared
│   │       └─ Not thread-safe?
│   │           └─ Use Transient → New instance each time
│   │
│   └─ NO: Stateless service
│       ├─ Does service use expensive resources (DbContext, HttpClient)?
│       │   └─ Use Scoped → Reuse within request, dispose after
│       ├─ Is service lightweight and stateless?
│       │   ├─ Used frequently?
│       │   │   └─ Use Singleton → Reuse everywhere
│       │   └─ Used rarely?
│       │       └─ Use Transient → Create when needed
│       └─ Is service IDisposable?
│           └─ Prefer Scoped or Singleton (not Transient)
```

## Transient (AddTransient)

**Characteristics**: New instance every time requested

✅ **Use for**:
- Lightweight, stateless services
- Services used rarely
- Helper/utility classes with no dependencies

```csharp
builder.Services.AddTransient<IEmailService, EmailService>();
builder.Services.AddTransient<IDateTimeProvider, DateTimeProvider>();
```

⚠️ **Avoid if**:
- Service implements IDisposable (causes memory leak if injected into Singleton)
- Service is expensive to create
- Service should be shared within request

## Scoped (AddScoped)

**Characteristics**: One instance per scope (typically one HTTP request in ASP.NET)

✅ **Use for** (Most Common):
- DbContext (EF Core) - always Scoped
- Per-request services (shopping cart, user context)
- Services that should share instance within request
- Services with IDisposable (disposed at end of request)

```csharp
builder.Services.AddDbContext<AppDbContext>(); // Scoped by default
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IShoppingCartService, ShoppingCartService>();
```

✅ **Safe injection**:
- Scoped can inject: Singleton ✅, Scoped ✅, Transient ✅

## Singleton (AddSingleton)

**Characteristics**: One instance for application lifetime

✅ **Use for**:
- Stateless, thread-safe services
- Configuration services
- Caching services (if thread-safe)
- Services used everywhere frequently

```csharp
builder.Services.AddSingleton<IMemoryCache, MemoryCache>();
builder.Services.AddSingleton<IConfiguration>(configuration);
builder.Services.AddSingleton<IDateTimeProvider, SystemDateTimeProvider>();
```

⚠️ **Requirements**:
- **MUST be thread-safe** (immutable or uses locks)
- **MUST NOT inject Scoped services** (captive dependency)
- **MUST NOT inject Transient IDisposable** (memory leak)

✅ **Safe injection**:
- Singleton can inject: Singleton only ✅

❌ **Forbidden**:
- Singleton injecting Scoped → Captive dependency
- Singleton injecting Transient IDisposable → Memory leak

## Special Cases

### DbContext: Always Scoped
```csharp
builder.Services.AddDbContext<AppDbContext>(); // Scoped
// Never Singleton (not thread-safe)
// Never Transient (connection overhead)
```

### HttpClient: Use IHttpClientFactory
```csharp
builder.Services.AddHttpClient<IApiService, ApiService>(); // Managed lifetime
// Never create HttpClient directly in Singleton
```

### Background Services: Singleton with Scoped Resolution
```csharp
public class DataProcessor : BackgroundService
{
    private readonly IServiceProvider _serviceProvider; // Inject provider, not Scoped

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var scope = _serviceProvider.CreateScope(); // Create scope
        var scopedService = scope.ServiceProvider.GetRequiredService<IDataService>();
        await scopedService.ProcessAsync();
    }
}
```

## Captive Dependency Problem

❌ **WRONG**: Singleton captures Scoped
```csharp
// Singleton service
public class CacheService // Registered as Singleton
{
    private readonly AppDbContext _context; // Scoped!

    public CacheService(AppDbContext context) // Captive dependency!
    {
        _context = context; // Context from first request, never updated
    }
}
```

✅ **CORRECT**: Inject IServiceProvider, resolve Scoped on-demand
```csharp
public class CacheService // Singleton
{
    private readonly IServiceProvider _serviceProvider;

    public CacheService(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public async Task<Data> GetDataAsync()
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await context.Data.ToListAsync();
    }
}
```

## Quick Reference

| Lifetime | Instance Count | Disposed When | Use For |
|----------|----------------|---------------|---------|
| Transient | Many (per request) | When consumer disposed | Lightweight, stateless |
| Scoped | One per request | End of request | DbContext, per-request state |
| Singleton | One | App shutdown | Stateless, thread-safe, config |

## Summary

**Most common**: Scoped (for services with DbContext)
**Safest**: Scoped (avoids captive dependencies)
**Performance**: Singleton (if thread-safe and stateless)
**Default choice**: When in doubt, use Scoped
