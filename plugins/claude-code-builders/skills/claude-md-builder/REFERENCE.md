# CLAUDE.md Reference Guide

Detailed troubleshooting, hierarchy guidance, import rules, and best practices.

## Troubleshooting Common Issues

### Import Not Loading

**Diagnostic steps (sequential):**

1. **Verify file exists** at the import path
2. **Check path syntax**: Relative paths use `./` or `../`; absolute paths start with `/`; use forward slashes (not backslashes)
3. **Check code blocks**: Imports inside ``` or backtick spans are ignored — move outside
4. **Check depth**: Trace import chain from root — max 5 levels
5. **Check approval**: First import in a project triggers approval dialog. If declined, imports stay disabled for that project
6. **Reload session**: CLAUDE.md loads at startup — start new session after changes

### Circular Import

**Symptom**: Error about circular dependency (A -> B -> A)

**Solution**: Extract shared content to a common file:
```markdown
# common.md (shared content)

# A.md
@common.md
[A-specific content]

# B.md
@common.md
[B-specific content]
```

### Import Depth Exceeded

**Symptom**: Error about exceeding maximum import depth (5 levels)

**Solution**: Flatten the structure:
```
# Before: Too deep (6 levels)
CLAUDE.md -> L1 -> L2 -> L3 -> L4 -> L5 -> L6

# After: Flattened (2 levels)
CLAUDE.md
├── architecture.md
├── style-frontend.md
├── style-backend.md
├── testing.md
└── deployment.md
```

### Conflicting Instructions Between Hierarchy Levels

**Symptom**: Different behavior than expected because multiple CLAUDE.md files conflict

**Diagnosis**: Check all hierarchy levels (managed policy > project > project rules > user > user rules > project-local)

**Solution**:
1. Earlier levels take precedence — remove conflicts from lower-priority files
2. Restructure so levels complement rather than conflict
3. Use project-level for team standards, user-level for personal preferences only

### Instructions Being Ignored

**Symptom**: Claude doesn't follow documented conventions

**Possible causes**:
1. **File too long** — "If Claude keeps doing something you don't want despite having a rule, the file is probably too long and the rule is getting lost" (Anthropic)
2. **Phrasing ambiguous** — "If Claude asks questions answered in CLAUDE.md, the phrasing might be ambiguous" (Anthropic)
3. **Content too vague** — "Follow best practices" is unactionable; be specific

**Solutions**:
- Prune file to under 500 lines (ideally under 300)
- Add emphasis: `IMPORTANT:` or `YOU MUST` for critical rules
- Replace vague guidance with specific, actionable instructions
- Move specialized content to skills (loaded on-demand)

## Hierarchy Decision Tables

### When to Use Each Level

| Content Type | Level | Why |
|---|---|---|
| Security policies, compliance (SOC2, HIPAA) | Managed policy | Organization must enforce |
| Company-wide coding standards | Managed policy | All teams must follow |
| Project architecture decisions | Project memory | Team must share |
| Team code conventions | Project memory | Team must share |
| Path-specific conventions (API rules, test rules) | Project rules | Modular, path-aware |
| Testing strategy and patterns | Project memory or rules | Team must share |
| Personal library preferences | User memory | Only you care |
| Personal code style preferences | User memory | Only you care |
| Personal rules (documentation style, etc.) | User rules | Only you care, modular |
| Project-specific personal notes | Auto memory | Claude manages automatically |

### Decision Rules

1. **Organization must enforce** -> Managed policy
2. **Team must share** -> Project memory or project rules
3. **Path-specific conventions** -> Project rules (with `paths:` frontmatter)
4. **Only you care (all projects)** -> User memory or user rules
5. **Claude's own learnings** -> Auto memory (managed by Claude)
6. When in doubt: **Project memory** (most common)

### Project Rules vs Project Memory

| Criteria | Project memory (CLAUDE.md) | Project rules (.claude/rules/) |
|---|---|---|
| **Structure** | Single file or @imports | Multiple modular files |
| **Path-specific** | No | Yes (with `paths:` frontmatter) |
| **Best for** | Core project overview, quick commands | Topic-specific conventions |
| **Maintenance** | Edit one file | Add/remove rule files independently |
| **When to prefer** | Small projects, < 200 lines total | Many conventions, path-specific needs |

## Import Rules (Complete Reference)

### Path Resolution
- **Relative paths** resolve relative to the file containing the import, not the working directory
- **Absolute paths** resolve from filesystem root
- Both `./` relative and `/` absolute paths supported

### Limitations
- **Max depth**: 5 levels of nested imports
- **No circular imports**: Detected and rejected
- **Code blocks**: Imports inside ``` fences are ignored (treated as example text)
- **Inline code**: Imports inside backtick spans are ignored
- **File must exist**: Missing files cause import errors

### Discovery & Loading
- **Upward search**: Claude Code searches upward from cwd to root, loading CLAUDE.md files found
- **Dynamic discovery**: Nested CLAUDE.md files in subdirectories discovered when those directories are accessed
- **Rules discovery**: `.claude/rules/` scanned recursively for `.md` files
- **Load order**: Managed policy -> Project -> Project rules -> User -> User rules -> Project-local

### Import Approval Dialog
First time encountering `@import` statements in a project, Claude Code shows an approval dialog:
- One-time decision per project
- Once declined, imports remain disabled for that project
- Approval stored in project settings

## .claude/rules/ Complete Reference

### File Structure
```
.claude/rules/
├── code-style.md        # Unconditional (no paths: frontmatter)
├── testing.md           # Unconditional
├── security.md          # Unconditional
├── api/
│   └── endpoints.md     # Can be path-specific
└── frontend/
    └── components.md    # Can be path-specific
```

### Path-Specific Rules Syntax
```yaml
---
paths:
  - "src/api/**/*.ts"
  - "src/api/**/*.tsx"
---
# API Rules
- Validate all inputs
- Use standardized error responses
```

### Glob Patterns
- `*` matches any characters except path separators
- `**` matches any number of directories
- `{ts,tsx}` brace expansion supported
- `src/**/*.{ts,tsx}` matches all TypeScript files under src/

### Priority
- Project rules (`.claude/rules/`) override user rules (`~/.claude/rules/`)
- Rules without `paths:` always load
- Rules with `paths:` only load when working with matching files
- Within rules directory, all `.md` files are loaded (no ordering guarantee)

## Auto Memory Reference

### Location
`~/.claude/projects/<project>/memory/`

### Structure
- `MEMORY.md` — Entrypoint, first 200 lines loaded at startup
- Topic files (e.g., `debugging.md`, `patterns.md`) — Referenced from MEMORY.md, loaded on-demand

### Behavior
- Claude reads MEMORY.md at session start
- Claude updates memory files during sessions as it learns
- Keep MEMORY.md concise (< 200 lines) since content beyond that is truncated
- Create topic files for detailed notes and link from MEMORY.md

### What Goes in Auto Memory vs CLAUDE.md
| Content | Auto memory | CLAUDE.md |
|---|---|---|
| Project conventions | No | Yes |
| Lessons Claude learned | Yes | No |
| Debugging insights | Yes | No |
| Team standards | No | Yes |
| Claude's own notes | Yes | No |

## Best Practices (Official + Community)

### Official Anthropic Guidance
1. **Keep CLAUDE.md under ~500 lines** — move specialized instructions to skills
2. **Be specific**: "Use 2-space indentation" > "Format code properly"
3. **Use structure**: Bullet points, markdown headings, clear grouping
4. **Review periodically**: Update as project evolves
5. **Use emphasis**: `IMPORTANT` or `YOU MUST` for critical rules
6. **Treat like code**: Review when things go wrong, prune regularly, test changes

### Community Best Practices
1. **Target under 300 lines** (HumanLayer); ideally under 60 lines for root file
2. **Never duplicate linter rules** — let deterministic tools handle formatting
3. **Don't use /init blindly** — it's a starting point, prune aggressively
4. **Start with guardrails for actual problems**, not comprehensive manuals
5. **Provide alternatives with constraints** — "Don't use X" is less helpful than "Use Y instead of X because Z"
6. **Pitch why/when to read external docs** rather than embedding full docs via @imports

### Content That Doesn't Belong
- Anything Claude can figure out by reading code
- Standard language conventions Claude already knows
- Detailed API documentation (link to docs instead)
- Information that changes frequently
- Long explanations or tutorials
- File-by-file codebase descriptions
- Self-evident practices like "write clean code"
- Code style rules enforced by linter/formatter

## File Locations Quick Reference

| Level | Location |
|-------|----------|
| Managed policy (macOS) | `/Library/Application Support/ClaudeCode/CLAUDE.md` |
| Managed policy (Linux) | `/etc/claude-code/CLAUDE.md` |
| Managed policy (Windows) | `C:\Program Files\ClaudeCode\CLAUDE.md` |
| Project memory | `./CLAUDE.md` or `./.claude/CLAUDE.md` |
| Project rules | `./.claude/rules/*.md` |
| User memory | `~/.claude/CLAUDE.md` |
| User rules | `~/.claude/rules/*.md` |
| Project-local *(deprecated)* | `./CLAUDE.local.md` |
| Auto memory | `~/.claude/projects/<project>/memory/` |

## Integration with Claude Code

### How CLAUDE.md is Used
1. Content added as **user message** following system prompt (not replacing it)
2. **Supplements** Claude's default behavior, doesn't override core functionality
3. Content uses your **context window** — keep it focused

### Difference from Other Configuration
| Config | How Applied | Use For |
|--------|------------|---------|
| CLAUDE.md | User message after system prompt | Project/personal instructions |
| .claude/rules/ | Loaded as additional context | Modular, path-specific rules |
| Skills | Loaded on-demand when invoked | Specialized workflows, domain knowledge |
| Output Styles | Replaces system prompt portions | Non-coding task formatting |
| --append-system-prompt | Appends to system prompt | CLI-based behavior changes |
| Custom agents | Separate context with own config | Specialized subagent tasks |
