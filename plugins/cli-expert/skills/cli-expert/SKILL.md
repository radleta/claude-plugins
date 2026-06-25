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

## Pages

- [The 10 CLI Commandments](ten-commandments.md) — Universal 10-rule summary table defining a well-behaved, composable Unix CLI tool
- [Unix Conventions](principles/unix-conventions.md) — Core Unix CLI conventions: stdout/stderr split, stdin via dash, filter pattern, exit codes, signal handling, argument conventions, and line buffering
- [Output Modes](principles/output-modes.md) — Output mode design matrix (normal/quiet/json/verbose), color handling priority chain, TTY detection, and global options architecture for CLI tools
- [Error Handling](principles/error-handling.md) — Global exception safety net, SIGINT cancellation handling, structured logging patterns, custom exception hierarchy, and per-command error handling for CLI tools
- [DX Conventions](principles/dx-conventions.md) — CLI developer experience conventions: help text, version info, command structure, argument parsing, idempotency, configuration priority chain, error messages, dx.sh pattern, and progressive output
- [Production Readiness Checklist](checklists/production-readiness.md) — 50+ item production readiness checklist covering all CLI quality dimensions: Unix conventions, output modes, error handling, logging, DX, composability, and testing
- [Platform Guides Index](platforms/README.md) — Index of platform-specific CLI implementation guides and template for adding new platforms
- [.NET CLI Patterns](platforms/dotnet.md) — .NET 9+ CLI patterns: Spectre.Console.Cli (recommended), System.CommandLine 2.0.3, DI/TypeRegistrar, Serilog, custom exception hierarchy, entry point templates, and testing patterns

## Meta

- [Operations Log](log.md) — Timestamped wiki operations log (ingest, lint, query filings)
- [Schema](schema.md) — Wiki conventions and page-type definitions
