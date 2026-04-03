# Output Modes: --verbose, --quiet, --json, Color, TTY

## The Four Output Modes

| Mode | Flag | Data (stdout) | Success/Info (stderr) | Errors (stderr) | Debug (stderr) |
|------|------|---------------|----------------------|-----------------|----------------|
| **Normal** | (default) | Yes | Yes (with color) | Yes (with color) | No |
| **Quiet** | `--quiet` / `-q` | Yes | **Suppressed** | Yes | No |
| **JSON** | `--json` | Structured JSON | Suppressed | Yes | No |
| **Verbose** | `--verbose` / `-v` | Yes | Yes (with color) | Yes (with color) | **Yes** |

### Mutual Exclusion

`--quiet` and `--verbose` are mutually exclusive. Validate at parse time — return a parse error before the command runs.

`--json` can combine with `--verbose` (JSON data to stdout, debug to stderr — they don't interfere since they use different streams).

## Color Handling

### Detection Priority (first match wins)

1. `--no-color` flag → disable
2. `NO_COLOR` env var (any non-empty value) → disable (https://no-color.org/)
3. `TERM=dumb` env var → disable
4. stderr redirected (not a TTY) → disable
5. Default → enable

### Implementation Pattern

```
Resolve color once at startup, not per-write:

color_enabled = NOT (
    --no-color flag present
    OR NO_COLOR env var non-empty
    OR TERM == "dumb"
    OR stderr is redirected/not a TTY
)
```

### Color Codes (ANSI)

| Output Type | Symbol | ANSI Code | Reset |
|-------------|--------|-----------|-------|
| Success | `✓` | `\x1b[32m` (green) | `\x1b[0m` |
| Error | `✗` | `\x1b[31m` (red) | `\x1b[0m` |
| Info | `ℹ` | `\x1b[36m` (cyan) | `\x1b[0m` |
| Warning | `⚠` | `\x1b[33m` (yellow) | `\x1b[0m` |

### Where Color Applies

- **stderr only** — success messages, errors, info, warnings
- **Never on stdout** — data output is never colored (breaks piping, breaks JSON parsing)
- **Suppress symbols when redirected** — when stderr is piped to a log file, consider replacing Unicode symbols with ASCII: `ERROR:` instead of `✗`, `OK:` instead of `✓`

## --verbose Mode

**Purpose:** Enable diagnostic output for debugging configuration, HTTP calls, file operations.

**Implementation:** Use a log-level mechanism, not boolean flags:
- Default level: Warning (only warnings and errors from diagnostic logger)
- `--verbose` sets level to Debug — enables `debug()` calls throughout code
- All diagnostic output goes to stderr

**What to log in verbose mode:**

| Category | Example | Never Log |
|----------|---------|-----------|
| Config resolution | `Config: apiUrl from env var` | API keys, tokens, secrets |
| HTTP requests | `GET /api/review/abc123` | Request/response bodies |
| HTTP responses | `GET /api/review responded 200` | Response bodies |
| File operations | `Reading file: ./resource.json (1.2KB)` | File contents |
| Timing | `Submit completed in 342ms` | N/A |
| Decisions | `Using config from ~/.app/config.json` | Secret values from config |

## --quiet Mode

**Purpose:** Suppress all non-essential stderr output for clean scripting.

**What --quiet suppresses:**
- Success messages (`✓ Template written`)
- Info messages (`ℹ Using config from...`)
- Warnings (non-critical)
- Verbose/debug output (if somehow both active — but they should be mutually exclusive)

**What --quiet does NOT suppress:**
- Errors (`✗ File not found`) — always show
- Data output to stdout — always flows

**Use case:**
```bash
# Script checks exit code, doesn't want stderr noise
cmd validate resource.json -q && echo "Valid" || echo "Invalid"

# Pipe chain — only errors show on terminal
cmd template worksheet | cmd validate - -q | cmd submit - --notes "auto" -q
```

## --json Mode

**Purpose:** Machine-parseable output for agents and scripts.

**Rules:**
1. All command data output becomes structured JSON on stdout
2. Success/info messages to stderr are suppressed (same as quiet)
3. Errors still go to stderr as text (for human visibility)
4. Exit code remains the primary success/failure signal
5. Diagnostic logger should be suppressed (or fatal-only) unless `--verbose` also active

**JSON output patterns:**

```json
// Success: structured result to stdout
{"reviewId": "abc123", "status": "pending", "action": "create"}

// Validation result (success)
{"valid": true, "errors": [], "warnings": []}

// Validation result (failure) — stdout has structured data, exit code is 1
{"valid": false, "errors": [{"field": "name", "message": "required"}], "warnings": []}
```

**Design principle:** An agent parsing `--json` output should be able to:
1. Check exit code (0 = success, non-zero = failure)
2. Parse stdout as JSON for structured result
3. Optionally capture stderr for error context

## Global Options Architecture

These flags should be **global options** (available on all subcommands), not per-command options:

| Option | Short | Description | Scope |
|--------|-------|-------------|-------|
| `--verbose` | `-v` | Enable diagnostic output | Global, recursive |
| `--quiet` | `-q` | Suppress non-essential output | Global, recursive |
| `--json` | | Machine-readable output | Per-command (some commands may not support it) |
| `--no-color` | | Disable colored output | Global, recursive |

**Threading pattern:** Define global options in a shared location. Each command's action handler reads them and passes to the output formatter / logger.
