# Slash Command & Skill Syntax Reference

> **Unified model (v2.1.3+):** Commands and skills share the same underlying system. Commands are action-oriented (`/commit`, `/deploy`), skills are knowledge-oriented (auto-loaded expertise). Both use the same YAML frontmatter syntax documented here.

## Command File Structure

### Basic Structure

```markdown
Command prompt goes here
```

### Structure with Frontmatter

```markdown
---
property: value
property2: value2
---

Command prompt goes here
```

## File Location & Naming

### Location Conventions

| Location | Purpose | Scope |
|----------|---------|-------|
| `.claude/commands/` | Project commands | Shared with team via git |
| `~/.claude/commands/` | Personal commands | Available across all projects |
| `plugin-name/commands/` | Plugin commands | Bundled with plugins |

### Naming Rules

- Filename (without `.md`) becomes command name
- `optimize.md` → `/optimize`
- `fix-bug.md` → `/fix-bug`
- Subdirectories provide organization but don't affect command name
- `.claude/commands/frontend/review.md` → `/review` (with namespace annotation)

## YAML Frontmatter

### Frontmatter Format

```yaml
---
property1: value1
property2: value2
---
```

### Frontmatter Properties

| Property | Type | Purpose | Default |
|----------|------|---------|---------|
| `description` | string | Brief command summary shown in UI | First line of prompt |
| `allowed-tools` | string | Comma-separated list of permitted tools | Inherits from conversation |
| `model` | string | Specific model to use | Inherits from conversation |
| `argument-hint` | string | Display text for expected arguments | None |
| `disable-model-invocation` | boolean | Prevent SlashCommand tool access | false |
| `user-invocable` | boolean | Whether users can invoke via `/name` | true |
| `context` | string | Execution context mode | (default) |
| `agent` | string | Agent to delegate execution to | None |
| `hooks` | object | Lifecycle hooks configuration | None |
| `memory` | string | Memory scope for the command | None |

### Property Details

#### `description`
- Brief summary of what the command does
- Shown in command picker and help
- Required for SlashCommand tool integration
- Should be concise and clear
- **Budget:** ~2% of context window (`SLASH_COMMAND_TOOL_CHAR_BUDGET`)

```yaml
---
description: Create a git commit with proper formatting
---
```

#### `allowed-tools`
- Controls which tools Claude can use
- **OPTIONAL - USER-REQUESTED ONLY:** See @QUALITY.md "Appropriate" Tool Permissions for complete decision matrix
- Format: `ToolName(pattern *)` or just `ToolName`
- Multiple tools: comma or newline separated
- Supports wildcards with `*`

**Default behavior:** Omit `allowed-tools` entirely unless user explicitly requests restrictions

**Pattern syntax (v2.1.0+):**
```yaml
# Space-separated (current syntax)
allowed-tools: Bash(git *), Bash(npm test *)

# Tool-only (no pattern)
allowed-tools: Read, Grep, Glob

# Skill permission
allowed-tools: Skill(my-skill)
```

**Example (user requested restrictions):**
```yaml
---
allowed-tools: Read, Grep, Glob  # Only if user asked for read-only
---
```

#### `model`
- Specifies which model to use via alias (OPTIONAL)
- Overrides conversation model
- Use for commands requiring specific model capabilities

**Valid aliases:** `sonnet`, `opus`, `haiku`, `default`, `inherit`, `sonnet[1m]`

```yaml
---
model: sonnet  # Use aliases, not full model IDs
---
```

**Note:** Use model aliases (`sonnet`, `opus`, `haiku`, `inherit`) instead of full model version strings for simplicity and forward compatibility. `inherit` explicitly inherits the conversation's model.

#### `argument-hint`
- Shows expected argument format in UI
- Helps users understand what to pass
- Does not validate or enforce

```yaml
---
argument-hint: [issue-number] [priority]
---
```

#### `disable-model-invocation`
- Prevents command from using SlashCommand tool
- Useful for preventing recursive command calls
- Default is `false`

```yaml
---
disable-model-invocation: true
---
```

#### `user-invocable`
- Controls whether users can invoke via `/name` in the CLI
- When `false`, command is only available programmatically (via SlashCommand tool)
- Default is `true`

**Invocation control matrix:**

| `user-invocable` | `disable-model-invocation` | Result |
|---|---|---|
| `true` (default) | `false` (default) | User and model can invoke |
| `true` | `true` | User only (no model auto-invocation) |
| `false` | `false` | Model only (hidden from user) |
| `false` | `true` | Neither (effectively disabled) |

```yaml
---
user-invocable: false  # Hidden from user, model-only
---
```

#### `context`
- Controls execution context for the command
- `fork` spawns a fresh, isolated subagent — it does NOT copy or branch the current conversation

**What the forked context receives:**
- Command/skill markdown content (with `$ARGUMENTS` substituted)
- CLAUDE.md project instructions and auto-memory
- Working directory and environment info
- Skill description list (standard system injection)

**What the forked context does NOT receive:**
- Conversation history (prior user/assistant messages)
- Any context from the parent conversation
- Loaded skills or state from the parent session

**When to use `context: fork`:**
- Self-contained operations that don't need conversation history (git commands, code analysis, pattern scanning)
- Commands where `$ARGUMENTS` provides all needed context
- Heavy-output commands that would pollute the main context window

**When NOT to use `context: fork`:**
- Commands that extract information from conversation history (e.g., requirements verification)
- Debugging commands that reference what the user was discussing
- Commands that explicitly say "analyze current conversation"

```yaml
---
context: fork  # Spawns fresh isolated context (no conversation history)
---
```

**Combine with `agent`** to control which agent type executes the fork:

```yaml
---
context: fork
agent: Explore  # Use Explore subagent for read-only research
---
```

#### `agent`
- Delegates command execution to a specific agent
- The agent must be defined and available

```yaml
---
agent: code-reviewer
---
```

#### `hooks`
- Configures lifecycle hooks for the command
- Hooks run shell commands at specific points during execution

```yaml
---
hooks:
  pre: "echo 'Starting command'"
  post: "echo 'Command complete'"
---
```

#### `memory`
- Controls memory scope for command execution

```yaml
---
memory: session
---
```

## Argument Handling

### Argument Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `$ARGUMENTS` | All arguments as single string | `/cmd foo bar` → `"foo bar"` |
| `$0` | First positional argument | `/cmd foo bar` → `"foo"` |
| `$1` | Second positional argument | `/cmd foo bar` → `"bar"` |
| `$2` | Third positional argument | etc. |
| `$N` | Nth positional argument (0-based) | Supports any position |
| `$ARGUMENTS[N]` | Array-style access (0-based) | Same as `$N` |

> **0-based indexing (v2.1.19+):** Positional arguments use 0-based indexing. `$0` is the first argument, `$1` is the second, etc.

### Substitution Variables

| Variable | Description |
|----------|-------------|
| `$ARGUMENTS` | All user-provided arguments |
| `$0`, `$1`, `$2`... | Positional arguments (0-based) |
| `${CLAUDE_SESSION_ID}` | Current session identifier |

### Usage Patterns

#### All Arguments
```markdown
Review this code and $ARGUMENTS
```

Invocation: `/review check for bugs and performance issues`
Result: `Review this code and check for bugs and performance issues`

#### Positional Arguments
```markdown
Fix issue #$0 with priority $1 assigned to $2
```

Invocation: `/fix-issue 123 high alice`
Result: `Fix issue #123 with priority high assigned to alice`

#### Mixed Usage
```markdown
Process PR #$0: $ARGUMENTS
```

Invocation: `/process-pr 456 check tests and lint`
Result: `Process PR #456: 456 check tests and lint`

Note: `$ARGUMENTS` includes all args, so `$0` will be in `$ARGUMENTS`

#### Conditional Text
```markdown
Review the code$( if $0 then echo " in $0" fi)
```

Note: Command files don't support shell conditionals directly. Use argument positions strategically.

## Special Features

### Bash Execution

Execute bash commands inline with `!` prefix followed by backticks:

```markdown
Current git status:
!`git status`

Recent changes:
!`git log --oneline -5`
```

**Rules:**
- Output captured and included in prompt
- Commands execute before Claude processes the prompt
- Requires `allowed-tools` permissions based on command type (see @QUALITY.md "Appropriate" Tool Permissions)
- Use backticks around the command
- Must be on its own line or clearly delimited

**Escaping in Auto-Loaded Skill Files:**

Auto-loaded files (SKILL.md) process both bang-tick execution and `$` variable substitution — even inside fenced code blocks.

**For `$` variables** — use echo-hex with `\x24` (works reliably):
```markdown
!`echo -e '\x24ARGUMENTS'`
!`echo -e '| \x60\x240\x60 | First positional argument |'`
```

**For bang-tick syntax** — the system re-escapes `!`` in echo output (adds `\` prefix). No workaround exists in auto-loaded files.

**Recommended:** Move code examples containing bang-tick or `$` variables to reference files (like this one). Reference files loaded via Read tool are not processed — all syntax displays literally. See the "Quick Reference Template" and "Common Patterns" sections below for examples using raw syntax.

**Example with Permissions:**
```yaml
---
allowed-tools: Bash(git status *), Bash(git log *)
---

Status: !`git status`
```

### File References

Include file contents with `@` prefix:

```markdown
Review @src/utils/helpers.js

Compare these two implementations:
@src/old-version.js
@src/new-version.js
```

**Rules:**
- File contents read at command execution
- Use relative or absolute paths
- Multiple files supported
- Files must be readable

### Extended Thinking

Commands can trigger extended thinking mode by including specific keywords in the prompt. This enables deeper analysis for complex tasks.

**Trigger phrases:**
- Include terms related to deep analysis, complex reasoning, or thorough review
- "ultrathink" triggers maximum extended thinking budget
- Extended thinking activates automatically when appropriate

## Namespacing

### Subdirectory Organization

```
.claude/commands/
├── git/
│   ├── commit.md      → /commit (project:git)
│   └── review.md      → /review (project:git)
├── frontend/
│   ├── component.md   → /component (project:frontend)
│   └── test.md        → /test (project:frontend)
└── optimize.md        → /optimize
```

**Behavior:**
- Command name derived from filename only
- Subdirectory shown as context in UI: `(project:frontend)`
- No `/frontend/component` syntax - just `/component`
- Prevents name collisions through organization
- Helps users find related commands

### Best Practices for Namespacing
- Group related commands in subdirectories
- Use clear, descriptive directory names
- Avoid deep nesting (1-2 levels max)
- Document namespace purpose in README

## Plugin Commands

### Syntax
```
/plugin-name:command-name
```

### Location
```
plugin-name/
└── commands/
    └── command-name.md
```

### Example
Plugin `my-tools` with `commands/format.md`:
- Invoked as: `/my-tools:format`
- Standard command syntax applies
- Scoped to plugin namespace

## MCP Commands

### Syntax
```
/mcp__<server-name>__<prompt-name>
```

### Characteristics
- Dynamically discovered from MCP servers
- Generated automatically
- Follow MCP server's prompt templates
- Cannot be edited locally

### Permission Pattern
```yaml
---
allowed-tools: mcp__github
---
```

**Important:** Wildcards not supported in MCP permissions. Use exact server names.

## Agent Skills Open Standard

Skills can be published and shared via the Agent Skills open standard (`agentskills.io`). This enables cross-tool interoperability for skill definitions.

## Quick Reference Template

```markdown
---
description: What this command does (10-50 words, action verb + domain context)
argument-hint: <required> [optional]
# Only add these if needed:
# allowed-tools: Tool1, Tool2(pattern *)   # Only if user requests restrictions
# model: sonnet                             # Only if specific model needed
# user-invocable: false                     # Only if model-only command
# context: fork                             # Only if isolated execution needed
---

Context from bash (optional):
!`git status -sb`

File reference (optional):
@$0

Instructions for Claude:
Do something specific with $ARGUMENTS
```

## Common Patterns

**Simple command (no args):**

```markdown
---
description: Run standard code review
---
Review the current codebase for quality, best practices, and issues.
```

**Command with arguments:**

```markdown
---
description: Create conventional commit
argument-hint: [scope or message]
---
Create a conventional commit.
Current status: !`git status -sb`
Additional context: $ARGUMENTS
```

**Positional arguments:**

```markdown
---
description: Review pull request
argument-hint: <pr-number> [focus-area]
---
Review PR #$0
PR details: !`gh pr view $0`
Focus on: $ARGUMENTS
```

## Complete Example

```markdown
---
description: Review PR with comprehensive checks
allowed-tools: Bash(gh pr view *)
argument-hint: [pr-number]
model: sonnet
---

Review Pull Request #$0

Current PR details:
!`gh pr view $0`

Perform the following checks:
1. Code quality and style
2. Test coverage
3. Documentation updates
4. Breaking changes
5. Security considerations

Focus areas: $ARGUMENTS
```

**Usage:**
```
/review-pr 123 focus on authentication changes
```

## Syntax Validation Checklist

**File Structure:**

- [ ] **File ends in `.md`**
  - How to verify: Check filename extension is `.md` not `.txt`, `.yaml`, or no extension

- [ ] **Frontmatter uses `---` delimiters**
  - How to verify: Line 1 is `---`, closing `---` present with blank line after
  - Run: `head -n 10 file.md | grep -c "^---$"` should return 2

**YAML Syntax:**

- [ ] **YAML properties properly indented (2 spaces)**
  - How to verify: Count spaces before properties - should be multiple of 2
  - Run: `grep $'\t' file.md | wc -l` should return 0 (no tabs)

- [ ] **Property values quoted if containing special chars**
  - How to verify: Check values with `: , [ ] { } # & * ! | > ' " % @ `` for quotes
  - Example: `description: "Uses * wildcard"` ✓, `description: Uses * wildcard` ✗

**Argument Syntax:**

- [ ] **Arguments use `$ARGUMENTS`, `$0`, `$1`, `$2`, etc. (0-based)**
  - How to verify: Search for `$` - only valid patterns present
  - Valid: `$ARGUMENTS`, `$0`, `$1`, `$2`, `$ARGUMENTS[0]`, `${CLAUDE_SESSION_ID}`
  - Invalid: `$ARG`, `$ARGS`, `${1}`, `$(1)`, `$arg1`
  - Run: `grep '$ARG[^U]' file.md` should return nothing
  - Run: `grep '\${[0-9]}' file.md` should return nothing

**Special Syntax:**

- [ ] **Bash commands use `!` + backtick syntax**
  - How to verify: Bash commands in prompt use `` !`command` `` not bare commands
  - Example: `` !`git status` `` ✓, `git status` ✗

- [ ] **File references use `@` prefix**
  - How to verify: Documentation references use `@filename.md`
  - Example: `@QUALITY.md` ✓, `QUALITY.md` ✗ (in references)

**Frontmatter Properties:**

- [ ] **Tool names in `allowed-tools` are correct**
  - How to verify: Tool names match available tools (case-sensitive)
  - Valid: `Bash(git *)`, `Read`, `Write`, `Edit`, `WebFetch`, `Skill(name)`
  - Check pattern syntax: `Tool(pattern *)` format (space-separated, not colon)

- [ ] **Model IDs are valid**
  - How to verify: Use aliases not full IDs
  - Valid: `sonnet`, `opus`, `haiku`, `default`, `inherit`
  - Invalid: `claude-sonnet-4-20241022`, `claude-*`

**Naming:**

- [ ] **No conflicting command names in scope**
  - How to verify: Check `.claude/commands/` for duplicate filenames
  - Run: `find .claude/commands -name "filename.md" | wc -l` should return 1
  - Check Claude Code slash command list for conflicts

## Common Syntax Errors

### Invalid YAML
```yaml
# WRONG - tabs used
---
description:	"My command"
---

# CORRECT - spaces used
---
description: "My command"
---
```

### Missing Delimiters
```markdown
# WRONG - missing closing delimiter
---
description: My command

Command text here
```

```markdown
# CORRECT
---
description: My command
---

Command text here
```

### Incorrect Argument Syntax
```markdown
# WRONG - shell syntax doesn't work
if [ -n "$0" ]; then
  echo "Got argument"
fi

# CORRECT - use arguments directly
Process $0 with the following options: $ARGUMENTS
```

### Invalid Tool Patterns
```yaml
# WRONG - colon separator (pre-v2.1.0 syntax)
allowed-tools: Bash(git status:*), Bash(git add:*)

# WRONG - no pattern delimiter
allowed-tools: Bash git status, Bash git add

# CORRECT - space separator (v2.1.0+)
allowed-tools: Bash(git status *), Bash(git add *)
```

## Edge Cases

### Empty Arguments
- `$ARGUMENTS` is empty string if no args provided
- `$0`, `$1` etc. are empty if not enough args
- Design prompts to handle missing arguments gracefully

### Special Characters in Arguments
- Arguments passed as-is
- Quote handling depends on shell invocation
- Complex arguments may need escaping

### Command Name Conflicts
- Personal commands shadow project commands with same name
- Plugin commands use namespace prefix to avoid conflicts
- Latest alphabetically wins for same-scope conflicts

### Hot-Reload Behavior
- **Skills** (`.claude/skills/`) hot-reload automatically when files change (v2.1.0+)
- **Legacy commands** (`.claude/commands/`) may require a session restart to pick up changes
- When in doubt, restart the session after modifying command files
