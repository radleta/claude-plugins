---
tags: [claude-code/builders]
summary: "CLAUDE.md memory hierarchy, @import syntax, .claude/rules/ modular rules, and content organization best practices"
---

# CLAUDE.md Builder Patterns

Complete specifications for building CLAUDE.md instruction files. Source: `claude-md-builder` skill.

## Key Constraint: Reload Required

CLAUDE.md files load once at session start. After creating or modifying CLAUDE.md files, the user must start a new session to apply changes. (Rules files and auto memory also load at startup.)

## Memory Hierarchy (7 Levels)

| # | Level | Location | Shared With |
|---|-------|----------|-------------|
| 1 | **Managed policy** | `/etc/claude-code/CLAUDE.md` (Linux) | All users in org |
| 2 | **Project memory** | `./CLAUDE.md` or `./.claude/CLAUDE.md` | Team (via source control) |
| 3 | **Project rules** | `./.claude/rules/*.md` | Team (via source control) |
| 4 | **User memory** | `~/.claude/CLAUDE.md` | Just you (all projects) |
| 5 | **User rules** | `~/.claude/rules/*.md` | Just you (all projects) |
| 6 | **Project-local** | `./CLAUDE.local.md` *(deprecated)* | Just you (this project) |
| 7 | **Auto memory** | `~/.claude/projects/<project>/memory/` | Just you (per project) |

**Precedence:** Earlier levels override later levels. Managed policy > Project > User.

## .claude/rules/ — Modular Rules System

All `.md` files in `.claude/rules/` are automatically loaded. Subdirectories discovered recursively. Symlinks supported.

### Path-Specific Rules

Add YAML frontmatter to restrict rules to matching file paths:

```yaml
---
paths:
  - "src/api/**/*.ts"
---
# API Development Rules
```

Rules without `paths` frontmatter load unconditionally. Glob patterns support brace expansion: `src/**/*.{ts,tsx}`.

## @import Syntax

```markdown
## Architecture
@.claude/docs/architecture.md
```

Import rules:
- Relative paths resolve relative to the file containing the import
- Max depth: 5 levels of nested imports
- No circular imports (A → B → A causes error)
- Imports inside ``` or backticks are ignored
- First import in a project triggers a one-time approval dialog

## Auto Memory

Claude writes its own notes to `~/.claude/projects/<project>/memory/`:
- `MEMORY.md` is the entrypoint — first 200 lines loaded at startup
- Topic files load on-demand
- Claude reads and updates during sessions

## Official Size Guidance

**From Anthropic:** Keep CLAUDE.md under ~500 lines. Move specialized instructions to skills.

| Include | Exclude |
|---------|---------|
| Bash commands Claude can't guess | Anything Claude can figure out from code |
| Code style rules that differ from defaults | Standard language conventions |
| Testing instructions and preferred runners | Detailed API documentation (link instead) |
| Architectural decisions specific to project | Long explanations or tutorials |
| Dev environment quirks | File-by-file codebase descriptions |

**Emphasis works:** Use `IMPORTANT` or `YOU MUST` for critical rules Claude keeps missing.

## Common Anti-Patterns

- **DON'T: Exceed ~500 lines** — Attention degrades with length
- **DON'T: Include linter-enforceable rules** — Creates conflicting sources of truth
- **DON'T: Mix project and personal preferences** — Causes team conflicts
- **DON'T: Create circular imports** — A imports B imports A causes a load error
- **DON'T: Nest imports > 3 levels deep** — Hard to debug; max is 5
- **DON'T: Put imports in code blocks** — The parser skips fenced content

## Commands

- **`/init`** — Analyzes codebase and generates starter CLAUDE.md
- **`/memory`** — Opens memory files in system editor
