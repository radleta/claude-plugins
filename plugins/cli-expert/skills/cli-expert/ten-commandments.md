---
tags: [cli-expert/principles]
summary: "Universal 10-rule summary table defining a well-behaved, composable Unix CLI tool"
---

# The 10 CLI Commandments

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

See [unix-conventions.md](principles/unix-conventions.md) for detailed implementation of commandments 1–3, 6–8.
See [output-modes.md](principles/output-modes.md) for commandments 4, 5, 9.
See [dx-conventions.md](principles/dx-conventions.md) for commandment 10.
