# Template: Constructor Injection Pattern

**When to Use**: Service requires dependencies injected via DI container.

**Complexity**: Low

**Common Mistakes Agents Make**:
- Using property injection instead of constructor injection
- Not validating constructor parameters for null
- Wrong DI lifetime (Singleton capturing Scoped)
- Disposing injected dependencies (DI container manages disposal)
- Missing readonly on injected fields

## Template

```csharp
using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace {{Namespace}};

/// <summary>
/// {{IServiceName}} interface
/// </summary>
public interface {{IServiceName}}
{
    Task<{{ReturnType}}> {{MethodName}}Async({{ParamType}} {{paramName}}, CancellationToken cancellationToken = default);
}

/// <summary>
/// {{ServiceName}} implementation - {{Description}}
/// </summary>
public class {{ServiceName}} : {{IServiceName}}
{
    // Injected dependencies - readonly fields with underscore prefix
    private readonly {{IDependency1}} _{{dependency1}};
    private readonly {{IDependency2}} _{{dependency2}};
    private readonly ILogger<{{ServiceName}}> _logger;

    /// <summary>
    /// Constructor with dependency injection
    /// </summary>
    public {{ServiceName}}(
        {{IDependency1}} {{dependency1}},
        {{IDependency2}} {{dependency2}},
        ILogger<{{ServiceName}}> logger)
    {
        // Validate all parameters (fail fast)
        ArgumentNullException.ThrowIfNull({{dependency1}});
        ArgumentNullException.ThrowIfNull({{dependency2}});
        ArgumentNullException.ThrowIfNull(logger);

        _{{dependency1}} = {{dependency1}};
        _{{dependency2}} = {{dependency2}};
        _logger = logger;
    }

    /// <inheritdoc/>
    public async Task<{{ReturnType}}> {{MethodName}}Async(
        {{ParamType}} {{paramName}},
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("{{MethodName}} called with {ParamName}", {{paramName}});

        // Use injected dependencies
        var intermediate = await _{{dependency1}}.{{Method1}}Async({{paramName}}, cancellationToken);
        var result = await _{{dependency2}}.{{Method2}}Async(intermediate, cancellationToken);

        return result;
    }
}
```

## Registration in Program.cs

```csharp
// Add dependencies with appropriate lifetimes

// Scoped (most common for services with DbContext)
builder.Services.AddScoped<{{IServiceName}}, {{ServiceName}}>();

// Transient (stateless, lightweight services)
builder.Services.AddTransient<{{IHelperService}}, {{HelperService}}>();

// Singleton (stateless, thread-safe, application-lifetime)
builder.Services.AddSingleton<{{ICacheService}}, {{CacheService}}>();

// HttpClient via IHttpClientFactory
builder.Services.AddHttpClient<{{IApiService}}, {{ApiService}}>();

// DbContext (always Scoped)
builder.Services.AddDbContext<{{DbContextName}}>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));
```

## Critical Rules Applied

✅ **Constructor injection** (not property injection)
✅ **ArgumentNullException.ThrowIfNull** for validation
✅ **readonly fields** with underscore prefix
✅ **Don't dispose injected dependencies** (DI manages)
✅ **Interface I-prefix** naming convention
✅ **PascalCase** class and method names

## Prevents Top 10 Mistakes

- **#5: Null handling** → ArgumentNullException.ThrowIfNull
- **#6: Naming** → I-prefix, PascalCase, _camelCase
- **#9: Captive dependencies** → Shows correct lifetime registration
