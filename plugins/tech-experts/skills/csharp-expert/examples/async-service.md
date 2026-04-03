# Example: Async Service with Cancellation Support

**User Request**: "Create a service that fetches user data from an API with cancellation support and dependency injection"

## Step 1: Investigate Project

### Investigation Actions

**Tool: Read** `.csproj` file to detect project type and framework:
```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.Extensions.Http" Version="8.0.0" />
  </ItemGroup>
</Project>
```

**Findings**:
- Project type: ASP.NET Core Web API (.NET 8)
- Nullable reference types: Enabled
- HTTP client: Microsoft.Extensions.Http available

**Tool: Grep** for existing service patterns:
```
Grep "class.*Service" → Found existing services using constructor injection
Grep "async Task" → Found existing async methods with CancellationToken
```

**Findings**:
- Project uses constructor injection pattern
- Existing services follow async + CancellationToken pattern
- Services registered in Program.cs with AddScoped

**Tool: Read** `Program.cs` to understand DI registration:
```csharp
builder.Services.AddHttpClient();
builder.Services.AddScoped<IExistingService, ExistingService>();
```

**Findings**: Services registered as Scoped (per-request lifetime)

### Investigation Summary

**Project Context**:
- ASP.NET Core Web API, .NET 8
- Nullable reference types enabled
- Constructor injection with Scoped lifetime pattern
- Async methods use CancellationToken
- HttpClient available via DI

## Step 2: Detect Pattern

**Keywords from request**: "service", "fetches", "API", "cancellation", "dependency injection"

**Pattern detection** → Multiple categories:
1. **Async/await** (keywords: "fetches") → Load @rules/async-await-rules.md
2. **Cancellation** (keyword: "cancellation") → Load @templates/async-with-cancellation.cs
3. **Dependency injection** (keyword: "dependency injection") → Load @rules/dependency-injection-rules.md
4. **HTTP client** (keyword: "API") → Use HttpClient (IDisposable managed by DI)

**Files to load**:
- @rules/async-await-rules.md (Critical - prevent async void, deadlocks)
- @rules/dependency-injection-rules.md (High - prevent captive dependencies)
- @rules/naming-conventions.md (High - proper naming)
- @templates/async-with-cancellation.cs (working example)
- @templates/constructor-injection.cs (DI pattern)

## Step 3: Generate Code

### Apply Rules from @rules/

**From async-await-rules.md**:
- ✅ Return Task<T> (not async void)
- ✅ Use await (not .Result or .Wait())
- ✅ Include CancellationToken parameter
- ✅ Pass CancellationToken through async chain
- ❌ No ConfigureAwait(false) needed (ASP.NET Core)

**From dependency-injection-rules.md**:
- ✅ Constructor injection (not property injection)
- ✅ Register as Scoped (matches pattern, uses HttpClient)
- ✅ IHttpClientFactory (not direct HttpClient in constructor)

**From naming-conventions.md**:
- ✅ Interface: IUserService (I-prefix)
- ✅ Implementation: UserService (PascalCase)
- ✅ Method: GetUserDataAsync (Async suffix)

### Generated Code

**IUserService.cs** (Interface):
```csharp
using System.Threading;
using System.Threading.Tasks;

namespace MyApp.Services;

/// <summary>
/// Service for fetching user data from external API.
/// </summary>
public interface IUserService
{
    /// <summary>
    /// Fetches user data by ID.
    /// </summary>
    /// <param name="userId">The user ID to fetch.</param>
    /// <param name="cancellationToken">Cancellation token to cancel the operation.</param>
    /// <returns>User data or null if not found.</returns>
    Task<UserData?> GetUserDataAsync(int userId, CancellationToken cancellationToken = default);
}
```

**UserService.cs** (Implementation):
```csharp
using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace MyApp.Services;

/// <summary>
/// Service implementation for fetching user data from external API.
/// </summary>
public class UserService : IUserService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<UserService> _logger;

    // Constructor injection - HttpClient provided by IHttpClientFactory
    public UserService(HttpClient httpClient, ILogger<UserService> logger)
    {
        _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    /// <inheritdoc/>
    public async Task<UserData?> GetUserDataAsync(int userId, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Fetching user data for userId: {UserId}", userId);

            // Pass cancellationToken through async chain
            var response = await _httpClient.GetAsync(
                $"https://api.example.com/users/{userId}",
                cancellationToken
            );

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to fetch user {UserId}: {StatusCode}", userId, response.StatusCode);
                return null;
            }

            // Deserialize with cancellation support
            var userData = await response.Content.ReadFromJsonAsync<UserData>(cancellationToken: cancellationToken);

            _logger.LogInformation("Successfully fetched user data for userId: {UserId}", userId);
            return userData;
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Request cancelled for userId: {UserId}", userId);
            throw; // Re-throw cancellation exceptions
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "HTTP request failed for userId: {UserId}", userId);
            throw;
        }
    }
}
```

**UserData.cs** (Model):
```csharp
namespace MyApp.Services;

public record UserData(int Id, string Name, string Email);
```

**Program.cs** (DI Registration):
```csharp
// Register with IHttpClientFactory (manages HttpClient lifecycle)
builder.Services.AddHttpClient<IUserService, UserService>();
```

## Step 4: Verify

### Verification Checklist

**Critical Rules** (async-await):
- [x] ✅ No async void - Method returns Task<UserData?>
- [x] ✅ No .Result or .Wait() - Uses await throughout
- [x] ✅ CancellationToken parameter present - GetUserDataAsync(int, CancellationToken)
- [x] ✅ CancellationToken passed through chain - GetAsync and ReadFromJsonAsync receive token
- [x] ✅ OperationCanceledException caught and re-thrown correctly

**Critical Rules** (IDisposable):
- [x] ✅ HttpClient not disposed manually - Managed by IHttpClientFactory
- [x] ✅ No using statement on HttpClient - DI manages lifetime

**High Priority Rules** (null safety):
- [x] ✅ Nullable annotation correct - Task<UserData?> indicates null possible
- [x] ✅ Null checks on constructor parameters - ArgumentNullException thrown

**High Priority Rules** (naming):
- [x] ✅ Interface I-prefix - IUserService
- [x] ✅ PascalCase class name - UserService
- [x] ✅ Async suffix on method - GetUserDataAsync
- [x] ✅ camelCase parameters - userId, cancellationToken

**High Priority Rules** (dependency injection):
- [x] ✅ Constructor injection used - Not property injection
- [x] ✅ Scoped lifetime appropriate - Service uses HttpClient (Scoped)
- [x] ✅ IHttpClientFactory pattern - AddHttpClient<IUserService, UserService>
- [x] ✅ No captive dependencies - Not registered as Singleton

**Medium Priority** (LINQ):
- [x] N/A - No LINQ in this example

### Top 10 Mistakes Prevention

**Prevented Mistakes**:
1. ✅ **#1: async void** - Returns Task<UserData?>
2. ✅ **#2: Missing async/await** - Properly awaits async operations
3. ✅ **#3: Deadlocks (.Result/.Wait)** - Uses await, no blocking calls
4. ✅ **#4: Missing IDisposable.Dispose()** - HttpClient managed by DI, not manually disposed
5. ✅ **#5: Incorrect null handling** - Nullable annotation Task<UserData?>, null checks present
6. ✅ **#6: Wrong naming conventions** - IUserService, UserService, GetUserDataAsync all correct
7. N/A **#7: Multiple LINQ enumeration** - No LINQ used
8. ✅ **#8: Missing cancellation support** - CancellationToken parameter and propagation
9. ✅ **#9: Captive dependencies** - Registered as Scoped, not Singleton
10. N/A **#10: Wrong collection types** - No collections used

### Build Verification

**Compile check**:
```bash
dotnet build
# Expected: Build succeeded
```

**Analyzer warnings**:
```bash
dotnet build /warnaserror
# Expected: No warnings (nullable, async, naming all correct)
```

---

## Key Takeaways

1. **Investigation drives decisions**: Project uses .NET 8, nullable enabled, HttpClient via DI → Shaped implementation
2. **Rules prevent critical mistakes**: async-await rules prevented async void (#1), deadlocks (#3)
3. **Templates provide structure**: async-with-cancellation template showed CancellationToken pattern
4. **Verification catches issues**: Checklist confirmed all Top 10 mistakes prevented

**This workflow prevents the 6 most critical C# mistakes in a single example!**
