# Template: LINQ Query Patterns

**When to Use**: Database queries using Entity Framework Core or in-memory collections.

**Complexity**: Medium

**Common Mistakes Agents Make**:
- Multiple enumeration (not materializing with ToList)
- ToList() before filtering (client-side instead of SQL WHERE)
- N+1 queries (not using Include)
- Count() > 0 instead of Any()
- Modifying collection during enumeration

## Template

```csharp
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;

namespace {{Namespace}};

public class {{RepositoryName}}
{
    private readonly {{DbContext}} _context;

    public {{RepositoryName}}({{DbContext}} context)
    {
        _context = context;
    }

    /// <summary>
    /// Filter and materialize - ToList after Where
    /// </summary>
    public async Task<List<{{Entity}}>> Get{{Entities}}Async(CancellationToken cancellationToken = default)
    {
        return await _context.{{Entities}}
            .Where(e => e.{{Property}} == {{value}}) // SQL WHERE clause
            .ToListAsync(cancellationToken); // Materialize here
    }

    /// <summary>
    /// Project and materialize - Select before ToList
    /// </summary>
    public async Task<List<string>> Get{{Entity}}NamesAsync(CancellationToken cancellationToken = default)
    {
        return await _context.{{Entities}}
            .Select(e => e.Name) // SQL SELECT Name
            .ToListAsync(cancellationToken); // Fetch only Name column
    }

    /// <summary>
    /// Include related data - prevent N+1 queries
    /// </summary>
    public async Task<List<{{Entity}}>> Get{{Entities}}WithRelatedAsync(CancellationToken cancellationToken = default)
    {
        return await _context.{{Entities}}
            .Include(e => e.{{RelatedEntity}}) // SQL JOIN
            .Where(e => e.IsActive)
            .ToListAsync(cancellationToken); // Single query with JOIN
    }

    /// <summary>
    /// Use Any() for existence check, not Count() > 0
    /// </summary>
    public async Task<bool> Has{{Entities}}Async(CancellationToken cancellationToken = default)
    {
        return await _context.{{Entities}}
            .AnyAsync(cancellationToken); // SELECT TOP 1 (fast)
    }

    /// <summary>
    /// Materialize once for multiple operations
    /// </summary>
    public async Task Process{{Entities}}Async(CancellationToken cancellationToken = default)
    {
        // Materialize once
        var entities = await _context.{{Entities}}
            .Where(e => e.IsActive)
            .ToListAsync(cancellationToken);

        // Multiple enumerations of materialized list (no extra queries)
        var count = entities.Count; // No query
        var max = entities.Max(e => e.Value); // No query
        foreach (var entity in entities) // No query
        {
            Console.WriteLine(entity.Name);
        }
    }

    /// <summary>
    /// Avoid modification during enumeration
    /// </summary>
    public void RemoveInactive(List<{{Entity}}> entities)
    {
        // Wrong: entities.RemoveAll(e => !e.IsActive);  during foreach
        // Correct: Use LINQ to create new collection
        var activeEntities = entities.Where(e => e.IsActive).ToList();
    }
}
```

## Prevents Top 10 Mistakes

- **#7: Multiple LINQ enumeration** → Materialize with ToList, use Include
