# Slash Command Best Practices & Tips

### Hot-Reload Behavior (v2.1.0+)
- **Skills** (`.claude/skills/`) hot-reload automatically when files change
- **Legacy commands** (`.claude/commands/`) may require a session restart
- When in doubt, restart the session after modifying command files

## Command Design Principles

### 1. Single Responsibility Principle
Each command should do one thing well.

**GOOD:**
```markdown
# .claude/commands/git/commit.md
Create a git commit with message: $ARGUMENTS
```

**AVOID:**
```markdown
# .claude/commands/git/everything.md
Create a commit, push to remote, create PR, and notify team about $ARGUMENTS
```

**Why:** Focused commands are easier to maintain, debug, and combine.

### 2. Clear Descriptions
Make descriptions specific and actionable.

**GOOD:**
```yaml
---
description: Create a git commit with conventional commit format
---
```

**AVOID:**
```yaml
---
description: Git stuff
---
```

**Why:** Clear descriptions help users discover and understand commands.

### 3. Meaningful Names
Use descriptive, action-oriented command names.

**GOOD:**
- `review-pr.md` → `/review-pr`
- `optimize-images.md` → `/optimize-images`
- `generate-types.md` → `/generate-types`

**AVOID:**
- `do-thing.md` → `/do-thing`
- `x.md` → `/x`
- `util.md` → `/util`

**Why:** Good names make commands self-documenting.

## Argument Design

### Optimal Argument Placement

**Golden Rule: Use `$ARGUMENTS` once, at the end**

```markdown
# BEST PRACTICE ✓
---
description: Create detailed plan with ULTRATHINK
---

Create a detailed plan using ULTRATHINK methodology.

**Requirements:**
- Deep analysis and reasoning
- Comprehensive documentation
- Actionable steps

Apply rigorous thinking to: $ARGUMENTS
```

**Why this works:**
1. **Ending bias** - Claude gives more weight to final instructions
2. **Token efficiency** - No repetition waste
3. **Maximum importance** - User's request has the most impact
4. **Clear focus** - Command ends with what matters most

### Token Optimization

Commands consume tokens from the context window. Keep prompts concise:

**Show commands, not explanations:**
```markdown
# ✗ After cloning, copy the hook file and make it executable
# ✓ cp .githooks/pre-commit .git/hooks/pre-commit && chmod +x
```

**Avoid duplication with @ includes:**
```markdown
# ✗ Command repeats same instructions as @referenced file
# ✓ Add to referenced file only (command sees it via @)
```

**Reference files for details:**
```markdown
Create feature: $ARGUMENTS

Follow patterns in @.claude/docs/conventions.md
```

**AVOID: Multiple `$ARGUMENTS`**

```markdown
# BAD PRACTICE ✗
Create a plan for: $ARGUMENTS

[... instructions ...]

Make sure to address: $ARGUMENTS
```

**Problems:**
- Wastes tokens with repetition
- Dilutes importance across multiple mentions
- Less efficient prompt structure

**Exception: Positional Args**
When using `$0`, `$1`, etc., you can still place `$ARGUMENTS` at the end:

```markdown
Review PR #$0 from $1

[... review criteria ...]

Additional focus areas: $ARGUMENTS
```

### Design for Flexibility

**Pattern 1: Optional Context**
```markdown
---
argument-hint: [additional context]
---

Analyze the codebase for performance issues. $ARGUMENTS
```

Users can add: `/analyze` or `/analyze focus on database queries`

**Pattern 2: Required + Optional**
```markdown
---
argument-hint: <file-path> [instructions]
---

Refactor @$0 following these guidelines: $ARGUMENTS
```

**Pattern 3: Structured Arguments**
```markdown
---
argument-hint: <pr-number> <reviewer> [notes]
---

Request review from $1 for PR #$0. Additional notes: $ARGUMENTS
```

### Provide Argument Hints

Always use `argument-hint` to guide users:

```yaml
---
argument-hint: <issue-id> <priority: low|medium|high>
---
```

This shows in the UI and helps users format their input correctly.

### Handle Missing Arguments Gracefully

**GOOD:**
```markdown
Review PR #$0 with standard checks.
$( Additional focus areas: $ARGUMENTS )
```

**BETTER:**
```markdown
Review PR #$0 with standard checks.

$ARGUMENTS
```

The second version naturally handles both cases:
- `/review-pr 123` - just standard checks
- `/review-pr 123 focus on security` - standard + security focus

## Tool Restrictions

### When to Use `allowed-tools`

**For complete guidance on tool permissions:** See @QUALITY.md "Appropriate" Tool Permissions (lines 15-96)

**Quick Summary:**
- **DEFAULT:** Omit `allowed-tools` entirely (applies to all operations)
- **ONLY ADD:** When user explicitly requests restrictions
- **Golden Rule:** If unsure whether to restrict tools, don't. Add restrictions only when user asks.

The decision matrix in @QUALITY.md provides detailed criteria, examples for when user requests restrictions, and rationale for default behavior.

### Security-Sensitive Commands

Restrict tools for commands that shouldn't modify files:

```yaml
---
description: Analyze codebase for patterns
allowed-tools: Read, Grep, Glob
---
```

**Use cases:**
- Analysis commands
- Read-only reviews
- Security audits
- Documentation generation (reading phase)

### Git Operations

Precisely scope git permissions:

```yaml
---
description: Create and push a commit
allowed-tools: Bash(git add *), Bash(git commit *), Bash(git push *)
---
```

**Why:** Prevents accidental execution of destructive git commands.

### Default: No Restrictions

**Best Practice:** Start without `allowed-tools` and add only if needed.

```yaml
# BEST - No restrictions for safe refactoring
---
description: Refactor code to use dependency injection
---

# AVOID - Over-restricting safe operations
---
description: Refactor code to use dependency injection
allowed-tools: Read, Edit, Write
---
```

Most commands work better without restrictions. Add them only for:
- Git push/force operations
- Deployments
- Delete operations
- Network fetches
- **Forked internal workers** (recommend to user — see @QUALITY.md)

### Skill Tool in `allowed-tools`

The `Skill` tool supports pattern matching in `allowed-tools`:

```yaml
# Allow all skill invocations
allowed-tools: Read, Glob, Grep, Skill

# Restrict to a specific skill
allowed-tools: Read, Glob, Grep, Skill(plan-expert)
```

**Key insight:** Skills are knowledge injection only. Loading a skill via the `Skill` tool injects knowledge/context into the agent — it does NOT grant additional tool access. The `allowed-tools` restriction on other tools (Read, Bash, etc.) is the real guardrail. Use bare `Skill` for most forked workers.

### `Bash(git *)` for Git-Only Commands

For commands that need git history but shouldn't run arbitrary shell commands:

```yaml
allowed-tools: Read, Glob, Grep, Bash(git *)
```

This allows `git log`, `git diff`, `git status`, etc. but blocks `rm`, `npm`, and other non-git commands. Appropriate for read-only git analysis workers.

## Organization Strategies

### Namespace by Domain

```
.claude/commands/
├── git/
│   ├── commit.md
│   ├── review-pr.md
│   └── sync.md
├── testing/
│   ├── run-unit.md
│   ├── run-e2e.md
│   └── coverage.md
├── docs/
│   ├── api.md
│   └── readme.md
└── deploy/
    ├── staging.md
    └── production.md
```

**Benefits:**
- Easy to find related commands
- Clear ownership boundaries
- Intuitive organization
- Prevents name collisions

### Namespace by Role

```
.claude/commands/
├── developer/
│   ├── debug.md
│   └── test.md
├── reviewer/
│   ├── pr-checklist.md
│   └── security-review.md
└── maintainer/
    ├── release.md
    └── changelog.md
```

**Use when:** Team roles are well-defined

### Flat for Small Projects

```
.claude/commands/
├── commit.md
├── test.md
├── review.md
└── deploy.md
```

**Use when:** Fewer than 10 commands

## Performance Considerations

### Bash Execution Efficiency

**AVOID:**
```markdown
!`find . -name "*.js" -exec wc -l {} \;`
!`cat package.json`
!`git log --all --oneline`
```

**BETTER:**
```markdown
!`git status -sb`
!`git diff --stat`
```

**Why:** Heavy operations slow command execution. Keep bash commands lightweight.

### File Reference Limits

**AVOID:**
```markdown
Review all these files:
@src/**/*.js
@tests/**/*.test.js
@docs/**/*.md
```

**BETTER:**
```markdown
Review @$0

# Usage: /review src/specific-file.js
```

**Why:** Too many file references exceed context limits.

## Team Collaboration

### Document Your Commands

Create a README in `.claude/commands/`:

```markdown
# Team Commands

## Git Workflows
- `/commit` - Create conventional commit
- `/review-pr <number>` - Review pull request

## Testing
- `/test-all` - Run full test suite
- `/test-changed` - Test only changed files
```

### Standardize Conventions

Establish team patterns:

```yaml
# Standard format for all git commands
---
description: <Action> <subject> <details>
allowed-tools: Bash(git *)
argument-hint: <specific-format>
---
```

### Version Your Commands

Add comments for breaking changes:

```markdown
---
description: Deploy to environment
---

<!-- v2.0.0: Now requires environment argument -->
<!-- v1.0.0: Defaulted to staging -->

Deploy to $0 environment
```

## Advanced Patterns

### Composition Through Arguments

Design commands that work well together:

```markdown
# .claude/commands/git/changes.md
!`git diff --name-only`
```

```markdown
# .claude/commands/test/files.md
Run tests for: $ARGUMENTS
```

**Usage:**
```
/test-files $(/git-changes)
```

### Context Building

Use bash execution to build rich context:

```markdown
---
allowed-tools: Bash(git *), Read, Grep
---

Current branch: !`git branch --show-current`
Changed files: !`git diff --name-only HEAD~1`
Recent commit: !`git log -1 --oneline`

Based on these changes, $ARGUMENTS
```

### Model Selection Strategy

Choose models based on task complexity:

```yaml
# Fast, simple tasks
---
model: haiku
---
```

```yaml
# Complex reasoning
---
model: sonnet
---
```

```yaml
# Default - inherit from conversation
---
# no model specified
---
```

## Testing & Debugging

### Test Command Syntax

Before committing, verify:

```bash
# Check YAML syntax
cat .claude/commands/my-command.md | head -n 10

# Test with different arguments
/my-command
/my-command arg1
/my-command arg1 arg2 arg3
```

### Debug with Simple Versions

Start simple, add complexity:

```markdown
# Version 1 - basic
Create a commit with: $ARGUMENTS
```

```markdown
# Version 2 - add bash
Current status: !`git status -sb`
Create a commit with: $ARGUMENTS
```

```markdown
# Version 3 - add restrictions
---
allowed-tools: Bash(git *)
---

Current status: !`git status -sb`
Create a commit with: $ARGUMENTS
```

### Use Claude Code Debug Mode

```bash
claude --debug
```

Then run your command to see detailed error messages.

## Common Pitfalls

### 1. Over-Complicated Prompts

**AVOID:**
```markdown
First analyze the codebase, then identify all potential issues,
then categorize them by severity, then create a detailed report
with recommendations, then create tasks for each issue, then...
```

**BETTER:**
```markdown
Analyze codebase and identify issues with severity levels. $ARGUMENTS
```

Let Claude handle the complexity naturally.

### 2. Hard-Coded Values

**AVOID:**
```markdown
Review pull request #123 from alice
```

**Why bad:** Hard-coded values make command single-use, requiring edit for every different PR. Not reusable.

**BETTER:**
```markdown
Review pull request #$0 from $1
```

**Why good:** Arguments make command reusable. Single command works for any PR number and author. Follows DRY principle.

### 3. Using Bash Execution Without Testing

**AVOID:**
```markdown
!`git push origin main`
```

**Why bad:** Bash execution runs before Claude processes prompt. If command fails, entire command execution fails. Untested bash can break command flow.

**BETTER:**
```markdown
Deploy to production:

Pre-flight checks:
1. All tests passing
2. Branch is main
3. No uncommitted changes

Execute: git push origin main
```

**Why good:** Claude handles git push through Bash tool with proper error handling and user confirmation for destructive operations. Reliable execution with safety checks.

### 4. Unclear Argument Boundaries

**AVOID:**
```markdown
Create PR from $0 to $1 with title $2 and description $3
```

**Why bad:** Positional args with spaces break parsing. $2 gets first word of title, not whole title. Fragile and error-prone.

**BETTER:**
```markdown
---
argument-hint: <source-branch> <target-branch>
---

Create PR from $0 to $1

Title and description: $ARGUMENTS
```

**Why good:** $ARGUMENTS captures all remaining text including spaces. Mix of positional (branches) and free-form (title/desc) works reliably.

### 5. Namespace Confusion

**AVOID:**
```
.claude/commands/frontend/react/components/review.md
```

**Why bad:** Deep nesting creates confusion. Command name `/review` conflicts with other `/review` commands. Overly complex organization.

**BETTER:**
```
.claude/commands/frontend/review-component.md
```

**Why good:** Flat structure with descriptive name `/review-component` is unique and clear. Easy to find, no conflicts, simple organization.

## Maintenance Tips

### Regular Review

Periodically check:
- [ ] Are commands still used?
- [ ] Are descriptions accurate?
- [ ] Do permissions need updating?
- [ ] Are there new common workflows?

### Deprecation Strategy

When removing commands:

```markdown
---
description: [DEPRECATED] Use /new-command instead
---

This command is deprecated. Please use /new-command instead.

$ARGUMENTS
```

### Migration Path

When updating command signatures:

```markdown
<!--
MIGRATION: v1.0.0 -> v2.0.0
Old: /deploy
New: /deploy <environment>

For automatic deployment, use /deploy-auto
-->
```

## Personal vs Project Commands

### Use Personal Commands For:
- Individual preferences (coding style, review checklists)
- Experimental workflows
- Personal productivity shortcuts
- Machine-specific operations

### Use Project Commands For:
- Team standards (commit format, PR templates)
- Project-specific workflows
- Shared review processes
- Deployment procedures

### Synchronization Pattern

Keep personal commands in sync across machines:

```bash
# In dotfiles repo
~/.dotfiles/claude/commands/
└── ...

# Symlink to Claude directory
ln -s ~/.dotfiles/claude/commands ~/.claude/commands
```

## Migration & Modern Features

### Migrating Commands to Skills
If you have complex commands that would benefit from auto-discovery and hot-reload, consider migrating them to skills (`.claude/skills/`). Skills use the same YAML frontmatter but auto-load based on context rather than requiring explicit `/name` invocation.

### Using `context: fork`

**Key gotcha:** Despite the name, `context: fork` does NOT fork/copy the current conversation. It spawns a completely fresh subagent context with no conversation history. The command content becomes the subagent's only prompt.

**Decision framework — when to fork:**

| Fork | Don't Fork |
|------|------------|
| Self-contained git operations (`/commit`, `/merge`) | Commands that say "analyze current conversation" |
| Code analysis that reads files directly | Commands extracting requirements from discussion |
| Pattern scanning / verification commands | Debugging commands referencing prior context |
| Heavy-output commands (avoid polluting main context) | Implementation commands inferring tasks from conversation |

**Rule of thumb:** If `$ARGUMENTS` provides everything the command needs, fork is safe. If the command needs to "remember" what was discussed, do NOT fork.

```yaml
---
context: fork
description: Run analysis in isolated context
---
```

**Combine with `agent`** for specialized execution:

```yaml
---
context: fork
agent: Explore    # Read-only research subagent
---
```

### Description Budget Monitoring
Command descriptions consume ~2% of the context window (`SLASH_COMMAND_TOOL_CHAR_BUDGET`). For commands with many arguments, keep descriptions concise to avoid exceeding the budget.

## Quick Reference Checklist

When creating a command, ask:

- [ ] Is the name descriptive and action-oriented?
- [ ] Does it have a clear description?
- [ ] Are argument hints provided?
- [ ] Are tool restrictions appropriate? (Remember: most commands don't need them)
- [ ] Does model use alias format (sonnet/haiku/opus) if specified?
- [ ] Is the prompt focused and clear?
- [ ] Does it handle missing arguments well?
- [ ] Is it in the right namespace?
- [ ] Have I tested it with different arguments?
- [ ] Is it documented for the team?
- [ ] Does the YAML syntax validate?

## Resources

- Syntax Reference: See @SYNTAX.md
- Examples: See @EXAMPLES.md
- Quality Standards: See @QUALITY.md
- Official Docs: https://docs.claude.com/en/docs/claude-code/slash-commands.md
