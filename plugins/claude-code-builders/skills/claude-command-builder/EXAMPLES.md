# Slash Command Examples

## Table of Contents

1. [Simple Commands](#simple-commands)
2. [Git Workflows](#git-workflows)
3. [Code Review](#code-review)
4. [Testing](#testing)
5. [Documentation](#documentation)
6. [Deployment](#deployment)
7. [Analysis & Refactoring](#analysis--refactoring)
8. [Advanced Patterns](#advanced-patterns)

## Simple Commands

**Complexity Legend:**
- 🟢 **Beginner** - Basic structure, no frontmatter or simple frontmatter, minimal logic
- 🟡 **Intermediate** - Frontmatter with arguments, file references, or bash commands
- 🔴 **Advanced** - Complex frontmatter, multiple arguments, tool permissions, conditional logic

### Basic Command (No Arguments)

**Complexity:** 🟢 Beginner

`.claude/commands/status.md`
```markdown
Provide a quick status update on:
1. Current git branch and status
2. Recent file changes
3. Any pending tasks or TODOs
```

**Usage:** `/status`

### Command with Open-Ended Arguments

**Complexity:** 🟢 Beginner

`.claude/commands/explain.md`
```markdown
---
description: Explain a concept or code pattern
argument-hint: [topic]
---

Provide a clear, concise explanation of: $ARGUMENTS
```

**Usage:**
- `/explain recursion`
- `/explain how redux middleware works`

### Command with File Reference

**Complexity:** 🟡 Intermediate

`.claude/commands/summarize.md`
```markdown
---
description: Summarize a file's purpose and key functions
argument-hint: <file-path>
---

Summarize @$0 including:
- Primary purpose
- Key functions/exports
- Dependencies
- Usage patterns
```

**Usage:** `/summarize src/utils/helpers.js`

## Git Workflows

### Conventional Commit

**Complexity:** 🔴 Advanced

`.claude/commands/git/commit.md`
```markdown
---
description: Create a conventional commit
argument-hint: [files or scope]
---

Create a conventional commit following the format:
type(scope): description

Current status:
!`git status -sb`

Staged changes:
!`git diff --cached --stat`

Consider: $ARGUMENTS

Use conventional commit types:
- feat: New feature
- fix: Bug fix
- docs: Documentation
- style: Formatting
- refactor: Code restructuring
- test: Adding tests
- chore: Maintenance
```

**Usage:**
- `/commit`
- `/commit focus on authentication module`
- `/commit fix user login bug`

### Review Pull Request

**Complexity:** 🔴 Advanced

`.claude/commands/git/review-pr.md`
```markdown
---
description: Comprehensive PR review with checklist
argument-hint: <pr-number>
# No allowed-tools - let Claude use gh and other tools as needed
---

Review Pull Request #$0

PR Information:
!`gh pr view $0`

Changed files:
!`gh pr diff $0 --name-only`

Perform comprehensive review covering:

1. Code Quality
   - Readability and clarity
   - Consistent style
   - Proper error handling
   - No code smells

2. Functionality
   - Logic correctness
   - Edge cases handled
   - Performance considerations

3. Testing
   - Tests included
   - Coverage adequate
   - Test quality

4. Documentation
   - Code comments where needed
   - README updates
   - API docs updated

5. Security
   - No obvious vulnerabilities
   - Input validation
   - Sensitive data handling

Additional focus: $ARGUMENTS
```

**Usage:**
- `/review-pr 123`
- `/review-pr 123 focus on security and performance`

### Sync Branch

`.claude/commands/git/sync.md`
```markdown
---
description: Sync current branch with main
---

Sync current branch with latest main branch:

Current branch:
!`git branch --show-current`

Status:
!`git status -sb`

Steps:
1. Fetch latest changes
2. Rebase or merge with main
3. Resolve any conflicts
4. Verify sync successful

Additional instructions: $ARGUMENTS
```

**Usage:**
- `/sync`
- `/sync use merge instead of rebase`

## Code Review

### Security Review

`.claude/commands/review/security.md`
```markdown
---
description: Security-focused code review
argument-hint: [file-pattern or directory]
---

Perform security review of $ARGUMENTS

Check for:

1. Input Validation
   - User input sanitization
   - SQL injection risks
   - XSS vulnerabilities
   - Command injection

2. Authentication & Authorization
   - Proper auth checks
   - Role-based access
   - Token handling
   - Session management

3. Data Protection
   - Sensitive data encryption
   - Secure storage
   - No hardcoded secrets
   - Proper env var usage

4. Dependencies
   - Known vulnerabilities
   - Outdated packages
   - Unused dependencies

5. Error Handling
   - No information leakage
   - Proper logging
   - Safe error messages
```

**Usage:**
- `/security`
- `/security src/api/`
- `/security focus on authentication flow`

### Performance Review

`.claude/commands/review/performance.md`
```markdown
---
description: Analyze code for performance issues
argument-hint: [scope]
---

Analyze for performance issues: $ARGUMENTS

Focus areas:

1. Algorithmic Complexity
   - Inefficient loops
   - N+1 queries
   - Redundant operations

2. Resource Usage
   - Memory leaks
   - Excessive allocations
   - Large object creation

3. I/O Operations
   - Blocking operations
   - Missing caching
   - Inefficient queries

4. Rendering (Frontend)
   - Unnecessary re-renders
   - Missing memoization
   - Large bundle sizes

Provide specific optimization recommendations with code examples.
```

**Usage:**
- `/performance`
- `/performance src/components/Dashboard.tsx`

## Testing

### Run Tests for Changed Files

**Complexity:** 🔴 Advanced

`.claude/commands/testing/test-changed.md`
```markdown
---
description: Run tests for modified files
---

Identify changed files and run relevant tests:

Changed files:
!`git diff --name-only HEAD`

Staged files:
!`git diff --cached --name-only`

Run appropriate tests and report:
- Which tests ran
- Pass/fail status
- Any failures with details
- Coverage impact

$ARGUMENTS
```

**Usage:**
- `/test-changed`
- `/test-changed run in watch mode`

### Generate Test Cases

`.claude/commands/testing/generate-tests.md`
```markdown
---
description: Generate test cases for a function or module
argument-hint: <file-path>
---

Generate comprehensive test cases for @$0

Include:

1. Happy Path Tests
   - Normal operation
   - Expected inputs
   - Valid outputs

2. Edge Cases
   - Boundary values
   - Empty inputs
   - Null/undefined
   - Maximum values

3. Error Cases
   - Invalid inputs
   - Error conditions
   - Exception handling

4. Integration Cases
   - Interaction with dependencies
   - State changes
   - Side effects

Use the project's testing framework and follow existing patterns.

Additional requirements: $ARGUMENTS
```

**Usage:**
- `/generate-tests src/utils/validation.js`
- `/generate-tests src/api/users.ts include integration tests`

### Coverage Report

`.claude/commands/testing/coverage.md`
```markdown
---
description: Analyze test coverage and suggest improvements
# No allowed-tools - let Claude use test runners and Read as needed
---

Analyze test coverage:

!`npm run test:coverage`

Review coverage report and:
1. Identify uncovered code paths
2. Suggest tests for critical uncovered code
3. Analyze coverage trends
4. Recommend coverage improvements

Focus: $ARGUMENTS
```

**Usage:**
- `/coverage`
- `/coverage focus on API layer`

## Documentation

### Generate API Docs

`.claude/commands/docs/api.md`
```markdown
---
description: Generate API documentation from code
argument-hint: <file-path>
---

Generate API documentation for @$0

Include:

## Overview
Brief description of the module/API

## Exports

### Functions
For each function:
- Signature with types
- Parameters (name, type, description)
- Return value (type, description)
- Examples
- Throws/Errors

### Classes
For each class:
- Constructor parameters
- Public methods
- Properties
- Usage examples

### Types/Interfaces
- Type definitions
- Field descriptions
- Usage examples

## Examples
Real-world usage scenarios

Additional focus: $ARGUMENTS
```

**Usage:**
- `/api src/api/users.ts`
- `/api src/utils/helpers.js include implementation details`

### Update README

`.claude/commands/docs/readme.md`
```markdown
---
description: Update README with recent changes
---

Update README based on recent changes:

Recent commits:
!`git log --oneline -10`

Review current README and update:

1. Installation instructions
2. Usage examples
3. API changes
4. New features
5. Configuration options
6. Breaking changes

Maintain existing structure and style.

Additional sections: $ARGUMENTS
```

**Usage:**
- `/readme`
- `/readme add deployment section`

## Deployment

### Deploy to Environment

**Complexity:** 🔴 Advanced

`.claude/commands/deploy/deploy.md`
```markdown
---
description: Deploy application to specified environment
argument-hint: <environment: staging|production>
# Note: No allowed-tools - let Claude use what's needed for deployment
# Only add if user explicitly requests restrictions
---

Deploy to $0 environment

Pre-deployment checks:
1. All tests passing
2. No uncommitted changes
3. Version updated
4. Changelog updated

Current status:
!`git status -sb`

Latest commit:
!`git log -1 --oneline`

Proceed with deployment to $0:
1. Build production bundle
2. Run pre-deployment tests
3. Deploy to $0
4. Run smoke tests
5. Verify deployment

Additional instructions: $ARGUMENTS
```

**Usage:**
- `/deploy staging`
- `/deploy production skip smoke tests`

### Rollback Deployment

`.claude/commands/deploy/rollback.md`
```markdown
---
description: Rollback to previous deployment
argument-hint: <environment>
---

Rollback deployment on $0

Recent deployments:
!`git log --grep="deploy" --oneline -5`

Steps:
1. Identify last stable version
2. Prepare rollback
3. Execute rollback to $0
4. Verify rollback successful
5. Document incident

Reason for rollback: $ARGUMENTS
```

**Usage:**
- `/rollback production database connection issues`

## Analysis & Refactoring

### Analyze Dependencies

`.claude/commands/analyze/deps.md`
```markdown
---
description: Analyze project dependencies
---

Analyze project dependencies:

Current dependencies:
!`npm list --depth=0`

Check for:

1. Unused Dependencies
   - Packages not imported
   - Dev dependencies in production
   - Duplicates

2. Outdated Packages
   - Security vulnerabilities
   - Major version updates
   - Breaking changes

3. Bundle Size Impact
   - Large dependencies
   - Tree-shaking opportunities
   - Alternative lighter packages

4. Dependency Health
   - Maintenance status
   - Community support
   - Known issues

Focus: $ARGUMENTS
```

**Usage:**
- `/deps`
- `/deps focus on security vulnerabilities`

### Refactor Pattern

`.claude/commands/refactor/pattern.md`
```markdown
---
description: Refactor code to use a specific pattern
argument-hint: <pattern-name> <file-path>
---

Refactor @$1 to use $0 pattern

Steps:

1. Analyze Current Implementation
   - Identify code structure
   - Note dependencies
   - Document current behavior

2. Design Refactoring
   - Apply $0 pattern
   - Maintain functionality
   - Improve code quality

3. Implement Changes
   - Refactor step by step
   - Preserve tests
   - Update documentation

4. Validate
   - Ensure tests pass
   - Verify functionality
   - Check for improvements

Additional requirements: $ARGUMENTS
```

**Usage:**
- `/refactor strategy-pattern src/payment/processor.js`
- `/refactor factory-pattern src/components/Button.tsx maintain backwards compatibility`

### Find Code Duplicates

`.claude/commands/analyze/duplicates.md`
```markdown
---
description: Find and suggest fixes for code duplication
argument-hint: [directory]
---

Find code duplication in $ARGUMENTS

Analyze:

1. Exact Duplicates
   - Identical code blocks
   - Copy-paste violations

2. Similar Patterns
   - Nearly identical functions
   - Repeated logic
   - Similar algorithms

3. Opportunities for Abstraction
   - Common patterns
   - Shared utilities
   - Reusable components

For each duplicate found:
- Show locations
- Suggest extraction method
- Provide refactored example
```

**Usage:**
- `/duplicates src/`
- `/duplicates focus on utility functions`

## Advanced Patterns

### Multi-Step Workflow

`.claude/commands/workflows/new-feature.md`
```markdown
---
description: Guide through new feature implementation
argument-hint: <feature-name>
---

Implement new feature: $0

Follow this workflow:

## 1. Planning
- [ ] Define feature requirements
- [ ] Identify affected components
- [ ] Design API/interface
- [ ] Plan tests

## 2. Implementation
- [ ] Create feature branch
- [ ] Implement core functionality
- [ ] Add error handling
- [ ] Write tests

## 3. Documentation
- [ ] Add code comments
- [ ] Update README
- [ ] Write API docs
- [ ] Add usage examples

## 4. Review
- [ ] Self-review checklist
- [ ] Run all tests
- [ ] Check coverage
- [ ] Performance check

## 5. Integration
- [ ] Create pull request
- [ ] Address review comments
- [ ] Merge to main
- [ ] Deploy to staging

Additional considerations: $ARGUMENTS
```

**Usage:**
- `/new-feature user-authentication`
- `/new-feature dark-mode include accessibility checks`

### Context-Rich Analysis

`.claude/commands/analyze/architecture.md`
```markdown
---
description: Analyze project architecture
---

Analyze project architecture:

Project structure:
!`find . -type f -name "*.js" -o -name "*.ts" | head -20`

Package info:
!`cat package.json | grep -A 10 "dependencies"`

Analyze:

1. Architecture Patterns
   - MVC, MVVM, Clean Architecture
   - Layering approach
   - Separation of concerns

2. Module Organization
   - Directory structure
   - Module boundaries
   - Import patterns

3. Data Flow
   - State management
   - Data fetching
   - Event handling

4. Dependencies
   - Inter-module dependencies
   - Circular dependencies
   - Coupling analysis

5. Scalability
   - Current limitations
   - Growth considerations
   - Refactoring opportunities

Focus: $ARGUMENTS
```

**Usage:**
- `/architecture`
- `/architecture focus on state management`

### Conditional Model Selection

`.claude/commands/quick-fix.md`
```markdown
---
description: Quick bug fix with fast model
model: haiku
argument-hint: <issue-description>
---

Quick fix for: $ARGUMENTS

Focus on:
- Identifying the issue
- Minimal code change
- Fast turnaround
- Basic testing
```

**Usage:** `/quick-fix login button not responsive`

vs.

`.claude/commands/complex-refactor.md`
```markdown
---
description: Complex refactoring with advanced reasoning
model: sonnet
argument-hint: <scope>
---

Complex refactoring of: $ARGUMENTS

Perform deep analysis:
- Architecture implications
- Multiple refactoring strategies
- Trade-off analysis
- Comprehensive testing plan
```

**Usage:** `/complex-refactor entire authentication system`

### Combining Bash and File References

`.claude/commands/compare-implementations.md`
```markdown
---
description: Compare two implementations
argument-hint: <file1> <file2>
---

Compare implementations:

File 1: @$0
File 2: @$1

Git diff (if in version control):
!`git diff --no-index $0 $1 || echo "Not in git"`

Analysis:

1. Functional Differences
   - What each does differently
   - Edge case handling
   - Error handling

2. Performance
   - Time complexity
   - Space complexity
   - Optimization opportunities

3. Code Quality
   - Readability
   - Maintainability
   - Best practices

4. Recommendation
   - Which is better and why
   - Hybrid approach if applicable
   - Refactoring suggestions
```

**Usage:** `/compare-implementations src/old-auth.js src/new-auth.js`

## Template Library

### Minimal Template

```markdown
Brief instruction for Claude
```

### Standard Template

```markdown
---
description: What this command does
argument-hint: [expected-arguments]
---

Command instructions with $ARGUMENTS
```

### Full-Featured Template

```markdown
---
description: What this command does
argument-hint: <required> [optional]
model: sonnet
# allowed-tools: Only add if user explicitly requests restrictions
---

Context from bash:
!`command here`

File reference:
@$0

Detailed instructions:
1. Step one
2. Step two
3. Step three

Additional context: $ARGUMENTS
```

## Command Composition Examples

### Chain Commands Conceptually

While you can't literally pipe commands, you can design them to work together:

```markdown
# /list-todos - outputs TODO locations
!`grep -r "TODO" src/ | cut -d: -f1 | sort -u`
```

```markdown
# /fix-todo - fixes a specific TODO
Review TODO in @$0 and implement the fix
```

**Usage:**
```
/list-todos
# Review output
/fix-todo src/components/Header.tsx
```

### Reference Previous Context

```markdown
# /start-feature
Create feature branch for: $ARGUMENTS
Document initial requirements and architecture decisions.
```

```markdown
# /continue-feature
Continue working on the current feature.
Review previous context and progress to next step.
```

## Troubleshooting Examples

### Debug Command That Won't Run

```markdown
---
description: Test command syntax and execution
---

Testing command execution:

Current directory: !`pwd`
Git status: !`git status -sb`
Environment: !`echo $SHELL`

Arguments received: $ARGUMENTS
Argument 0: $0
Argument 1: $1

If you see this output, the command is working!
```

### Validate YAML Frontmatter

Create a test command with intentional errors to understand validation:

```markdown
---
description: Test YAML parsing
model: sonnet
test-invalid-key: this should be ignored
# Note: No allowed-tools unless user requests restrictions
---

If this command runs, YAML is valid.
Unknown keys are ignored gracefully.
```

## Real-World Team Commands

These examples are based on common team workflows:

### Daily Standup Prep

`.claude/commands/team/standup.md`
```markdown
---
description: Prepare daily standup update
---

Prepare standup update:

My commits since yesterday:
!`git log --author="$(git config user.name)" --since="yesterday" --oneline`

Provide standup summary:

Yesterday:
- Key accomplishments
- Commits made
- PRs created/reviewed

Today:
- Planned work
- Priorities

Blockers:
- Any impediments

Additional notes: $ARGUMENTS
```

### Code Freeze Checklist

`.claude/commands/release/freeze.md`
```markdown
---
description: Pre-release code freeze checklist
---

Code Freeze Checklist for Release:

Recent changes:
!`git log --oneline -20`

Tests:
!`npm test 2>&1 | tail -10`

Verify:
- [ ] All tests passing
- [ ] No critical bugs
- [ ] Documentation updated
- [ ] CHANGELOG updated
- [ ] Version bumped
- [ ] Dependencies updated
- [ ] Security audit passed
- [ ] Performance benchmarks met

Additional checks: $ARGUMENTS
```

---

## Modern Features Examples

### Using `context: fork`

**Good use — self-contained operation (all context via `$ARGUMENTS`):**

`.claude/commands/commit.md`
```markdown
---
description: Create conventional commit with smart staging triage
context: fork
argument-hint: [additional context]
---

Analyze staged changes and create a conventional commit.

Additional context: $ARGUMENTS
```

**Why this works:** The command reads git state directly (staged changes, commit history). It doesn't need to know what was discussed in the conversation. `$ARGUMENTS` provides any additional context the user wants to pass.

<example type="negative">

**Bad use — command needs conversation history:**

`.claude/commands/verify-conversation.md`
```markdown
---
description: Verify conversation-based requirements coverage
context: fork          # ❌ WRONG — this command needs conversation context
argument-hint: [context]
---

Extract all requirements from conversation context and verify implementation.
```

**Why this fails:** The command explicitly extracts requirements from conversation history. With `context: fork`, it spawns a fresh context with NO conversation history — it can't see what requirements were discussed.

</example>

**Key insight:** `context: fork` does NOT copy the conversation — it spawns a completely fresh subagent. Only use it when `$ARGUMENTS` + file system provide everything the command needs.

### Using `${CLAUDE_SESSION_ID}`

`.claude/commands/log-action.md`
```markdown
---
description: Log action with session tracking
argument-hint: <action-description>
---

Log this action for session ${CLAUDE_SESSION_ID}:

Action: $ARGUMENTS

Record with timestamp and session context.
```

**Usage:** `/log-action deployed v2.3.1 to staging`

### Using `hooks`

`.claude/commands/guarded-deploy.md`
```markdown
---
description: Deploy with pre/post hooks
hooks:
  pre: "npm test"
  post: "echo 'Deploy complete' | tee deploy.log"
argument-hint: <environment>
---

Deploy to $0 environment with automated pre/post checks.

The pre-hook runs tests before deployment starts.
The post-hook logs the completion.
```

**Usage:** `/guarded-deploy staging`

### Using `user-invocable` Control

`.claude/commands/internal/auto-format.md`
```markdown
---
description: Auto-format code on save (model-only)
user-invocable: false
---

Format the current file according to project conventions.
This command is invoked automatically by the model, not directly by users.
```

---

## Anti-Patterns to Avoid

This section shows common mistakes and why they're problematic. Learn from these anti-patterns to avoid them in your own commands.

### ❌ Anti-Pattern #1: Too Many Responsibilities

**BAD EXAMPLE:**
`.claude/commands/do-everything.md`
```markdown
---
description: Do all git operations
allowed-tools: Bash(git *), Bash(npm *), Bash(curl *), WebFetch
---

1. Check git status
2. Run tests
3. Create commit with: $0
4. Push to remote
5. Create pull request
6. Notify team via webhook
7. Update documentation
```

**Problems:**
- Single command does 7 different things
- Hard to debug when one step fails
- Can't reuse individual steps
- Violates single responsibility principle
- Overly broad permissions (Bash(git *) instead of specific)
- Unnecessary allowed-tools for safe operations (git status, tests)
- Should omit allowed-tools entirely or only specify truly destructive ops (git push, WebFetch)

**BETTER:** Create separate commands:
- `/git-status` - Check status only
- `/test` - Run tests only
- `/commit` - Create commit only
- `/push` - Push to remote only
- `/create-pr` - Create PR only

---

### ❌ Anti-Pattern #2: Invalid YAML Syntax

**BAD EXAMPLE:**
`.claude/commands/broken.md`
```markdown
---
description:Create a commit
argument-hint:<message>
allowed-tools:Bash(git commit *)
model:claude-sonnet-4-20241022
---
```

**Problems:**
- Missing space after colons (`: `)
- Using full model ID instead of alias
- Will fail to parse

**BETTER:**
```markdown
---
description: Create a commit
argument-hint: <message>
model: sonnet
---
```

**Note:** `allowed-tools` omitted - git commit is a safe local operation (see @QUALITY.md decision matrix)

---

### ❌ Anti-Pattern #3: Wrong Argument Syntax

**BAD EXAMPLE:**
`.claude/commands/bad-args.md`
```markdown
Review pull request #$ARG with focus on ${2}
```

**Problems:**
- `$ARG` is not valid (should be `$ARGUMENTS`)
- `${2}` is bash syntax, not slash command syntax (should be `$1`)
- Will not be substituted correctly

**BETTER:**
```markdown
---
argument-hint: <pr-number> [focus-area]
---

Review pull request #$0

Focus area: $ARGUMENTS
```

---

### ❌ Anti-Pattern #4: Missing Required Permissions

**BAD EXAMPLE:**
`.claude/commands/deploy.md`
```markdown
Deploy to production:

!`npm run build`
!`git push origin main`
!`kubectl apply -f deployment.yaml`
```

**Problems:**
- No `allowed-tools` frontmatter
- Destructive operations will prompt for permission every time
- No safety guardrails
- Interrupts automated workflows

**BETTER:**
```markdown
---
description: Deploy to production with safety checks
# No allowed-tools - let Claude use what's needed for deployment
# Only add if user explicitly requests restrictions
---

Deploy to production:

!`npm run build`
!`git push origin main`
!`kubectl apply -f deployment.yaml`
```

---

### ❌ Anti-Pattern #5: Overly Broad Tool Permissions

**BAD EXAMPLE:**
```yaml
---
description: Simple git status command
allowed-tools: Bash(*)
---
```

**Problems:**
- `Bash(*)` grants permission to ANY bash command
- Security risk - command could execute `rm -rf /`
- Over-permissive for a simple read-only operation
- Violates principle of least privilege

**BETTER:**
```markdown
---
description: Simple git status command
# No allowed-tools needed for safe operations
---

Show git status:
!`git status -sb`
```

**Note:** Don't add `allowed-tools` for read-only git operations - they're safe and don't need restrictions

---

### ❌ Anti-Pattern #6: Unclear or Missing Description

**BAD EXAMPLE:**
```yaml
---
description: Does stuff
---
```

or

```markdown
# No frontmatter at all
Do some git things with $ARGUMENTS
```

**Problems:**
- "Does stuff" tells user nothing
- Can't discover what command does
- Missing description means no auto-complete help
- Wastes user time figuring out purpose

**BETTER:**
```yaml
---
description: Create a conventional commit with automated changelog entry
argument-hint: [commit message]
---
```

---

### ❌ Anti-Pattern #7: Shell Logic in Prompt

**BAD EXAMPLE:**
```markdown
if [ -f "package.json" ]; then
  npm test
else
  echo "No package.json found"
fi
```

**Problems:**
- Shell syntax (if/then/else) doesn't belong in command prompts
- Won't execute as intended
- Claude is not a bash shell
- Should be in separate bash script if needed

**BETTER:**
```markdown
---
# No allowed-tools - let Claude use npm test as needed
---

Run tests if package.json exists:

!`test -f package.json && npm test || echo "No package.json found"`
```

Or even better, let Claude handle logic:
```markdown
Check if package.json exists. If it does, run npm test. If not, explain that tests are not available.
```

---

### ❌ Anti-Pattern #8: Argument Repetition

**BAD EXAMPLE:**
```markdown
Create a plan for: $ARGUMENTS

[... 100 lines of instructions ...]

Make sure to address all aspects of: $ARGUMENTS

[... more instructions ...]

Final considerations for: $ARGUMENTS
```

**Problems:**
- Wastes tokens with repetition (same text copied 3x)
- Dilutes importance across mentions
- Inefficient prompt structure
- Costs more to process

**BETTER:**
```markdown
Create a comprehensive plan addressing: $ARGUMENTS

[... all instructions in one place ...]
```

---

### ❌ Anti-Pattern #9: No Argument Hints

**BAD EXAMPLE:**
```markdown
---
description: Review pull request
---

Review PR #$0 from $1 with focus on $2
```

**Problems:**
- User has no idea what arguments are needed
- No auto-complete hints
- Trial and error required
- Poor user experience

**BETTER:**
```markdown
---
description: Review pull request with specific focus
argument-hint: <pr-number> <author> [focus-area]
---

Review PR #$0 from $1

Focus area: $ARGUMENTS
```

---

### ❌ Anti-Pattern #10: Confusing File Locations

**BAD EXAMPLE:**
```
~/.claude/commands/team-deploy.md  (personal directory)
```

**Problems:**
- Team command in personal directory
- Other team members won't have access
- Can't be version controlled with project
- Inconsistent across team

**BETTER:**
```
.claude/commands/team-deploy.md  (project directory)
```

Then commit to git so entire team has access.

---

## Summary: Anti-Pattern Checklist

Before creating a command, ensure you're NOT doing any of these:

- [ ] Multiple responsibilities in one command
- [ ] Invalid YAML syntax (missing spaces, wrong format)
- [ ] Wrong argument syntax ($ARG, ${1} instead of $ARGUMENTS, $0)
- [ ] Missing permissions for destructive/network operations
- [ ] Overly broad permissions (Bash(*) instead of specific)
- [ ] Unclear or missing description
- [ ] Shell logic (if/then/else) in prompt
- [ ] Repeated $ARGUMENTS throughout prompt
- [ ] No argument hints when using $0, $1, etc.
- [ ] Wrong file location (personal vs project)

If you find yourself doing any of these, refer to the examples above for better patterns.

---

For more information:
- Syntax details: See SYNTAX.md
- Best practices: See TIPS.md
- Quality standards: See @QUALITY.md
- Official docs: https://docs.claude.com/en/docs/claude-code/slash-commands.md
