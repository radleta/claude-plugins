---
name: command-verification
description: "Validates Claude Code command files against the claude-command-builder framework including YAML syntax, argument handling, tool permissions, and description quality. Use when reviewing commands for correctness, validating slash command changes, or auditing command frontmatter — even for simple no-argument commands."
---

# Command Verification Methodology

## Purpose

Verify that Claude Code command files (.claude/commands/*.md) meet quality standards for YAML syntax, argument handling, tool permissions, and user discoverability. For skill file validation, use skill-verification instead.

## Detection Categories

### CM-01: YAML Syntax (CRITICAL)

- Opening `---` on line 1 (no blank lines or content before it)
- Closing `---` present with blank line after it
- 2-space indentation (never tabs)
- No blank lines within frontmatter block
- All property names are valid: `description`, `allowed-tools`, `model`, `argument-hint`, `disable-model-invocation`, `user-invocable`, `context`, `agent`, `hooks`, `memory`
- Values with special characters properly quoted (`: , [ ] { } # & * ! | >`)
- No trailing whitespace after values

### CM-02: Arguments (CRITICAL)

- Only valid argument variables used: `$ARGUMENTS`, `$0`, `$1`, `$2`, etc.
- Never uses invalid forms: `$ARG`, `$ARGS`, `${0}`, `${1}`, `$(1)`
- `argument-hint` present when `$ARGUMENTS` or positional args are used
- `argument-hint` format matches usage (`<arg0> <arg1>` for positional, `<args>` for $ARGUMENTS)
- `$ARGUMENTS` placed at end of prompt when used (ending bias for maximum impact)
- If no arguments used, no `argument-hint` in frontmatter

### CM-03: Description (HIGH)

- Description field present in frontmatter
- Word count: 10-50 words (under 10 is too vague, over 50 is excessive)
- Contains at least one action verb (analyze, create, review, deploy, test, generate, optimize, fix, refactor, validate, document, verify, run, build, check)
- Contains domain context (git, PR, code, test, API, file, security, performance, dependency, skill, agent, command, plan)
- No generic descriptions ("Does stuff", "Helps with things")
- Description accurately reflects what the command does

### CM-04: Tool Permissions (HIGH)

- `allowed-tools` omitted by default (best practice — Claude handles permissions via user prompts)
- If present: uses space-separated pattern syntax (`Bash(git *)` not `Bash(git:*)`)
- Tool restrictions match the command's actual needs (not over-restricted or under-restricted)
- Read-only commands restrict to: `Read, Glob, Grep, Bash` (with Bash limited to git or specific patterns)
- `Skill(name)` pattern used correctly if referencing specific skills

**Decision principle:** Only add `allowed-tools` when the command needs explicit sandboxing (e.g., forked read-only workers). Default is to omit entirely.

### CM-05: Structure (MEDIUM)

- Filename is descriptive and action-oriented (verb-noun format, kebab-case, lowercase)
- Filename does not conflict with existing commands in the same directory
- Single responsibility (command does one thing well)
- No shell logic in prompt body (no if/then/else/fi/case/while/for — let Claude handle conditionals)
- `@` prefix used for file references (e.g., `@QUALITY.md`)
- Model uses alias if specified (`sonnet`, `opus`, `haiku` — not full model ID)
- Location appropriate: project-specific in `.claude/commands/`, portable in `~/.claude/commands/`

**For the full decision matrix on tool permissions**, Read:
- `.claude/skills/claude-command-builder/QUALITY.md`

**For syntax reference**, Read:
- `.claude/skills/claude-command-builder/SYNTAX.md`

## Workflow

### Step 1: Gather Context

1. Read the command file(s) specified in the session summary or $ARGUMENTS
2. Parse YAML frontmatter (everything between opening and closing `---`)
3. Parse prompt body (everything after closing `---` and blank line)
4. List other commands in the same directory to check for name conflicts

### Step 2: Analyze

1. Check CM-01 (YAML syntax) — delimiter placement, indentation, valid properties
2. Check CM-02 (arguments) — variable syntax, hint presence, placement
3. Check CM-03 (description) — word count, action verb, domain context
4. Check CM-04 (tool permissions) — omitted vs present, pattern syntax, appropriateness
5. Check CM-05 (structure) — filename, single responsibility, no shell logic

### Step 3: Verdict

Determine **APPROVED** or **ISSUES_FOUND**.

- Any CRITICAL finding (CM-01, CM-02) → ISSUES_FOUND
- 2+ HIGH findings → ISSUES_FOUND
- Isolated HIGH or MEDIUM-only → APPROVED with recommendations

## Output Format

```
## Command Verification Report

**VERDICT: [APPROVED|ISSUES_FOUND]**
**File:** [path]
**Type:** [command|skill]

---

### Frontmatter Analysis
| Property | Value | Status |
|----------|-------|--------|
| description | [value or MISSING] | ✅/❌ |
| allowed-tools | [value or OMITTED] | ✅/❌/N/A |
| argument-hint | [value or OMITTED] | ✅/❌/N/A |
| model | [value or OMITTED] | ✅/❌/N/A |

### Arguments Analysis
**Variables found:** [list or none]
**Hint matches usage:** [yes/no/N/A]
**Placement:** [$ARGUMENTS at end: yes/no | N/A]

---

### Findings

#### CRITICAL
| Category | Location | Issue | Fix |
|----------|----------|-------|-----|

#### HIGH
| Category | Location | Issue | Fix |
|----------|----------|-------|-----|

#### MEDIUM
| Category | Location | Issue | Fix |
|----------|----------|-------|-----|

---

### Description Quality
**Word count:** [n] (target: 10-50)
**Action verb:** [found verb or MISSING]
**Domain context:** [found context or MISSING]

---

### Summary
**Overall:** [PROCEED / ADDRESS issues first]
```
