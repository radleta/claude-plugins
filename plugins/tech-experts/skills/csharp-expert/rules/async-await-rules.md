# Async/Await Rules

Async/await in C# has strict rules about how it must be used. These rules exist because improper async usage causes **deadlocks**, **application crashes**, **race conditions**, and **performance issues**. Breaking these rules can hang your entire application or crash it with unhandled exceptions.

## The Problem: Why Async Rules Matter

Async/await enables non-blocking I/O and responsive applications, but misuse leads to catastrophic failures:
- **async void** → Unhandled exceptions crash the app (no way to await or catch)
- **.Result/.Wait()** → Deadlocks in UI/ASP.NET contexts (blocks the synchronization context)
- **Missing await** → Fire-and-forget behavior, exceptions lost, resources leaked
- **Missing ConfigureAwait(false)** in libraries → Forces context capture, causes deadlocks in consumers

**Key insight**: async is viral - once you go async, you must stay async throughout the call chain.

---

## Rule 1: Never Use async void (Except Event Handlers)

**Statement**: Async methods must return `Task` or `Task<T>`, never `void`. The only exception is event handlers.

### Why This Matters

`async void` methods cannot be awaited, and exceptions thrown inside them crash the application. There's no way to catch exceptions from async void methods - they bypass normal exception handling and crash the entire process.

### ❌ WRONG: async void Method

```csharp
// This is WRONG - async void cannot be awaited, exceptions crash app
public async void SaveDataAsync()
{
    await _repository.SaveAsync(); // If this throws, app crashes
}

// Caller cannot await or catch exceptions
SaveDataAsync(); // Fire-and-forget, exceptions crash app
```

**What breaks**: If `SaveAsync()` throws an exception, it crashes the application. The caller has no way to catch it or wait for completion.

### ❌ WRONG: async void in Background Task

```csharp
public class DataProcessor
{
    // This is WRONG - cannot track completion or errors
    public async void ProcessDataAsync()
    {
        await Task.Delay(1000);
        throw new Exception("Oops"); // App crash!
    }
}

// Usage
var processor = new DataProcessor();
processor.ProcessDataAsync(); // Can't await, can't catch exceptions
```

**What breaks**: Exception thrown inside async void crashes the app. No try-catch can save you.

### ✅ CORRECT: async Task Method

```csharp
// Return Task, not void
public async Task SaveDataAsync()
{
    await _repository.SaveAsync(); // Exceptions can be caught by caller
}

// Caller can await and handle exceptions
try
{
    await SaveDataAsync(); // Can await completion and catch exceptions
}
catch (Exception ex)
{
    _logger.LogError(ex, "Failed to save data");
}
```

**Why this works**: Returning `Task` allows callers to await and catch exceptions. The exception propagates normally up the call stack.

### ✅ CORRECT: async void for Event Handlers (Only Exception)

```csharp
// Event handlers are the ONLY valid use of async void
public class MainWindow
{
    private async void SaveButton_Click(object sender, EventArgs e)
    {
        try
        {
            await SaveDataAsync();
        }
        catch (Exception ex)
        {
            // MUST handle exceptions inside event handler
            MessageBox.Show($"Error: {ex.Message}");
        }
    }

    private async Task SaveDataAsync()
    {
        await _repository.SaveAsync();
    }
}
```

**Why this is acceptable**: Event handlers must have `void` signature to match delegate type. However, you MUST handle exceptions inside the event handler with try-catch.

---

## Rule 2: Never Block on Async Code (.Result / .Wait())

**Statement**: Never use `.Result`, `.Wait()`, or `.GetAwaiter().GetResult()` on Tasks. Always use `await` instead.

### Why This Matters

Blocking on async code causes **deadlocks** in UI applications and ASP.NET. When you call `.Result` or `.Wait()`, the thread blocks waiting for the Task. But the Task may need that same thread (synchronization context) to complete, causing a deadlock.

### ❌ WRONG: Blocking with .Result

```csharp
public User GetUser(int userId)
{
    // This is WRONG - blocks thread and causes deadlocks
    var user = _repository.GetUserAsync(userId).Result;
    return user;
}
```

**What breaks in ASP.NET**:
1. Request thread calls `.Result` and blocks
2. `GetUserAsync` tries to resume on the request thread (captured context)
3. Request thread is blocked waiting for `GetUserAsync`
4. Deadlock! Application hangs forever.

### ❌ WRONG: Blocking with .Wait()

```csharp
public void SaveData()
{
    // This is WRONG - Wait() causes same deadlock issue
    _repository.SaveAsync().Wait();
}
```

**What breaks**: Same deadlock scenario. The blocked thread can't resume the async operation.

### ✅ CORRECT: Use await Instead

```csharp
// Make the method async and use await
public async Task<User> GetUserAsync(int userId)
{
    // Use await - never blocks, no deadlock
    var user = await _repository.GetUserAsync(userId);
    return user;
}
```

**Why this works**: `await` doesn't block the thread. It yields control back to the caller, and the thread can do other work. When the async operation completes, execution resumes on an available thread.

### ✅ CORRECT: All the Way Async

```csharp
// Controller
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;

    [HttpGet("{id}")]
    public async Task<IActionResult> GetUser(int id)
    {
        // Async all the way through the call chain
        var user = await _userService.GetUserAsync(id);
        return Ok(user);
    }
}

// Service
public class UserService : IUserService
{
    private readonly IUserRepository _repository;

    public async Task<User> GetUserAsync(int id)
    {
        return await _repository.GetUserAsync(id);
    }
}

// Repository
public class UserRepository : IUserRepository
{
    public async Task<User> GetUserAsync(int id)
    {
        return await _dbContext.Users.FindAsync(id);
    }
}
```

**Why this works**: Async all the way through. No blocking anywhere. No deadlocks possible.

---

## Rule 3: Always Pass CancellationToken Through Async Chain

**Statement**: Async methods that perform I/O should accept `CancellationToken` parameter and pass it through the entire async call chain.

### Why This Matters

Without cancellation support, long-running operations cannot be cancelled. In ASP.NET, when a request is cancelled (user closes browser), the server keeps processing, wasting resources.

### ❌ WRONG: No CancellationToken

```csharp
// This is WRONG - cannot cancel long operation
public async Task<List<User>> GetAllUsersAsync()
{
    await Task.Delay(10000); // 10 seconds, no way to cancel
    return await _dbContext.Users.ToListAsync();
}
```

**What breaks**: If the client cancels the request, the server continues processing for 10 seconds, wasting database connections and CPU.

### ✅ CORRECT: CancellationToken Parameter

```csharp
// Add CancellationToken parameter with default value
public async Task<List<User>> GetAllUsersAsync(CancellationToken cancellationToken = default)
{
    // Pass token through async chain
    await Task.Delay(10000, cancellationToken);
    return await _dbContext.Users.ToListAsync(cancellationToken);
}
```

**Why this works**: When the token is cancelled, `Task.Delay` and `ToListAsync` throw `OperationCanceledException`, stopping the operation immediately.

### ✅ CORRECT: CancellationToken in ASP.NET Controller

```csharp
[HttpGet]
public async Task<IActionResult> GetUsers(CancellationToken cancellationToken)
{
    // ASP.NET provides cancellation token automatically
    var users = await _userService.GetAllUsersAsync(cancellationToken);
    return Ok(users);
}
```

**Why this works**: ASP.NET automatically cancels the token when the request is aborted. The cancellation propagates through the entire async chain.

---

## Rule 4: Use ConfigureAwait(false) in Libraries (Not Applications)

**Statement**: In library code, use `ConfigureAwait(false)` after every `await`. In application code (ASP.NET, console, WPF), do NOT use it.

### Why This Matters

`ConfigureAwait(false)` tells the awaiter not to capture the synchronization context. This improves performance in libraries but breaks UI applications that need to resume on the UI thread.

### When to Use ConfigureAwait(false)

**Use in**: Class libraries, NuGet packages, non-UI code that doesn't need context
**Don't use in**: ASP.NET Core (no synchronization context), WPF/WinForms UI code, Blazor

### ❌ WRONG: ConfigureAwait(false) in UI Code

```csharp
// This is WRONG in WPF/WinForms - can't update UI after await
private async void SaveButton_Click(object sender, EventArgs e)
{
    var result = await SaveDataAsync().ConfigureAwait(false);

    // Exception! This runs on thread pool, not UI thread
    this.StatusLabel.Text = "Saved"; // Cross-thread exception!
}
```

**What breaks**: After `ConfigureAwait(false)`, code resumes on thread pool thread, not UI thread. Accessing UI elements throws exception.

### ✅ CORRECT: No ConfigureAwait in ASP.NET Core

```csharp
// ASP.NET Core - no synchronization context, ConfigureAwait not needed
public async Task<IActionResult> GetUser(int id)
{
    // Just use await - no ConfigureAwait needed
    var user = await _userService.GetUserAsync(id);
    return Ok(user);
}
```

**Why this works**: ASP.NET Core has no synchronization context to capture. Adding `ConfigureAwait(false)` does nothing and adds clutter.

### ✅ CORRECT: ConfigureAwait(false) in Library

```csharp
// Class library code
public class DataClient
{
    public async Task<string> GetDataAsync()
    {
        // Library code - use ConfigureAwait(false) for performance
        var response = await _httpClient.GetAsync("https://api.example.com/data")
            .ConfigureAwait(false);

        var content = await response.Content.ReadAsStringAsync()
            .ConfigureAwait(false);

        return content;
    }
}
```

**Why this works**: Library code doesn't need UI context. `ConfigureAwait(false)` avoids unnecessary context capture and improves performance.

---

## Rule 5: Don't Return Task Without Awaiting (Unless Intentional)

**Statement**: If you use `await` in a method, ensure you're actually awaiting the operation. Don't just return the Task without `async`.

### ❌ WRONG: Unnecessary async Keyword

```csharp
// This is WRONG - async keyword adds overhead for no benefit
public async Task<User> GetUserAsync(int id)
{
    // Just returning Task, not awaiting anything
    return await _repository.GetUserAsync(id); // Unnecessary await
}
```

**What's wrong**: The `async` keyword adds state machine overhead for a simple pass-through. Just return the Task directly.

### ✅ CORRECT: Return Task Directly

```csharp
// No async keyword, just return the Task
public Task<User> GetUserAsync(int id)
{
    return _repository.GetUserAsync(id); // Direct return, no await
}
```

**Why this works**: No state machine overhead. The Task is returned directly to the caller. Use this when you're just passing through a Task.

### ✅ CORRECT: Use async When You Need It

```csharp
// Use async when you need await or try-catch
public async Task<User> GetUserAsync(int id)
{
    try
    {
        var user = await _repository.GetUserAsync(id);
        _logger.LogInformation("Fetched user {Id}", id);
        return user;
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Failed to fetch user {Id}", id);
        throw;
    }
}
```

**Why async is needed**: You need `await` to add logging, handle exceptions, or perform additional async operations.

---

## Summary Checklist

Before generating async code, verify:

- [ ] **No async void** (except event handlers with try-catch)
- [ ] **No .Result, .Wait(), or .GetAwaiter().GetResult()** (use await instead)
- [ ] **CancellationToken parameter** on async methods that perform I/O
- [ ] **CancellationToken passed through** async call chain
- [ ] **ConfigureAwait(false)** only in libraries, not ASP.NET Core or UI apps
- [ ] **async keyword** only when you need await (not for pass-through)
- [ ] **Proper exception handling** for async void event handlers

---

**These rules prevent deadlocks, crashes, and resource leaks - the most critical C# failures!**
