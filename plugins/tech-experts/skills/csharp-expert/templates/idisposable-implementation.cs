# Template: IDisposable Implementation

**When to Use**: Class owns IDisposable resources (file streams, HttpClient, database connections).

**Complexity**: Medium

**Common Mistakes Agents Make**:
- Not implementing IDisposable when owning IDisposable fields
- Disposing dependency-injected objects (DI container manages those)
- No ObjectDisposedException check in methods after disposal
- Missing GC.SuppressFinalize call

## Template

```csharp
using System;

namespace {{Namespace}};

/// <summary>
/// {{ClassName}} - {{Description}}
/// </summary>
public class {{ClassName}} : IDisposable
{
    // Resources we own (must dispose)
    private readonly FileStream? _fileStream;
    private readonly HttpClient? _httpClient;

    // Disposal tracking
    private bool _disposed;

    public {{ClassName}}(string filePath)
    {
        _fileStream = new FileStream(filePath, FileMode.Create);
        _httpClient = new HttpClient();
    }

    public void {{MethodName}}()
    {
        ObjectDisposedException.ThrowIf(_disposed, this);

        // Use resources
        _fileStream?.WriteByte(0);
    }

    public void Dispose()
    {
        Dispose(true);
        GC.SuppressFinalize(this);
    }

    protected virtual void Dispose(bool disposing)
    {
        if (_disposed) return;

        if (disposing)
        {
            // Dispose managed resources
            _fileStream?.Dispose();
            _httpClient?.Dispose();
        }

        // Free unmanaged resources (if any)

        _disposed = true;
    }
}
```

## Usage

```csharp
// Always use 'using' statement
using var resource = new {{ClassName}}("file.txt");
resource.{{MethodName}}();
// Dispose() called automatically here
```

## Prevents Top 10 Mistakes

- **#4: Missing IDisposable.Dispose()** → Proper implementation
