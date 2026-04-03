# C# Expert Templates

Working C# code templates for common patterns. Each template demonstrates correct usage of C# conventions, async patterns, dependency injection, and resource management.

## Available Templates

### Async Patterns (4 templates)

1. **async-method-with-cancellation.cs** - Async method with full cancellation support, exception handling, and logging
2. **async-parallel-operations.cs** - Running multiple async operations in parallel with Task.WhenAll
3. **async-with-timeout.cs** - Async operations with timeout using CancellationTokenSource
4. **async-event-handler.cs** - async void event handler (only valid use case for async void)

### Resource Management (3 templates)

5. **idisposable-implementation.cs** - Full IDisposable pattern with proper disposal
6. **using-declarations.cs** - Modern C# 8+ using declarations for file I/O
7. **iasync-disposable.cs** - IAsyncDisposable for async cleanup (streams, connections)

### Dependency Injection (3 templates)

8. **constructor-injection.cs** - Service with constructor injection and proper lifetimes
9. **di-registration.cs** - Program.cs service registration examples (Transient/Scoped/Singleton)
10. **scoped-service-resolution.cs** - Resolving Scoped services from Singleton using IServiceProvider

### LINQ Patterns (2 templates)

11. **linq-query-patterns.cs** - Correct LINQ usage: materialization, Include, projection
12. **linq-avoiding-n-plus-one.cs** - Avoiding N+1 queries with Include and batch fetching

### Null Safety (2 templates)

13. **null-safe-patterns.cs** - Nullable reference types, null-conditional operators, null checks
14. **argument-validation.cs** - ArgumentNullException.ThrowIfNull and parameter validation

### Naming & Conventions (2 templates)

15. **naming-examples.cs** - Complete naming convention examples (PascalCase, camelCase, I-prefix, etc.)
16. **basic-class-structure.cs** - Standard class structure with properties, methods, constructors

### API Patterns (2 templates)

17. **minimal-api-endpoint.cs** - ASP.NET Core minimal API with route handlers
18. **controller-with-di.cs** - ASP.NET Controller with dependency injection and async actions

## Template Structure

Each template includes:

- **When to Use**: Scenario description
- **Complexity**: Low/Medium/High
- **Common Mistakes Agents Make**: What typically goes wrong
- **Template Code**: Working example with {{placeholder}} syntax
- **Adaptation Examples**: Real-world usage variations
- **Critical Rules Applied**: Which rules from @rules/ are demonstrated
- **Prevents Top 10 Mistakes**: Which mistakes this template prevents

## How to Use Templates

1. **Investigate project** (Read .csproj, Grep patterns)
2. **Detect pattern** from user request
3. **Load appropriate template** from this folder
4. **Replace {{placeholders}}** with actual names from project context
5. **Adapt to project conventions** (using, namespace, naming style)
6. **Verify against @validation/checklist.md**

## Placeholder Syntax

Templates use `{{placeholder}}` syntax:

- `{{ServiceName}}` → Class name in PascalCase (e.g., UserService)
- `{{IServiceName}}` → Interface name with I-prefix (e.g., IUserService)
- `{{methodName}}` → Method name in PascalCase (e.g., GetUser)
- `{{paramName}}` → Parameter in camelCase (e.g., userId)
- `{{_fieldName}}` → Private field with underscore (e.g., _repository)
- `{{Type}}` → Type name (e.g., User, string, int)

## Progressive Disclosure

Templates are loaded on-demand based on detected pattern:

**User mentions "async method"** → Load async-method-with-cancellation.cs
**User mentions "IDisposable"** → Load idisposable-implementation.cs
**User mentions "dependency injection"** → Load constructor-injection.cs + di-registration.cs
**User mentions "LINQ query"** → Load linq-query-patterns.cs

## Template Categories by Top 10 Mistakes

**Prevents #1-#3 (Async):**
- async-method-with-cancellation.cs
- async-parallel-operations.cs
- async-with-timeout.cs

**Prevents #4 (IDisposable):**
- idisposable-implementation.cs
- using-declarations.cs
- iasync-disposable.cs

**Prevents #5 (Null Safety):**
- null-safe-patterns.cs
- argument-validation.cs

**Prevents #6 (Naming):**
- naming-examples.cs
- basic-class-structure.cs

**Prevents #7 (LINQ):**
- linq-query-patterns.cs
- linq-avoiding-n-plus-one.cs

**Prevents #8 (Cancellation):**
- async-method-with-cancellation.cs

**Prevents #9 (DI):**
- constructor-injection.cs
- di-registration.cs
- scoped-service-resolution.cs

**Prevents #10 (Collections):**
- linq-query-patterns.cs (collection type selection context)

---

**Templates provide working code patterns that prevent the Top 10 C# agent mistakes!**
