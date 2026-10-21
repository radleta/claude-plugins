---
name: test-verification
description: "Test quality verification methodology with 7 detection categories, assertion analysis, and AI-specific shallow test detection. Use when reviewing tests for meaningfulness, missing edge cases, assertion quality, or mock correctness — even for small test files."
---

# Test Verification Methodology

## AI Awareness

- AI tends to write tests that pass but don't actually verify behavior
- Tests may have assertions that never fail (always true)
- AI often tests happy path only, missing edge cases
- Mocks may not reflect actual system behavior
- Tests may verify implementation details instead of behavior

## Detection Categories

**shallow-tests**: Tests that exist but don't meaningfully verify behavior
- Test function with no expect/assert calls
- Trivial assertions: `expect(true).toBe(true)`, `assert True`, `assertEquals(1, 1)`
- Existence-only checks: `expect(result).toBeDefined()`, `assertNotNull(result)`
- Type-only checks: `expect(typeof result).toBe('object')`
- Length-only checks: `expect(result.length).toBeGreaterThan(0)`

**missing-assertions**: Tests that call code but don't verify outcomes
- Function called but return value not checked
- State mutation but no verification of new state
- Async operation but no await or callback verification
- Error scenario but no error type/message verification
- Side effect expected but not verified

**happy-path-only**: Tests that only cover success scenarios
- No tests for null/undefined inputs
- No tests for empty arrays/strings
- No tests for boundary values (0, -1, MAX_INT)
- No tests for invalid input types
- No tests for network/IO failures
- No tests for concurrent access scenarios

**mock-issues**: Mocks that don't reflect real system behavior
- Mock always returns success (never errors)
- Mock returns hardcoded values that won't vary
- Mock doesn't verify it was called correctly
- Mock implementation differs from real implementation contract
- Too many mocks (testing mocks, not code)

**coverage-gaps**: Important code paths not covered by tests
- Public functions without any tests
- Error handling branches not tested
- Conditional branches not fully covered
- Integration points not tested
- Configuration variations not tested

**test-smells**: Patterns indicating potential test quality issues
- Test name doesn't describe what's being tested
- Multiple unrelated assertions in one test
- Test depends on other tests (order-dependent)
- Test uses sleep/setTimeout for synchronization
- Test modifies global state without cleanup
- Commented-out tests or assertions
- Test file significantly smaller than source file

**test-convention-violations**: Tests that don't follow project conventions
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

Label every finding (below). `ISSUES_FOUND` when any `would-ship-bug` or `real-minor` finding
stands; `APPROVED` otherwise.

## Labels

Label each finding by its consequence on the `reviewer-contract` scale; each finding carries a
location, a verbatim quote of the test or source line, and that consequence.

- `would-ship-bug` — the suite passes over a defect present now: a test asserting the wrong expected value, a mock that hides a failure the real system produces, an error path that is broken and untested
- `real-minor` — nothing is broken yet, but a regression in the covered behavior would pass unnoticed: a shallow or missing assertion, happy-path-only coverage, an uncovered branch, a project test convention broken
- `nit` — a test smell that weakens nothing, such as a vague test name

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

## Issues
- [label] [category] [file:line] — "[verbatim quote]" — [consequence] — Fix: [specific test to add or change]

## Non-blocking findings
- nit [category] [file:line] — "[verbatim quote]" — [why it is polish]

## Dimensions Checked
- shallow-tests — [clean | n findings | not evaluable — reason]
- ... one line per category

## Undecided
[only when something qualifies under reviewer-contract clause 6]
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
| src/utils/validator.ts | src/utils/validator.test.ts | yes | partly |
| src/api/handler.ts | src/api/handler.test.ts | yes | no |

## Issues
- real-minor [shallow-tests] handler.test.ts:14 — "expect(result).toBeDefined()" — a handler returning the wrong status or body still passes — Fix: assert the response body, status and headers
- real-minor [missing-assertions] handler.test.ts:22 — "processData(input);" — the return value is never checked, so a broken transform ships green — Fix: assert the processed output for a known input
- real-minor [happy-path-only] validator.test.ts:8 — "expect(validateEmail('a@b.co')).toBe(true)" — null, empty and malformed inputs are untested, so a crash on empty input passes — Fix: add cases for null, "" and "a@"

## Non-blocking findings
none

## Dimensions Checked
- shallow-tests — 1 finding
- missing-assertions — 1 finding
- happy-path-only — 1 finding
- mock-issues, coverage-gaps, test-smells, test-convention-violations — clean
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

## Issues
none

## Non-blocking findings
- nit [test-smells] login.test.ts:41 — "it('works', ...)" — the name does not say which scenario it covers — Fix: "rejects an expired refresh token"

## Dimensions Checked
- shallow-tests, missing-assertions, happy-path-only, mock-issues, coverage-gaps, test-convention-violations — clean
- test-smells — 1 finding
```
