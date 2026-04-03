# Error Handling, Cancellation, and Structured Logging

## Global Exception Safety Net

The entry point of every CLI must wrap the command execution in a try-catch. Unhandled exceptions must never show raw stack traces to users.

**Entry point pattern:**
```
try:
    parse args
    adjust log level based on --verbose
    invoke command
    return exit code from command
catch OperationCancelled:
    log warning "cancelled"
    print "Operation cancelled." to stderr
    return EXIT_CANCELLED (130)
catch AppException (your custom exception):
    log error with exception
    print clean message to stderr
    return appropriate exit code based on exception type
catch Exception (generic safety net):
    log fatal with full exception
    print clean message to stderr
    return EXIT_USER_ERROR (1)
finally:
    flush and close logger
```

**Key points:**
- `OperationCancelled` gets its own catch — it's not an error, it's a clean cancellation
- App-specific exceptions (e.g., `CliException`) get clean formatting with no stack trace
- Generic `Exception` is the safety net — clean message by default, stack trace only in verbose mode
- `finally` always flushes the logger (critical for file/network sinks)

## Cancellation (Ctrl+C / SIGINT)

**The flow:**
1. User presses Ctrl+C → runtime cancels the CancellationToken
2. In-flight async operations (HTTP, file I/O) throw `OperationCancelledException`
3. Exception propagates to entry point's catch block
4. Print brief message to stderr
5. Exit with code 130

**Requirements:**
- Thread CancellationToken through all async operations
- Catch `OperationCanceledException` at the top level
- Never show stack trace for cancellation
- Exit 130 (not 1 or 2 — those are for errors)

**What NOT to do:**
- Don't ignore SIGINT (process hangs forever)
- Don't swallow the exception silently (user doesn't know what happened)
- Don't exit with code 0 (cancellation is not success)

## Structured Logging in CLIs

### When to Use a Logging Framework

| Scenario | Recommendation |
|----------|----------------|
| Simple CLI (1-2 commands, no HTTP) | stderr output is sufficient — no framework needed |
| CLI with HTTP calls, config resolution | Lightweight logger with log levels (e.g., Serilog, Winston, zerolog) |
| Long-running CLI (daemon, watcher) | Full logging framework with file sink |
| CLI as part of larger system | Match the system's logging framework |

### Logger vs OutputFormatter

A CLI typically needs **two output systems** that serve different purposes:

| Concern | OutputFormatter | Logger |
|---------|-----------------|--------|
| **Audience** | End user / agent | Developer debugging |
| **Destination** | stdout (data), stderr (status) | stderr only |
| **Content** | Success messages, errors, JSON results | Config resolution, HTTP calls, timing |
| **Controlled by** | `--json`, `--quiet` | `--verbose` (log level) |
| **Always visible** | Errors (stderr) | Only when verbose |

**They complement each other:**
- OutputFormatter handles user-facing output (success ✓, error ✗, data)
- Logger handles developer diagnostics (debug traces, HTTP logging, config resolution)

### Logger Configuration for CLIs

| Setting | Value | Rationale |
|---------|-------|-----------|
| **Output destination** | stderr only | Never pollute stdout data stream |
| **Default level** | Warning | Normal mode shows only warnings and errors |
| **Verbose level** | Debug | `--verbose` enables debug output |
| **Quiet level** | Fatal | Effectively silent |
| **Template** | `[{Level}] {Message}` | No timestamps — CLIs are ephemeral |
| **DI approach** | Static/global logger | CLIs rarely have DI containers |
| **Lifecycle** | Init at start, flush in `finally` | Ensure all events written before exit |

### What to Log (and What NOT to)

| Log This | Example | Level |
|----------|---------|-------|
| Config source resolution | `Config: apiUrl from env var` | Debug |
| HTTP request method + URL | `GET /api/review/abc123` | Debug |
| HTTP response status | `GET responded 200` | Debug |
| File operations | `Reading file: ./data.json (1.2KB)` | Debug |
| Operation timing | `Submit completed in 342ms` | Debug |
| Recoverable issues | `Config file not found, using env vars` | Warning |
| Known errors (app exceptions) | `API returned 404: Not found` | Error |
| Unhandled exceptions | `Unhandled: NullReferenceException` | Fatal |

| Never Log This | Why |
|----------------|-----|
| API keys, tokens, secrets | Security — visible in terminal, log files |
| Request/response bodies | May contain secrets or large payloads |
| Password fields | Obviously sensitive |
| Full config file contents | May contain secrets |

### Error Output Formatting

| Mode | Error Behavior |
|------|----------------|
| Normal | `✗ Clean message` to stderr |
| `--verbose` | `✗ Clean message` + stack trace via logger |
| `--json` | `✗ Clean message` to stderr (exit code tells agent it failed) |

**Stack traces only in verbose mode.** Normal users and agents see clean messages. Developers debugging with `--verbose` see full exception details via the logger.

## Custom Exception Hierarchy

For non-trivial CLIs, define a base exception with exit code and suggestion:

```
AppException (base)
  ├── exitCode: int (1=user, 2=infra)
  ├── suggestion: string? (actionable fix)
  │
  ├── InputException (exit 1)
  │   "Sheet not found in file.xlsx"
  │   suggestion: "Verify the xlsx has the expected sheet names"
  │
  └── InfrastructureException (exit 2)
      "Cannot connect to database"
      suggestion: "Check connection string in appsettings.json"
```

**Key properties:**
- `ExitCode` — maps directly to CLI exit codes (no translation layer)
- `Suggestion` — optional user-facing hint for how to fix the error
- Subclasses set their own default exit code

**Global handler renders rich output** (e.g., Spectre panels, boxed errors):
```
catch AppException:
    render error panel with message
    if suggestion exists, show it
    return exception.ExitCode
```

**Benefits over catch-by-status-code:**
- Commands throw specific exceptions — no manual exit code management
- Suggestions survive the call stack (thrown in reader, displayed at top level)
- Rich rendering happens once in the global handler, not per-command

## Per-Command Error Handling

Commands should handle expected errors locally with specific messages:

| Error Type | Handle In | Exit Code | Example |
|------------|-----------|-----------|---------|
| File not found | Command | 1 (UserError) | `File not found: ./missing.json` |
| Invalid JSON | Command | 1 (UserError) | `Invalid JSON: Unexpected token at line 3` |
| Validation failure | Command | 1 (UserError) | `2 errors: name required, url required` |
| Config missing | Command | 2 (InfraError) | `API URL not configured. Set API_URL or add to config` |
| Auth failure (401/403) | Command | 2 (InfraError) | `Authentication failed. Check API key.` |
| Server error (5xx) | Command | 2 (InfraError) | `Server error (500). Try again later.` |
| Connection refused | Command | 2 (InfraError) | `Cannot connect to API at https://...` |
| Unexpected exception | Global handler | 1 (UserError) | `Unexpected error: [message]` |

**The global handler is a safety net, not the primary error path.** Commands should catch expected errors and provide specific, actionable messages.
