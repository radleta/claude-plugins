# Developer Experience Conventions

Modern CLI conventions that make tools pleasant to use, discoverable, and composable. Sourced from [clig.dev](https://clig.dev/), [no-color.org](https://no-color.org/), and established Unix patterns.

## Help Text

**Automatic from command definitions.** Most modern argument parsers (System.CommandLine, cobra, click, commander) generate `--help` from your command/argument/option definitions. Don't write help text manually — define it in the command structure.

**Good help text includes:**
- One-line description of the command
- Usage syntax with argument placeholders
- All options with descriptions and defaults
- Examples (if parser supports it)

**Example:**
```
Description:
  akn-editor — AI agent content editor for AKN

Usage:
  akn-editor [command] [options]

Commands:
  template <type>    Generate a resource template
  validate <file>    Validate a resource JSON file
  submit <file>      Submit a resource proposal for review
  status <reviewId>  Check the status of a submitted review

Options:
  --verbose, -v   Enable diagnostic output
  --quiet, -q     Suppress non-essential output
  --no-color      Disable colored output
  --version       Show version information
  --help, -h      Show help and usage information
```

## Version Information

**`--version` should be free.** Set the version in your build metadata (package.json version, csproj Version, go ldflags). The argument parser reads it automatically.

**What to include:**
- Semantic version (`0.1.0`)
- Optional: git hash for traceability (`0.1.0+abc1234`)
- Optional: build date for debugging stale installs

**What NOT to include:**
- Runtime version (`.NET 9.0.1`) — that's for `--verbose` diagnostics
- OS information — irrelevant for version check

## Command Structure

**Subcommand pattern** (recommended for 3+ operations):
```
cmd <command> [arguments] [options]

cmd template worksheet --output file.json
cmd validate resource.json --strict
cmd submit resource.json --notes "Initial draft"
cmd status abc123 --json
```

**Single-command pattern** (for focused tools):
```
cmd [arguments] [options]

minify input.css --output output.css
```

**Naming conventions:**
- Command names: lowercase, single word preferred (`validate` not `validate-resource`)
- Argument names: descriptive, angle brackets in help (`<file>`, `<type>`, `<reviewId>`)
- Option names: `--long-name` with optional `-x` short alias

## Argument Parsing Best Practices

| Pattern | Example | When |
|---------|---------|------|
| Required positional | `cmd validate <file>` | Core input |
| Optional positional | `cmd template [type]` | Has sensible default |
| Required option | `cmd submit --notes <text>` | Named required input |
| Boolean flag | `cmd validate --strict` | Toggle behavior |
| Value option | `cmd template --output <path>` | Named optional input |
| Repeated | `cmd lint file1 file2 file3` | Multiple inputs |

**The `--` terminator:** Everything after `--` is treated as positional. Handles filenames starting with `-`. Most parsers support this natively.

## Idempotency

| Command Type | Idempotent? | Notes |
|-------------|-------------|-------|
| `template` | Yes | Always generates same output for same type |
| `validate` | Yes | Same file always produces same result |
| `status` | Yes | Read-only query |
| `submit` | **No** | Creates new review each time |

Document non-idempotent commands clearly. Agents and scripts may retry on failure — if `submit` creates a duplicate, that's a problem.

## Configuration Priority Chain

Standard priority order (highest to lowest):

1. **CLI flags** (`--api-url https://...`) — explicit, session-scoped
2. **Environment variables** (`API_URL=https://...`) — environment-scoped
3. **Config file** (`~/.app/config.json`) — user-scoped
4. **Defaults** — hardcoded in the tool

**Verbose mode should show resolution:**
```
[DBG] Config: apiUrl from --api-url flag
[DBG] Config: apiKey from AKN_API_KEY env var
```

## Error Messages

**Good error messages are:**
1. **Specific** — what exactly went wrong
2. **Actionable** — what the user should do to fix it
3. **Contextual** — include the value that caused the error

```
# BAD
Error: Invalid input

# GOOD
Error: File not found: ./resource.json

# BAD
Error: Configuration error

# GOOD
Error: API URL not configured. Set AKN_API_URL env var or add apiUrl to ~/.akn/config.json

# BAD
Error: Validation failed

# GOOD
Validation failed with 2 error(s):
  - name: name is required for new resources
  - url: url must start with '/'
```

## DX Script Pattern (dx.sh)

For project lifecycle, use a single shell script with subcommands instead of multiple scripts or a Makefile:

```bash
#!/usr/bin/env bash
set -euo pipefail

case "${1:-help}" in
  help)     echo "Commands: setup build test watch run info doctor clean" ;;
  setup)    dotnet restore && cp -n .env.example .env 2>/dev/null; mkdir -p data/inputs data/outputs ;;
  build)    dotnet build ;;
  test)     dotnet test ;;
  watch)    dotnet watch test --project tests/App.Tests ;;
  run)      shift; dotnet run --project src/App.Cli -- generate "$@" ;;
  info)     dotnet run --project src/App.Cli -- info ;;
  doctor)   # Validate dev environment
            echo "Checking SDK..."; dotnet --version
            echo "Checking .env..."; test -f .env && echo "OK" || echo "MISSING"
            echo "Checking data dirs..."; test -d data/inputs && echo "OK" || echo "MISSING" ;;
  clean)    dotnet clean; rm -rf data/outputs/*/  ;;
  *)        echo "Unknown command: $1"; exit 1 ;;
esac
```

**Why dx.sh over Makefile:**
- No Make dependency (Windows-friendly via Git Bash)
- Readable by anyone, no Make syntax knowledge required
- Easy to extend with `pull`, `publish`, `clean --older N` subcommands

**Publish safety pattern** — always backup before overwriting shared files:
```bash
publish)
  BACKUP_DIR="$PUBLISH_DIR/.backups/$(date +%Y%m%dT%H%M%S)"
  mkdir -p "$BACKUP_DIR"
  cp -r "$PUBLISH_DIR"/*.xlsx "$BACKUP_DIR/" 2>/dev/null || true
  cp data/outputs/latest/* "$PUBLISH_DIR/"
  echo "Published. Backup at $BACKUP_DIR"
  ;;
```

## Shell Completion

Most modern argument parsers support tab completion. The value varies by audience:

| Audience | Value |
|----------|-------|
| Developers using CLI interactively | High — discoverability |
| Agents calling CLI programmatically | Low — agents don't tab-complete |
| CI/CD scripts | Low — commands are hardcoded |

**When to add:** If your tool has many subcommands or arguments with known valid values. For argument parsers that support it, register completions for constrained arguments:

```
# Register valid values for the 'type' argument
type_arg.completions = ["worksheet", "coloring-page", "flashcard"]
```

## Timeouts for Network Operations

Commands that make HTTP calls should support `--timeout <seconds>`:

- Default: 30 seconds (reasonable for most operations)
- CI/agents: may want shorter (10s) to fail fast
- Large uploads: may need longer (120s)

Always pass CancellationToken / context with deadline to HTTP calls.

## Progressive Output for Long Operations

For operations that take more than a few seconds:

| Approach | When | How |
|----------|------|-----|
| Spinner/progress | Interactive terminal (TTY) | Show progress indicator on stderr |
| Silent | Piped / `--quiet` | No progress output |
| Status line | Long batch operations | Periodic status to stderr |

**Never show progress on stdout** — it breaks piping.

**Detect TTY before showing progress:**
- TTY + not quiet → show progress on stderr
- Not TTY (piped) → suppress progress
- `--json` mode → suppress progress
