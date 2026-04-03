# CLI App Planning Protocol

When a plan involves a CLI tool (command-line application, terminal utility, or script), apply these additional requirements on top of the standard planning workflow.

## Relationship to cli-expert Skill

This protocol shapes the **plan** — what steps to include, what to investigate, and what the plan's checklist must cover. The **cli-expert skill** shapes the **implementation** — how to actually build each step with production-grade Unix conventions, error handling patterns, and output modes.

**During planning:** Use this protocol's checklist (8 items) to ensure the plan addresses CLI concerns.
**During execution:** Each implementation step should load the cli-expert skill for its 65-item production readiness checklist (`checklists/production-readiness.md`), Unix conventions, and platform-specific guidance.

Recommend in the plan: "Load cli-expert skill during implementation for Unix conventions and production readiness patterns."

## Testing Strategy

CLI tools have unique testing needs: they interact with stdin/stdout/stderr, process arguments, handle signals, and produce exit codes. Every CLI plan must cover these testing tiers.

### Tier 1: Unit Tests (Every Implementation Step)

Each step that creates or modifies commands, parsers, formatters, or core logic must include unit tests.

**Argument parsing tests:**
- Valid argument combinations produce correct config
- Invalid arguments produce helpful error messages on stderr
- Missing required arguments fail with clear guidance
- Default values applied correctly
- Flag aliases work (e.g., -v and --verbose)

**Core logic tests:**
- Input processing with various data shapes
- Edge cases (empty input, very large input, malformed input)
- Error conditions produce appropriate exit codes

**Output format tests:**
- Human-readable output is correct and well-formatted
- Machine-readable output (JSON, CSV, TSV) is valid and parseable
- Color/formatting disabled when stdout is not a TTY
- Quiet/verbose modes produce expected output levels

**Plan step template addition:**
```markdown
### Step N: [Command Name]
...existing actions...

**Unit Tests (required):**
- [ ] Argument parsing: valid args, invalid args, defaults, aliases
- [ ] Core logic: happy path, edge cases, error conditions
- [ ] Output: human format, machine format (if applicable), TTY detection
Verify: `npm test -- [test-file]` — all pass
```

### Tier 2: Integration Tests (Command-Complete Steps)

After a command is fully implemented, add integration tests that execute the actual CLI binary.

**What to test:**
- Full command execution with real arguments
- Piping: stdin input, stdout output piped to other commands
- Exit codes: 0 for success, non-zero for specific error categories
- Signal handling: SIGINT (Ctrl+C) graceful shutdown
- File I/O: reading input files, writing output files
- Environment variables: correct behavior with/without env vars

**Plan step template addition:**
```markdown
### Step N: [Command] Integration Tests
...existing actions...

**Integration Tests (required):**
- [ ] Command executes successfully with valid input
- [ ] Exit code 0 on success, 1 on user error, 2 on system error
- [ ] Piping works: `echo "input" | cli-tool command`
- [ ] Output is valid when redirected: `cli-tool command > output.json && cat output.json | jq .`
- [ ] Ctrl+C produces graceful shutdown (cleanup, partial output)
Verify: test script runs all integration scenarios
```

### Tier 3: E2E Tests (Full Workflow Steps)

For CLI tools with multi-step workflows, add e2e tests that simulate real user sessions.

**When to include e2e tests:**
- Multi-command workflows (init → configure → run → report)
- File system operations (create project, generate files)
- Network operations (API calls, downloads, uploads)
- Interactive prompts (if applicable)

**Plan step template addition:**
```markdown
### Step N: E2E Workflow Tests

**Test Scenarios:**
- [ ] Complete workflow: [step 1] → [step 2] → [step 3] → verify final state
- [ ] Error recovery: [failure point] → [expected behavior] → [retry succeeds]
- [ ] Idempotency: running same command twice produces consistent results
Verify: e2e test script passes
```

## CLI Checklist (Adds to PLAN-QUALITY.md)

These items are **mandatory** when APP_TYPE = cli. A CLI plan scoring < 6/8 on these items is capped at Grade C.

### CLI-Specific Checklist (8 items)

- [ ] Exit codes defined and documented (0 = success, non-zero = specific error categories)
- [ ] Error messages go to stderr, normal output to stdout
- [ ] Help text included for every command and subcommand (--help flag)
- [ ] Machine-readable output format available (JSON/CSV) for scripting
- [ ] TTY detection: colors/formatting disabled when piped
- [ ] Unit tests cover argument parsing, core logic, and output formatting
- [ ] Integration tests verify full command execution with real arguments
- [ ] Piping tested: stdin input and stdout output work with Unix pipes

## Investigation Additions for CLI Apps

During the investigation phase, add these areas when APP_TYPE = cli:

### CLI Framework Discovery

- Argument parser (yargs, commander, clap, cobra, argparse)
- Subcommand patterns (if multi-command tool)
- Configuration file handling (config file location, format, precedence)
- Plugin/extension architecture (if applicable)

### Output Convention Discovery

- Output formats supported (human, JSON, CSV, table)
- Color library (chalk, kleur, ansi_term)
- Progress/spinner library (ora, indicatif)
- Logging framework and verbosity levels

### Testing Infrastructure Discovery

- Test framework and runner
- How existing commands are tested (unit vs integration vs snapshot)
- Test fixture patterns (temp directories, mock servers)
- CI test execution (how tests run in CI, timeout settings)

**Document as:**
```markdown
## CLI Infrastructure
- Framework: commander.js with subcommand pattern
- Config: ~/.toolrc (YAML) with CLI flag overrides
- Output: JSON (--json flag) + human-readable (default)
- Colors: chalk with TTY detection (NO_COLOR env var supported)
- Tests: Vitest for unit, custom test harness for integration
- Test fixtures: tests/fixtures/ with sample input files
- CI: GitHub Actions runs unit + integration tests
```
