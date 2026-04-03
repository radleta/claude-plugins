# C# Naming Conventions

C# has strict naming conventions enforced by the compiler, Roslyn analyzers, and community standards. Violating naming conventions causes **compilation errors** (I-prefix missing on interface), **analyzer warnings**, **readability issues**, and **broken IntelliSense**.

## The Problem: Why Naming Conventions Matter

C# naming is not just style - some violations break compilation:
- **Missing I-prefix on interfaces** → Analyzer error, violates C# standards
- **Lowercase class names** → Violates PascalCase rule, readability suffers
- **Missing Async suffix** → Methods look synchronous, causes confusion
- **Wrong casing on parameters** → camelCase required, PascalCase is wrong
- **Underscore prefix on public fields** → Violates conventions, should be properties

**Key insight**: C# naming is prescriptive, not descriptive. Follow conventions or face compilation errors and analyzer failures.

---

## Rule 1: Interfaces Must Have I- Prefix (IPascalCase)

**Statement**: All interface names must start with `I` followed by PascalCase. No exceptions.

### Why This Matters

The I-prefix is a C# language convention enforced by analyzers. Without it, Roslyn analyzers (CA1715) flag it as an error. It's also how C# developers instantly recognize interfaces.

### ❌ WRONG: Interface Without I-Prefix

```csharp
// This is WRONG - missing I-prefix
public interface UserRepository // CA1715: Prefix interface with 'I'
{
    Task<User> GetUserAsync(int id);
}
```

**What breaks**: Roslyn analyzer CA1715 error. Code reviewers reject. Violates C# conventions.

### ❌ WRONG: Lowercase Interface Name

```csharp
// This is WRONG - lowercase, no I-prefix
public interface userRepository // Multiple violations!
{
    Task<User> GetUserAsync(int id);
}
```

**What breaks**: Violates both PascalCase and I-prefix rules. Unacceptable in C#.

### ✅ CORRECT: I-Prefix with PascalCase

```csharp
// Correct interface naming
public interface IUserRepository // I-prefix + PascalCase
{
    Task<User> GetUserAsync(int id);
}

public interface IDisposable { } // Built-in example
public interface IEnumerable<T> { } // Built-in generic example
```

**Why this works**: Follows C# conventions. No analyzer warnings. Instantly recognizable as interface.

---

## Rule 2: Classes, Methods, Properties Use PascalCase

**Statement**: Classes, methods, properties, and public fields use PascalCase (first letter of each word capitalized).

### ❌ WRONG: Lowercase or camelCase Class Name

```csharp
// This is WRONG - should be PascalCase
public class userService // Should be UserService
{
    public string getName() // Should be GetName
    {
        return "John";
    }
}
```

**What breaks**: Violates C# conventions. Unreadable. Looks like variable, not class.

### ✅ CORRECT: PascalCase for Types and Members

```csharp
// PascalCase for all type and public members
public class UserService // PascalCase class
{
    public string UserName { get; set; } // PascalCase property

    public string GetName() // PascalCase method
    {
        return UserName;
    }

    public async Task<User> GetUserAsync(int id) // PascalCase async method
    {
        return await _repository.GetUserAsync(id);
    }
}
```

**Why this works**: Standard C# naming. Consistent with .NET framework. Readable.

---

## Rule 3: Parameters and Local Variables Use camelCase

**Statement**: Method parameters and local variables use camelCase (first letter lowercase, subsequent words capitalized).

### ❌ WRONG: PascalCase Parameters

```csharp
// This is WRONG - parameters should be camelCase
public User GetUser(int UserId, string UserName) // Should be userId, userName
{
    var FirstName = UserName.Split(' ')[0]; // Should be firstName
    return new User(UserId, FirstName);
}
```

**What breaks**: Violates C# conventions. Parameters look like types/properties. Confusing.

### ✅ CORRECT: camelCase for Parameters and Locals

```csharp
// camelCase for parameters and local variables
public User GetUser(int userId, string userName)
{
    var firstName = userName.Split(' ')[0];
    var user = new User(userId, firstName);
    return user;
}
```

**Why this works**: Standard C# naming. Clear distinction between parameters/locals (camelCase) and types/members (PascalCase).

---

## Rule 4: Private Fields Use _camelCase (Underscore Prefix)

**Statement**: Private fields use underscore prefix + camelCase: `_camelCase`. Public fields should be properties instead.

### Why This Matters

The underscore prefix distinguishes fields from local variables and parameters. It's the .NET convention.

### ❌ WRONG: Private Field Without Underscore

```csharp
// This is WRONG - private field should have underscore
public class UserService
{
    private IUserRepository repository; // Should be _repository

    public UserService(IUserRepository repository)
    {
        this.repository = repository; // 'this.' needed to disambiguate
    }
}
```

**What breaks**: Ambiguous with parameters. Requires `this.` to disambiguate. Violates conventions.

### ❌ WRONG: Public Field Instead of Property

```csharp
// This is WRONG - public field should be property
public class User
{
    public string Name; // Should be property with { get; set; }
}
```

**What breaks**: Public fields can't be overridden, can't have logic in getters/setters, break data binding.

### ✅ CORRECT: Private Fields with Underscore

```csharp
public class UserService
{
    private readonly IUserRepository _repository; // Underscore prefix
    private readonly ILogger<UserService> _logger;

    public UserService(IUserRepository repository, ILogger<UserService> logger)
    {
        _repository = repository; // No 'this.' needed
        _logger = logger;
    }

    public async Task<User> GetUserAsync(int id)
    {
        _logger.LogInformation("Fetching user {UserId}", id);
        return await _repository.GetUserAsync(id);
    }
}
```

**Why this works**: Underscore prefix makes fields instantly recognizable. No ambiguity with parameters.

### ✅ CORRECT: Properties for Public Members

```csharp
public class User
{
    public string Name { get; set; } // Property, not field
    public int Age { get; init; } // Init-only property (C# 9+)
    public string Email { get; private set; } // Public getter, private setter
}
```

**Why this works**: Properties provide encapsulation, can be overridden, support data binding.

---

## Rule 5: Async Methods Must Have Async Suffix

**Statement**: Methods that return `Task` or `Task<T>` should end with `Async` suffix.

### Why This Matters

The `Async` suffix signals to callers that the method is asynchronous and should be awaited. Without it, methods look synchronous, leading to confusion and potential `.Result` / `.Wait()` misuse.

### ❌ WRONG: Async Method Without Async Suffix

```csharp
// This is WRONG - returns Task but no Async suffix
public Task<User> GetUser(int id) // Should be GetUserAsync
{
    return _repository.GetUserAsync(id);
}
```

**What breaks**: Looks synchronous. Callers may forget to await. Violates conventions.

### ❌ WRONG: Sync Method With Async Suffix

```csharp
// This is WRONG - Async suffix but returns User, not Task
public User GetUserAsync(int id) // Should be GetUser (no Async suffix)
{
    return _repository.GetUser(id);
}
```

**What breaks**: Misleading name. Callers expect to await, but it's synchronous.

### ✅ CORRECT: Async Suffix for Async Methods

```csharp
// Async methods have Async suffix
public async Task<User> GetUserAsync(int id) // Async suffix
{
    return await _repository.GetUserAsync(id);
}

public async Task SaveUserAsync(User user) // Task, Async suffix
{
    await _repository.SaveAsync(user);
}

public Task<User> FindUserAsync(int id) // No await, but returns Task, keep Async
{
    return _repository.GetUserAsync(id);
}
```

**Why this works**: Async suffix makes async methods instantly recognizable. Callers know to await.

### ✅ CORRECT: No Async Suffix for Sync Methods

```csharp
// Sync methods have no Async suffix
public User GetUser(int id) // No async, no Async suffix
{
    return _users[id];
}
```

**Why this works**: No Task return, no Async suffix. Clearly synchronous.

---

## Rule 6: Constants Use PascalCase or UPPER_CASE

**Statement**: Constants use either PascalCase (preferred in C#) or UPPER_CASE (older style).

### ✅ CORRECT: PascalCase Constants (Preferred)

```csharp
public class Configuration
{
    public const int MaxRetries = 3; // PascalCase (preferred)
    public const string DefaultConnectionString = "Server=localhost";
}
```

### ✅ CORRECT: UPPER_CASE Constants (Acceptable)

```csharp
public class Configuration
{
    public const int MAX_RETRIES = 3; // UPPER_CASE (acceptable, older style)
    public const string DEFAULT_CONNECTION_STRING = "Server=localhost";
}
```

**Both acceptable**: PascalCase is more common in modern C#. UPPER_CASE is acceptable but less common.

---

## Rule 7: Boolean Variables Should Be Named as Questions

**Statement**: Boolean variables and properties should be named as yes/no questions: `Is...`, `Has...`, `Can...`, `Should...`.

### ❌ WRONG: Boolean Not Named as Question

```csharp
public class User
{
    public bool Active { get; set; } // Unclear meaning
    public bool Admin { get; set; } // Is admin? Has admin rights?
}
```

**What's wrong**: Ambiguous. `Active` could mean "IsActive" or "Activate". Not clear.

### ✅ CORRECT: Boolean Named as Question

```csharp
public class User
{
    public bool IsActive { get; set; } // Clear yes/no question
    public bool IsAdmin { get; set; }
    public bool HasVerifiedEmail { get; set; }
    public bool CanEdit { get; set; }
    public bool ShouldNotify { get; set; }
}
```

**Why this works**: Reads like a question. Clear meaning. Usage is obvious: `if (user.IsActive)`.

---

## Rule 8: Avoid Abbreviations and Acronyms

**Statement**: Use full words, not abbreviations. Acronyms (HTTP, URL, ID) are uppercase if 2 letters, PascalCase if 3+.

### ❌ WRONG: Abbreviations

```csharp
public class UsrSvc // Should be UserService
{
    public async Task<Usr> GetUsrAsync(int id) // Should be User
    {
        var repo = new UsrRepo(); // Should be UserRepository
        return await repo.GetAsync(id);
    }
}
```

**What breaks**: Unreadable. Unclear abbreviations. Violates conventions.

### ✅ CORRECT: Full Words

```csharp
public class UserService // Full words
{
    public async Task<User> GetUserAsync(int id)
    {
        var repository = new UserRepository();
        return await repository.GetAsync(id);
    }
}
```

**Why this works**: Readable. No ambiguity. IntelliSense-friendly.

### ✅ CORRECT: Acronym Casing

```csharp
public class ApiController // API = 3 letters → PascalCase: Api
{
    public string GetUrl() // URL = 3 letters → PascalCase: Url
    {
        return "https://example.com";
    }

    public int GetID() // ID = 2 letters → Uppercase: ID
    {
        return 123;
    }

    public string GetHTTPHeader() // HTTP = 4 letters → PascalCase: Http
    {
        return "Content-Type";
    }
}
```

**Rule**: 2-letter acronyms uppercase (ID, IO). 3+ letter acronyms PascalCase (Api, Url, Http).

---

## Summary Checklist

Before generating C# code, verify naming:

- [ ] **Interfaces**: I-prefix + PascalCase (IUserRepository)
- [ ] **Classes, methods, properties**: PascalCase (UserService, GetUser, UserName)
- [ ] **Parameters, local variables**: camelCase (userId, userName, result)
- [ ] **Private fields**: _camelCase with underscore (_repository, _logger)
- [ ] **Async methods**: Async suffix (GetUserAsync, SaveDataAsync)
- [ ] **Constants**: PascalCase (MaxRetries) or UPPER_CASE (MAX_RETRIES)
- [ ] **Booleans**: Is/Has/Can/Should prefix (IsActive, HasPermission)
- [ ] **Acronyms**: 2 letters uppercase (ID), 3+ PascalCase (Api, Url)
- [ ] **No abbreviations**: Full words (UserService, not UsrSvc)

---

**These naming conventions prevent compilation errors, analyzer warnings, and readability issues!**
