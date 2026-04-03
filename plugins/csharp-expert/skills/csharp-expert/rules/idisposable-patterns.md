# IDisposable Patterns

IDisposable in C# manages unmanaged resources (file handles, database connections, network sockets, memory). Failing to properly dispose resources causes **resource leaks**, **file handle exhaustion**, **memory leaks**, and **"file in use" errors**. These failures accumulate over time and crash applications.

## The Problem: Why IDisposable Matters

.NET's garbage collector handles managed memory, but NOT unmanaged resources:
- **File streams** → File handles leak, eventually "too many open files" error
- **Database connections** → Connection pool exhausted, app can't query database
- **HttpClient** → Socket exhaustion, "cannot assign requested address" error
- **Unmanaged memory** → Memory leak, app consumes all RAM

**Key insight**: If a class implements IDisposable, you MUST call Dispose() or use `using` statements.

---

## Rule 1: Always Use `using` for IDisposable Objects

**Statement**: When creating an IDisposable object, wrap it in a `using` statement or `using` declaration to ensure Dispose() is called.

### Why This Matters

If you forget to call Dispose(), resources leak. `using` statements guarantee Dispose() is called even if exceptions occur.

### ❌ WRONG: No using Statement

```csharp
// This is WRONG - file handle leaks if exception occurs
public void WriteData(string path, string data)
{
    var stream = new FileStream(path, FileMode.Create);
    var writer = new StreamWriter(stream);
    writer.WriteLine(data); // If this throws, stream never disposed
}
```

**What breaks**: If `WriteLine` throws an exception, `FileStream` and `StreamWriter` are never disposed. File handle leaks. After enough calls, "too many open files" error occurs.

### ❌ WRONG: Manual Dispose Without try-finally

```csharp
// This is WRONG - exception prevents Dispose()
public void ReadFile(string path)
{
    var reader = new StreamReader(path);
    string content = reader.ReadToEnd(); // If this throws, Dispose never called
    reader.Dispose();
}
```

**What breaks**: If `ReadToEnd()` throws, `Dispose()` is never reached. File handle leaks.

### ✅ CORRECT: using Statement (Traditional)

```csharp
// Traditional using statement - Dispose guaranteed
public void WriteData(string path, string data)
{
    using (var stream = new FileStream(path, FileMode.Create))
    using (var writer = new StreamWriter(stream))
    {
        writer.WriteLine(data);
    } // Dispose() called here, even if exception occurs
}
```

**Why this works**: `using` is syntactic sugar for try-finally. Dispose() is guaranteed to be called, even if exceptions occur.

### ✅ CORRECT: using Declaration (C# 8+)

```csharp
// Modern using declaration - cleaner syntax
public void WriteData(string path, string data)
{
    using var stream = new FileStream(path, FileMode.Create);
    using var writer = new StreamWriter(stream);
    writer.WriteLine(data);
} // Dispose() called here automatically
```

**Why this works**: `using` declaration disposes at end of scope. Cleaner code, same safety. Prefer this in C# 8+.

### ✅ CORRECT: Nested using for Multiple Resources

```csharp
public async Task CopyFileAsync(string source, string destination)
{
    using var sourceStream = new FileStream(source, FileMode.Open);
    using var destStream = new FileStream(destination, FileMode.Create);
    await sourceStream.CopyToAsync(destStream);
} // Both streams disposed in reverse order
```

**Why this works**: Multiple `using` declarations work correctly. Disposal happens in reverse order.

---

## Rule 2: Implement IDisposable for Classes That Own Unmanaged Resources

**Statement**: If your class holds IDisposable fields or unmanaged resources, implement IDisposable yourself.

### Why This Matters

Classes that own IDisposable objects are responsible for disposing them. If you don't implement IDisposable, callers have no way to clean up resources held by your class.

### ❌ WRONG: Class Owns IDisposable But Doesn't Implement IDisposable

```csharp
// This is WRONG - no way for caller to dispose _httpClient
public class DataFetcher
{
    private readonly HttpClient _httpClient = new HttpClient();

    public async Task<string> FetchDataAsync(string url)
    {
        return await _httpClient.GetStringAsync(url);
    }
    // Missing IDisposable implementation - _httpClient leaks!
}
```

**What breaks**: `HttpClient` is never disposed. Socket handles leak. Eventually "cannot assign requested address" error.

### ✅ CORRECT: Implement IDisposable Pattern

```csharp
public class DataFetcher : IDisposable
{
    private readonly HttpClient _httpClient = new HttpClient();
    private bool _disposed;

    public async Task<string> FetchDataAsync(string url)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        return await _httpClient.GetStringAsync(url);
    }

    public void Dispose()
    {
        Dispose(true);
        GC.SuppressFinalize(this);
    }

    protected virtual void Dispose(bool disposing)
    {
        if (_disposed) return;

        if (disposing)
        {
            // Dispose managed resources
            _httpClient?.Dispose();
        }

        // Dispose unmanaged resources (if any)

        _disposed = true;
    }
}
```

**Why this works**: Follows standard IDisposable pattern. Disposes `_httpClient` properly. Prevents double-disposal with `_disposed` flag.

### ✅ CORRECT: Usage with using

```csharp
// Caller wraps in using to ensure disposal
using var fetcher = new DataFetcher();
var data = await fetcher.FetchDataAsync("https://api.example.com/data");
```

**Why this works**: `using` ensures `DataFetcher.Dispose()` is called, which disposes `_httpClient`.

---

## Rule 3: Don't Dispose Dependency-Injected Objects

**Statement**: If an object is provided via dependency injection, do NOT dispose it yourself. The DI container manages its lifetime.

### Why This Matters

DI containers (Microsoft.Extensions.DependencyInjection) track object lifetimes and dispose objects at the appropriate time. If you dispose them manually, you break the lifetime management.

### ❌ WRONG: Disposing DI-Provided HttpClient

```csharp
public class UserService : IDisposable
{
    private readonly HttpClient _httpClient;

    // HttpClient injected via IHttpClientFactory
    public UserService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public void Dispose()
    {
        // This is WRONG - DI container manages HttpClient lifetime
        _httpClient?.Dispose(); // Don't do this!
    }
}
```

**What breaks**: HttpClient is managed by IHttpClientFactory. Disposing it manually breaks connection pooling and causes "ObjectDisposedException" errors.

### ✅ CORRECT: Let DI Container Manage Disposal

```csharp
// No IDisposable implementation - DI manages HttpClient
public class UserService
{
    private readonly HttpClient _httpClient;

    public UserService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<User> GetUserAsync(int id)
    {
        // Use HttpClient, don't dispose it
        var response = await _httpClient.GetAsync($"/users/{id}");
        return await response.Content.ReadFromJsonAsync<User>();
    }
}
```

**Why this works**: IHttpClientFactory manages HttpClient lifetime. No manual disposal needed.

### ✅ CORRECT: Only Dispose What You Own

```csharp
public class DataProcessor : IDisposable
{
    private readonly ILogger<DataProcessor> _logger; // Injected - don't dispose
    private readonly FileStream _fileStream; // Owned - must dispose

    public DataProcessor(ILogger<DataProcessor> logger, string filePath)
    {
        _logger = logger; // Don't dispose
        _fileStream = new FileStream(filePath, FileMode.Create); // Must dispose
    }

    public void Dispose()
    {
        // Only dispose what you created
        _fileStream?.Dispose();
        // Don't dispose _logger - DI container owns it
    }
}
```

**Why this works**: Only dispose objects you create. Never dispose injected dependencies.

---

## Rule 4: Use IAsyncDisposable for Async Cleanup

**Statement**: For async cleanup (flushing buffers, closing connections asynchronously), implement `IAsyncDisposable` instead of `IDisposable`.

### Why This Matters

Some cleanup operations are async (flushing file buffers, closing database connections gracefully). Sync Dispose() can't await, leading to incomplete cleanup.

### ❌ WRONG: Sync Dispose for Async Cleanup

```csharp
public class AsyncDataWriter : IDisposable
{
    private readonly Stream _stream;

    public void Dispose()
    {
        // This is WRONG - can't await FlushAsync in sync method
        _stream.FlushAsync().Wait(); // Potential deadlock!
        _stream.Dispose();
    }
}
```

**What breaks**: Calling `.Wait()` can cause deadlocks (see async-await-rules.md). Sync Dispose is wrong for async cleanup.

### ✅ CORRECT: Implement IAsyncDisposable

```csharp
public class AsyncDataWriter : IAsyncDisposable
{
    private readonly Stream _stream;

    public async ValueTask DisposeAsync()
    {
        // Proper async disposal
        await _stream.FlushAsync();
        await _stream.DisposeAsync();
    }
}
```

**Why this works**: `DisposeAsync` allows awaiting async operations. Proper async cleanup without deadlocks.

### ✅ CORRECT: Usage with await using

```csharp
// Use await using for IAsyncDisposable
public async Task WriteDataAsync(string path, string data)
{
    await using var writer = new AsyncDataWriter(path);
    await writer.WriteAsync(data);
} // DisposeAsync() called here
```

**Why this works**: `await using` calls `DisposeAsync()` instead of `Dispose()`. Proper async disposal.

---

## Rule 5: DbContext and Entity Framework Core Disposal

**Statement**: When using DbContext, either use `using` statements for short-lived contexts or let DI manage lifetime for request-scoped contexts.

### ❌ WRONG: DbContext Not Disposed

```csharp
public User GetUser(int id)
{
    // This is WRONG - DbContext leaked, connection not returned to pool
    var context = new AppDbContext();
    return context.Users.Find(id);
}
```

**What breaks**: DbContext holds database connection. Connection never returned to pool. Eventually connection pool exhausted.

### ✅ CORRECT: using for Ad-Hoc DbContext

```csharp
public User GetUser(int id)
{
    using var context = new AppDbContext();
    return context.Users.Find(id);
} // Connection returned to pool
```

**Why this works**: `using` ensures DbContext is disposed, connection returned to pool.

### ✅ CORRECT: DI-Managed DbContext (ASP.NET)

```csharp
public class UserRepository
{
    private readonly AppDbContext _context; // Injected - don't dispose

    public UserRepository(AppDbContext context)
    {
        _context = context; // DI manages lifetime (Scoped)
    }

    public async Task<User> GetUserAsync(int id)
    {
        return await _context.Users.FindAsync(id);
    }
    // No Dispose - DI container handles it at end of request
}

// Registration in Program.cs
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(connectionString), ServiceLifetime.Scoped);
```

**Why this works**: DbContext registered as Scoped. DI container disposes it at end of request. Repository doesn't implement IDisposable.

---

## Special Cases

### HttpClient: Use IHttpClientFactory

```csharp
// WRONG: Creating HttpClient directly
using var client = new HttpClient(); // Socket exhaustion!

// CORRECT: Use IHttpClientFactory
builder.Services.AddHttpClient<IMyService, MyService>();

public class MyService
{
    private readonly HttpClient _httpClient; // Injected - don't dispose

    public MyService(HttpClient httpClient)
    {
        _httpClient = httpClient; // IHttpClientFactory manages this
    }
}
```

### Memory<T> and IMemoryOwner<T>

```csharp
// For large buffers, use MemoryPool and IMemoryOwner
using IMemoryOwner<byte> owner = MemoryPool<byte>.Shared.Rent(size);
Memory<byte> memory = owner.Memory;
// Use memory
// owner.Dispose() called by using
```

---

## Rule 6: IDisposableAnalyzers 4.0.8 — Suppression Behavior

**Statement**: IDisposableAnalyzers 4.0.8 (latest version) performs interprocedural analysis. The only suppression mechanism is per-line `#pragma warning disable`.

### Why This Matters

Common indirection strategies that work with other analyzers **do not work** with IDisposableAnalyzers. The analyzer sees through discards, extension method chains, and `[SuppressMessage]` attributes on callees.

### ❌ WRONG: Discard to Suppress IDISP004

```csharp
// This is WRONG — analyzer still fires IDISP004
_ = cache.SetupSerializer(new MySerializer());
```

**What breaks**: IDISP004 sees through the `_ =` discard. The return type is `IFusionCache` (which is `IDisposable`), and the analyzer flags it regardless of the discard.

### ❌ WRONG: Extension Method Chain to Suppress IDISP004

```csharp
// This is WRONG — analyzer tracks intermediate IFlurlResponse
return url.PostUrlEncodedAsync(data).ReceiveString();
```

**What breaks**: IDISP004 sees the intermediate `Task<IFlurlResponse>` created by `PostUrlEncodedAsync()`. The `.ReceiveString()` extension method consumes it, but the analyzer can't see through the extension chain.

### ❌ WRONG: [SuppressMessage] Wrapper to Suppress IDISP001

```csharp
// This is WRONG — analyzer fires at call site, not wrapper
[SuppressMessage("IDisposableAnalyzers.Correctness", "IDISP001:Dispose created")]
public static HttpClient CreateManagedClient(this IHttpClientFactory factory, string name)
    => factory.CreateClient(name);

// Call site still gets IDISP001:
var client = factory.CreateManagedClient("MyClient"); // IDISP001 fires here
```

**What breaks**: IDisposableAnalyzers does interprocedural analysis. It sees that `CreateManagedClient` returns `HttpClient` (which is `IDisposable`) and flags the call site. The `[SuppressMessage]` only suppresses within the wrapper method body.

### ✅ CORRECT: Per-Line #pragma

```csharp
#pragma warning disable IDISP001 // TODO(dispose:false) Safe: IHttpClientFactory manages lifetime
var client = factory.CreateClient("MyClient");
#pragma warning restore IDISP001
```

**Why this works**: Per-line `#pragma` is the only suppression mechanism IDisposableAnalyzers 4.0.8 respects. Always annotate with a `TODO(dispose:*)` justification.

---

## Summary Checklist

Before generating code with IDisposable:

- [ ] **using statement/declaration** for all IDisposable objects you create
- [ ] **Implement IDisposable** if your class owns IDisposable fields
- [ ] **Don't dispose** dependency-injected objects
- [ ] **Use IAsyncDisposable** for async cleanup (FlushAsync, CloseAsync)
- [ ] **DbContext disposal** - `using` for ad-hoc, DI for request-scoped
- [ ] **HttpClient** - Never create directly, use IHttpClientFactory
- [ ] **ObjectDisposedException check** in methods after disposal

---

**These patterns prevent resource leaks, file handle exhaustion, and connection pool starvation!**
