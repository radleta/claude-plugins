# Unix CLI Conventions

Core conventions from the Unix philosophy that make CLI tools composable, scriptable, and predictable.

## stdout vs stderr: The Fundamental Split

| Stream | Purpose | When to Use | Piping Behavior |
|--------|---------|-------------|-----------------|
| **stdout** | Data output | Template JSON, validated content, query results | Piped to next command |
| **stderr** | Diagnostics | Success messages, progress, errors, debug info | Not piped (stays on terminal) |

**The Rule:** If a user pipes your command to `jq`, `grep`, or another tool, only the _data_ should flow through. Everything else goes to stderr.

```bash
# stdout has JSON data, stderr has the success message
cmd template worksheet > file.json    # file gets JSON, terminal shows "Template written"
cmd template worksheet | jq .typeId   # jq gets JSON, terminal shows nothing extra
```

**Common Violation:** Mixing status messages into stdout.
```
# BAD: "Processing..." goes to stdout, breaks jq
cmd process file.json | jq .result
# Error: "Processing..." is not valid JSON

# GOOD: Status to stderr, data to stdout
cmd process file.json 2>/dev/null | jq .result
# Works, but user shouldn't need 2>/dev/null
```

## stdin via `-` Convention

When a command accepts a file argument, the value `-` means "read from stdin." This is POSIX standard, used by `tar`, `curl`, `jq`, `cat`.

**Implementation pattern:**
1. Change file arguments from strict file types to string types
2. When value is `-`, read `stdin` to completion
3. When stdin is a TTY (not redirected) and `-` was passed, show helpful error
4. Add custom validation: if not `-`, check file exists

```
# File argument
cmd validate resource.json         # reads file
cmd validate -                     # reads stdin

# Piping chain
cmd template worksheet | cmd validate -

# Stdin from heredoc
echo '{"name":"test"}' | cmd validate -
```

**Error when stdin is TTY:**
```
Error: No input on stdin. Pipe data or pass a filename instead of '-'.
```

**Argument description should document it:**
```
file    JSON file to validate, or '-' for stdin
```

## The Filter Pattern

A "filter" command reads input, processes it, and outputs the result to stdout. If processing fails, it exits non-zero and the pipe stops.

**Validate-as-filter example:**
```bash
# Valid input passes through
cmd template worksheet | cmd validate -    # valid JSON echoed to stdout

# Invalid input stops the pipe
cmd template worksheet | cmd validate - | cmd submit - --notes "auto"
# If validate fails (exit 1), submit never runs (with set -o pipefail)
```

**Behavior matrix for filter commands:**

| Scenario | stdout | stderr | exit |
|----------|--------|--------|------|
| Valid input | Echoed data | `Success message` | 0 |
| Valid input + `--quiet` | Echoed data | (nothing) | 0 |
| Valid input + `--json` | Structured result | (nothing) | 0 |
| Invalid input | (nothing) | Error details | 1 |

## Exit Codes

| Code | Meaning | Unix Convention |
|------|---------|-----------------|
| 0 | Success | Universal |
| 1 | General user/input error | Common convention |
| 2 | Misuse of command / infrastructure error | Bash convention for builtin misuse; we use for infra errors |
| 126 | Command invoked cannot execute | Permission denied |
| 127 | Command not found | Shell convention |
| 128+N | Fatal signal N | E.g., 130 = 128 + SIGINT(2) |

**Define as named constants:**
```
SUCCESS    = 0
USER_ERROR = 1    # Bad input, validation failure, not found
INFRA_ERROR = 2   # Config missing, auth failed, server error
CANCELLED  = 130  # SIGINT (128 + 2)
```

Never use magic numbers in command code. Always reference the named constant.

## Signal Handling (Ctrl+C / SIGINT)

**What must happen on Ctrl+C:**
1. Cancel in-flight operations (HTTP requests, file I/O)
2. Write brief cancellation message to stderr
3. Exit with code 130 (128 + SIGINT signal number 2)
4. Never show a stack trace

**Implementation approach varies by platform:**
- Some frameworks (e.g., System.CommandLine) provide CancellationToken automatically
- Others require explicit `SIGINT` handler registration
- The entry point should catch `OperationCanceledException` (or equivalent) and exit 130

**What NOT to do:**
- Don't ignore SIGINT (process hangs)
- Don't show exception stack trace
- Don't exit with code 1 (that's for user errors, not cancellation)

## Argument Conventions

| Convention | Pattern | Handled By |
|------------|---------|------------|
| `--` terminator | Everything after `--` is positional | Most arg parsers natively |
| Short flags | `-v`, `-q`, `-o file` | Arg parser |
| Long flags | `--verbose`, `--quiet`, `--output file` | Arg parser |
| Combined short flags | `-vq` = `-v -q` | Some arg parsers |
| `=` syntax | `--output=file` | Most arg parsers |
| `-` for stdin | See stdin section above | Manual implementation |

## Line Buffering

Most modern runtimes (Node.js, .NET, Go) flush stdout after each write when connected to a pipe. If your platform does not:

- **C programs**: Use `setvbuf(stdout, NULL, _IOLBF, 0)` or `stdbuf -oL cmd`
- **Python**: Use `-u` flag or `PYTHONUNBUFFERED=1`
- **.NET**: `Console.Out` auto-flushes by default — no action needed
- **Go**: `os.Stdout` is unbuffered — no action needed

Test by piping to `head -1` — if the command hangs, it's block-buffering.
