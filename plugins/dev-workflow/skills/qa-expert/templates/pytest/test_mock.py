# Template: Mock and Patch Test

**When to Use**: Testing code with external dependencies (APIs, databases, file systems, third-party services) that you want to isolate, or testing error conditions that are hard to reproduce.

**Complexity**: Medium

**Common Mistakes Agents Make**:
- Over-mocking: Mocking too much implementation detail instead of just external boundaries
- Not using `pytest-mock` (monkeypatch/mocker fixtures) which are cleaner than unittest.mock
- Mocking the wrong target (mock where imported, not where defined)
- Creating overly complex mock setups that are harder to maintain than the code being tested
- Not verifying mock calls (assert_called_once_with, etc.)
- Using `patch` decorator incorrectly (wrong order of parameters)
- Not resetting mocks between tests (pytest-mock handles this automatically)
- Mocking return values incorrectly (return_value vs side_effect)

## Template

```python
"""
Tests for {{module_name}} using mocks and patches.

Tests code with external dependencies by mocking {{dependencies_description}}.
Uses pytest-mock plugin for cleaner mocking patterns.
"""
from typing import Dict, Any, List, Optional
from unittest.mock import Mock, MagicMock, call, ANY
import pytest
from pytest_mock import MockerFixture

from {{package_name}}.{{module_name}} import (
    {{function_with_dependency}},
    {{class_with_dependency}},
    {{service_class}},
)


# ============================================================================
# FIXTURES - Mock objects and test data
# ============================================================================

@pytest.fixture
def mock_{{dependency}}(mocker: MockerFixture) -> Mock:
    """
    Provide a mock {{dependency}} instance.

    Args:
        mocker: pytest-mock fixture

    Returns:
        Mock: Mocked {{dependency}} instance
    """
    mock = mocker.Mock()
    mock.{{method}}.return_value = {{default_return_value}}
    return mock


@pytest.fixture
def mock_{{external_service}}(mocker: MockerFixture) -> Mock:
    """
    Provide a mock {{external_service}} with configured responses.

    Args:
        mocker: pytest-mock fixture

    Returns:
        Mock: Configured mock service
    """
    mock = mocker.Mock()
    mock.{{method1}}.return_value = {"{{key}}": "{{value}}"}
    mock.{{method2}}.side_effect = {{ExceptionType}}("{{error_message}}")
    return mock


@pytest.fixture
def {{sample_data}}() -> Dict[str, Any]:
    """
    Provide sample data for testing.

    Returns:
        Dict[str, Any]: Test data
    """
    return {
        "{{key1}}": "{{value1}}",
        "{{key2}}": {{value2}},
    }


# ============================================================================
# TESTS - Mocking Function Dependencies with mocker.patch
# ============================================================================

def test_{{function}}_with_mocked_dependency(mocker: MockerFixture):
    """
    Test {{function}} with mocked external dependency.

    GIVEN: External dependency is mocked
    WHEN: {{function}} is called
    THEN: Should use mocked dependency and return expected result
    """
    # Arrange
    mock_{{dependency}} = mocker.patch("{{package_name}}.{{module_name}}.{{DependencyClass}}")
    mock_instance = mock_{{dependency}}.return_value
    mock_instance.{{method}}.return_value = {{expected_value}}

    {{input_param}} = {{input_value}}

    # Act
    result = {{function}}_with_dependency({{input_param}})

    # Assert
    assert result == {{expected_value}}
    mock_instance.{{method}}.assert_called_once_with({{input_param}})


def test_{{function}}_with_api_call_mocked(mocker: MockerFixture):
    """
    Test {{function}} with mocked API call.

    GIVEN: API call is mocked to return specific response
    WHEN: {{function}} makes API call
    THEN: Should process mocked response correctly
    """
    # Arrange
    mock_response = {
        "{{key}}": "{{value}}",
        "status": "success"
    }
    mock_get = mocker.patch("requests.get")
    mock_get.return_value.json.return_value = mock_response
    mock_get.return_value.status_code = 200

    # Act
    result = {{function}}_with_dependency("{{url}}")

    # Assert
    assert result["{{key}}"] == "{{value}}"
    mock_get.assert_called_once_with("{{url}}")


def test_{{function}}_handles_api_error(mocker: MockerFixture):
    """
    Test {{function}} handles API errors correctly.

    GIVEN: API call is mocked to raise exception
    WHEN: {{function}} makes API call
    THEN: Should handle exception appropriately
    """
    # Arrange
    mock_get = mocker.patch("requests.get")
    mock_get.side_effect = {{ExceptionType}}("{{error_message}}")

    # Act & Assert
    with pytest.raises({{YourCustomException}}):
        {{function}}_with_dependency("{{url}}")


# ============================================================================
# TESTS - Mocking Class Dependencies
# ============================================================================

class Test{{ClassWithDependency}}:
    """Tests for {{ClassWithDependency}} with mocked dependencies."""

    def test_initialization_with_mock(self, mock_{{dependency}}: Mock):
        """
        Test {{ClassWithDependency}} initialization with mock dependency.

        GIVEN: Mocked dependency
        WHEN: Creating {{ClassWithDependency}} instance
        THEN: Should initialize correctly
        """
        # Act
        instance = {{ClassWithDependency}}({{dependency}}=mock_{{dependency}})

        # Assert
        assert instance.{{dependency}} is mock_{{dependency}}

    def test_{{method}}_calls_dependency_correctly(
        self,
        mock_{{dependency}}: Mock
    ):
        """
        Test {{method}} calls dependency with correct parameters.

        GIVEN: {{ClassWithDependency}} with mocked dependency
        WHEN: {{method}} is called
        THEN: Should call dependency method with correct args
        """
        # Arrange
        instance = {{ClassWithDependency}}({{dependency}}=mock_{{dependency}})
        mock_{{dependency}}.{{dependency_method}}.return_value = {{expected_value}}

        # Act
        result = instance.{{method}}({{param}})

        # Assert
        assert result == {{expected_value}}
        mock_{{dependency}}.{{dependency_method}}.assert_called_once_with({{param}})

    def test_{{method}}_handles_dependency_exception(
        self,
        mock_{{dependency}}: Mock
    ):
        """
        Test {{method}} handles dependency exception.

        GIVEN: Dependency raises exception
        WHEN: {{method}} is called
        THEN: Should handle exception or propagate
        """
        # Arrange
        instance = {{ClassWithDependency}}({{dependency}}=mock_{{dependency}})
        mock_{{dependency}}.{{dependency_method}}.side_effect = {{ExceptionType}}("{{error}}")

        # Act & Assert
        with pytest.raises({{ExceptionType}}):
            instance.{{method}}({{param}})


# ============================================================================
# TESTS - Mocking Multiple Dependencies
# ============================================================================

def test_{{function}}_with_multiple_mocks(mocker: MockerFixture):
    """
    Test {{function}} with multiple mocked dependencies.

    GIVEN: Multiple external dependencies are mocked
    WHEN: {{function}} orchestrates multiple dependencies
    THEN: Should call all dependencies correctly
    """
    # Arrange
    mock_{{dependency1}} = mocker.patch("{{package_name}}.{{module_name}}.{{Dependency1}}")
    mock_{{dependency2}} = mocker.patch("{{package_name}}.{{module_name}}.{{Dependency2}}")

    mock_{{dependency1}}.return_value.{{method1}}.return_value = {{value1}}
    mock_{{dependency2}}.return_value.{{method2}}.return_value = {{value2}}

    # Act
    result = {{function}}({{param}})

    # Assert
    assert result == {{expected_combined_result}}
    mock_{{dependency1}}.return_value.{{method1}}.assert_called_once()
    mock_{{dependency2}}.return_value.{{method2}}.assert_called_once()


# ============================================================================
# TESTS - Using side_effect for Complex Behaviors
# ============================================================================

def test_{{function}}_with_side_effect_sequence(mocker: MockerFixture):
    """
    Test {{function}} with mock returning different values on successive calls.

    GIVEN: Mock configured with side_effect sequence
    WHEN: {{function}} calls dependency multiple times
    THEN: Should receive different values each time
    """
    # Arrange
    mock_{{dependency}} = mocker.patch("{{package_name}}.{{module_name}}.{{DependencyClass}}")
    mock_{{dependency}}.return_value.{{method}}.side_effect = [
        {{first_value}},
        {{second_value}},
        {{third_value}},
    ]

    # Act
    results = [
        {{function}}({{param1}}),
        {{function}}({{param2}}),
        {{function}}({{param3}}),
    ]

    # Assert
    assert results == [{{first_value}}, {{second_value}}, {{third_value}}]
    assert mock_{{dependency}}.return_value.{{method}}.call_count == 3


def test_{{function}}_with_side_effect_function(mocker: MockerFixture):
    """
    Test {{function}} with mock using side_effect callable.

    GIVEN: Mock configured with side_effect function
    WHEN: {{function}} calls dependency with various inputs
    THEN: Side effect function should process inputs correctly
    """
    # Arrange
    def side_effect_func({{param}}):
        if {{param}} == {{special_value}}:
            raise {{ExceptionType}}("{{error}}")
        return f"processed_{{{param}}}"

    mock_{{dependency}} = mocker.patch("{{package_name}}.{{module_name}}.{{DependencyClass}}")
    mock_{{dependency}}.return_value.{{method}}.side_effect = side_effect_func

    # Act
    result = {{function}}({{normal_param}})

    # Assert
    assert result == "processed_{{normal_param}}"

    # Act & Assert error case
    with pytest.raises({{ExceptionType}}):
        {{function}}({{special_value}})


# ============================================================================
# TESTS - Verifying Mock Calls
# ============================================================================

def test_{{function}}_calls_dependency_correct_number_of_times(
    mocker: MockerFixture
):
    """
    Test {{function}} calls dependency expected number of times.

    GIVEN: Mocked dependency
    WHEN: {{function}} processes list of items
    THEN: Should call dependency once per item
    """
    # Arrange
    mock_{{dependency}} = mocker.patch("{{package_name}}.{{module_name}}.{{DependencyClass}}")
    items = [{{item1}}, {{item2}}, {{item3}}]

    # Act
    {{function}}(items)

    # Assert
    assert mock_{{dependency}}.return_value.{{method}}.call_count == len(items)


def test_{{function}}_calls_dependency_with_correct_arguments(
    mocker: MockerFixture
):
    """
    Test {{function}} calls dependency with expected arguments.

    GIVEN: Mocked dependency
    WHEN: {{function}} is called
    THEN: Should pass correct arguments to dependency
    """
    # Arrange
    mock_{{dependency}} = mocker.patch("{{package_name}}.{{module_name}}.{{DependencyClass}}")

    # Act
    {{function}}({{param1}}, {{param2}})

    # Assert
    mock_{{dependency}}.return_value.{{method}}.assert_called_once_with(
        {{param1}},
        {{param2}},
        {{keyword_arg}}={{keyword_value}}
    )


def test_{{function}}_calls_multiple_methods_in_order(
    mocker: MockerFixture
):
    """
    Test {{function}} calls multiple dependency methods in correct order.

    GIVEN: Mocked dependency with multiple methods
    WHEN: {{function}} orchestrates workflow
    THEN: Should call methods in expected order
    """
    # Arrange
    mock_{{dependency}} = mocker.patch("{{package_name}}.{{module_name}}.{{DependencyClass}}")
    mock_instance = mock_{{dependency}}.return_value

    # Act
    {{function}}()

    # Assert
    expected_calls = [
        call.{{method1}}({{arg1}}),
        call.{{method2}}({{arg2}}),
        call.{{method3}}({{arg3}}),
    ]
    assert mock_instance.mock_calls == expected_calls


# ============================================================================
# TESTS - Mocking File System Operations
# ============================================================================

def test_{{function}}_reads_file_correctly(mocker: MockerFixture):
    """
    Test {{function}} reads file content correctly with mocked file system.

    GIVEN: File system operations are mocked
    WHEN: {{function}} reads file
    THEN: Should process mocked file content correctly
    """
    # Arrange
    mock_open = mocker.patch("builtins.open", mocker.mock_open(read_data="{{file_content}}"))

    # Act
    result = {{function}}("{{file_path}}")

    # Assert
    assert result == {{expected_processed_content}}
    mock_open.assert_called_once_with("{{file_path}}", "r")


def test_{{function}}_writes_file_correctly(mocker: MockerFixture):
    """
    Test {{function}} writes correct content to file.

    GIVEN: File system operations are mocked
    WHEN: {{function}} writes to file
    THEN: Should write expected content
    """
    # Arrange
    mock_open = mocker.patch("builtins.open", mocker.mock_open())
    content = "{{content_to_write}}"

    # Act
    {{function}}("{{file_path}}", content)

    # Assert
    mock_open.assert_called_once_with("{{file_path}}", "w")
    mock_open().write.assert_called_once_with(content)


# ============================================================================
# TESTS - Mocking Environment and Configuration
# ============================================================================

def test_{{function}}_uses_environment_variable(mocker: MockerFixture):
    """
    Test {{function}} uses environment variable correctly.

    GIVEN: Environment variable is mocked
    WHEN: {{function}} reads configuration
    THEN: Should use mocked environment value
    """
    # Arrange
    mocker.patch.dict("os.environ", {"{{ENV_VAR}}": "{{mock_value}}"})

    # Act
    result = {{function}}()

    # Assert
    assert result.config.{{setting}} == "{{mock_value}}"


def test_{{function}}_with_monkeypatch(monkeypatch: pytest.MonkeyPatch):
    """
    Test {{function}} with monkeypatch for simple attribute mocking.

    GIVEN: Module attribute is monkeypatched
    WHEN: {{function}} uses that attribute
    THEN: Should use monkeypatched value
    """
    # Arrange
    monkeypatch.setattr(
        "{{package_name}}.{{module_name}}.{{CONSTANT}}",
        "{{mocked_value}}"
    )

    # Act
    result = {{function}}()

    # Assert
    assert "{{mocked_value}}" in result


# ============================================================================
# TESTS - Spying on Real Objects
# ============================================================================

def test_{{function}}_with_spy_on_real_object(mocker: MockerFixture):
    """
    Test {{function}} using spy to track calls while using real implementation.

    GIVEN: Real dependency with spy attached
    WHEN: {{function}} calls real dependency
    THEN: Should track calls but use real implementation
    """
    # Arrange
    real_{{dependency}} = {{DependencyClass}}()
    spy = mocker.spy(real_{{dependency}}, "{{method}}")

    # Act
    result = {{function}}(real_{{dependency}})

    # Assert
    assert result == {{expected_real_result}}
    spy.assert_called_once_with({{expected_arg}})


# ============================================================================
# TESTS - Partial Mocking with MagicMock
# ============================================================================

def test_{{function}}_with_partial_mock(mocker: MockerFixture):
    """
    Test {{function}} with partially mocked object (some methods mocked, some real).

    GIVEN: Object with some methods mocked
    WHEN: {{function}} uses both mocked and real methods
    THEN: Should use appropriate implementation for each
    """
    # Arrange
    mock_{{dependency}} = mocker.Mock(spec={{DependencyClass}})
    mock_{{dependency}}.{{mocked_method}}.return_value = {{mocked_value}}
    # {{real_method}} uses real implementation via wraps
    real_instance = {{DependencyClass}}()
    mocker.patch.object(
        mock_{{dependency}},
        "{{real_method}}",
        side_effect=real_instance.{{real_method}}
    )

    # Act
    result = {{function}}(mock_{{dependency}})

    # Assert
    assert result.{{field_from_mock}} == {{mocked_value}}
    mock_{{dependency}}.{{mocked_method}}.assert_called_once()


# ============================================================================
# TESTS - Mocking Async Functions
# ============================================================================

@pytest.mark.asyncio
async def test_{{async_function}}_with_mocked_async_dependency(
    mocker: MockerFixture
):
    """
    Test {{async_function}} with mocked async dependency.

    GIVEN: Async dependency is mocked
    WHEN: {{async_function}} awaits dependency
    THEN: Should receive mocked return value
    """
    # Arrange
    mock_{{async_dependency}} = mocker.patch(
        "{{package_name}}.{{module_name}}.{{async_dependency_function}}",
        return_value={{expected_value}}
    )

    # Act
    result = await {{async_function}}({{param}})

    # Assert
    assert result == {{expected_value}}
    mock_{{async_dependency}}.assert_called_once_with({{param}})
```

## Adaptation Rules

- [ ] Replace `{{module_name}}`, `{{function}}`, `{{dependency}}` with actual names
- [ ] Use `mocker` fixture from pytest-mock instead of unittest.mock.patch
- [ ] Mock at the import boundary (where used, not where defined)
- [ ] Use `spec=` parameter to ensure mocks match real interface
- [ ] Verify mock calls with `assert_called_once_with()` or `assert_called_with()`
- [ ] Use `side_effect` for exceptions or sequences of return values
- [ ] Use `monkeypatch` for simple attribute/dict modifications
- [ ] Use `mocker.spy()` when you need to track calls but use real implementation
- [ ] Don't over-mock - only mock external boundaries
- [ ] Reset is automatic with pytest-mock (no manual cleanup needed)

## Related

- Rule: @rules/mocking-best-practices.md (when and what to mock)
- Rule: @rules/pytest-mock-usage.md (pytest-mock patterns)
- Template: @templates/pytest/test_basic_unit.py (for code without dependencies)
- Template: @templates/pytest/test_integration.py (for real dependency integration)

## pytest.ini Configuration

```ini
[pytest]
# pytest-mock is automatically available when installed
# No special configuration needed
```

## requirements.txt / pyproject.toml

```txt
pytest>=7.0.0
pytest-mock>=3.10.0  # Provides mocker fixture
```

## Notes

### Mock vs Patch vs Spy

Choose the right tool:

```python
# Mock - Replace with fake object
mock = mocker.Mock()

# Patch - Replace import/attribute
mocker.patch("module.Class")

# Spy - Track calls to real object
spy = mocker.spy(obj, "method")
```

### Where to Patch

Always patch where the object is used, not where it's defined:

```python
# module_a.py
class Service:
    pass

# module_b.py
from module_a import Service

def function():
    service = Service()

# ❌ Wrong - patches definition
mocker.patch("module_a.Service")

# ✅ Correct - patches usage
mocker.patch("module_b.Service")
```

### return_value vs side_effect

Use correctly based on need:

```python
# return_value - Simple return
mock.method.return_value = 42

# side_effect - Exception
mock.method.side_effect = ValueError("error")

# side_effect - Sequence
mock.method.side_effect = [1, 2, 3]

# side_effect - Function
mock.method.side_effect = lambda x: x * 2
```

### Verifying Mock Calls

```python
# Called at least once
mock.method.assert_called()

# Called exactly once
mock.method.assert_called_once()

# Called once with specific args
mock.method.assert_called_once_with(arg1, arg2)

# Called with args (any number of times)
mock.method.assert_called_with(arg1, arg2)

# Never called
mock.method.assert_not_called()

# Check call count
assert mock.method.call_count == 3
```

### Using spec for Type Safety

Always use `spec=` to ensure mocks match real interfaces:

```python
# ✅ Good - mock matches real class interface
mock = mocker.Mock(spec=RealClass)

# ❌ Avoid - allows calling non-existent methods
mock = mocker.Mock()
```

### Don't Over-Mock

Only mock external boundaries:

```python
# ✅ Good - mock external API
mock_requests = mocker.patch("requests.get")

# ❌ Avoid - mocking internal logic you should test
mock_calculate = mocker.patch("mymodule.calculate_total")
```
