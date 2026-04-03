# Template: Async Method with Cancellation Support

**When to Use**: Method performs I/O operations (database, HTTP, file) and should support cancellation.

**Complexity**: Medium

**Common Mistakes Agents Make**:
- Using async void instead of async Task (prevents awaiting, exceptions crash app)
- Not passing CancellationToken through async chain
- Using .Result or .Wait() instead of await (causes deadlocks)
- Missing Async suffix on method name
- Not handling OperationCanceledException correctly

## Template

```csharp
using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace {{Namespace}};

/// <summary>
/// {{ServiceName}} - {{Description}}
/// </summary>
public class {{ServiceName}}
{
    private readonly {{IDependency}} _dependency;
    private readonly ILogger<{{ServiceName}}> _logger;

    public {{ServiceName}}({{IDependency}} dependency, ILogger<{{ServiceName}}> logger)
    {
        _dependency = dependency ?? throw new ArgumentNullException(nameof(dependency));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    /// <summary>
    /// {{MethodDescription}}
    /// </summary>
    /// <param name="{{paramName}}">{{ParamDescription}}</param>
    /// <param name="cancellationToken">Cancellation token to cancel the operation</param>
    /// <returns>{{ReturnDescription}}</returns>
    public async Task<{{ReturnType}}> {{MethodName}}Async(
        {{ParamType}} {{paramName}},
        CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Starting {{MethodName}} for {ParamName}", {{paramName}});

            // Pass cancellationToken through async chain
            var result = await _dependency.{{DependencyMethodName}}Async(
                {{paramName}},
                cancellationToken
            );

            // Additional async operation with cancellation
            await ProcessResultAsync(result, cancellationToken);

            _logger.LogInformation("Completed {{MethodName}} for {ParamName}", {{paramName}});
            return result;
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("{{MethodName}} cancelled for {ParamName}", {{paramName}});
            throw; // Re-throw cancellation exceptions
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "{{MethodName}} failed for {ParamName}", {{paramName}});
            throw;
        }
    }

    /// <summary>
    /// Async method without return value
    /// </summary>
    public async Task {{VoidMethodName}}Async(
        {{ParamType}} {{paramName}},
        CancellationToken cancellationToken = default)
    {
        try
        {
            // Pass cancellationToken through
            await _dependency.{{VoidDependencyMethod}}Async({{paramName}}, cancellationToken);

            _logger.LogInformation("{{VoidMethodName}} completed for {ParamName}", {{paramName}});
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("{{VoidMethodName}} cancelled");
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "{{VoidMethodName}} failed");
            throw;
        }
    }

    /// <summary>
    /// Async method with timeout using CancellationTokenSource
    /// </summary>
    public async Task<{{ReturnType}}> {{MethodName}}WithTimeoutAsync(
        {{ParamType}} {{paramName}},
        TimeSpan timeout)
    {
        using var cts = new CancellationTokenSource(timeout);

        try
        {
            return await {{MethodName}}Async({{paramName}}, cts.Token);
        }
        catch (OperationCanceledException) when (cts.IsCancellationRequested)
        {
            _logger.LogWarning("{{MethodName}} timed out after {Timeout}", timeout);
            throw new TimeoutException($"Operation timed out after {timeout}");
        }
    }

    /// <summary>
    /// Multiple parallel async operations with cancellation
    /// </summary>
    public async Task<({{Type1}}, {{Type2}})> {{ParallelMethodName}}Async(
        {{ParamType}} {{paramName}},
        CancellationToken cancellationToken = default)
    {
        // Start both operations in parallel
        var task1 = _dependency.{{Method1}}Async({{paramName}}, cancellationToken);
        var task2 = _dependency.{{Method2}}Async({{paramName}}, cancellationToken);

        // Wait for both (throws if either fails or cancels)
        await Task.WhenAll(task1, task2);

        // Both completed successfully, get results
        return (await task1, await task2);
    }

    private async Task ProcessResultAsync(
        {{ReturnType}} result,
        CancellationToken cancellationToken)
    {
        // Additional processing with cancellation support
        await Task.Delay(100, cancellationToken); // Replace with actual work
    }
}
```

## Adaptation Examples

### ASP.NET Controller with Cancellation

```csharp
[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;

    public UsersController(IUserService userService)
    {
        _userService = userService;
    }

    /// <summary>
    /// ASP.NET provides CancellationToken automatically
    /// </summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetUser(int id, CancellationToken cancellationToken)
    {
        try
        {
            // Pass cancellation token from HTTP request
            var user = await _userService.GetUserAsync(id, cancellationToken);

            if (user == null)
            {
                return NotFound();
            }

            return Ok(user);
        }
        catch (OperationCanceledException)
        {
            // Request was cancelled (user closed browser, etc.)
            return StatusCode(499); // Client Closed Request
        }
    }
}
```

### Background Service with Cancellation

```csharp
public class DataProcessingService : BackgroundService
{
    private readonly IDataProcessor _processor;
    private readonly ILogger<DataProcessingService> _logger;

    public DataProcessingService(
        IDataProcessor processor,
        ILogger<DataProcessingService> logger)
    {
        _processor = processor;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("DataProcessingService starting");

        try
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                // Process with cancellation support
                await _processor.ProcessBatchAsync(stoppingToken);

                // Wait 1 minute between batches (cancellable)
                await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
            }
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("DataProcessingService cancelled");
        }
        finally
        {
            _logger.LogInformation("DataProcessingService stopped");
        }
    }
}
```

## Critical Rules Applied

✅ **Returns Task/Task<T>** (never async void)
✅ **Uses await** (no .Result or .Wait())
✅ **CancellationToken parameter** with default value
✅ **Passes token through chain** to all async calls
✅ **OperationCanceledException handled** and re-thrown
✅ **Async suffix** on all method names
✅ **Proper exception handling** with logging

## Prevents Top 10 Mistakes

- **#1: async void** → Returns Task, can be awaited
- **#2: Missing async/await** → Properly uses await
- **#3: Deadlocks (.Result/.Wait)** → Uses await, no blocking
- **#8: Missing cancellation** → Full cancellation support
