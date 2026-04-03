# Pattern Detection - Request to Guidance Mapping

**Purpose**: Map user requests to the appropriate rules, decision trees, or templates.

## Detection Flow

```
User Request
    ↓
Extract Keywords
    ↓
Match to Category
    ↓
Load Appropriate File(s)
    ↓
Generate Code Following Guidance
```

## Keyword → Category → File Mapping

### Category 1: Async/Await Rules & Constraints

**Keywords**: "async", "await", "Task", "async void", "deadlock", ".Result", ".Wait()", "ConfigureAwait", "ValueTask"

**Signals**:
- User mentions async-related errors or deadlocks
- Asks about async/await patterns
- Has application hanging issues
- Mentions Task or async methods

**Load**:
- @rules/async-await-rules.md → async void violations, .Result/.Wait() deadlocks, ConfigureAwait
- @decision-trees/async-vs-sync.md → When to use async vs sync

**Decision**: Does request involve async? Load rules first (Critical priority - prevents crashes/hangs).

---

### Category 2: Resource Management & IDisposable

**Keywords**: "IDisposable", "Dispose", "using", "resource", "leak", "file", "stream", "memory", "DbContext", "HttpClient"

**Signals**:
- User needs to work with files, databases, or HTTP
- Has memory leak issues
- Asks about resource cleanup
- Mentions IDisposable or using statements

**Load**:
- @rules/idisposable-patterns.md → When to implement IDisposable, using patterns
- @templates/idisposable-implementation.cs → IDisposable template
- @templates/using-declarations.cs → Modern using syntax

**Decision**: Resource management? Load IDisposable rules (Critical priority - prevents leaks).

---

### Category 3: Null Safety & Nullable Reference Types

**Keywords**: "null", "NullReferenceException", "nullable", "?", "!", "null-forgiving", "null check", "?.', "??", "NRT"

**Signals**:
- User has NullReferenceException issues
- Asks about null handling
- Needs nullable reference type annotations
- Asks about ?. or ?? operators

**Load**:
- @rules/null-safety.md → Nullable annotations, null checks, operators
- @templates/null-safe-patterns.cs → Null-safe code examples
- @decision-trees/null-handling.md → When to use ?, ??, !, ?.

**Decision**: Null handling question? Load null safety rules (High priority).

---

### Category 4: Naming Conventions

**Keywords**: "naming", "PascalCase", "camelCase", "I-prefix", "interface", "Async suffix", "_underscore", "convention", "style"

**Signals**:
- User asks about C# naming rules
- Has compilation errors from wrong names
- Needs to know proper casing
- Asks about interface or async method naming

**Load**:
- @rules/naming-conventions.md → PascalCase, camelCase, I-prefix, Async suffix rules
- @templates/naming-examples.cs → Examples of correct naming

**Decision**: Naming question? Load conventions (High priority - affects compilation).

---

### Category 5: Dependency Injection

**Keywords**: "dependency injection", "DI", "AddTransient", "AddScoped", "AddSingleton", "IServiceCollection", "lifetime", "captive", "service"

**Signals**:
- User needs to register services
- Asks about DI lifetimes
- Has captive dependency issues
- Mentions service registration or IServiceCollection

**Load**:
- @rules/dependency-injection-rules.md → Lifetime rules, captive dependencies
- @decision-trees/di-lifetimes.md → When to use Transient/Scoped/Singleton
- @templates/di-registration.cs → Service registration examples
- @templates/constructor-injection.cs → Constructor DI pattern

**Decision Tree**:
```
Start: What is the service?
├─ Stateless service (no state, thread-safe)
│   └─ Use Singleton → @decision-trees/di-lifetimes.md
├─ Per-request service (HTTP request, DbContext)
│   └─ Use Scoped → @decision-trees/di-lifetimes.md
└─ Stateful service or not thread-safe
    └─ Use Transient → @decision-trees/di-lifetimes.md
```

**Decision**: DI question? Load DI rules (High priority - prevents memory leaks).

---

### Category 6: LINQ Optimization

**Keywords**: "LINQ", "query", "Where", "Select", "ToList", "ToArray", "enumeration", "IEnumerable", "deferred execution", "multiple enumeration"

**Signals**:
- User has LINQ performance issues
- Asks about deferred execution
- Multiple database query issues
- Asks about ToList() or ToArray()

**Load**:
- @rules/linq-best-practices.md → Deferred execution, multiple enumeration
- @templates/linq-patterns.cs → Correct LINQ usage
- @decision-trees/collection-materialization.md → When to use ToList/ToArray

**Decision**: LINQ question? Load LINQ rules (Medium priority).

---

### Category 7: Collection Type Selection

**Keywords**: "collection", "List", "HashSet", "Dictionary", "array", "IEnumerable", "lookup", "performance", "contains"

**Signals**:
- User asks which collection type to use
- Has performance issues with collections
- Asks about List vs HashSet vs Dictionary
- Needs fast lookups or unique values

**Load**:
- @decision-trees/collection-types.md → When to use each collection type
- @templates/collection-usage.cs → Collection type examples
- @rules/linq-best-practices.md → Collection performance

**Decision Tree**:
```
Start: What operations are needed?
├─ Fast lookups by key
│   └─ Use Dictionary<TKey, TValue>
├─ Unique values, set operations
│   └─ Use HashSet<T>
├─ Sequential access, order matters
│   └─ Use List<T>
└─ Fixed size, performance-critical
    └─ Use Array (T[])
```

**Decision**: Collection choice? Load decision tree (Medium priority).

---

### Category 8: Async Methods & Cancellation

**Keywords**: "CancellationToken", "cancel", "cancellation", "timeout", "async operation", "long-running"

**Signals**:
- User needs cancellable operations
- Asks about CancellationToken
- Has long-running async tasks
- Needs timeout support

**Load**:
- @templates/async-with-cancellation.cs → CancellationToken patterns
- @rules/async-await-rules.md → Cancellation best practices
- @templates/timeout-patterns.cs → Timeout implementations

**Decision**: Async cancellation? Load cancellation templates (Medium priority).

---

### Category 9: Project Type Detection

**Keywords**: "console app", "ASP.NET", "Web API", "Blazor", "MAUI", "class library", "Azure Functions", "project type"

**Signals**:
- User starting new code in unknown project
- Asks about project-specific patterns
- Needs to understand project setup

**Load**:
- @investigation/project-detection.md → Detect SDK type and project structure
- @investigation/package-analysis.md → Identify key NuGet packages
- @investigation/api-style-detection.md → Detect minimal APIs vs controllers (ASP.NET)

**Decision**: Unknown project context? Run investigation first (Required before code generation).

---

### Category 10: Exception Handling

**Keywords**: "exception", "try", "catch", "finally", "throw", "error handling", "custom exception"

**Signals**:
- User asks about exception handling
- Needs custom exceptions
- Asks about try-catch patterns

**Load**:
- @templates/exception-handling.cs → Try-catch patterns
- @templates/custom-exceptions.cs → Custom exception classes
- @rules/async-await-rules.md → Exception handling in async (if async context)

**Decision**: Exception handling? Load templates.

---

## Multi-Category Requests

Some requests span multiple categories. Load all relevant files:

**Example**: "Create async method that queries database with cancellation"
- Load: @rules/async-await-rules.md (async patterns)
- Load: @templates/async-with-cancellation.cs (cancellation pattern)
- Load: @rules/idisposable-patterns.md (DbContext disposal)
- Load: @rules/dependency-injection-rules.md (DbContext is Scoped)

**Example**: "Implement service with dependency injection"
- Load: @rules/dependency-injection-rules.md (DI rules)
- Load: @decision-trees/di-lifetimes.md (choose lifetime)
- Load: @templates/constructor-injection.cs (DI pattern)
- Load: @rules/naming-conventions.md (service naming)

**Example**: "LINQ query that filters and materializes results"
- Load: @rules/linq-best-practices.md (deferred execution)
- Load: @templates/linq-patterns.cs (LINQ examples)
- Load: @decision-trees/collection-materialization.md (when to ToList)

---

## Default Fallback

**If keywords don't match clearly**:
1. Run @investigation/project-detection.md (understand context)
2. Load @templates/basic-class.cs (basic class structure)
3. Ask user for clarification about:
   - Is this async?
   - Does it use DI?
   - Does it manage resources (IDisposable)?
   - Does it use LINQ?
   - What .NET project type?

---

## Priority Order (by Severity)

When multiple files apply, load in this order:

**Critical (Always Load First)**:
1. **@rules/async-await-rules.md** (prevents deadlocks, crashes)
2. **@rules/idisposable-patterns.md** (prevents resource leaks)

**High (Load for Most Code Generation)**:
3. **@rules/null-safety.md** (prevents NullReferenceException)
4. **@rules/naming-conventions.md** (prevents compilation errors)
5. **@rules/dependency-injection-rules.md** (prevents memory leaks)

**Medium (Load as Needed)**:
6. **@rules/linq-best-practices.md** (performance)
7. **@decision-trees/** (guide choices)
8. **@templates/** (working examples)

**Supporting**:
9. **@investigation/** (if context needed)
10. **@validation/** (verify after generation)

---

## Investigation-First Protocol

**BEFORE generating any C# code**:

1. **Read .csproj** → Detect SDK type (Console, Web, Library), target framework (.NET 8, .NET 9)
2. **Grep for packages** → Detect DI, logging, testing frameworks
3. **Read Program.cs** → Detect startup patterns (minimal APIs, controllers, top-level statements)
4. **Glob configs** → Find .editorconfig, Directory.Build.props

**Load @investigation/** for detailed protocols.

---

**Detection ensures agents load exactly what's needed for each C# request, prioritizing critical rules that prevent crashes and leaks!**
