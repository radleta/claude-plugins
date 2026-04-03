# Decision Tree: Async vs Sync

**Purpose**: Decide when to make a method async vs synchronous.

## Decision Flow

```
Start: Does method perform I/O or long-running operations?
├─ YES: I/O Operation (database, HTTP, file)
│   ├─ Is it database query (EF Core)?
│   │   └─ Use async → Task<T>, await _context.SaveChangesAsync()
│   ├─ Is it HTTP request?
│   │   └─ Use async → Task<T>, await _httpClient.GetAsync()
│   ├─ Is it file I/O?
│   │   └─ Use async → Task<T>, await File.ReadAllTextAsync()
│   └─ Is it any I/O-bound operation?
│       └─ Use async → Don't block threads waiting for I/O
│
├─ NO: CPU-bound computation
│   ├─ Is computation expensive (> 50ms)?
│   │   ├─ In ASP.NET API?
│   │   │   └─ Keep sync (don't use Task.Run in ASP.NET)
│   │   └─ In desktop app (WPF/WinForms)?
│   │       └─ Use Task.Run to offload from UI thread
│   └─ Is computation quick (< 50ms)?
│       └─ Keep sync → No benefit from async
│
└─ SPECIAL CASE: Already have sync version
    └─ Don't create async wrapper with Task.Run (sync-over-async anti-pattern)
```

## When to Use Async

✅ **Database queries** (Entity Framework Core)
```csharp
public async Task<User> GetUserAsync(int id)
{
    return await _context.Users.FindAsync(id);
}
```

✅ **HTTP requests**
```csharp
public async Task<string> FetchDataAsync(string url)
{
    return await _httpClient.GetStringAsync(url);
}
```

✅ **File I/O**
```csharp
public async Task<string> ReadFileAsync(string path)
{
    return await File.ReadAllTextAsync(path);
}
```

✅ **Any I/O-bound operation** (network, disk, database)

## When to Use Sync

✅ **Simple property access or calculations**
```csharp
public int CalculateTotal(int a, int b)
{
    return a + b; // No I/O, keep sync
}
```

✅ **In-memory operations**
```csharp
public User FindUser(List<User> users, int id)
{
    return users.FirstOrDefault(u => u.Id == id); // In-memory, sync
}
```

✅ **Quick transformations**
```csharp
public string FormatName(string firstName, string lastName)
{
    return $"{firstName} {lastName}"; // Instant, keep sync
}
```

## Anti-Patterns to Avoid

❌ **Sync-over-async** (wrapping sync in Task.Run unnecessarily)
```csharp
// WRONG: Don't do this in ASP.NET
public Task<int> CalculateTotalAsync(int a, int b)
{
    return Task.Run(() => a + b); // Wastes thread pool thread!
}
```

❌ **Async-all-the-things** (making everything async for no reason)
```csharp
// WRONG: No I/O, no benefit from async
public async Task<int> GetCountAsync(List<User> users)
{
    return await Task.FromResult(users.Count); // Pointless
}
```

## Summary

**Use async for**: I/O operations (database, HTTP, files)
**Use sync for**: CPU-bound calculations, in-memory operations
**Avoid**: Fake async (Task.Run wrapping), async-all-the-things
