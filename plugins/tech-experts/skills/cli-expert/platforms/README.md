# Platform-Specific Implementation Guides

The core CLI principles are language-agnostic. This folder contains platform-specific implementation details for each language/framework.

## Available Platforms

| Platform | File | Covers |
|----------|------|--------|
| **.NET / C#** | `dotnet.md` | Spectre.Console.Cli (recommended), System.CommandLine 2.0.3, DI patterns, Serilog+DI, hybrid config, custom exceptions, rich TUI |

## Adding a New Platform

When building a CLI in a new language/framework, create a platform file following this template:

```markdown
# [Platform] CLI Patterns

## Argument Parsing
[Framework-specific arg parsing library and API patterns]

## Entry Point Pattern
[How to structure Main/main with global exception handling]

## Signal Handling
[How Ctrl+C/SIGINT works in this runtime]

## stdin/stdout/stderr
[Platform-specific I/O patterns, encoding, buffering]

## TTY Detection
[How to detect if output is a terminal]

## Logging Framework
[Recommended logger for CLI use in this ecosystem]

## Testing Patterns
[How to test CLI commands, mock stdin, capture stdout/stderr]

## Platform Gotchas
[Platform-specific pitfalls and workarounds]
```

## Platform Coverage Roadmap

Potential future platforms (add when a CLI is built in that language):

| Platform | Arg Parser | Logger | Notes |
|----------|-----------|--------|-------|
| **Node.js / TypeScript** | commander, yargs, oclif | pino, winston | `process.stdout.isTTY` for TTY detection |
| **Go** | cobra, urfave/cli | zerolog, zap | `os.Stdin` stat for pipe detection |
| **Python** | click, typer, argparse | structlog, loguru | `sys.stdin.isatty()` for TTY |
| **Rust** | clap | tracing, env_logger | `atty` crate for TTY detection |
