# EXAMPLES.md Navigation Guide

**Purpose:** Help agents quickly find relevant examples in EXAMPLES.md without reading the entire file.

---

## Decision Matrix: Which Examples to Read

| Your Task | Example Section to Read | Line Range | Why Read This Section |
|-----------|------------------------|------------|----------------------|
| **Creating simple command (no args)** | Simple Commands → Basic Command | Lines 21-34 | Shows minimal viable command structure |
| **Creating command with arguments** | Simple Commands → Open-Ended Arguments | Lines 36-52 | Shows $ARGUMENTS pattern |
| **Creating git commit command** | Git Workflows → Conventional Commit | Lines 75-111 | Complete git commit example with bash execution |
| **Creating PR review command** | Git Workflows → Review Pull Request | Lines 113-166 | Shows positional args ($0) + bash + criteria |
| **Creating security review** | Code Review → Security Review | Lines 198-244 | Comprehensive security checklist pattern |
| **Creating test command** | Testing → Generate Test Cases | Lines 318-360 | Shows test generation with edge cases |
| **Creating deploy command** | Deployment → Deploy to Environment | Lines 470-510 | Shows deployment with pre-flight checks |
| **Using context: fork** | Modern Features → context: fork | Lines 1028-1068 | Isolated execution (positive + negative examples) |
| **Using ${CLAUDE_SESSION_ID}** | Modern Features → Session ID | Lines 1070-1086 | Session tracking variable |
| **Using hooks** | Modern Features → hooks | Lines 1088-1106 | Pre/post lifecycle hooks |
| **Using user-invocable** | Modern Features → user-invocable | Lines 1108-1130 | Model-only commands |
| **Finding anti-patterns** | Anti-Patterns to Avoid | Lines 1102-1430 | Shows what NOT to do with 10 anti-patterns |
| **Learning allowed-tools usage** | Anti-Pattern #1 & #5 | Lines 1106-1130, 1230-1260 | DEFAULT (omit) vs user-requested patterns |
| **Creating read-only command** | Anti-Pattern #5 notes | Lines 1230-1260 | User asked for read-only restrictions |
| **Multi-step workflow** | Advanced Patterns → Multi-Step Workflow | Lines 661-710 | Complex workflow with phases |
| **Need ALL anti-patterns** | Anti-Pattern Summary Checklist | Lines 1416-1430 | Quick checklist of all mistakes to avoid |

---

## Search Strategy

**Use Grep for fast pattern matching:**

```bash
# Find examples using specific feature
grep -n "allowed-tools" EXAMPLES.md    # Find tool permission examples
grep -n "\$ARGUMENTS" EXAMPLES.md      # Find argument handling examples
grep -n "!\`" EXAMPLES.md             # Find bash execution examples
grep -n "argument-hint" EXAMPLES.md    # Find argument hint examples
grep -n "context: fork" EXAMPLES.md    # Find isolated context examples
grep -n "CLAUDE_SESSION_ID" EXAMPLES.md # Find session ID examples
grep -n "hooks:" EXAMPLES.md           # Find hooks examples
grep -n "user-invocable" EXAMPLES.md   # Find invocation control examples

# Find examples by command type
grep -n "git" EXAMPLES.md              # Git-related examples
grep -n "deploy" EXAMPLES.md           # Deployment examples
grep -n "test" EXAMPLES.md             # Testing examples
grep -n "review" EXAMPLES.md           # Review/analysis examples
```

---

## Most Common Use Cases

### Use Case 1: "I need an example like what I'm creating"

**Decision Tree:**

```
What type of command?
├─ Git operation → Read lines 73-195 (Git Workflows section)
├─ Code review → Read lines 196-284 (Code Review section)
├─ Testing → Read lines 285-386 (Testing section)
├─ Documentation → Read lines 387-467 (Documentation section)
├─ Deployment → Read lines 468-537 (Deployment section)
├─ Analysis/Refactoring → Read lines 538-658 (Analysis section)
├─ Complex multi-step → Read lines 659-844 (Advanced Patterns section)
└─ Modern features (fork, hooks, session) → Read lines 1028-1101 (Modern Features)
```

### Use Case 2: "I want to avoid mistakes"

**Action:** Read Anti-Patterns section (lines 1102-1430)

**Priority anti-patterns:**
- Anti-Pattern #1: Too many responsibilities (lines 1106-1140)
- Anti-Pattern #3: Wrong argument syntax (lines 1174-1198)
- Anti-Pattern #4: Missing required permissions (lines 1200-1232)
- Anti-Pattern #10: Confusing file locations (lines 1394-1414)

### Use Case 3: "I need modern feature examples"

**Action:** Read Modern Features section (lines 1028-1130)

- `context: fork` — isolated execution (positive + negative examples, decision framework)
- `${CLAUDE_SESSION_ID}` — session tracking
- `hooks` — pre/post lifecycle hooks
- `user-invocable: false` — model-only commands

### Use Case 4: "I don't know what section I need"

**Action:** Use grep to search for keywords, then read that section

Example:
```bash
# I need examples of pr review
grep -n "pull request" EXAMPLES.md
# Returns matches in Git Workflows section
# Read that section
```

---

## Reading Order Recommendations

**For comprehensive learning (read sequentially):**
1. Table of Contents (lines 3-13)
2. Complexity Legend (lines 15-20)
3. Simple Commands (lines 21-72) - Start here
4. Your relevant use case section (Git/Testing/etc.)
5. Modern Features (lines 1028-1101) - New capabilities
6. Template Library (lines 845-886) - Reference templates
7. Anti-Patterns section (lines 1102-1430) - What to avoid

**For quick reference (targeted reading):**
1. Use decision matrix above to find your section
2. Read only that section
3. Optionally check anti-patterns (lines 1102-1430)

---

## When to Read EXAMPLES.md

**Read EXAMPLES.md when:**
- Need concrete examples of patterns
- Unsure how to structure specific command type
- Want to see anti-patterns (what NOT to do)
- Looking for similar command to pattern-match
- Need examples of modern features (fork, hooks, session ID)

**Don't read EXAMPLES.md when:**
- Learning syntax rules → Read @SYNTAX.md instead
- Determining tool permissions → Read @QUALITY.md decision matrix instead
- Validating command → Read @QUALITY.md or @SYNTAX.md validation sections

**Prerequisites:**
- Read @SYNTAX.md FIRST to understand syntax before seeing examples
- Understand basic command structure from SKILL.md

---

## Quick Reference

**Line Range Cheat Sheet:**

| Lines | Content |
|-------|---------|
| 3-13 | Table of contents |
| 15-20 | Complexity legend |
| 21-72 | Simple commands (beginner) |
| 73-195 | Git workflows |
| 196-284 | Code review |
| 285-386 | Testing |
| 387-467 | Documentation |
| 468-537 | Deployment |
| 538-658 | Analysis & refactoring |
| 659-844 | Advanced patterns |
| 845-886 | Template library |
| 888-924 | Command composition |
| 925-962 | Troubleshooting examples |
| 963-1027 | Real-world team commands |
| 1028-1101 | **Modern features** (fork, hooks, session ID, invocation control) |
| 1102-1415 | **Anti-patterns** (READ THIS to avoid mistakes) |
| 1416-1430 | Anti-pattern summary checklist |

---

## Decision Rules

1. **Pattern Matching Rule:**
   - If your command is similar to existing type → Read that section's examples
   - If creating something new → Read Simple Commands + Template Library
   - If using modern features → Read Modern Features section

2. **Complexity Rule:**
   - Beginner: Read Simple Commands (lines 21-72)
   - Intermediate: Read relevant use case section
   - Advanced: Read Advanced Patterns (lines 659-844) + Modern Features (lines 1028-1101)

3. **Anti-Pattern Rule:**
   - ALWAYS check anti-patterns section (lines 1102-1430) before finalizing command
   - Use checklist (lines 1416-1430) for final validation

4. **Time Constraint Rule:**
   - Have 2 minutes: Read only your specific section from decision matrix
   - Have 5 minutes: Read your section + anti-patterns
   - Have 15+ minutes: Read Simple Commands + your section + modern features + anti-patterns + templates

---

This navigation guide reduces EXAMPLES.md reading time from "scan entire file" to "read 20-100 lines of relevant content."
