# CLI Production Readiness Checklist

Use this checklist when reviewing a CLI tool for production readiness or when hardening an existing tool.

## Core Unix Conventions (12 items)

- [ ] **stdout/stderr split** — Data to stdout, diagnostics to stderr
- [ ] **Piping works** — `cmd | jq .` produces valid output (no status messages in stdout)
- [ ] **stdin via `-`** — Commands accepting files also accept `-` for stdin
- [ ] **Filter pattern** — Validation/transform commands echo valid input to stdout
- [ ] **Exit code 0** — Success returns 0
- [ ] **Exit code 1** — User/input errors return 1
- [ ] **Exit code 2** — Infrastructure/config errors return 2
- [ ] **Exit code 130** — Ctrl+C returns 130 (128 + SIGINT)
- [ ] **Named exit codes** — Constants defined, no magic numbers in code
- [ ] **`--` terminator** — Arguments after `--` treated as positional
- [ ] **UTF-8 output** — Encoding set explicitly (important on Windows)
- [ ] **No stdout buffering issues** — Piped output flows immediately

## Output Modes (10 items)

- [ ] **`--verbose` / `-v`** — Enables diagnostic output (debug-level logging)
- [ ] **`--quiet` / `-q`** — Suppresses success/info messages; errors still show
- [ ] **`--json`** — Machine-readable structured output to stdout
- [ ] **`--verbose` + `--quiet` rejected** — Mutually exclusive, validated at parse time
- [ ] **`--no-color`** — Explicit flag to disable ANSI color
- [ ] **`NO_COLOR` env var** — Respected per https://no-color.org/
- [ ] **`TERM=dumb`** — Detected and treated as no-color
- [ ] **TTY auto-detection** — Color disabled when stderr redirected
- [ ] **Color only on stderr** — stdout data never has ANSI codes
- [ ] **Unicode symbols safe** — Fallback when stderr redirected to file (optional)

## Error Handling (11 items)

- [ ] **Global try-catch** — Entry point wraps execution; no raw stack traces
- [ ] **OperationCancelled caught** — Ctrl+C produces clean message + exit 130
- [ ] **App exceptions caught** — Custom exception types get formatted messages
- [ ] **Generic catch** — Safety net for unexpected errors; clean message
- [ ] **Stack traces in verbose only** — Normal mode shows message only
- [ ] **Actionable error messages** — Tell user what to do, not just what failed
- [ ] **Contextual errors** — Include the value that caused the failure
- [ ] **Custom exception hierarchy** — Base exception with ExitCode + Suggestion, subclasses for input/infra
- [ ] **Per-command error handling** — Commands catch expected errors locally
- [ ] **No swallowed exceptions** — Every catch either logs or re-throws
- [ ] **Logger flushed on exit** — `finally` block flushes/closes logger

## Logging (8 items)

- [ ] **Logger output to stderr** — Never pollutes stdout data stream
- [ ] **Default level: Warning** — Normal mode is quiet from logger
- [ ] **Verbose level: Debug** — `--verbose` enables debug diagnostics
- [ ] **No timestamps in console** — CLIs are ephemeral; timestamps are noise
- [ ] **Structured properties** — `Log("GET {Url}", url)` not `Log($"GET {url}")`
- [ ] **No secrets logged** — API keys, tokens, passwords never in log output
- [ ] **No request/response bodies** — May contain secrets or large payloads
- [ ] **Config resolution logged** — Shows which source provided each value

## DX Conventions (12 items)

- [ ] **`--help` works** — Auto-generated from command definitions
- [ ] **`--version` works** — Reads from build metadata
- [ ] **Version is meaningful** — Not default `1.0.0`; semver with optional git hash
- [ ] **Subcommand structure** — Logical grouping for 3+ commands
- [ ] **Required args validated** — Missing required args produce clear error
- [ ] **Config priority chain** — Flags > env vars > config file > defaults
- [ ] **Config file path documented** — Error messages tell user where config goes
- [ ] **Idempotent commands marked** — Non-idempotent operations documented
- [ ] **Timeout for HTTP** — `--timeout` with reasonable default (30s)
- [ ] **Completion sources** — Constrained arguments have completion values (optional)
- [ ] **DX script** — `dx.sh` or equivalent with setup/build/test/run/doctor subcommands
- [ ] **Info command** — `info` subcommand shows resolved config with value sources

## Composability (6 items)

- [ ] **2-stage pipe works** — `cmd1 | cmd2 -` composes correctly
- [ ] **3-stage pipe works** — `cmd1 | cmd2 - | cmd3 -` composes correctly
- [ ] **Quiet piping** — `cmd1 | cmd2 - -q` suppresses intermediate stderr
- [ ] **JSON piping** — `cmd1 --json | jq .field` works
- [ ] **Exit code propagation** — `set -o pipefail && cmd1 | cmd2 -` fails correctly
- [ ] **No interactive prompts when piped** — Detect redirected stdin, don't prompt

## Testing (6 items)

- [ ] **Exit codes tested** — Verify 0/1/2/130 for each scenario
- [ ] **stdout vs stderr tested** — Verify data goes to correct stream
- [ ] **stdin piping tested** — Verify `-` argument reads from stdin
- [ ] **--json output tested** — Verify valid JSON structure
- [ ] **--quiet behavior tested** — Verify suppression of success/info messages
- [ ] **Error formatting tested** — Verify clean messages, no stack traces

---

## Scoring

| Category | Items | Weight |
|----------|-------|--------|
| Core Unix | 12 | Critical — must pass 100% |
| Output Modes | 10 | High — must pass 80%+ |
| Error Handling | 11 | High — must pass 90%+ |
| Logging | 8 | Medium — must pass 75%+ |
| DX | 12 | Medium — must pass 70%+ |
| Composability | 6 | High — must pass 80%+ |
| Testing | 6 | High — must pass 80%+ |

**Production ready:** Core 100%, all others at threshold or above.
