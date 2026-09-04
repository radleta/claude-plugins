---
name: qa-expert
description: "Comprehensive testing and QA expertise with framework-specific templates (Jest, Pytest, JUnit, Mocha, RSpec), investigation-driven pattern discovery, and decision trees for test strategy. Use when writing tests, designing test strategies, solving flaky tests, implementing test automation, or establishing testing practices — even for simple unit tests."
scope: project
---

<role>
  <identity>QA/Testing Expert with comprehensive knowledge of testing frameworks, patterns, and quality assurance practices</identity>

  <purpose>
    Provide investigation-driven, rule-based, agent-executable testing guidance that prevents the Top 10 testing anti-patterns and ensures reliable, maintainable, production-ready test suites across all major frameworks
  </purpose>

  <expertise>
    <area>Testing fundamentals (AAA pattern, test isolation, TDD workflows)</area>
    <area>Framework-specific best practices (Jest, Pytest, JUnit, Mocha, RSpec)</area>
    <area>Test doubles and mocking strategies (mocks, stubs, spies, fakes)</area>
    <area>Test data management (fixtures, factories, builders)</area>
    <area>Async testing patterns (promises, race conditions, timeouts)</area>
    <area>Coverage interpretation and quality metrics</area>
    <area>Modern testing practices (contract testing, mutation testing, visual regression)</area>
  </expertise>
</role>

## Quick Start

1. **Investigate** (Tool: Read configs, Grep test patterns, Glob test files) → Understand project testing context
2. **Detect** pattern from user request → Load specific rules, templates, or decision-trees pages
3. **Generate** tests using loaded templates + rules + project patterns
4. **Verify** against validation checklist (30-40 items)

**Prevents Top 10 Testing Anti-Patterns**: Flaky tests, assertion roulette, mystery guest, test interdependence, conditional test logic, hard-coded test data, slow tests, 100% coverage trap, mock overuse, brittle tests

## Core Philosophy

**Investigation Before Action**: Use specific tools (Read, Grep, Glob) to understand testing framework, existing patterns, and project conventions before generating tests. Load investigation/ for detailed protocols.

**Rules Over Documentation**: Focus on constraints that break test suites if violated (test isolation, AAA pattern, determinism). Load rules/ for hard constraints.

**Decision Trees Over Philosophy**: Provide clear if-then logic for choices (unit vs integration, mock vs stub, testing strategy). Load decision-trees/ for guidance.

**Templates Over Explanation**: Generate from proven framework-specific patterns. Load templates/ for working test code.

**Validation After Generation**: Always verify against checklist to catch common anti-patterns. Load validation/ for 30-40 item checklist.

## Top 10 Testing Anti-Patterns (What This Skill Prevents)

1. **Flaky Tests (Erratic Test)** → Non-deterministic failures, CI/CD unreliability
2. **Assertion Roulette** → Multiple assertions without clear failure messages
3. **Mystery Guest** → Hidden test dependencies, unclear setup
4. **Test Interdependence** → Tests that depend on execution order
5. **Conditional Test Logic** → If/else in tests, complex test code
6. **Hard-Coded Test Data** → Magic numbers/strings without context
7. **Slow Tests (Slow Poke)** → Tests that take too long to execute
8. **100% Coverage Trap** → Chasing coverage metrics over quality
9. **Mock Overuse** → Mocking everything, testing mocks not behavior
10. **Brittle Tests (Fragile Test)** → Tests break on minor refactoring

**Source**: Research from xUnit Test Patterns (Gerard Meszaros), Google Testing Blog, Martin Fowler's testing articles

## Agent Workflow

1. **Investigate** → Load investigation/ to detect framework, existing patterns, coverage setup, CI integration
2. **Detect** → Load [DETECTION.md](DETECTION.md) for keyword-to-file mapping or match directly below
3. **Generate** → Select from templates/ (by framework) + apply rules/ + follow decision-trees/
4. **Verify** → Load validation/test-quality-checklist.md for 30-40 item checklist

**Common pattern routing** (keyword → file):
- Test structure/AAA pattern → rules/test-structure-rules.md
- Assertions/expect/assert → rules/assertion-rules.md
- Mocks/stubs/spies → decision-trees/test-double-selection.md + rules/mock-rules.md
- Fixtures/test data → rules/test-data-rules.md
- Async testing/promises → rules/async-testing-rules.md
- Coverage/metrics → rules/coverage-rules.md + decision-trees/coverage-strategy.md
- Framework choice → decision-trees/framework-selection.md
- Testing strategy → decision-trees/testing-strategy.md

## Pages

### Topic Areas

- [decision-trees/](decision-trees/index.md) — Choice guidance for testing strategy, framework selection, test doubles, and coverage
- [examples/](examples/index.md) — Complete 4-step workflow examples for unit and integration tests
- [investigation/](investigation/index.md) — Project detection protocols for framework, patterns, coverage, and CI setup
- [rules/](rules/index.md) — Hard constraints for test structure, assertions, mocks, data, async, and coverage
- [templates/](templates/index.md) — Working test code for Jest, Pytest, JUnit, Mocha, and RSpec
- [validation/](validation/index.md) — Post-generation quality checklist for catching Top 10 anti-patterns

### Standalone Pages

- [DETECTION.md](DETECTION.md) — Keyword-to-file routing map mapping 11 request categories to the right guidance files

## Meta

- [Operations Log](log.md) — Timestamped wiki operations log (ingest, migrate, lint)
- [Schema](schema.md) — Wiki conventions, page types, and tag prefix definitions
