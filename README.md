# radleta — Claude Code Plugin Marketplace

Personal plugin marketplace with 44 plugins for AI-augmented development.

## Setup

```bash
claude plugin marketplace add radleta/claude-plugins
```

## Bundles

Install a bundle to get a curated set of plugins in one command.

| Plugin | Description | Install |
|--------|-------------|---------|
| [**dev-workflow**](./plugins/dev-workflow/) | Complete development pipeline: planning, implementation, verification, and commit workflow | `claude plugin install dev-workflow@radleta` |
| [**tech-experts**](./plugins/tech-experts/) | All technology expert skills in one install | `claude plugin install tech-experts@radleta` |

## Individual Plugins

### Development

| Plugin | Description | Install |
|--------|-------------|---------|
| [chrome-devtools](./plugins/chrome-devtools/) | Browser automation methodology for Chrome DevTools integration | `claude plugin install chrome-devtools@radleta` |
| [claude-code-builders](./plugins/claude-code-builders/) | Claude Code primitive builders: skills, commands, agents, plugins, hooks, and CLAUDE.md | `claude plugin install claude-code-builders@radleta` |
| [cli-expert](./plugins/cli-expert/) | Production-grade Unix-style CLI patterns with composable piping and structured output | `claude plugin install cli-expert@radleta` |
| [code-verification](./plugins/code-verification/) | Unified code quality and requirements verification with detection categories | `claude plugin install code-verification@radleta` |
| [com-interop-expert](./plugins/com-interop-expert/) | COM Interop patterns for C#/.NET including P/Invoke, RCW lifecycle, and STA threading | `claude plugin install com-interop-expert@radleta` |
| [commit-methodology](./plugins/commit-methodology/) | Comprehensive commit creation with adaptive analysis and conventional commit format | `claude plugin install commit-methodology@radleta` |
| [completeness-expert](./plugins/completeness-expert/) | Enforces complete output and verification before declaring tasks done | `claude plugin install completeness-expert@radleta` |
| [completeness-verification](./plugins/completeness-verification/) | Structural completeness methodology with named fingerprint detection | `claude plugin install completeness-verification@radleta` |
| [csharp-expert](./plugins/csharp-expert/) | C# and .NET patterns for async/await, dependency injection, LINQ, and resource management | `claude plugin install csharp-expert@radleta` |
| [dynamodb-expert](./plugins/dynamodb-expert/) | DynamoDB patterns for .NET/C#: single-table design, GSI overloading, and batch operations | `claude plugin install dynamodb-expert@radleta` |
| [estimation-expert](./plugins/estimation-expert/) | Calibrated effort estimation for AI-augmented development workflows | `claude plugin install estimation-expert@radleta` |
| [gcp-expert](./plugins/gcp-expert/) | Google Cloud Platform patterns for .NET/C# authentication, service accounts, and API config | `claude plugin install gcp-expert@radleta` |
| [gemini-tools](./plugins/gemini-tools/) | Gemini CLI integration for text and image generation | `claude plugin install gemini-tools@radleta` |
| [interview-methodology](./plugins/interview-methodology/) | Structured option-batch protocol for eliciting user decisions with recommendations | `claude plugin install interview-methodology@radleta` |
| [mdite-expert](./plugins/mdite-expert/) | mdite markdown documentation graph toolkit expert | `claude plugin install mdite-expert@radleta` |
| [plan-update](./plugins/plan-update/) | Plan progress update methodology for marking completed steps | `claude plugin install plan-update@radleta` |
| [powershell-expert](./plugins/powershell-expert/) | PowerShell patterns for script analysis, .NET interop, and PS1-to-C# porting | `claude plugin install powershell-expert@radleta` |
| [pr-writer](./plugins/pr-writer/) | Framework for creating well-structured pull request descriptions | `claude plugin install pr-writer@radleta` |
| [project-update](./plugins/project-update/) | Business-facing project status updates from git history | `claude plugin install project-update@radleta` |
| [qa-expert](./plugins/qa-expert/) | Comprehensive testing and QA expertise with framework-specific patterns | `claude plugin install qa-expert@radleta` |
| [react-expert](./plugins/react-expert/) | React 18+ component architecture, performance, and testing patterns | `claude plugin install react-expert@radleta` |
| [scripts-expert](./plugins/scripts-expert/) | Portable shell and Node.js script patterns with install.sh and Windows/MSYS compatibility | `claude plugin install scripts-expert@radleta` |
| [svg-toolkit](./plugins/svg-toolkit/) | SVG optimization, raster-to-vector tracing, and animation techniques | `claude plugin install svg-toolkit@radleta` |
| [test-verification](./plugins/test-verification/) | Test quality verification methodology with shallow test detection | `claude plugin install test-verification@radleta` |
| [typescript-expert](./plugins/typescript-expert/) | TypeScript type system mastery, architectural patterns, and compiler optimization | `claude plugin install typescript-expert@radleta` |
| [visual-companion](./plugins/visual-companion/) | Browser-based visual companion that serves HTML previews locally | `claude plugin install visual-companion@radleta` |
| [web-scraper](./plugins/web-scraper/) | Systematic web scraping methodology with escalating strategies | `claude plugin install web-scraper@radleta` |
| [wiki-memory](./plugins/wiki-memory/) | Wiki-backed persistent memory for Claude Code projects | `claude plugin install wiki-memory@radleta` |
| [winforms-expert](./plugins/winforms-expert/) | Windows Forms patterns for NotifyIcon tray apps, GDI+ rendering, and message pumps | `claude plugin install winforms-expert@radleta` |

### Productivity

| Plugin | Description | Install |
|--------|-------------|---------|
| [claude-tray](./plugins/claude-tray/) | Windows system tray monitor for Claude Code sessions | `claude plugin install claude-tray@radleta` |
| [document-tools](./plugins/document-tools/) | Spreadsheet generation and Markdown-to-PDF conversion tools | `claude plugin install document-tools@radleta` |
| [email-drafter](./plugins/email-drafter/) | Gmail draft management and label-gated email composition | `claude plugin install email-drafter@radleta` |
| [human-voice](./plugins/human-voice/) | Strips AI tells from text so emails, posts, and copy read as genuinely human-authored | `claude plugin install human-voice@radleta` |
| [local-memory](./plugins/local-memory/) | Active Projects working memory management in CLAUDE.local.md | `claude plugin install local-memory@radleta` |
| [scratch-management](./plugins/scratch-management/) | Scratch folder lifecycle management for plans and temp files | `claude plugin install scratch-management@radleta` |
| [scratch-memory](./plugins/scratch-memory/) | Project-scoped scratch-memory: MCP tools (write_report, write_review, write_issue) for sub-agent verdicts plus scratch-memory CLI (handoff, pickup, register with opt-in PostToolUse hook) for session state persistence and ownership transfer across Claude Code sessions, plus the commit-session verb for per-session file validation and the handoff-manager agent for HANDOFF.md synthesis and resume briefs | `claude plugin install scratch-memory@radleta` |

### Documentation

| Plugin | Description | Install |
|--------|-------------|---------|
| [api-docs](./plugins/api-docs/) | Industry-standard patterns for API documentation generation | `claude plugin install api-docs@radleta` |
| [doc-update](./plugins/doc-update/) | Accuracy-driven documentation update methodology for code changes | `claude plugin install doc-update@radleta` |
| [user-docs](./plugins/user-docs/) | Validated patterns for creating end-user documentation | `claude plugin install user-docs@radleta` |

### Integration

| Plugin | Description | Install |
|--------|-------------|---------|
| [google-sheets-expert](./plugins/google-sheets-expert/) | Google Sheets API v4 patterns for .NET/C# including service account auth and batch operations | `claude plugin install google-sheets-expert@radleta` |

### Security

| Plugin | Description | Install |
|--------|-------------|---------|
| [security-verification](./plugins/security-verification/) | OWASP Top 10 security verification methodology with detection patterns | `claude plugin install security-verification@radleta` |

### DevOps

| Plugin | Description | Install |
|--------|-------------|---------|
| [github-actions-expert](./plugins/github-actions-expert/) | GitHub Actions CI/CD patterns for workflows, permissions, matrix builds, and releases | `claude plugin install github-actions-expert@radleta` |

## Cowork Skills

Download the zip and upload via Cowork → Customize → Plugins → add skill via zip. ([source](https://support.claude.com/en/articles/13837440))

| Skill | Download |
|-------|----------|
| Human Voice | [human-voice.zip](https://github.com/radleta/claude-plugins/releases/download/cowork-latest/human-voice.zip) |

## Author

Richard Adleta — [github.com/radleta](https://github.com/radleta)

*Generated by marketplace-publish on 2026-06-27*
