---
name: code-verification
description: "Unified code quality and requirements verification with 10 detection categories, traceability matrix, and AI-specific pattern detection. Use when reviewing code changes for quality issues, convention violations, over-engineering, requirements coverage, or plan-decision conformance — even for small diffs."
---

# Code Verification Methodology

## AI Awareness

AI-generated code has specific, predictable failure patterns:
- 66% of developers spend more time fixing "almost right" AI code than saved (Stack Overflow 2025)
- AI PRs have 1.7x more issues than human-only PRs (CodeRabbit Dec 2025)
- AI is "nearsighted" — often loses context of full requirements
- AI code is often "almost right" but subtly flawed
- AI tends to add unnecessary complexity and indirection
- AI may implement adjacent features but miss what was actually asked

## Detection Categories

### Requirements Categories

**missing-requirements** (CRITICAL): Requirements stated but not implemented
- Each explicit requirement has corresponding implementation
- Each acceptance criterion is satisfied
- All user stories/tasks are addressed
- No requirements were "forgotten" during implementation

**context-drift** (CRITICAL): Implementation diverged from original intent
- Implementation matches what user actually asked for
- No assumptions that change the scope
- No "improvements" that weren't requested
- Terminology matches user's terminology

**partial-implementation** (HIGH): Features only partially implemented
- Each feature is fully functional, not just scaffolded
- Edge cases mentioned in requirements are handled
- Error scenarios mentioned are implemented
- All stated behaviors are present
- No placeholder comments standing in for implementation (`// ...`, `// rest of code`)
- No functions that describe behavior in comments but lack actual logic
- No components that implement only the first case and comment "repeat for remaining"
- No files that end abruptly without completing all declared exports/functions

**scope-creep** (MEDIUM): Implementation exceeds stated requirements
- No unrequested features added
- No "nice to have" additions without user consent
- Complexity matches requirement complexity

### Quality Categories

**almost-right-patterns** (CRITICAL): Code that looks correct but has subtle logical flaws
- Off-by-one errors in loops and array access
- Incorrect boundary conditions
- Wrong comparison operators (< vs <=, == vs ===)
- Incorrect null/undefined handling
- Race conditions in async code
- Incorrect error propagation
- Swallowed exceptions: `catch` blocks that discard exception details (bare `catch`, `catch (Exception)` without logging, `catch (Exception ex)` that only uses `ex.Message` without logging the full exception). Every catch that doesn't re-throw MUST log the full exception object via the project's logging framework (e.g., `ILogger`, `console.error`, `logging.exception`) so stack traces reach observability tools (Application Insights, Sentry, etc.). Using only `ex.Message` in a return string is NOT sufficient — the stack trace and inner exceptions are lost.

**over-engineering** (HIGH): Unnecessary complexity that should be simplified
- Abstractions without clear benefit
- Unnecessary wrapper classes/functions
- Premature optimization
- Over-generalized solutions for specific problems
- Unnecessary design patterns
- Configuration options that aren't needed

**convention-violations** (HIGH): Code that doesn't follow project patterns or CLAUDE.md conventions
- File naming doesn't match project convention
- File location doesn't match project structure
- Code style doesn't match existing patterns
- Import patterns differ from project standard
- Error handling style inconsistent with project
- Build/test/lint commands don't match documented commands

**code-smells** (MEDIUM): Patterns indicating potential problems
- Functions too long (>50 lines)
- Too many parameters (>5)
- Deep nesting (>3 levels)
- Duplicated code blocks
- Magic numbers/strings without constants
- Commented-out code (should be deleted)

### codebase-alignment (HIGH)
Code that creates parallel implementations of existing functionality.
New files, functions, or classes that duplicate what already exists in the codebase.
Backwards compatibility shims (old interface preserved alongside new) without
an approved decision in the plan's decision table.
Extension by copy-paste rather than by modifying the original.

### plan-decision-conformance (HIGH)
Code that contradicts decisions recorded in the plan's decision table.
**When active:** Only when a plan with decisions exists (REVIEW_DEPTH = light, plan path provided). Read `decisions.md` or `decisions/` from the plan path.

Checklist:
- Each plan decision's "Choice" is reflected in the implementation — code doesn't contradict the selected option
- Data models match decision specifications (types, field names, storage formats match what decisions describe)
- Architectural approach matches decisions (extend vs create, which file to modify, integration pattern)
- No implementation of a rejected alternative (code implements Option B when decision chose Option A)

**Scope boundary:** Does NOT check structural completeness (completeness-verifier's job). Only checks: given that the code exists, does it match what the decisions said to build?

## Out of Scope

- Exhaustive completeness pattern grep (use completeness-verifier agent). This skill flags truncation patterns noticed during quality read as a secondary signal.
- Test quality (use /verify-tests)
- Security analysis (use /verify-security)

## Workflow

### Step 1: Gather Context (SINGLE PASS)

1. Read project instruction files (CLAUDE.md, .claude/CLAUDE.md, .claude/rules/*.md, README.md) to extract project conventions, coding standards, file naming rules, and build/test/lint commands. Use documented patterns as the authority.
2. Read session context (provided in task prompt): what was implemented, which files changed, why, and any plan path or acceptance criteria. If a plan path is mentioned, read the plan for structured requirements.
3. List all files created or modified (from session context)
4. Read all changed files (SINGLE PASS — these reads serve both requirements and quality analysis)
5. Identify project conventions (from instruction files first, supplemented by examining existing code near changed files)
6. Extract all requirements from context (plan steps, conversation summary, acceptance criteria)

### Step 2: Requirements Analysis

1. If a plan path with decisions is provided, read `decisions.md` or `decisions/` for plan-decision-conformance checks
2. For each requirement: find corresponding implementation
3. For each acceptance criterion: verify it's satisfied
4. Check for context drift (implementation vs intent)
5. Check for scope creep (extra features)

### Step 3: Quality Analysis (using already-read files)

1. Check for "almost right" patterns (subtle logic errors)
2. Check for over-engineering and unnecessary complexity
3. Check for convention violations against both project instruction files and existing code patterns
4. Check for code smells
5. Codebase alignment: check for parallel implementations, duplicate patterns, unauthorized backwards compatibility

### Step 4: Unified Verdict

Determine APPROVED or ISSUES_FOUND with combined report.

**Key principle:** Read files ONCE. Analyze TWICE (requirements + quality). Report ONCE.

## Output Format

```
## Code Verification Report

**VERDICT: [APPROVED|ISSUES_FOUND]**

---

### Scope Summary
**Files examined:**
[List of files reviewed]

**Project conventions identified:**
[Key conventions discovered from existing code]

---

### Requirements Coverage

**Traceability Matrix:**

| # | Requirement | Status | Implementation | Notes |
|---|-------------|--------|----------------|-------|
| 1 | [Requirement] | ✅ MET / ❌ NOT MET / ⚠️ PARTIAL | [file:function] | [Details] |

**Context Drift:** [None detected / Details of drift]
**Scope Creep:** [None detected / Details of unrequested additions]

---

### Code Quality

**✅ Good Patterns Found:**
- [Pattern]: [Where observed and why it's good]

**❌ Issues Found:**

**Almost-Right Patterns:**
| File | Line | Code | Issue | Fix |
|------|------|------|-------|-----|

**Over-Engineering:**
| File | Line | Pattern | Issue | Simplification |
|------|------|---------|-------|----------------|

**Convention Violations:**
| File | Line | Violation | Convention | Fix |
|------|------|-----------|-----------|-----|

**Code Smells:**
| File | Line | Smell | Severity | Recommendation |
|------|------|-------|----------|----------------|

---

### Recommendations

**Critical (must fix):**
1. [Specific action with file:line]

**High Priority (should fix):**
1. [Specific action with file:line]

**Medium Priority (consider):**
1. [Specific action with file:line]

---

### Summary

**Overall Assessment:**
[Detailed paragraph explaining both requirements status and code quality]

**Requirements Coverage:** [X of Y] requirements met ([Z%])
**Quality Issues:** [count] critical, [count] high, [count] medium
**Recommendation:** [PROCEED to security review / ADDRESS issues first]
```

## Examples

### ISSUES_FOUND Example

```
## Code Verification Report

**VERDICT: ISSUES_FOUND**

### Requirements Coverage

| # | Requirement | Status | Implementation | Notes |
|---|-------------|--------|----------------|-------|
| 1 | Profile with avatar, name, bio | ✅ MET | UserProfile.tsx:15-45 | All fields present |
| 2 | Edit mode toggle | ✅ MET | UserProfile.tsx:8 | useState for editMode |
| 3 | Validate bio length | ❌ NOT MET | Not found | No validation exists |
| 4 | Save to backend API | ⚠️ PARTIAL | UserProfile.tsx:52 | Local only, no API call |

### Code Quality

**Over-Engineering:**
| File | Line | Pattern | Issue | Simplification |
|------|------|---------|-------|----------------|
| src/utils/validator.ts | 15 | `AbstractValidatorFactory` | Factory pattern for single validator | Use direct function |

**Requirements Coverage:** 2 of 4 met (50%)
**Quality Issues:** 0 critical, 2 high, 0 medium
**Recommendation:** ADDRESS issues first
```

### APPROVED Example

```
## Code Verification Report

**VERDICT: APPROVED**

### Requirements Coverage

| # | Requirement | Status | Implementation | Notes |
|---|-------------|--------|----------------|-------|
| 1 | User authentication | ✅ MET | src/auth.ts:authenticate() | JWT-based |
| 2 | Rate limiting | ✅ MET | src/middleware/rateLimit.ts | 100 req/min |
| 3 | Session management | ✅ MET | src/auth.ts:createSession() | 24hr expiry |

**Requirements Coverage:** 3 of 3 met (100%)
**Quality Issues:** 0 critical, 0 high, 0 medium
**Recommendation:** PROCEED to security review
```
