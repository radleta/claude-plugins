# radleta — Claude Code Plugin Marketplace

Personal plugin marketplace with 24 plugins for AI-augmented development.

## Setup

```bash
claude plugin marketplace add radleta/claude-plugins
```

## Bundles

Install a bundle to get a curated set of plugins in one command.

| Plugin | Description | Install |
|--------|-------------|---------|
| [**dev-workflow**](./plugins/dev-workflow/) | Development pipeline: brainstorming to idea.md, a lead-driven build with checkpoint reports, one end-of-build review, and the commit workflow | `claude plugin install dev-workflow@radleta` |

## Individual Plugins

### Development

| Plugin | Description | Install |
|--------|-------------|---------|
| [agent-voice](./plugins/agent-voice/) | Variance pass for instructions an agent executes: name the branches, prune, bound every step, and sharpen the pointer that triggers the file | `claude plugin install agent-voice@radleta` |
| [chrome-devtools](./plugins/chrome-devtools/) | Browser automation methodology for Chrome DevTools integration | `claude plugin install chrome-devtools@radleta` |
| [code-verification](./plugins/code-verification/) | Unified code quality and requirements verification with detection categories | `claude plugin install code-verification@radleta` |
| [commit-methodology](./plugins/commit-methodology/) | Comprehensive commit creation with adaptive analysis and conventional commit format | `claude plugin install commit-methodology@radleta` |
| [completeness-expert](./plugins/completeness-expert/) | Enforces complete output and verification before declaring tasks done | `claude plugin install completeness-expert@radleta` |
| [completeness-verification](./plugins/completeness-verification/) | Structural completeness methodology with named fingerprint detection | `claude plugin install completeness-verification@radleta` |
| [discuss-methodology](./plugins/discuss-methodology/) | Interview a plan, decision, or design relentlessly until nothing is left unasked | `claude plugin install discuss-methodology@radleta` |
| [estimation-expert](./plugins/estimation-expert/) | Calibrated effort estimation for AI-augmented development workflows | `claude plugin install estimation-expert@radleta` |
| [interview-methodology](./plugins/interview-methodology/) | Structured option-batch protocol for eliciting user decisions with recommendations | `claude plugin install interview-methodology@radleta` |
| [plan-update](./plugins/plan-update/) | Plan progress update methodology for marking completed steps | `claude plugin install plan-update@radleta` |
| [pr-writer](./plugins/pr-writer/) | Framework for creating well-structured pull request descriptions | `claude plugin install pr-writer@radleta` |
| [project-update](./plugins/project-update/) | Business-facing project status updates from git history | `claude plugin install project-update@radleta` |
| [test-verification](./plugins/test-verification/) | Test quality verification methodology with shallow test detection | `claude plugin install test-verification@radleta` |
| [ux-verification](./plugins/ux-verification/) | Visual-first UX, accessibility, and design-quality verification with screenshot evidence at multiple viewport breakpoints | `claude plugin install ux-verification@radleta` |
| [visual-companion](./plugins/visual-companion/) | Browser-based visual companion that serves HTML previews locally | `claude plugin install visual-companion@radleta` |
| [wiki-memory](./plugins/wiki-memory/) | Wiki-backed persistent memory for Claude Code projects | `claude plugin install wiki-memory@radleta` |

### Productivity

| Plugin | Description | Install |
|--------|-------------|---------|
| [human-voice](./plugins/human-voice/) | Strips AI tells from text so emails, posts, and copy read as genuinely human-authored | `claude plugin install human-voice@radleta` |
| [scratch-management](./plugins/scratch-management/) | Scratch folder lifecycle management for plans and temp files | `claude plugin install scratch-management@radleta` |
| [scratch-memory](./plugins/scratch-memory/) | Project-scoped scratch-memory: MCP tools (write_report, write_review, write_issue, write_session, write_task) for sub-agent verdicts, session handoffs, and task capture plus scratch-memory CLI (handoff, pickup, register with two opt-in PostToolUse hooks, tasks, epics) for session state persistence and ownership transfer across Claude Code sessions, plus the commit-session verb for per-session file validation and rewrite-pointer/cat-sessions (with --with-tasks) verbs for v3 HANDOFF.md pointer regeneration and resume briefs; plus the capture-issue command and the scratch/issues/ corpus conventions (schema including the optional epic/spike keys, open|resolved lifecycle, triage, resolution) documented in scratch-issues-methodology, with the epics verb group deriving an epic's workable spike frontier from those files | `claude plugin install scratch-memory@radleta` |
| [writing-expert](./plugins/writing-expert/) | Writing craft knowledge base: prose structure, narrative arc, sentence rhythm, line editing, and explaining technical topics to informed readers | `claude plugin install writing-expert@radleta` |

### Documentation

| Plugin | Description | Install |
|--------|-------------|---------|
| [doc-update](./plugins/doc-update/) | Accuracy-driven documentation update methodology for code changes | `claude plugin install doc-update@radleta` |
| [research-and-capture](./plugins/research-and-capture/) | Wiki-first codebase investigation plus the capture and ingestion layer that turns what a session learned into durable wiki knowledge | `claude plugin install research-and-capture@radleta` |

### Security

| Plugin | Description | Install |
|--------|-------------|---------|
| [security-verification](./plugins/security-verification/) | OWASP Top 10 security verification methodology with detection patterns | `claude plugin install security-verification@radleta` |

## Cowork Skills

Download the zip and upload via Cowork → Customize → Plugins → add skill via zip. ([source](https://support.claude.com/en/articles/13837440))

| Skill | Download |
|-------|----------|
| Agent Voice | [agent-voice.zip](https://github.com/radleta/claude-plugins/releases/download/cowork-latest/agent-voice.zip) |
| Completeness Expert | [completeness-expert.zip](https://github.com/radleta/claude-plugins/releases/download/cowork-latest/completeness-expert.zip) |
| Discuss Methodology | [discuss-methodology.zip](https://github.com/radleta/claude-plugins/releases/download/cowork-latest/discuss-methodology.zip) |
| Estimation Expert | [estimation-expert.zip](https://github.com/radleta/claude-plugins/releases/download/cowork-latest/estimation-expert.zip) |
| Human Voice | [human-voice.zip](https://github.com/radleta/claude-plugins/releases/download/cowork-latest/human-voice.zip) |
| Interview Methodology | [interview-methodology.zip](https://github.com/radleta/claude-plugins/releases/download/cowork-latest/interview-methodology.zip) |
| Knowledge Distillation | [knowledge-distillation.zip](https://github.com/radleta/claude-plugins/releases/download/cowork-latest/knowledge-distillation.zip) |
| Writing Expert | [writing-expert.zip](https://github.com/radleta/claude-plugins/releases/download/cowork-latest/writing-expert.zip) |

## Author

Richard Adleta — [github.com/radleta](https://github.com/radleta)

*Generated by marketplace-publish on 2026-09-04*
