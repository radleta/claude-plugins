---
name: test-verification
description: "Test quality verification methodology with 7 detection categories, assertion analysis, and AI-specific shallow test detection. Use when reviewing tests for meaningfulness, missing edge cases, assertion quality, or mock correctness — even for small test files."
---

# Test Verification Methodology

## AI Awareness

AI-generated tests often look complete but miss critical verification:
- AI tends to write tests that pass but don't actually verify behavior
- Tests may have assertions that never fail (always true)
- AI often tests happy path only, missing edge cases
- Mocks may not reflect actual system behavior
- Tests may verify implementation details instead of behavior

## Detection Categories

**shallow-tests** (CRITICAL): Tests that exist but don't meaningfully verify behavior
- Test function with no expect/assert calls
- Trivial assertions: `expect(true).toBe(true)`, `assert True`, `assertEquals(1, 1)`
- Existence-only checks: `expect(result).toBeDefined()`, `assertNotNull(result)`
- Type-only checks: `expect(typeof result).toBe('object')`
- Length-only checks: `expect(result.length).toBeGreaterThan(0)`

**missing-assertions** (CRITICAL): Tests that call code but don't verify outcomes
- Function called but return value not checked
- State mutation but no verification of new state
- Async operation but no await or callback verification
- Error scenario but no error type/message verification
- Side effect expected but not verified

**happy-path-only** (HIGH): Tests that only cover success scenarios
- No tests for null/undefined inputs
- No tests for empty arrays/strings
- No tests for boundary values (0, -1, MAX_INT)
- No tests for invalid input types
- No tests for network/IO failures
- No tests for concurrent access scenarios

**mock-issues** (HIGH): Mocks that don't reflect real system behavior
- Mock always returns success (never errors)
- Mock returns hardcoded values that won't vary
- Mock doesn't verify it was called correctly
- Mock implementation differs from real implementation contract
- Too many mocks (testing mocks, not code)

**coverage-gaps** (HIGH): Important code paths not covered by tests
- Public functions without any tests
- Error handling branches not tested
- Conditional branches not fully covered
- Integration points not tested
- Configuration variations not tested

**test-smells** (MEDIUM): Patterns indicating potential test quality issues
- Test name doesn't describe what's being tested
- Multiple unrelated assertions in one test
- Test depends on other tests (order-dependent)
- Test uses sleep/setTimeout for synchronization
- Test modifies global state without cleanup
- Commented-out tests or assertions
- Test file significantly smaller than source file

**test-convention-violations** (HIGH): Tests that don't follow project conventions
- Test file naming doesn't follow project convention (from CLAUDE.md or existing patterns)
- Test directory structure doesn't match project layout
- Test framework doesn't match what project documents specify
- Test setup/teardown doesn't follow project patterns

## Out of Scope

- Completeness verification (use /verify-todo)
- Code quality and requirements verification (use /verify-code)
- Security analysis (use /verify-security)

## Workflow

### Step 1: Gather Tests

1. Read project instruction files (CLAUDE.md, .claude/CLAUDE.md, .claude/rules/*.md, README.md, and manifest file like package.json scripts) to discover project test conventions: test framework, test file naming patterns, test commands, test directory structure, and any testing requirements or restrictions.
2. Read session context (provided in task prompt): what was implemented, which files changed, why, and any plan path or acceptance criteria. If a plan path is mentioned, read the plan's step acceptance criteria as test expectations and affected files to identify where tests should exist.
3. Find all test files for changed code (from session context)
4. Map source files to their test files
5. Identify what code paths need testing (from plan criteria or ad-hoc analysis)
6. Check if tests exist for all public interfaces

### Step 2: Analyze Quality

1. Check each test for meaningful assertions
2. Detect shallow or trivial tests
3. Identify happy-path-only coverage
4. Verify mocks are appropriate and correct
5. Check for test smells

### Step 3: Verdict

Determine APPROVED or ISSUES_FOUND with detailed findings.

## Output Format

```
## Test Quality Verification Report

**VERDICT: [APPROVED|ISSUES_FOUND]**

---

### Test Coverage Summary

**Source Files:**
[List of source files being tested]

**Test Files:**
[List of corresponding test files]

**Coverage Status:**
| Source File | Test File | Has Tests | Meaningful |
|-------------|-----------|-----------|------------|
| [file.ts] | [file.test.ts] | /  | //  |

---

### Test Quality Analysis

**Good Test Patterns Found:**
- [Pattern]: [Where observed and why it's good]

**Issues Found:**
- [Issue]: [file:line] - [Description]

---

### Detailed Findings (if ISSUES_FOUND)

**Shallow Tests:**
| Test File | Test Name | Issue | Recommendation |
|-----------|-----------|-------|----------------|
| [file] | [test name] | [What's wrong] | [How to fix] |

**Missing Assertions:**
| Test File | Test Name | Code Called | Missing Verification |
|-----------|-----------|-------------|---------------------|
| [file] | [test] | [function/method] | [What should be checked] |

**Happy Path Only:**
| Test File | Function Tested | Missing Scenarios |
|-----------|-----------------|-------------------|
| [file] | [function] | [null, empty, error, boundary] |

**Mock Issues:**
| Test File | Mock | Issue | Fix |
|-----------|------|-------|-----|
| [file] | [mock name] | [What's wrong] | [How to fix] |

**Coverage Gaps:**
| Source File | Untested Code | Impact |
|-------------|---------------|--------|
| [file:line] | [function/branch] | [Why it matters] |

**Test Smells:**
| Test File | Smell | Severity | Recommendation |
|-----------|-------|----------|----------------|
| [file] | [smell type] | [high/medium/low] | [How to address] |

---

### Recommendations

**Critical (must add/fix):**
1. [Specific test to add/fix with file reference]

**High Priority (should add/fix):**
1. [Specific test to add/fix]

**Medium Priority (consider):**
1. [Improvement suggestion]

---

### Summary

**Overall Assessment:**
[Detailed paragraph explaining test quality status]

**Test Quality Score:** [X/10]
**Issues to Resolve:** [count] critical, [count] high, [count] medium
**Recommendation:** [PROCEED to security review / FIX test issues first]
```

## Examples

### ISSUES_FOUND Example

```
## Test Quality Verification Report

**VERDICT: ISSUES_FOUND**

### Test Coverage Summary

**Coverage Status:**
| Source File | Test File | Has Tests | Meaningful |
|-------------|-----------|-----------|------------|
| src/utils/validator.ts | src/utils/validator.test.ts |  |  |
| src/api/handler.ts | src/api/handler.test.ts |  |  |

### Detailed Findings

**Shallow Tests:**
| Test File | Test Name | Issue | Recommendation |
|-----------|-----------|-------|----------------|
| handler.test.ts | "should handle request" | Only checks result is defined | Verify response body, status, headers |

**Happy Path Only:**
| Test File | Function Tested | Missing Scenarios |
|-----------|-----------------|-------------------|
| validator.test.ts | validateEmail() | null input, empty string, malformed emails |

**Missing Assertions:**
| Test File | Test Name | Code Called | Missing Verification |
|-----------|-----------|-------------|---------------------|
| handler.test.ts | "should process data" | processData() | Return value never checked |

### Summary

**Test Quality Score:** 4/10
**Issues to Resolve:** 2 critical, 3 high, 1 medium
**Recommendation:** FIX test issues first
```

### APPROVED Example

```
## Test Quality Verification Report

**VERDICT: APPROVED**

### Test Quality Analysis

**Good Test Patterns Found:**
- Comprehensive assertions: login.test.ts verifies response body, tokens, headers
- Edge case coverage: Tests for null, empty, invalid, and expired tokens
- Error scenarios: All error paths tested with specific error messages
- Mock verification: Mocks verify they're called with correct parameters
- Clear test names: Names describe exact scenario being tested

### Summary

**Test Quality Score:** 9/10
**Issues to Resolve:** 0 critical, 0 high, 0 medium
**Recommendation:** PROCEED to security review
```
