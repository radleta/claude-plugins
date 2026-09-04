---
summary: Navigation hub for QA test templates — framework-specific working test code for Jest, Pytest, JUnit, Mocha, and RSpec covering unit, integration, async, mock, and parametrized patterns.
tags: [qa-expert/templates]
---

# Templates

Framework-specific working test code templates. Select the framework and test type matching your project.

## Framework Groups

### Jest (TypeScript/JavaScript)
- `jest/basic-unit-test.test.ts` — Basic unit test with describe/it, beforeEach, and expect matchers
- `jest/integration-test.test.ts` — Integration test with module setup and teardown
- `jest/async-test.test.ts` — Async/await and Promise-based test patterns
- `jest/mock-test.test.ts` — jest.fn(), jest.spyOn(), and module mock patterns
- `jest/parametrized-test.test.ts` — Data-driven tests with test.each()

### Pytest (Python)
- `pytest/test_basic_unit.py` — Basic unit test with fixtures and parametrize
- `pytest/test_integration.py` — Integration test with conftest and database fixtures
- `pytest/test_async.py` — Async test patterns with pytest-asyncio
- `pytest/test_mock.py` — Mock, patch, and MagicMock patterns
- `pytest/test_parametrized.py` — @pytest.mark.parametrize for data-driven tests

### JUnit (Java)
- `junit/BasicUnitTest.java` — @Test, @BeforeEach, Assertions.assertEquals patterns
- `junit/IntegrationTest.java` — @SpringBootTest and context-loading integration tests
- `junit/AsyncTest.java` — CompletableFuture and async assertion patterns
- `junit/MockTest.java` — Mockito @Mock, @InjectMocks, verify() patterns
- `junit/ParameterizedTest.java` — @ParameterizedTest with @ValueSource and @MethodSource

### Mocha (JavaScript/Node.js)
- `mocha/basic-unit.spec.js` — describe/it with Chai expect assertions
- `mocha/integration.spec.js` — Integration test with before/after hooks
- `mocha/async.spec.js` — Async/Promise patterns with done callback and async/await
- `mocha/mock.spec.js` — Sinon stubs, spies, and sandbox patterns
- `mocha/data-driven.spec.js` — Data-driven tests with array iteration

### RSpec (Ruby)
- [README.md](rspec/README.md) — Overview of all RSpec templates with complexity ratings
- [QUICK_REFERENCE.md](rspec/QUICK_REFERENCE.md) — Quick selection table by testing scenario
- `rspec/basic_unit_spec.rb` — describe/context/it hierarchy with let and subject
- `rspec/integration_spec.rb` — Rails controller and model integration tests
- `rspec/async_spec.rb` — Background job and async operation test patterns
- `rspec/mock_spec.rb` — RSpec doubles, allow(), and expect().to receive() patterns
- `rspec/parametrized_spec.rb` — shared_examples and multiple input testing
