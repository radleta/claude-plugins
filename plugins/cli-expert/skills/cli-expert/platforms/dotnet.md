# .NET CLI Patterns

Implementation patterns for .NET 9+ CLI tools. Covers two frameworks: **Spectre.Console.Cli** (recommended for rich CLIs with DI) and **System.CommandLine** (lighter, for simpler tools).

## Framework Selection

| Criteria | Spectre.Console.Cli | System.CommandLine 2.0.3 |
|----------|---------------------|--------------------------|
| **DI integration** | Via TypeRegistrar bridge (one-time ~45 lines) | Manual, requires custom middleware |
| **Rich rendering** | Built-in: tables, progress, panels, trees | None — separate library needed |
| **Command pattern** | Settings class + Command class (clean separation) | Inline lambda or handler delegate |
| **Validation** | `Settings.Validate()` runs before command | `AddValidator()` on command |
| **Async** | `AsyncCommand<TSettings>` | `SetAction(async (pr, ct) => ...)` |
| **Help/version** | Automatic | Automatic |
| **stdin `-` support** | Manual (same as S.CL) | Manual |
| **Package count** | 1 (`Spectre.Console.Cli` includes rendering) | 1 (`System.CommandLine`) |
| **Best for** | Feature-rich CLIs, DI-heavy apps, TUI output | Simple utilities, minimal dependencies |

**Recommendation:** Use **Spectre.Console.Cli** when the CLI has DI, multiple commands, or needs rich output. Use **System.CommandLine** for simple single-purpose tools.

---

## Spectre.Console.Cli (Recommended)

### Settings + Command Pattern

Commands are defined as a pair: a `CommandSettings` class (declares options/args) and an `AsyncCommand<TSettings>` class (executes logic).

```csharp
public class GenerateSettings : CommandSettings
{
    [CommandArgument(0, "[input]")]
    [Description("Input file path")]
    public string? Input { get; init; }

    [CommandOption("-o|--output")]
    [Description("Output file path")]
    [DefaultValue("report.xlsx")]
    public string Output { get; init; } = "report.xlsx";

    [CommandOption("-v|--verbose")]
    [Description("Enable diagnostic output")]
    public bool Verbose { get; init; }

    [CommandOption("-q|--quiet")]
    [Description("Suppress non-essential output")]
    public bool Quiet { get; init; }

    [CommandOption("--json")]
    [Description("Output structured JSON to stdout")]
    public bool Json { get; init; }

    [CommandOption("--dry-run")]
    [Description("Preview without writing files")]
    public bool DryRun { get; init; }

    [CommandOption("--no-color")]
    [Description("Disable colored output")]
    public bool NoColor { get; init; }

    public override ValidationResult Validate()
    {
        if (Verbose && Quiet)
            return ValidationResult.Error("--verbose and --quiet are mutually exclusive");

        if (Input is not null && !File.Exists(Input))
            return ValidationResult.Error($"Input file not found: {Input}");

        return ValidationResult.Success();
    }
}
```

```csharp
public class GenerateCommand : AsyncCommand<GenerateSettings>
{
    private readonly ILogger<GenerateCommand> _logger;
    private readonly IReportGenerator _generator;

    public GenerateCommand(ILogger<GenerateCommand> logger, IReportGenerator generator)
    {
        _logger = logger;
        _generator = generator;
    }

    public override async Task<int> ExecuteAsync(CommandContext context, GenerateSettings settings)
    {
        _logger.LogDebug("Generating report from {Input}", settings.Input);
        await _generator.GenerateAsync(settings.Input!, settings.Output);
        return ExitCodes.Success;
    }
}
```

**Key points:**
- `Validate()` runs before `ExecuteAsync` — invalid settings never reach the command
- Constructor injection works via TypeRegistrar (see DI section)
- Return exit code as `int` from `ExecuteAsync`
- `[Description]` attributes generate help text automatically

### DI Integration: TypeRegistrar/TypeResolver

One-time boilerplate (~45 lines) that bridges `IServiceCollection` to Spectre.Console.Cli:

```csharp
// Infrastructure/TypeRegistrar.cs
public sealed class TypeRegistrar(IServiceCollection services) : ITypeRegistrar
{
    public ITypeResolver Build() => new TypeResolver(services.BuildServiceProvider());
    public void Register(Type service, Type impl) => services.AddSingleton(service, impl);
    public void RegisterInstance(Type service, object impl) => services.AddSingleton(service, impl);
    public void RegisterLazy(Type service, Func<object> factory)
        => services.AddSingleton(service, _ => factory());
}

// Infrastructure/TypeResolver.cs
public sealed class TypeResolver(IServiceProvider provider) : ITypeResolver
{
    public object? Resolve(Type? type) => type is null ? null : provider.GetService(type);
}
```

### CommandApp Configuration

```csharp
var registrar = new TypeRegistrar(services);
var app = new CommandApp(registrar);
app.Configure(config =>
{
    config.SetApplicationName("my-tool");
    config.AddCommand<GenerateCommand>("generate")
        .WithDescription("Generate report from input")
        .WithExample("generate", "-i", "data/input.xlsx");
    config.AddCommand<InfoCommand>("info")
        .WithDescription("Show resolved configuration and paths");
});
return app.Run(args);
```

### Spectre stderr Configuration

Route all Spectre.Console rich output to stderr (keeps stdout clean for data):

```csharp
AnsiConsole.Console = AnsiConsole.Create(new AnsiConsoleSettings
{
    Out = new AnsiConsoleOutput(Console.Error)
});
```

Place this early in Program.cs, before any Spectre output.

### Rich TUI Elements (via Spectre.Console)

Spectre.Console.Cli includes the full Spectre.Console rendering engine:

```csharp
// Progress bars (on stderr via AnsiConsole config above)
await AnsiConsole.Progress()
    .StartAsync(async ctx =>
    {
        var task = ctx.AddTask("Processing...");
        while (!task.IsFinished)
        {
            await DoWorkAsync();
            task.Increment(10);
        }
    });

// Tables for config display
var table = new Table();
table.AddColumn("Setting");
table.AddColumn("Value");
table.AddColumn("Source");
table.AddRow("InputDir", "./data/inputs", "appsettings.json");
AnsiConsole.Write(table);

// Error panels with suggestions
AnsiConsole.Write(new Panel($"[red]{exception.Message}[/]")
    .Header("[red]Error[/]")
    .BorderColor(Color.Red));
if (exception.Suggestion is not null)
    AnsiConsole.MarkupLine($"[yellow]Suggestion:[/] {exception.Suggestion}");

// Trees for hierarchy display
var tree = new Tree("Configuration");
tree.AddNode("appsettings.json").AddNode("InputDir: ./data");
AnsiConsole.Write(tree);
```

### Built-in Features

| Feature | How | Notes |
|---------|-----|-------|
| `--help` / `-h` | Automatic | From `[Description]` attributes and command descriptions |
| `--version` | Automatic | From `AssemblyInformationalVersionAttribute` |
| Parse errors | Automatic | Clean error messages on stderr |
| Examples in help | `.WithExample(...)` | Shows usage examples in `--help` |
| CancellationToken | Manual | Pass via DI or use `Console.CancelKeyPress` |

---

## System.CommandLine 2.0.3

**The stable 2.0.3 API differs significantly from beta documentation:**

| Beta (pre-2.0) | Stable (2.0.3) |
|-----------------|-----------------|
| `command.AddCommand(sub)` | `command.Add(sub)` |
| `command.AddOption(opt)` | `command.Options.Add(opt)` or collection initializer |
| `command.SetHandler(delegate)` | `command.SetAction(delegate)` |
| `option.IsRequired = true` | `option.Required = true` |
| Handler parameter binding | `parseResult.GetValue(symbol)` |
| `rootCommand.InvokeAsync(args)` | `rootCommand.Parse(args).InvokeAsync()` |

### Command Definition Pattern

```csharp
public static Command Create()
{
    var fileArg = new Argument<string>("file")
    {
        Description = "JSON file to process, or '-' for stdin"
    };

    var jsonOption = new Option<bool>("--json")
    {
        Description = "Output result as JSON"
    };

    var command = new Command("validate", "Validate a resource JSON file")
    {
        fileArg,    // collection initializer adds args/options
        jsonOption
    };

    command.SetAction(async (parseResult, ct) =>
    {
        var file = parseResult.GetValue(fileArg)!;
        var jsonMode = parseResult.GetValue(jsonOption);
        return await ExecuteAsync(file, jsonMode, ct);
    });

    return command;
}
```

### Global Options (Recursive)

```csharp
public static class GlobalOptions
{
    public static readonly Option<bool> Verbose = new("--verbose", "-v")
    {
        Description = "Enable diagnostic output",
        Recursive = true
    };

    public static readonly Option<bool> Quiet = new("--quiet", "-q")
    {
        Description = "Suppress non-essential output",
        Recursive = true
    };

    public static readonly Option<bool> NoColor = new("--no-color")
    {
        Description = "Disable colored output",
        Recursive = true
    };
}

// Mutual exclusion validation
rootCommand.AddValidator(result =>
{
    if (result.GetValue(GlobalOptions.Verbose) && result.GetValue(GlobalOptions.Quiet))
        result.AddError("--verbose and --quiet are mutually exclusive");
});
```

---

## DI Patterns

### IServiceCollection Extensions (Per Project)

Organize DI registration as extension methods per project:

```csharp
// In MyApp.Core project
public static class CoreServiceExtensions
{
    public static IServiceCollection AddMyAppCore(this IServiceCollection services)
    {
        services.AddTransient<IReportGenerator, ReportGenerator>();
        services.AddTransient<ICalculationEngine, CalculationEngine>();
        return services;
    }
}

// In MyApp.Xlsx project
public static class XlsxServiceExtensions
{
    public static IServiceCollection AddMyAppXlsx(this IServiceCollection services)
    {
        services.AddTransient<IFinancialDataReader, ClosedXmlReader>();
        services.AddTransient<IReportWriter, ClosedXmlWriter>();
        return services;
    }
}
```

Register in Program.cs:
```csharp
var services = new ServiceCollection();
services.AddSingleton<IConfiguration>(configuration);
services.Configure<MyAppOptions>(configuration.GetSection("MyApp"));
services.AddMyAppCore();
services.AddMyAppXlsx();
services.AddLogging(b => b.AddSerilog());
```

### Serilog with DI (ILogger<T>)

**Packages:** `Serilog`, `Serilog.Sinks.Console`, `Serilog.Extensions.Logging`

```csharp
var levelSwitch = new LoggingLevelSwitch(LogEventLevel.Warning);

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.ControlledBy(levelSwitch)
    .WriteTo.Console(
        standardErrorFromLevel: LogEventLevel.Verbose,
        outputTemplate: "[{Level:u3}] {Message:lj}{NewLine}{Exception}")
    .CreateLogger();

// Register with DI for ILogger<T> injection
services.AddLogging(builder => builder.AddSerilog());
```

Commands receive `ILogger<T>` via constructor injection:
```csharp
public class GenerateCommand(ILogger<GenerateCommand> logger) : AsyncCommand<GenerateSettings>
{
    public override async Task<int> ExecuteAsync(CommandContext context, GenerateSettings settings)
    {
        logger.LogDebug("Starting generation with input: {Input}", settings.Input);
        // ...
    }
}
```

### Static Serilog (No DI)

For simpler tools without DI:
```csharp
// In shared libraries
private static readonly Serilog.ILogger Logger = Log.ForContext<ApiClient>();
Logger.Debug("GET {Url}", url);
```

**In tests:** Static `Log.Logger` defaults to silent. Tests don't need to configure Serilog.

---

## Configuration

### Hybrid .env + appsettings.json

Cross-stack portable config pattern. `.env` works across Node, Python, .NET. `appsettings.json` is .NET-native.

**Packages:** `DotNetEnv` for `.env` loading

```csharp
// Load .env before config builder (so env vars are available)
DotNetEnv.Env.Load(optional: true);

var configuration = new ConfigurationBuilder()
    .AddJsonFile("appsettings.json", optional: true)
    .AddJsonFile("appsettings.local.json", optional: true)
    .AddEnvironmentVariables("MYAPP_")
    .Build();
```

**Override priority (highest wins):**
1. Environment variables (`MYAPP_` prefix)
2. `appsettings.local.json` (gitignored, per-machine)
3. `appsettings.json` (tracked, shared defaults)

**Options class:**
```csharp
public class MyAppOptions
{
    public string InputDir { get; set; } = "./data/inputs";
    public string OutputDir { get; set; } = "./data/outputs";
    public string DefaultInput { get; set; } = "input.xlsx";
    public string DefaultOutput { get; set; } = "report.xlsx";
    public string PublishDir { get; set; } = "";
}
```

**.env.example (tracked):**
```env
# Override any setting via MYAPP_ prefix
# MYAPP_MYAPP__INPUTDIR=./custom/inputs
# MYAPP_MYAPP__OUTPUTDIR=~/OneDrive/outputs
# MYAPP_MYAPP__PUBLISHDIR=~/OneDrive/shared
```

**.gitignore entries:**
```
.env
appsettings.local.json
```

### Config Resolution Logging

In verbose mode, log where each config value came from:
```csharp
// Use IConfiguration provider enumeration
foreach (var provider in ((IConfigurationRoot)configuration).Providers)
{
    if (provider.TryGet("MyApp:InputDir", out var value))
        logger.LogDebug("Config: InputDir = {Value} (from {Source})",
            value, provider.GetType().Name);
}
```

### Info Command Pattern

Display resolved config as a rich Spectre table:

```csharp
public class InfoCommand : Command<InfoSettings>
{
    private readonly IOptions<MyAppOptions> _options;
    private readonly IConfiguration _configuration;

    public override int Execute(CommandContext context, InfoSettings settings)
    {
        var table = new Table();
        table.AddColumn("Setting");
        table.AddColumn("Value");
        table.AddColumn("Source");

        table.AddRow("InputDir", _options.Value.InputDir, GetSource("MyApp:InputDir"));
        table.AddRow("OutputDir", _options.Value.OutputDir, GetSource("MyApp:OutputDir"));

        AnsiConsole.Write(table);
        return 0;
    }
}
```

---

## Custom Exception Hierarchy

Pattern for CLI-specific exceptions with exit codes and user-friendly suggestions:

```csharp
// Base exception
public class AppException : Exception
{
    public int ExitCode { get; }
    public string? Suggestion { get; }

    public AppException(string message, int exitCode = 1, string? suggestion = null,
        Exception? inner = null) : base(message, inner)
    {
        ExitCode = exitCode;
        Suggestion = suggestion;
    }
}

// User/input errors (exit 1)
public class InputException : AppException
{
    public InputException(string message, string? suggestion = null,
        Exception? inner = null) : base(message, 1, suggestion, inner) { }
}

// Infrastructure errors (exit 2)
public class InfrastructureException : AppException
{
    public InfrastructureException(string message, string? suggestion = null,
        Exception? inner = null) : base(message, 2, suggestion, inner) { }
}
```

**Usage in readers/services:**
```csharp
throw new InputException(
    $"Sheet 'Financial Assumptions' not found in {path}",
    suggestion: "Verify the xlsx has the expected sheet names");
```

**Global handler renders with Spectre panels:**
```csharp
catch (AppException ex)
{
    AnsiConsole.Write(new Panel($"[red]{ex.Message}[/]")
        .Header("[red]Error[/]")
        .BorderColor(Color.Red));
    if (ex.Suggestion is not null)
        AnsiConsole.MarkupLine($"[yellow]Suggestion:[/] {ex.Suggestion}");
    return ex.ExitCode;
}
```

---

## Entry Point Pattern (Spectre.Console.Cli + DI)

Complete Program.cs template:

```csharp
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Serilog;
using Serilog.Core;
using Serilog.Events;
using Spectre.Console;

// Windows codepage fix — first line
Console.OutputEncoding = Encoding.UTF8;

// Load .env before config
DotNetEnv.Env.Load(optional: true);

// Build configuration
var configuration = new ConfigurationBuilder()
    .AddJsonFile("appsettings.json", optional: true)
    .AddJsonFile("appsettings.local.json", optional: true)
    .AddEnvironmentVariables("MYAPP_")
    .Build();

// Serilog
var levelSwitch = new LoggingLevelSwitch(LogEventLevel.Warning);
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.ControlledBy(levelSwitch)
    .WriteTo.Console(
        standardErrorFromLevel: LogEventLevel.Verbose,
        outputTemplate: "[{Level:u3}] {Message:lj}{NewLine}{Exception}")
    .CreateLogger();

// Spectre stderr
AnsiConsole.Console = AnsiConsole.Create(new AnsiConsoleSettings
{
    Out = new AnsiConsoleOutput(Console.Error)
});

try
{
    // DI
    var services = new ServiceCollection();
    services.AddSingleton<IConfiguration>(configuration);
    services.Configure<MyAppOptions>(configuration.GetSection("MyApp"));
    services.AddMyAppCore();
    services.AddMyAppXlsx();
    services.AddLogging(b => b.AddSerilog());

    // CommandApp
    var registrar = new TypeRegistrar(services);
    var app = new CommandApp(registrar);
    app.Configure(config =>
    {
        config.SetApplicationName("my-app");
        config.AddCommand<GenerateCommand>("generate")
            .WithDescription("Generate report from input")
            .WithExample("generate", "-i", "data/input.xlsx");
        config.AddCommand<InfoCommand>("info")
            .WithDescription("Show resolved configuration");
    });

    return app.Run(args);
}
catch (AppException ex)
{
    AnsiConsole.Write(new Panel($"[red]{ex.Message}[/]")
        .Header("[red]Error[/]").BorderColor(Color.Red));
    if (ex.Suggestion is not null)
        AnsiConsole.MarkupLine($"[yellow]Suggestion:[/] {ex.Suggestion}");
    return ex.ExitCode;
}
catch (OperationCanceledException)
{
    Console.Error.WriteLine("\u2717 Operation cancelled.");
    return 130;
}
catch (Exception ex)
{
    Log.Fatal(ex, "Unhandled: {Message}", ex.Message);
    Console.Error.WriteLine($"\u2717 {ex.Message}");
    return 2;
}
finally
{
    await Log.CloseAndFlushAsync();
}
```

## Entry Point Pattern (System.CommandLine)

```csharp
using System.CommandLine;
using System.Text;
using Serilog;
using Serilog.Core;
using Serilog.Events;

Console.OutputEncoding = Encoding.UTF8;

var levelSwitch = new LoggingLevelSwitch(LogEventLevel.Warning);
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.ControlledBy(levelSwitch)
    .WriteTo.Console(
        standardErrorFromLevel: LogEventLevel.Verbose,
        outputTemplate: "[{Level:u3}] {Message:lj}{NewLine}{Exception}")
    .CreateLogger();

try
{
    var rootCommand = new RootCommand("my-tool -- description");
    rootCommand.Options.Add(GlobalOptions.Verbose);
    // ... add commands ...

    var parseResult = rootCommand.Parse(args);
    if (parseResult.GetValue(GlobalOptions.Verbose))
        levelSwitch.MinimumLevel = LogEventLevel.Debug;

    return await parseResult.InvokeAsync();
}
catch (OperationCanceledException)
{
    Console.Error.WriteLine("\u2717 Operation cancelled.");
    return 130;
}
catch (Exception ex)
{
    Log.Fatal(ex, "Unhandled: {Message}", ex.Message);
    Console.Error.WriteLine($"\u2717 {ex.Message}");
    return 1;
}
finally
{
    await Log.CloseAndFlushAsync();
}
```

---

## Version with Git Hash

Set in `Directory.Build.props` for all projects:

```xml
<PropertyGroup>
    <Version>0.1.0</Version>
    <InformationalVersion>0.1.0+$(GitHash)</InformationalVersion>
</PropertyGroup>
```

Or use `MinVer` / `GitVersion` NuGet package for automatic versioning.

For manual git hash in csproj:
```xml
<Target Name="SetGitHash" BeforeTargets="GetAssemblyVersion">
    <Exec Command="git rev-parse --short HEAD" ConsoleToMSBuild="true">
        <Output TaskParameter="ConsoleOutput" PropertyName="GitHash" />
    </Exec>
    <PropertyGroup>
        <InformationalVersion>$(Version)+$(GitHash)</InformationalVersion>
    </PropertyGroup>
</Target>
```

`--version` reads `AssemblyInformationalVersionAttribute` automatically in both frameworks.

---

## Console Encoding (Windows)

```csharp
Console.OutputEncoding = Encoding.UTF8;
```

**Very first line** of Program.cs, before any output. Required because:
- .NET 9 on Windows defaults to system codepage (not UTF-8)
- Unicode symbols (`✓ ✗ ℹ`) render as `?` without UTF-8
- Safe no-op on all other platforms

## TTY Detection

```csharp
Console.IsOutputRedirected  // stdout piped
Console.IsErrorRedirected   // stderr piped
Console.IsInputRedirected   // stdin piped
```

## stdin Reading Pattern

```csharp
public static async Task<string> ReadInputAsync(string pathOrDash, CancellationToken ct = default)
{
    if (pathOrDash == "-")
    {
        if (!Console.IsInputRedirected)
            throw new InputException(
                "No input on stdin. Pipe data or pass a filename instead of '-'.",
                suggestion: "Example: cat data.json | my-tool validate -");
        return await Console.In.ReadToEndAsync(ct);
    }

    if (!File.Exists(pathOrDash))
        throw new InputException($"File not found: {pathOrDash}");

    return await File.ReadAllTextAsync(pathOrDash, ct);
}
```

## Testing CLI Commands

### Spectre.Console.Cli Testing

```csharp
// Use CommandAppTester for integration tests
var app = new CommandAppTester();
app.SetDefaultCommand<GenerateCommand>();
var result = await app.RunAsync("--input", "test.xlsx");
Assert.Equal(0, result.ExitCode);
```

### System.CommandLine Testing

```csharp
var command = ValidateCommand.Create();
var exitCode = command.Parse(new[] { "test-file.json" }).Invoke();
Assert.Equal(0, exitCode);
```

## Project Structure Pattern

```
App.Cli/              -> Entry point (Program.cs), TypeRegistrar, Commands/
App.Core/             -> Domain models, interfaces, business logic
App.Xlsx/             -> ClosedXML readers/writers (or other I/O)
App.Core.Tests/       -> Unit tests for domain logic
App.Xlsx.Tests/       -> Integration tests for I/O

Each project has ServiceCollectionExtensions:
  App.Core  -> AddMyAppCore()
  App.Xlsx  -> AddMyAppXlsx()

App.Cli references: App.Core, App.Xlsx
App.Core references: nothing (pure domain)
App.Xlsx references: App.Core (for domain types)
```

## Platform Gotchas

| Gotcha | Solution |
|--------|----------|
| `Console.Out` auto-flushes in .NET | No `AutoFlush = true` needed |
| `ReadToEndAsync` on non-redirected stdin hangs | Check `Console.IsInputRedirected` first |
| Self-contained publish is ~65MB | Acceptable for CLI; trimming/AOT in future |
| `RuntimeIdentifier` in csproj -> output in `bin/Debug/net9.0/win-x64/` | Not `net9.0/` — adjust build scripts |
| Serilog static `Log.Logger` in tests | Defaults to silent — no test pollution |
| `AddCommand` doesn't exist in S.CL 2.0.3 | Use `command.Add(subcommand)` |
| Spectre.Console colors on stdout | Configure `AnsiConsole.Console` to use stderr |
| ClosedXML returns `double` for numbers | Cast to `decimal` at reader boundary for financial precision |
| `.env` not loaded before config builder | Call `DotNetEnv.Env.Load()` before `ConfigurationBuilder` |
