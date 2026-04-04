# File I/O Rules & Constraints

## Rule 1: FileSystemWatcher + Atomic Write Incompatibility (CRITICAL)

`File.Move(src, dst, overwrite: true)` uses `MoveFileEx` with `MOVEFILE_REPLACE_EXISTING` which **silently suppresses `FileSystemWatcher` notifications** on Windows. The FSW never fires `Changed`, `Created`, or `Deleted` events for the target file.

### Impact
- Applications relying on FSW for live file monitoring will miss all updates
- Falls back to polling (sweep timer) with seconds of latency instead of milliseconds
- No error or warning — FSW silently stops working

### Bad Pattern
```csharp
// ❌ Atomic write that breaks FSW — no events fire for target.json
var tmpPath = path + ".tmp";
File.WriteAllBytes(tmpPath, json);
File.Move(tmpPath, path, overwrite: true);  // Uses MoveFileEx — FSW silent
```

### Good Patterns

**Option A: Direct write (preferred for small files < 10KB)**
```csharp
// ✅ Direct write — FSW fires Changed event
File.WriteAllBytes(path, json);
```

**Option B: Delete + Move (preserves atomicity for large files)**
```csharp
// ✅ Explicit delete + move — FSW fires Deleted then Created
var tmpPath = path + ".tmp";
File.WriteAllBytes(tmpPath, json);
if (File.Exists(path)) File.Delete(path);
File.Move(tmpPath, path);
```

### When to Use Each
- **Option A**: Files < 10KB, single writer, reader handles partial JSON (return null on parse error)
- **Option B**: Large files, multiple concurrent readers, need atomicity guarantees

### Verified Impact
- Latency with `File.Move(overwrite: true)`: **5,000–15,000ms** (sweep-only detection)
- Latency with `File.WriteAllBytes`: **27–98ms** (FSW + drain timer detection)

### Root Cause
`File.Move(overwrite: true)` calls Win32 `MoveFileEx` with `MOVEFILE_REPLACE_EXISTING`. This performs an in-place file replacement that does not trigger `ReadDirectoryChangesW` (the Win32 API backing `FileSystemWatcher`). No `Changed`, `Created`, or `Renamed` events are raised for the target file.

---

## Rule 2: FileSystemWatcher Buffer Overflow

FSW's default `InternalBufferSize` is 8KB. Under rapid writes (e.g., many sessions updating state files), the buffer overflows and events are silently dropped.

### Fix
```csharp
var watcher = new FileSystemWatcher(path, "*.json")
{
    InternalBufferSize = 65536, // 64KB — prevents overflow under load
    NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite | NotifyFilters.Size,
    EnableRaisingEvents = true,
};

// Always wire the Error event to detect buffer overflows
watcher.Error += (_, err) =>
    _logger.LogWarning(err.GetException(), "FileSystemWatcher buffer overflow");
```

---

## Rule 3: FSW Event Deduplication

FSW fires multiple events for a single file write (e.g., `Changed` twice). Use a debounce queue:

```csharp
private readonly ConcurrentQueue<string> _pending = new();

watcher.Changed += (_, e) => _pending.Enqueue(e.FullPath);

// Drain on UI thread timer (100ms):
while (_pending.TryDequeue(out var path))
{
    if (!processed.Add(path)) continue; // Skip duplicates in same cycle
    HandleFileChanged(path);
}
```

---

## Rule 4: JSON Deserialization Null Override

`System.Text.Json` deserialization sets properties to `null` when the JSON field is explicitly `"field": null`, even if the C# property has a default initializer.

### Bad Assumption
```csharp
// ❌ Default initializer does NOT protect against explicit null in JSON
public Dictionary<string, string> Mappings { get; init; } = new();
// JSON: {"mappings": null} → Mappings is NULL, not empty dictionary
```

### Fix: Null-check at usage site
```csharp
// ✅ Always null-check properties that may come from JSON deserialization
if (config.Mappings is not null && config.Mappings.TryGetValue(key, out var value))
{
    // safe
}
```
