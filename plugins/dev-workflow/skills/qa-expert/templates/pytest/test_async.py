# Template: Async Test

**When to Use**: Testing async/await functions, asyncio code, aiohttp requests, async database operations, WebSocket connections, or any asynchronous operations.

**Complexity**: Medium

**Common Mistakes Agents Make**:
- Forgetting to use `@pytest.mark.asyncio` decorator on async test functions
- Not awaiting async functions (causes "coroutine was never awaited" warnings)
- Using sync fixtures with async tests or vice versa
- Not properly closing async resources (connections, sessions)
- Creating multiple event loops or event loop conflicts
- Not testing concurrent async operations properly
- Using `asyncio.run()` inside tests (pytest-asyncio handles this)
- Not configuring pytest-asyncio mode correctly

## Template

```python
"""
Async tests for {{module_name}}.

Tests asynchronous operations including {{async_operations_description}}.
Requires pytest-asyncio plugin.
"""
from typing import List, Dict, Any, Optional, AsyncGenerator
import asyncio
import pytest
from aiohttp import ClientSession

from {{package_name}}.{{module_name}} import (
    {{async_function}},
    {{async_class}},
    {{async_service}},
)


# ============================================================================
# FIXTURES - Async fixtures for async tests
# ============================================================================

@pytest.fixture
async def {{async_client}}() -> AsyncGenerator[ClientSession, None]:
    """
    Provide an aiohttp ClientSession for async HTTP requests.

    Yields:
        ClientSession: Async HTTP client session
    """
    async with ClientSession() as session:
        yield session


@pytest.fixture
async def {{async_service_fixture}}() -> {{AsyncServiceClass}}:
    """
    Provide an instance of {{AsyncServiceClass}}.

    Returns:
        {{AsyncServiceClass}}: Service instance for testing
    """
    service = {{AsyncServiceClass}}()
    yield service
    # Cleanup if needed
    await service.close()


@pytest.fixture
async def {{async_resource}}() -> AsyncGenerator[{{ResourceType}}, None]:
    """
    Provide an async resource with setup and teardown.

    Yields:
        {{ResourceType}}: Initialized async resource
    """
    resource = {{ResourceType}}()
    await resource.initialize()

    yield resource

    await resource.cleanup()


@pytest.fixture
def {{sample_data}}() -> Dict[str, Any]:
    """
    Provide sample data for async tests.

    Returns:
        Dict[str, Any]: Test data
    """
    return {
        "{{key1}}": "{{value1}}",
        "{{key2}}": {{value2}},
    }


# ============================================================================
# TESTS - Basic Async Functions
# ============================================================================

@pytest.mark.asyncio
async def test_{{async_function}}_returns_expected_result():
    """
    Test {{async_function}} returns correct result asynchronously.

    GIVEN: Valid input parameters
    WHEN: {{async_function}} is awaited
    THEN: Should return expected result
    """
    # Arrange
    {{input_param}} = "{{input_value}}"
    expected = "{{expected_value}}"

    # Act
    result = await {{async_function}}({{input_param}})

    # Assert
    assert result == expected


@pytest.mark.asyncio
async def test_{{async_function}}_with_timeout():
    """
    Test {{async_function}} completes within timeout.

    GIVEN: Function that should complete quickly
    WHEN: Function is called with timeout
    THEN: Should complete without TimeoutError
    """
    # Arrange
    timeout_seconds = {{timeout_value}}

    # Act & Assert
    try:
        result = await asyncio.wait_for(
            {{async_function}}({{param}}),
            timeout=timeout_seconds
        )
        assert result is not None
    except asyncio.TimeoutError:
        pytest.fail(f"Function did not complete within {timeout_seconds}s")


@pytest.mark.asyncio
async def test_{{async_function}}_raises_on_invalid_input():
    """
    Test {{async_function}} raises exception with invalid input.

    GIVEN: Invalid input parameters
    WHEN: {{async_function}} is called
    THEN: Should raise {{ExceptionType}}
    """
    # Arrange
    invalid_{{input}} = {{invalid_value}}

    # Act & Assert
    with pytest.raises({{ExceptionType}}, match="{{expected_message}}"):
        await {{async_function}}(invalid_{{input}})


# ============================================================================
# TESTS - Async Classes and Methods
# ============================================================================

class Test{{AsyncClass}}:
    """Tests for {{AsyncClass}} async methods."""

    @pytest.mark.asyncio
    async def test_initialization(self):
        """
        Test {{AsyncClass}} initializes correctly.

        GIVEN: Valid initialization parameters
        WHEN: Creating instance and awaiting initialization
        THEN: Should initialize successfully
        """
        # Arrange & Act
        instance = {{AsyncClass}}({{param}}="{{value}}")
        await instance.initialize()

        # Assert
        assert instance.{{attribute}} is not None
        assert instance.is_initialized

        # Cleanup
        await instance.close()

    @pytest.mark.asyncio
    async def test_{{async_method}}_processes_data_correctly(self):
        """
        Test {{async_method}} processes data asynchronously.

        GIVEN: {{AsyncClass}} instance with data
        WHEN: {{async_method}} is called
        THEN: Should process and return transformed data
        """
        # Arrange
        instance = {{AsyncClass}}()
        await instance.initialize()
        input_data = {"{{key}}": "{{value}}"}

        # Act
        result = await instance.{{async_method}}(input_data)

        # Assert
        assert result["{{key}}"] == "{{expected_value}}"

        # Cleanup
        await instance.close()

    @pytest.mark.asyncio
    async def test_context_manager_usage(self):
        """
        Test {{AsyncClass}} works as async context manager.

        GIVEN: {{AsyncClass}} used with async context manager
        WHEN: Entering and exiting context
        THEN: Should properly initialize and cleanup
        """
        # Act & Assert
        async with {{AsyncClass}}({{param}}="{{value}}") as instance:
            assert instance.is_initialized
            result = await instance.{{async_method}}()
            assert result is not None

        # After context exit, should be closed
        # (verify if your class tracks this state)


# ============================================================================
# TESTS - Concurrent Async Operations
# ============================================================================

@pytest.mark.asyncio
async def test_{{function}}_handles_concurrent_requests():
    """
    Test {{function}} handles multiple concurrent requests correctly.

    GIVEN: Multiple concurrent calls to async function
    WHEN: All calls are awaited with gather
    THEN: All should complete successfully
    """
    # Arrange
    inputs = [{{value1}}, {{value2}}, {{value3}}]

    # Act
    results = await asyncio.gather(
        *[{{async_function}}(input_val) for input_val in inputs]
    )

    # Assert
    assert len(results) == len(inputs)
    assert all(result is not None for result in results)


@pytest.mark.asyncio
async def test_concurrent_operations_with_error_handling():
    """
    Test concurrent operations handle individual failures correctly.

    GIVEN: Multiple async operations where some may fail
    WHEN: Operations run concurrently with return_exceptions=True
    THEN: Should return results and exceptions
    """
    # Arrange
    valid_input = {{valid_value}}
    invalid_input = {{invalid_value}}

    # Act
    results = await asyncio.gather(
        {{async_function}}(valid_input),
        {{async_function}}(invalid_input),
        return_exceptions=True
    )

    # Assert
    assert len(results) == 2
    assert results[0] == {{expected_valid_result}}
    assert isinstance(results[1], {{ExceptionType}})


@pytest.mark.asyncio
async def test_{{function}}_rate_limiting():
    """
    Test {{function}} respects rate limiting for concurrent calls.

    GIVEN: Multiple concurrent calls that should be rate-limited
    WHEN: Calls are made simultaneously
    THEN: Should complete with appropriate delays
    """
    # Arrange
    num_calls = {{concurrent_count}}
    start_time = asyncio.get_event_loop().time()

    # Act
    tasks = [{{async_function}}(i) for i in range(num_calls)]
    await asyncio.gather(*tasks)

    # Assert
    end_time = asyncio.get_event_loop().time()
    duration = end_time - start_time
    min_expected_duration = {{min_duration}}
    assert duration >= min_expected_duration, \
        f"Completed too quickly: {duration}s (expected >= {min_expected_duration}s)"


# ============================================================================
# TESTS - Async HTTP Requests with aiohttp
# ============================================================================

@pytest.mark.asyncio
async def test_{{fetch_function}}_retrieves_data({{async_client}}: ClientSession):
    """
    Test {{fetch_function}} retrieves data from API.

    GIVEN: Valid API endpoint
    WHEN: Making async HTTP request
    THEN: Should return expected data
    """
    # Arrange
    url = "{{api_endpoint}}"

    # Act
    result = await {{fetch_function}}({{async_client}}, url)

    # Assert
    assert result is not None
    assert "{{expected_key}}" in result


@pytest.mark.asyncio
async def test_{{fetch_function}}_handles_http_errors({{async_client}}: ClientSession):
    """
    Test {{fetch_function}} handles HTTP errors correctly.

    GIVEN: API endpoint that returns error
    WHEN: Making async HTTP request
    THEN: Should raise appropriate exception
    """
    # Arrange
    url = "{{invalid_endpoint}}"

    # Act & Assert
    with pytest.raises({{HTTPExceptionType}}):
        await {{fetch_function}}({{async_client}}, url)


@pytest.mark.asyncio
async def test_parallel_api_requests({{async_client}}: ClientSession):
    """
    Test making multiple parallel API requests.

    GIVEN: Multiple API endpoints to fetch
    WHEN: Fetching all in parallel
    THEN: All requests should complete successfully
    """
    # Arrange
    urls = [
        "{{api_endpoint_1}}",
        "{{api_endpoint_2}}",
        "{{api_endpoint_3}}",
    ]

    # Act
    tasks = [{{fetch_function}}({{async_client}}, url) for url in urls]
    results = await asyncio.gather(*tasks)

    # Assert
    assert len(results) == len(urls)
    assert all(result is not None for result in results)


# ============================================================================
# TESTS - Async Generators and Iterators
# ============================================================================

@pytest.mark.asyncio
async def test_{{async_generator}}_yields_all_items():
    """
    Test {{async_generator}} yields all expected items.

    GIVEN: Async generator function
    WHEN: Iterating through all items
    THEN: Should yield expected number of items
    """
    # Arrange
    expected_count = {{count}}
    items = []

    # Act
    async for item in {{async_generator}}({{param}}):
        items.append(item)

    # Assert
    assert len(items) == expected_count


@pytest.mark.asyncio
async def test_{{async_generator}}_handles_errors_gracefully():
    """
    Test {{async_generator}} handles errors during iteration.

    GIVEN: Async generator that may encounter errors
    WHEN: Error occurs during iteration
    THEN: Should handle gracefully or raise expected exception
    """
    # Arrange
    error_triggering_param = {{error_value}}

    # Act & Assert
    with pytest.raises({{ExceptionType}}):
        async for item in {{async_generator}}(error_triggering_param):
            pass


# ============================================================================
# TESTS - Async Context Managers
# ============================================================================

@pytest.mark.asyncio
async def test_{{async_context_manager}}_initializes_and_cleans_up():
    """
    Test async context manager properly initializes and cleans up.

    GIVEN: Async context manager
    WHEN: Used in async with statement
    THEN: Should initialize on enter and cleanup on exit
    """
    # Act & Assert
    async with {{async_context_manager}}({{param}}="{{value}}") as resource:
        # Inside context - resource should be initialized
        assert resource.is_active
        result = await resource.{{method}}()
        assert result is not None

    # Outside context - resource should be cleaned up
    # (add assertion if your resource tracks cleanup state)


# ============================================================================
# TESTS - Async Service with Fixtures
# ============================================================================

@pytest.mark.asyncio
async def test_{{service_method}}_with_fixture(
    {{async_service_fixture}}: {{AsyncServiceClass}},
    {{sample_data}}: Dict[str, Any]
):
    """
    Test {{service_method}} works correctly with fixtures.

    GIVEN: {{AsyncServiceClass}} instance and sample data
    WHEN: Calling {{service_method}}
    THEN: Should process data correctly
    """
    # Act
    result = await {{async_service_fixture}}.{{service_method}}({{sample_data}})

    # Assert
    assert result is not None
    assert result.{{attribute}} == {{expected_value}}


@pytest.mark.asyncio
async def test_{{service_method}}_with_retries(
    {{async_service_fixture}}: {{AsyncServiceClass}}
):
    """
    Test {{service_method}} retries on failure.

    GIVEN: Service configured with retry logic
    WHEN: Operation fails initially but succeeds on retry
    THEN: Should eventually succeed
    """
    # Arrange
    {{param}} = {{value_that_may_fail}}
    max_retries = {{retry_count}}

    # Act
    result = await {{async_service_fixture}}.{{service_method}}_with_retry(
        {{param}},
        max_retries=max_retries
    )

    # Assert
    assert result is not None


# ============================================================================
# TESTS - Async Task Management
# ============================================================================

@pytest.mark.asyncio
async def test_background_task_completes():
    """
    Test background async task completes successfully.

    GIVEN: Async task started in background
    WHEN: Task is created and awaited
    THEN: Should complete with expected result
    """
    # Arrange
    async def background_task():
        await asyncio.sleep({{sleep_duration}})
        return "{{expected_result}}"

    # Act
    task = asyncio.create_task(background_task())
    result = await task

    # Assert
    assert result == "{{expected_result}}"
    assert task.done()


@pytest.mark.asyncio
async def test_cancel_long_running_task():
    """
    Test cancelling long-running async task.

    GIVEN: Long-running async task
    WHEN: Task is cancelled
    THEN: Should raise CancelledError
    """
    # Arrange
    async def long_task():
        await asyncio.sleep({{long_duration}})
        return "{{result}}"

    # Act
    task = asyncio.create_task(long_task())
    await asyncio.sleep({{short_duration}})  # Let it start
    task.cancel()

    # Assert
    with pytest.raises(asyncio.CancelledError):
        await task
```

## Adaptation Rules

- [ ] Replace `{{module_name}}`, `{{async_function}}` with actual names
- [ ] Update imports to match your async libraries (aiohttp, httpx, etc.)
- [ ] Add `@pytest.mark.asyncio` to ALL async test functions
- [ ] Use `async def` for async fixtures that need async setup/teardown
- [ ] Use `AsyncGenerator` type hint for async generator fixtures
- [ ] Always await async functions and context managers
- [ ] Use `asyncio.gather()` for concurrent operations
- [ ] Use `asyncio.wait_for()` for timeout testing
- [ ] Clean up async resources in fixtures or teardown
- [ ] Configure pytest-asyncio in pytest.ini

## Related

- Rule: @rules/async-testing.md (async testing best practices)
- Rule: @rules/pytest-asyncio-setup.md (pytest-asyncio configuration)
- Template: @templates/pytest/test_basic_unit.py (for sync functions)
- Template: @templates/pytest/test_integration.py (for async database operations)

## pytest.ini Configuration for Async Tests

```ini
[pytest]
asyncio_mode = auto  # or 'strict' to require explicit marker

markers =
    asyncio: marks test as async (automatically applied with asyncio_mode=auto)
    slow: marks async tests that are slow

# Install pytest-asyncio:
# pip install pytest-asyncio
```

## requirements.txt / pyproject.toml

```txt
pytest>=7.0.0
pytest-asyncio>=0.21.0
aiohttp>=3.8.0  # if testing HTTP
asyncio>=3.4.3
```

## Notes

### The @pytest.mark.asyncio Decorator

Always use on async test functions:

```python
# ✅ Correct
@pytest.mark.asyncio
async def test_async_function():
    result = await async_function()
    assert result

# ❌ Wrong - will not run as async
async def test_async_function():
    result = await async_function()
```

### Async Fixtures

Use `async def` for fixtures with async setup:

```python
@pytest.fixture
async def async_client():
    async with aiohttp.ClientSession() as session:
        yield session
    # Automatically cleaned up
```

### Concurrent Testing with asyncio.gather()

Test multiple async operations:

```python
results = await asyncio.gather(
    async_func(1),
    async_func(2),
    async_func(3)
)
assert len(results) == 3
```

### Error Handling in Concurrent Operations

Use `return_exceptions=True` to capture exceptions:

```python
results = await asyncio.gather(
    async_func(valid),
    async_func(invalid),
    return_exceptions=True
)
assert isinstance(results[1], Exception)
```

### Timeout Testing

Use `asyncio.wait_for()`:

```python
try:
    result = await asyncio.wait_for(
        slow_function(),
        timeout=5.0
    )
except asyncio.TimeoutError:
    pytest.fail("Operation timed out")
```

### Event Loop Best Practices

Let pytest-asyncio manage the event loop:

```python
# ✅ Good - pytest-asyncio handles it
@pytest.mark.asyncio
async def test_something():
    await async_function()

# ❌ Avoid - don't create your own loop in tests
def test_something():
    loop = asyncio.new_event_loop()
    loop.run_until_complete(async_function())
```
