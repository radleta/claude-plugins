---
name: claude-md-builder
description: "Complete specifications for building CLAUDE.md instruction files including the 7-level memory hierarchy, @import syntax, and .claude/rules/ modular rules. Use when creating CLAUDE.md files, building multi-file instruction structures, or configuring path-specific rules — even for simple single-file project instructions."
---

# CLAUDE.md Builder

<role>
  <identity>Expert CLAUDE.md file builder and instruction architecture specialist</identity>

  <purpose>
    Guide creation, organization, and troubleshooting of CLAUDE.md instruction files
    and .claude/rules/ modular rule systems for Claude Code projects
  </purpose>

  <expertise>
    <area>7-level memory hierarchy (managed policy through auto memory)</area>
    <area>@import file inclusion and .claude/rules/ path-specific rules</area>
    <area>Content organization and token efficiency</area>
    <area>Troubleshooting import errors, circular dependencies, and conflicts</area>
  </expertise>

  <scope>
    <in-scope>
      <item>Creating CLAUDE.md files at any hierarchy level</item>
      <item>Configuring .claude/rules/ and ~/.claude/rules/ directories</item>
      <item>Writing @import statements and multi-file structures</item>
      <item>Path-specific rules with YAML frontmatter</item>
      <item>Token optimization and content organization</item>
    </in-scope>

    <out-of-scope>
      <item>Creating Claude Code skills (use claude-skill-builder)</item>
      <item>Creating custom agents (use claude-agent-builder)</item>
      <item>General Claude API usage or prompt engineering</item>
    </out-of-scope>
  </scope>
</role>

## Key Constraint: Reload Required

CLAUDE.md files load once at session start. After creating or modifying CLAUDE.md files, remind the user to start a new session to apply changes. (Rules files and auto memory also load at startup.)

## Memory Hierarchy (7 Levels)

CLAUDE.md files are organized in a 7-level hierarchy, loaded in this order:

| # | Level | Location | Shared With |
|---|-------|----------|-------------|
| 1 | **Managed policy** | macOS: `/Library/Application Support/ClaudeCode/CLAUDE.md`; Linux: `/etc/claude-code/CLAUDE.md`; Windows: `C:\Program Files\ClaudeCode\CLAUDE.md` | All users in org |
| 2 | **Project memory** | `./CLAUDE.md` or `./.claude/CLAUDE.md` | Team (via source control) |
| 3 | **Project rules** | `./.claude/rules/*.md` | Team (via source control) |
| 4 | **User memory** | `~/.claude/CLAUDE.md` | Just you (all projects) |
| 5 | **User rules** | `~/.claude/rules/*.md` | Just you (all projects) |
| 6 | **Project-local** | `./CLAUDE.local.md` *(deprecated)* | Just you (this project) |
| 7 | **Auto memory** | `~/.claude/projects/<project>/memory/` | Just you (per project) |

**Precedence**: Earlier levels override later levels. Managed policy > Project > User.

For detailed hierarchy guidance and decision tables, use Read tool on [REFERENCE.md](REFERENCE.md) — it covers precedence edge cases, conflict resolution, and import troubleshooting.

## .claude/rules/ — Modular Rules System

Rules files provide **modular, topic-specific** project instructions:

```
.claude/
├── CLAUDE.md              # Main project instructions
└── rules/
    ├── code-style.md      # Always loaded
    ├── testing.md         # Always loaded
    └── api-rules.md       # Path-specific (see below)
```

All `.md` files in `.claude/rules/` are automatically loaded. Subdirectories are discovered recursively. Symlinks supported.

### Path-Specific Rules

Add YAML frontmatter to restrict rules to matching file paths:

```yaml
---
paths:
  - "src/api/**/*.ts"
---
# API Development Rules
- All endpoints must include input validation
- Use controller-service-repository pattern
```

Rules without `paths` frontmatter load unconditionally. Glob patterns support brace expansion: `src/**/*.{ts,tsx}`.

**User-level rules** at `~/.claude/rules/*.md` load for all projects (lower priority than project rules).

## @import Syntax

Import content from other files using `@path/to/file.md`:

```markdown
## Architecture
@.claude/docs/architecture.md

## Code Style
@.claude/docs/style.md
```

### Import Rules
- **Relative paths** resolve relative to the file containing the import (not cwd)
- **Max depth**: 5 levels of nested imports
- **No circular imports**: A -> B -> A causes error
- **Code blocks/spans**: Imports inside ``` or backticks are ignored
- **Approval dialog**: First import encounter in a project triggers one-time approval

For complete import troubleshooting, use Read tool on [REFERENCE.md](REFERENCE.md) — covers circular dependency resolution, approval dialogs, and common error messages.

## Auto Memory

Claude writes its own notes to `~/.claude/projects/<project>/memory/`:
- `MEMORY.md` is the entrypoint — first **200 lines** loaded at startup
- Topic files (e.g., `debugging.md`, `patterns.md`) load on-demand
- Claude reads and updates these files during sessions

## Commands

- **`/init`** — Analyzes codebase and generates starter CLAUDE.md (use as starting point, then prune)
- **`/memory`** — Opens memory files in system editor

## Official Size & Token Guidance

**From Anthropic's official docs:**

> "Keep CLAUDE.md under ~500 lines. Move specialized instructions to skills."
> "For each line, ask: 'Would removing this cause Claude to make mistakes?' If not, cut it."

| Include | Exclude |
|---------|---------|
| Bash commands Claude can't guess | Anything Claude can figure out from code |
| Code style rules that differ from defaults | Standard language conventions |
| Testing instructions and preferred runners | Detailed API documentation (link instead) |
| Repo etiquette (branches, PRs, commits) | Information that changes frequently |
| Architectural decisions specific to project | Long explanations or tutorials |
| Dev environment quirks (required env vars) | File-by-file codebase descriptions |
| Common gotchas / non-obvious behaviors | Self-evident practices ("write clean code") |

**Emphasis works**: Use `IMPORTANT` or `YOU MUST` for critical rules Claude keeps missing.

**Community guidance** (HumanLayer, builder.io): Target under 300 lines; ideally under 60 lines for the root file. Never include code style that a linter handles. Treat CLAUDE.md like code — review, prune, test.

## Content Organization Best Practices

### Be Specific, Not Vague
```markdown
# Good: Specific and actionable
- Use snake_case for Python variables
- Maximum line length: 88 characters (Black formatter)
- Use type hints for all function parameters

# Bad: Vague and unhelpful
- Follow Python conventions
- Write clean code
```

### Organize by Concern
Group related instructions under descriptive headings: Code Style, Architecture, Testing, Git Workflow, Deployment.

### Use Rules for Modularity
For projects with many conventions, prefer `.claude/rules/` over one large CLAUDE.md:
```
.claude/rules/
├── code-style.md       # Formatting, naming, patterns
├── testing.md          # Test framework, coverage, patterns
├── git-workflow.md     # Branches, commits, PRs
└── api-rules.md        # Path-specific API conventions
```

### Use @imports for Large Projects
When total content exceeds ~500 lines, split into files:
```markdown
# Project Documentation
@.claude/docs/architecture.md
@.claude/docs/testing.md
```

### Move Specialized Knowledge to Skills
CLAUDE.md loads every session. Skills load on-demand. Move domain expertise, workflow protocols, and specialized guidance to `.claude/skills/` and keep CLAUDE.md for universal project conventions only.

## Common Anti-Patterns

**DON'T: Exceed ~500 lines** — Attention degrades with length; rules buried deep get ignored.

**DON'T: Include linter-enforceable rules** — Duplicating what ESLint/Prettier already enforce wastes tokens and creates conflicting sources of truth.

**DON'T: Mix project and personal preferences** — Project conventions in `./CLAUDE.md`, personal in `~/.claude/CLAUDE.md`. Mixing causes conflicts for teammates who don't share your preferences.

**DON'T: Create circular imports** — A imports B imports A causes a load error. Extract shared content to a common file both can import.

**DON'T: Nest imports > 3 levels deep** — Deep chains are hard to debug when something breaks. Max is 5, but aim for 2-3.

**DON'T: Put imports in code blocks** — The parser skips content inside ``` fences, so the import silently does nothing.

## Getting Started

### New Project
1. Run `/init` to generate starter CLAUDE.md
2. Prune auto-generated content — keep only what Claude can't figure out alone
3. Add project-specific conventions (architecture, testing, git workflow)
4. Create `.claude/rules/` for modular topic-specific rules
5. Commit to version control

### Personal Preferences
1. Create `~/.claude/CLAUDE.md` with cross-project preferences
2. Optionally add `~/.claude/rules/*.md` for personal rules
3. Keep personal content personal — don't duplicate project conventions

### Large Projects
1. Design structure: main CLAUDE.md as index + imported topic files
2. Use `.claude/rules/` for path-specific conventions
3. Keep each file under 200 lines
4. Target total content under 500 lines
5. Move specialized workflows to skills

## Detailed Reference

Use Read tool to load these when needed:

- **[EXAMPLES.md](EXAMPLES.md)** — Templates, filled patterns, and advanced structures. Read when building a new CLAUDE.md from scratch or designing multi-file structures.
- **[REFERENCE.md](REFERENCE.md)** — Troubleshooting, hierarchy decision tables, import rules, best practices. Read when debugging import issues or resolving precedence conflicts.
