---
name: cli-expert
description: "Validated patterns for building production-grade, Unix-style CLI tools with composable piping, structured output, signal handling, and modern DX conventions. Use when creating CLI applications, adding commands, implementing piping support, handling exit codes, adding color/TTY detection, or designing agent-facing CLI tools — even for simple single-command CLIs."
---

<role>
  <identity>Expert in production-grade CLI tool design</identity>
  <purpose>Guide creation of world-class, Unix-style command-line tools with composable piping, structured output, proper error handling, and excellent developer experience across any language/platform</purpose>
  <expertise>
    <area>Unix CLI conventions (stdin/stdout/stderr, exit codes, piping, signals)</area>
    <area>Output modes (--verbose, --quiet, --json, color, TTY detection)</area>
    <area>Global error handling, cancellation, and structured logging</area>
    <area>CLI composability and developer experience</area>
  </expertise>
  <scope>
    <in-scope>
      <item>CLI tool architecture and conventions</item>
      <item>Unix piping and composability patterns</item>
      <item>Output formatting, color, and TTY handling</item>
      <item>Error handling, exit codes, and signal handling</item>
      <item>Structured logging in CLI context</item>
      <item>Platform-specific implementation guidance</item>
    </in-scope>
    <out-of-scope>
      <item>GUI application design</item>
      <item>Web server/API design (use api-docs skill)</item>
      <item>Package distribution and installation (separate concern)</item>
    </out-of-scope>
  </scope>
</role>

## The 10 CLI Commandments

These principles define a well-behaved, composable Unix CLI tool:

| # | Principle | Rule |
|---|-----------|------|
| 1 | **Data to stdout, diagnostics to stderr** | Never mix data output with status messages |
| 2 | **Exit codes are your API** | 0=success, 1=user error, 2=infra error, 130=cancelled |
| 3 | **Accept stdin via `-`** | `cmd validate -` reads from pipe; `cmd template \| cmd validate -` composes |
| 4 | **Respect `NO_COLOR`** | Check env var + `--no-color` flag + TTY auto-detect |
| 5 | **Support `--quiet` and `--verbose`** | `--quiet` suppresses non-essential stderr; `--verbose` enables diagnostics |
| 6 | **Handle Ctrl+C gracefully** | Catch SIGINT, clean up, exit 130 — never show stack trace |
| 7 | **UTF-8 everywhere** | Set output encoding explicitly on platforms that default to legacy codepage |
| 8 | **Global exception safety net** | Wrap entry point in try-catch; clean message + exit code, never raw stack trace |
| 9 | **`--json` for machine consumption** | Structured output to stdout when `--json` active; suppress human formatting |
| 10 | **Version and help for free** | `--version` from build metadata; `--help` auto-generated from command definitions |

## Output Mode Matrix

| Output type | Normal | `--quiet` | `--json` | `--verbose` |
|-------------|--------|-----------|----------|-------------|
| Data (stdout) | Yes | Yes | JSON result | Yes |
| Success messages (stderr) | Yes | **No** | No | Yes |
| Info/warnings (stderr) | Yes | **No** | No | Yes |
| Errors (stderr) | Yes | Yes | Yes | Yes |
| Debug diagnostics (stderr) | No | No | No | **Yes** |

`--quiet` and `--verbose` are mutually exclusive — validate at parse time.

## Composable Piping Pattern

A well-designed CLI enables multi-stage pipes:

```bash
# Generate → validate → submit (3-stage pipe)
cmd template worksheet | cmd validate - | cmd submit - --notes "auto"

# Filter pattern: validate echoes valid input to stdout
cmd validate resource.json | jq .typeId

# Quiet mode for scripting
cmd validate resource.json -q && echo "Valid" || echo "Invalid"
```

For this to work:
1. `validate -` reads stdin, echoes valid input to stdout (filter pattern)
2. `submit -` reads stdin
3. Success/info messages go to stderr only — never pollute stdout data
4. `--quiet` suppresses even stderr diagnostics for clean pipe chains

## Exit Code Convention

| Code | Meaning | When | Example |
|------|---------|------|---------|
| 0 | Success | Command completed normally | Validation passed, submission accepted |
| 1 | User/input error | Bad args, validation failure, not found (4xx) | Missing required field, file not found |
| 2 | Infrastructure error | Config missing, auth failed, server error (5xx) | No API key, connection refused, 500 |
| 130 | Cancelled | SIGINT / Ctrl+C (128 + signal 2) | User pressed Ctrl+C during operation |

Define as named constants, not magic numbers. Share across CLI projects.

## Color Handling Priority

Resolve color support in this order (first match wins):

1. `--no-color` flag (explicit disable, highest priority)
2. `NO_COLOR` env var (any non-empty value disables — https://no-color.org/)
3. `TERM=dumb` env var (no terminal capabilities)
4. TTY auto-detection (if stderr redirected → no color)
5. Default: color enabled

Apply color only to stderr output (success=green, error=red, info=cyan). Never color stdout data.

## File Loading Protocol

<loading-decision>
  <file path="principles/unix-conventions.md">
    <load-when>Implementing stdin piping, stdout/stderr split, exit codes, or signal handling</load-when>
    <provides>Detailed Unix CLI conventions with implementation patterns and examples</provides>
  </file>

  <file path="principles/output-modes.md">
    <load-when>Adding --verbose, --quiet, --json flags, color support, or TTY detection</load-when>
    <provides>Output mode design with interaction matrix and implementation patterns</provides>
  </file>

  <file path="principles/error-handling.md">
    <load-when>Implementing global exception handling, cancellation, or structured logging in CLI</load-when>
    <provides>Entry point patterns, logging framework selection, and error formatting</provides>
  </file>

  <file path="principles/dx-conventions.md">
    <load-when>Designing command structure, help text, version info, or argument parsing</load-when>
    <provides>DX conventions from clig.dev and modern CLI guidelines</provides>
  </file>

  <file path="checklists/production-readiness.md">
    <load-when>Reviewing a CLI for production readiness or auditing an existing CLI tool</load-when>
    <provides>50+ item checklist covering all CLI quality dimensions</provides>
  </file>

  <file path="platforms/README.md">
    <load-when>Need platform-specific implementation guidance or adding a new platform</load-when>
    <provides>Platform file index and template for adding new platforms</provides>
  </file>

  <file path="platforms/dotnet.md">
    <load-when>Building CLI with .NET / C# / Spectre.Console / System.CommandLine / Serilog</load-when>
    <provides>.NET 9 patterns: Spectre.Console.Cli (recommended) with DI/TypeRegistrar, System.CommandLine 2.0.3, Serilog+DI, hybrid config, custom exceptions, rich TUI, project structure</provides>
  </file>
</loading-decision>

## Investigation Protocol

When starting a new CLI project or hardening an existing one:

1. **Identify consumers** — Agents (structured output critical), developers (DX matters), scripts (exit codes, piping), or all three?
2. **Map commands** — What commands exist? Which accept file input (candidates for stdin `-` support)?
3. **Audit output** — Does data go to stdout and diagnostics to stderr? Any mixing?
4. **Check exit codes** — Are they consistent? Named constants or magic numbers?
5. **Test piping** — Can commands compose? `cmd1 | cmd2 -` works?
6. **Verify signals** — Does Ctrl+C produce clean output or stack trace?
7. **Check color** — Does `NO_COLOR=1 cmd ...` suppress ANSI codes?
8. **Platform check** — Load the relevant `platforms/*.md` file for language-specific patterns
