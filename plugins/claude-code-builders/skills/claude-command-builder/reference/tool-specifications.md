# Tool Specifications for Commands

> Tools used during command creation and tools referenced in `allowed-tools`. Referenced from SKILL.md.

## Tools Used for Command Creation

These are tools the command builder agent uses when creating/editing command files.

### Read - Reading existing command files
- **When to use:** Examining existing commands, reviewing file structure
- **Pattern:** `Read` (no special permissions needed)
- **Example:** Reading .claude/commands/*.md to understand patterns

### Write - Creating new command files
- **When to use:** Creating new .claude/commands/*.md files from scratch
- **Pattern:** `Write` (no special permissions needed)
- **Example:** Writing new /deploy.md command file

### Edit - Modifying existing command files
- **When to use:** Updating frontmatter, fixing syntax, adjusting arguments
- **Pattern:** `Edit` (no special permissions needed)
- **Example:** Changing allowed-tools in existing command

### Glob - Finding command files by pattern
- **When to use:** Discovering existing commands, checking for name conflicts
- **Pattern:** `Glob("**/*.md")` in .claude/commands/
- **Example:** Finding all git-related commands

### Grep - Searching command content
- **When to use:** Finding examples of patterns, locating argument usage
- **Pattern:** `Grep` with regex patterns
- **Example:** Searching for all uses of $ARGUMENTS

## Tools Commands Typically Reference

These are tools that COMMANDS (the files you create) will reference in their `allowed-tools` frontmatter.

### Bash(pattern *) - Execute bash commands
- **When to use in commands:** git operations, npm scripts, file operations, system commands
- **Risk level:** HIGH (destructive potential)
- **Pattern examples:**
  - `Bash(git add *)` - Specific git add commands
  - `Bash(git commit *)` - Specific git commit commands
  - `Bash(npm test *)` - Specific npm test commands
  - `Bash(git push *)` - Specific git push (HIGH RISK)
  - `Bash(rm *)` - File deletion (CRITICAL RISK)
- **Decision matrix:** See @QUALITY.md "Appropriate" Tool Permissions

### WebFetch - Fetch content from URLs
- **When to use in commands:** API calls, fetching documentation, accessing web resources
- **Risk level:** HIGH (network access, potential data exfiltration)
- **Pattern:** `WebFetch` (no pattern matching)
- **Requires:** Explicit allowed-tools for any URL fetching

### Read, Write, Edit, Glob, Grep - File operations
- **When to use in commands:** File analysis, code generation, automated edits
- **Risk level:** MEDIUM to HIGH (depending on write vs read)
- **Pattern:** Generally no pattern matching needed
- **Note:** Read-only operations (Read, Glob, Grep) often don't need allowed-tools

### Skill(name) - Invoke other skills
- **When to use in commands:** Delegating to specialized skills, chaining skill workflows
- **Risk level:** LOW to MEDIUM (depends on target skill)
- **Pattern:** `Skill(skill-name)` for specific skill invocation
- **Example:** `Skill(claude-skill-builder)` to invoke skill creation within a command

## Tool Permission Guidance

See @QUALITY.md "Appropriate" Tool Permissions for the complete decision matrix.

**Key principle:** Default is to OMIT `allowed-tools` entirely. Only add when the user explicitly requests restrictions.

## Permission Pattern Examples

### Example 1: Default - No restrictions (BEST PRACTICE)

```yaml
---
description: Analyze code for potential improvements
# (no allowed-tools - let Claude use what's needed)
---
```

### Example 2: Default - Git command (BEST PRACTICE)

```yaml
---
description: Create conventional commit
# (no allowed-tools - even for git operations)
---
```

### Example 3: Default - Deployment (BEST PRACTICE)

```yaml
---
description: Deploy to production
# (no allowed-tools - even for deployment)
---
```

### Example 4: User-requested restriction (user asked for read-only)

```yaml
---
description: Analyze codebase (read-only per user request)
allowed-tools: Read, Grep, Glob
# Only because user said: "Make this read-only"
---
```

### Example 5: User-requested restriction (user asked to limit to git)

```yaml
---
description: Git operations only (per user request)
allowed-tools: Bash(git *)
# Only because user said: "Restrict this to git only"
---
```

### Example 6: User-requested restriction (specific git operations)

```yaml
---
description: Commit and push workflow (restricted per user request)
allowed-tools: Bash(git add *), Bash(git commit *), Bash(git push *)
# Only because user said: "Only allow git add, commit, and push"
---
```

### Example 7: User-requested skill invocation

```yaml
---
description: Build and validate a new skill
allowed-tools: Read, Write, Edit, Skill(claude-skill-builder)
# Only because user said: "Restrict to file ops and skill builder"
---
```
