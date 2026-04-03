# Pattern Detection - Request to Guidance Mapping

**Purpose**: Map user testing requests to the appropriate rules, decision trees, templates, or investigation protocols.

## Detection Flow

```
User Request
    ↓
Extract Keywords
    ↓
Match to Category
    ↓
Load Appropriate File(s)
    ↓
Generate Tests Following Guidance
```

## Keyword → Category → File Mapping

### Category 1: Test Structure & Organization

**Keywords**: "test structure", "AAA", "arrange act assert", "test naming", "describe", "it", "test organization", "test isolation"

**Signals**:
- User asks about test structure or organization
- Mentions AAA pattern, test naming conventions
- Wants to know how to structure tests
- Has unclear or poorly organized tests

**Load**:
- @rules/test-structure-rules.md → AAA pattern, naming, isolation, setup complexity
- @templates/{framework}/basic-unit-test → Framework-specific structure examples
- @examples/unit-test-workflow.md → Complete workflow example

**Decision**: Does request involve test organization? Load structure rules first.

---

### Category 2: Assertions & Matchers

**Keywords**: "assertion", "expect", "assert", "matcher", "toBe", "toEqual", "should", "failure message", "assertion roulette"

**Signals**:
- User asks about assertions or matchers
- Mentions expect(), assert, should syntax
- Has unclear or generic assertions
- Asks about failure messages
- Mentions Assertion Roulette anti-pattern

**Load**:
- @rules/assertion-rules.md → Specific assertions, meaningful messages, behavior vs implementation
- @templates/{framework}/basic-unit-test → Framework-specific assertion syntax
- @validation/test-quality-checklist.md → Assertion verification items

**Decision Tree**:
```
Start: What assertion framework?
├─ Jest/Vitest
│   └─ expect().toBe(), toEqual(), toContain() → @templates/jest/basic-unit-test.test.ts
├─ Pytest
│   └─ assert, pytest.raises() → @templates/pytest/test_basic_unit.py
├─ JUnit
│   └─ assertEquals(), assertThrows() → @templates/junit/BasicUnitTest.java
├─ Mocha + Chai
│   └─ expect().to.equal(), should → @templates/mocha/basic-unit.spec.js
└─ RSpec
    └─ expect().to eq(), be_truthy → @templates/rspec/basic_unit_spec.rb
```

---

### Category 3: Mocking & Test Doubles

**Keywords**: "mock", "stub", "spy", "fake", "dummy", "jest.fn", "sinon", "mockito", "test double", "mocking", "when to mock"

**Signals**:
- User needs to mock dependencies
- Asks mock vs stub vs spy
- Mentions mocking libraries (Jest, Sinon, Mockito, pytest-mock)
- Has over-mocking issues
- Asks "what to mock" or "when to mock"

**Load**:
- @decision-trees/test-double-selection.md → Mock vs stub vs spy vs fake vs dummy
- @rules/mock-rules.md → When to mock, anti-patterns, cleanup
- @templates/{framework}/mock-test → Framework-specific mocking examples

**Decision Tree**:
```
Start: Why need test double?
├─ Just fill parameter (never used)
│   └─ Dummy → @decision-trees/test-double-selection.md
├─ Working implementation (simplified)
│   └─ Fake (in-memory DB) → @rules/mock-rules.md (fake examples)
├─ Return canned responses
│   ├─ Need verify calls?
│   │   └─ Spy → @templates/{framework}/mock-test (spy examples)
│   └─ Just return values?
│       └─ Stub → @rules/mock-rules.md (state verification)
└─ Set expectations, verify behavior
    └─ Mock → @templates/{framework}/mock-test (behavior verification)
```

---

### Category 4: Test Data & Fixtures

**Keywords**: "test data", "fixture", "factory", "builder", "magic numbers", "test setup", "beforeEach", "setUp", "let", "factory_boy", "FactoryBot"

**Signals**:
- User asks about test data management
- Mentions fixtures, factories, or builders
- Has magic numbers/strings in tests
- Asks about test setup or data generation
- Mentions beforeEach, setUp, let() patterns

**Load**:
- @rules/test-data-rules.md → Avoid magic values, fixtures vs factories, intention-revealing data
- @templates/{framework}/basic-unit-test → Fixture patterns per framework
- @templates/pytest/test_parametrized.py → Pytest fixture examples
- @templates/junit/ParameterizedTest.java → JUnit test data

**Decision**: Does request involve test data? Load data management rules.

---

### Category 5: Async Testing

**Keywords**: "async", "await", "promise", "async/await", "timeout", "race condition", "flaky", "setTimeout", "sleep", "waitFor"

**Signals**:
- User testing async code (promises, async/await)
- Has timeout or race condition issues
- Mentions flaky tests
- Asks about waiting for conditions
- Has "Sleeping Snail" anti-pattern (fixed sleeps)

**Load**:
- @rules/async-testing-rules.md → Promise handling, condition-based waiting, race conditions
- @templates/{framework}/async-test → Framework-specific async patterns
- @validation/test-quality-checklist.md → Async verification items

**Common Issues**:
```
Issue → Solution → File
├─ Fixed sleeps (sleep, setTimeout)
│   └─ Use waitFor/polling → @rules/async-testing-rules.md (Rule 2)
├─ Promise not awaited
│   └─ async/await or return → @rules/async-testing-rules.md (Rule 1)
├─ Unhandled rejection
│   └─ expect().rejects, try/catch → @rules/async-testing-rules.md (Rule 3)
└─ Race condition
    └─ Promise.all(), proper sync → @rules/async-testing-rules.md (Rule 5)
```

---

### Category 6: Coverage & Quality Metrics

**Keywords**: "coverage", "code coverage", "100% coverage", "branch coverage", "mutation testing", "quality metrics", "coverage threshold"

**Signals**:
- User asks about coverage targets
- Mentions 100% coverage (trap!)
- Asks about coverage types (line vs branch)
- Needs mutation testing guidance
- Asks about quality metrics

**Load**:
- @decision-trees/coverage-strategy.md → Coverage targets by project type
- @rules/coverage-rules.md → 100% trap, branch coverage, mutation testing
- @investigation/coverage-setup.md → Detect existing coverage config

**Decision Tree**:
```
Start: What project type?
├─ Safety-critical (medical, automotive)
│   └─ 95-100% coverage → @decision-trees/coverage-strategy.md
├─ Financial/payment
│   └─ 80-90% coverage → @decision-trees/coverage-strategy.md
├─ SaaS web app
│   └─ 60-80% coverage → @decision-trees/coverage-strategy.md
├─ Internal tools
│   └─ 40-60% coverage → @decision-trees/coverage-strategy.md
└─ Open-source library
    └─ 80-95% coverage → @decision-trees/coverage-strategy.md
```

---

### Category 7: Framework Selection & Setup

**Keywords**: "jest", "pytest", "junit", "mocha", "rspec", "vitest", "which framework", "testing framework", "framework setup"

**Signals**:
- User asks which testing framework to use
- Mentions specific framework by name
- Needs framework-specific guidance
- Setting up new testing framework

**Load**:
- @decision-trees/framework-selection.md → Choose framework based on language/platform
- @investigation/framework-detection.md → Detect existing framework
- @templates/{framework}/ → Framework-specific templates

**Decision Tree**:
```
Start: What language?
├─ JavaScript/TypeScript
│   ├─ React/Vue/Angular?
│   │   └─ Jest → @templates/jest/
│   ├─ Vite project?
│   │   └─ Vitest → @decision-trees/framework-selection.md
│   └─ Node.js backend?
│       └─ Jest or Mocha → @decision-trees/framework-selection.md
├─ Python
│   └─ Pytest → @templates/pytest/
├─ Java
│   └─ JUnit 5 → @templates/junit/
├─ Ruby
│   └─ RSpec → @templates/rspec/
└─ Other
    └─ @decision-trees/framework-selection.md
```

---

### Category 8: Testing Strategy & Test Types

**Keywords**: "unit test", "integration test", "e2e", "end-to-end", "test pyramid", "test trophy", "testing strategy", "what to test"

**Signals**:
- User asks what type of test to write
- Mentions unit vs integration vs E2E
- Asks about test pyramid or trophy
- Needs testing strategy guidance
- Asks "should I write unit or integration test?"

**Load**:
- @decision-trees/testing-strategy.md → Unit vs integration vs E2E decision tree
- @rules/test-structure-rules.md → Each test should be fast (targets by type)
- @examples/unit-test-workflow.md → Unit test example
- @examples/integration-test-workflow.md → Integration test example

**Decision Tree**:
```
Start: What are you testing?
├─ Pure business logic (no dependencies)
│   └─ Unit Test → @templates/{framework}/basic-unit-test
├─ Component + dependencies (DB, API)
│   └─ Integration Test → @templates/{framework}/integration-test
├─ Full user journey
│   └─ E2E Test (critical paths only) → @decision-trees/testing-strategy.md
└─ API contract between services
    └─ Contract Test → @decision-trees/testing-strategy.md
```

---

### Category 9: Investigation & Project Setup

**Keywords**: "existing tests", "project setup", "detect framework", "existing patterns", "CI", "coverage setup", "what framework is this"

**Signals**:
- User needs to understand existing test setup
- Asks "what testing framework does this project use?"
- Wants to match existing patterns
- Needs to detect CI/CD setup
- Asks about project's coverage configuration

**Load**:
- @investigation/framework-detection.md → Detect Jest, Pytest, JUnit, Mocha, RSpec
- @investigation/existing-test-patterns.md → Find test structure, naming, assertions
- @investigation/coverage-setup.md → Detect coverage tools and thresholds
- @investigation/ci-integration.md → Understand CI/CD test execution

**Investigation Protocol**:
```
Step 1: Detect Framework
    └─ @investigation/framework-detection.md

Step 2: Find Existing Patterns
    └─ @investigation/existing-test-patterns.md

Step 3: Check Coverage Setup
    └─ @investigation/coverage-setup.md

Step 4: Understand CI/CD
    └─ @investigation/ci-integration.md
```

---

### Category 10: Anti-Patterns & Common Mistakes

**Keywords**: "flaky test", "slow test", "brittle test", "assertion roulette", "mystery guest", "fragile", "test smells", "anti-pattern"

**Signals**:
- User has flaky or unreliable tests
- Mentions test anti-patterns by name
- Tests break on minor refactoring
- Tests are slow or hard to maintain

**Load**:
- @rules/test-structure-rules.md → Isolation, minimal setup, speed
- @rules/async-testing-rules.md → Flaky test causes (67% from async)
- @validation/test-quality-checklist.md → Comprehensive anti-pattern checklist

**Anti-Pattern → Rule File**:
```
Flaky Test → @rules/async-testing-rules.md (determinism, no race conditions)
Assertion Roulette → @rules/assertion-rules.md (one logical assertion per test)
Mystery Guest → @rules/test-data-rules.md (explicit setup, avoid hidden fixtures)
Slow Test → @rules/test-structure-rules.md (speed targets: unit <100ms)
Brittle Test → @rules/assertion-rules.md (test behavior, not implementation)
Over-Mocking → @rules/mock-rules.md (mock boundaries, not internals)
100% Coverage Trap → @rules/coverage-rules.md (meaningful coverage)
```

---

### Category 11: Validation & Quality Checks

**Keywords**: "validate", "check", "review", "quality", "checklist", "best practices", "verify tests"

**Signals**:
- User wants to validate generated tests
- Asks for test review or quality check
- Mentions best practices
- Wants comprehensive checklist

**Load**:
- @validation/test-quality-checklist.md → 30-40 item comprehensive checklist
- @rules/ (all rule files) → Specific rule verification
- @examples/ → Compare to example workflows

**Validation Workflow**:
```
1. Load @validation/test-quality-checklist.md
2. Run automated checks (grep, test execution)
3. Manual review against rules
4. Verify coverage thresholds
5. Check CI integration
```

---

## Quick Reference: Request → Files

| User Request | Primary Files to Load |
|--------------|----------------------|
| "Write unit test for UserService" | @templates/{framework}/basic-unit-test, @rules/test-structure-rules.md, @rules/assertion-rules.md |
| "How to mock API calls?" | @decision-trees/test-double-selection.md, @rules/mock-rules.md, @templates/{framework}/mock-test |
| "Fix flaky async test" | @rules/async-testing-rules.md, @validation/test-quality-checklist.md (async section) |
| "What coverage target?" | @decision-trees/coverage-strategy.md, @rules/coverage-rules.md |
| "Which testing framework to use?" | @decision-trees/framework-selection.md, @investigation/framework-detection.md |
| "Write integration test for API" | @templates/{framework}/integration-test, @examples/integration-test-workflow.md |
| "What's the AAA pattern?" | @rules/test-structure-rules.md (Rule 1) |
| "How to test promises?" | @rules/async-testing-rules.md, @templates/{framework}/async-test |
| "Setup test fixtures" | @rules/test-data-rules.md, @templates/{framework}/basic-unit-test (fixture section) |
| "Understand existing tests" | @investigation/existing-test-patterns.md, @investigation/framework-detection.md |

---

## Multi-Category Requests

Some requests require loading from multiple categories:

**"Write integration test with database"**:
- @templates/{framework}/integration-test (template)
- @rules/test-structure-rules.md (isolation, cleanup)
- @rules/test-data-rules.md (fixture management)
- @examples/integration-test-workflow.md (complete workflow)

**"Mock API and test async response"**:
- @decision-trees/test-double-selection.md (choose stub vs mock)
- @rules/mock-rules.md (mocking external boundaries)
- @rules/async-testing-rules.md (promise handling)
- @templates/{framework}/mock-test (mocking syntax)
- @templates/{framework}/async-test (async patterns)

**"Setup testing for new project"**:
- @decision-trees/framework-selection.md (choose framework)
- @investigation/framework-detection.md (verify choice)
- @decision-trees/testing-strategy.md (test distribution)
- @rules/test-structure-rules.md (structure standards)

---

## Default Investigation Protocol

**When user provides test-related request without specific keywords**:

1. Run investigation first:
   - @investigation/framework-detection.md → Understand framework
   - @investigation/existing-test-patterns.md → Match existing style

2. Then load appropriate templates/rules based on findings

3. Generate tests matching project conventions

4. Validate with @validation/test-quality-checklist.md

---

**QA Expert Pattern Detection: Keyword-driven routing to rules, templates, decision trees, and investigation protocols for comprehensive testing guidance!**
