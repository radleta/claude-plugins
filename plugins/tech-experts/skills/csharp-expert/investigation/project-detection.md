# Investigation Protocol: Project Detection

**Purpose**: Detect C# project type, .NET version, and key characteristics before generating code.

## Investigation Steps

### Step 1: Read .csproj File

**Tool**: Read → `{ProjectName}.csproj`

**Extract**:
- SDK type (determines project type)
- Target framework (determines .NET version)
- Nullable reference types enabled/disabled
- Key package references

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
  </PropertyGroup>
</Project>
```

**Findings**:
- `Sdk="Microsoft.NET.Sdk"` → Console app or class library
- `Sdk="Microsoft.NET.Sdk.Web"` → ASP.NET Core (Web API, MVC, Razor Pages)
- `Sdk="Microsoft.NET.Sdk.BlazorWebAssembly"` → Blazor WebAssembly
- `Sdk="Microsoft.NET.Sdk.Razor"` → Razor class library
- `TargetFramework` → net6.0, net7.0, net8.0, net9.0
- `<Nullable>enable</Nullable>` → Nullable reference types enabled

### Step 2: Detect NuGet Packages

**Tool**: Grep → Search for key package references in .csproj

**Key packages to detect**:

**Database**:
- `Microsoft.EntityFrameworkCore` → Entity Framework Core (use async, Scoped DbContext)
- `Microsoft.EntityFrameworkCore.SqlServer` → SQL Server
- `Npgsql.EntityFrameworkCore.PostgreSQL` → PostgreSQL

**HTTP**:
- `Microsoft.Extensions.Http` → IHttpClientFactory available

**Dependency Injection**:
- `Microsoft.Extensions.DependencyInjection` → DI container (usually implicit in ASP.NET)

**Testing**:
- `xUnit` → xUnit testing framework
- `NUnit` → NUnit testing framework
- `MSTest` → MSTest testing framework
- `Moq` → Mocking library

**Logging**:
- `Microsoft.Extensions.Logging` → ILogger available (usually implicit)

### Step 3: Read Program.cs or Startup.cs

**Tool**: Read → `Program.cs` or `Startup.cs`

**Detect**:
- Top-level statements (C# 9+) or traditional Main method
- Minimal APIs or Controllers
- DI service registrations

```csharp
// Top-level statements (modern)
var builder = WebApplication.CreateBuilder(args);

// Minimal APIs (no controllers)
app.MapGet("/users", () => "Hello");

// Or Controllers
builder.Services.AddControllers();
app.MapControllers();
```

**Findings**:
- Top-level statements → C# 9+, modern project
- `WebApplication.CreateBuilder` → ASP.NET Core 6+
- Minimal APIs → Simple route handlers
- Controllers → Traditional MVC/API controllers

### Step 4: Check for .editorconfig

**Tool**: Glob → `.editorconfig`

**Extract** (if exists):
- Brace style preferences
- var usage preferences
- Naming rules

## Decision Matrix

| SDK | Target Framework | Project Type | Code Generation Approach |
|-----|------------------|--------------|--------------------------|
| Microsoft.NET.Sdk | net8.0 | Console App | Top-level statements, nullable enabled |
| Microsoft.NET.Sdk.Web | net8.0 | ASP.NET Core | Minimal APIs or Controllers, DI, async |
| Microsoft.NET.Sdk | netstandard2.1 | Class Library | Traditional namespace, broad compatibility |

## Example Investigation Output

```yaml
Project Type: ASP.NET Core Web API
.NET Version: 8.0
Nullable Reference Types: Enabled
Top-Level Statements: Yes
API Style: Minimal APIs
Database: Entity Framework Core (SQL Server)
HTTP Client: IHttpClientFactory available
Testing Framework: xUnit
Logging: ILogger (Microsoft.Extensions.Logging)
```

## Adaptation Rules

Based on findings, adapt code generation:

**If nullable enabled** → Use `?` annotations, ArgumentNullException.ThrowIfNull
**If ASP.NET Core** → Use constructor injection, async methods, CancellationToken from request
**If EF Core detected** → Use async queries (ToListAsync, FindAsync), Scoped DbContext
**If minimal APIs** → Generate route handlers, not controllers
**If .NET 8+** → Use modern C# features (primary constructors, collection expressions)

## Quick Investigation Example

```bash
# Read .csproj
Read: MyProject.csproj
Result: SDK=Microsoft.NET.Sdk.Web, TargetFramework=net8.0, Nullable=enable

# Check packages
Grep: "Microsoft.EntityFrameworkCore"
Result: Found - EF Core available

# Read Program.cs
Read: Program.cs
Result: Top-level statements, builder.Services.AddDbContext, app.MapControllers()

# Conclusion
Project: ASP.NET Core Web API, .NET 8, Controllers, EF Core, Nullable enabled
```

## Summary

**Always investigate before generating**. 2-3 tool calls (Read .csproj, Grep packages, Read Program.cs) provide enough context to generate correct, idiomatic C# code.
