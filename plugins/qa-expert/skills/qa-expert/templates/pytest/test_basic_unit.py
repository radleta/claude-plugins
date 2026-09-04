# Template: Basic Unit Test

**When to Use**: Testing pure functions, business logic, utilities, data transformations, calculations, validators, or any code with no external dependencies.

**Complexity**: Low

**Common Mistakes Agents Make**:
- Using generic test names like `test_function()` instead of descriptive names like `test_calculates_total_with_tax()`
- Not following the AAA (Arrange-Act-Assert) pattern clearly
- Missing edge cases (empty inputs, None, zero, negative numbers)
- Not using pytest's assert features (just using `assert` without clear failure messages)
- Forgetting to test error conditions and exceptions
- Not testing boundary conditions (min/max values)
- Using multiple asserts that test different concerns in one test
- Not using pytest fixtures for common test data setup

## Template

```python
"""
Tests for {{module_name}} module.

{{Brief description of what this module does and what we're testing.}}
"""
from typing import List, Optional, Dict, Any
import pytest

from {{package_name}}.{{module_name}} import (
    {{function_name}},
    {{another_function}},
    {{class_name}},
)


# ============================================================================
# FIXTURES - Reusable test data and setup
# ============================================================================

@pytest.fixture
def {{sample_data_fixture}}() -> {{DataType}}:
    """
    Provides {{description of what this fixture provides}}.

    Returns:
        {{DataType}}: {{Description of return value}}
    """
    return {{DataType}}(
        {{field1}}={{value1}},
        {{field2}}={{value2}},
    )


@pytest.fixture
def {{list_fixture}}() -> List[{{ItemType}}]:
    """
    Provides a list of {{description}} for testing.
    """
    return [
        {{ItemType}}({{field}}={{value1}}),
        {{ItemType}}({{field}}={{value2}}),
        {{ItemType}}({{field}}={{value3}}),
    ]


# ============================================================================
# TESTS - {{FunctionName}} function
# ============================================================================

class Test{{FunctionName}}:
    """Tests for {{function_name}} function."""

    def test_{{function_name}}_with_valid_input(self):
        """
        Test {{function_name}} returns expected result with valid input.

        GIVEN: Valid input {{data_description}}
        WHEN: {{function_name}} is called
        THEN: Should return {{expected_result}}
        """
        # Arrange
        {{input_var}} = {{valid_input_value}}
        expected = {{expected_value}}

        # Act
        result = {{function_name}}({{input_var}})

        # Assert
        assert result == expected

    def test_{{function_name}}_with_empty_input(self):
        """
        Test {{function_name}} handles empty input correctly.

        GIVEN: Empty {{input_type}}
        WHEN: {{function_name}} is called
        THEN: Should return {{expected_behavior}}
        """
        # Arrange
        {{input_var}} = {{empty_value}}

        # Act
        result = {{function_name}}({{input_var}})

        # Assert
        assert result == {{expected_empty_result}}

    def test_{{function_name}}_with_none_input(self):
        """
        Test {{function_name}} handles None input.

        GIVEN: None as input
        WHEN: {{function_name}} is called
        THEN: Should raise {{ExceptionType}} or return {{default_value}}
        """
        # Arrange
        {{input_var}} = None

        # Act & Assert
        with pytest.raises({{ExceptionType}}, match="{{expected_error_message}}"):
            {{function_name}}({{input_var}})

    def test_{{function_name}}_with_boundary_values(self):
        """
        Test {{function_name}} handles boundary values.

        GIVEN: Boundary value input (min/max)
        WHEN: {{function_name}} is called
        THEN: Should handle correctly without overflow or errors
        """
        # Arrange
        min_value = {{min_boundary}}
        max_value = {{max_boundary}}

        # Act
        result_min = {{function_name}}(min_value)
        result_max = {{function_name}}(max_value)

        # Assert
        assert result_min == {{expected_min_result}}
        assert result_max == {{expected_max_result}}

    def test_{{function_name}}_with_invalid_type(self):
        """
        Test {{function_name}} raises TypeError with invalid input type.

        GIVEN: Invalid type (e.g., string instead of int)
        WHEN: {{function_name}} is called
        THEN: Should raise TypeError
        """
        # Arrange
        invalid_input = "{{invalid_value}}"

        # Act & Assert
        with pytest.raises(TypeError):
            {{function_name}}(invalid_input)

    def test_{{function_name}}_maintains_{{property}}(self, {{sample_data_fixture}}):
        """
        Test {{function_name}} maintains {{property_name}} property.

        GIVEN: Input with {{property}}
        WHEN: {{function_name}} processes it
        THEN: Output should maintain {{property}}
        """
        # Arrange
        input_data = {{sample_data_fixture}}

        # Act
        result = {{function_name}}(input_data)

        # Assert
        assert {{property_check}}(result)
        assert result.{{attribute}} == input_data.{{attribute}}


# ============================================================================
# TESTS - {{ClassName}} class
# ============================================================================

class Test{{ClassName}}:
    """Tests for {{ClassName}} class."""

    def test_initialization_with_valid_params(self):
        """
        Test {{ClassName}} initializes correctly with valid parameters.

        GIVEN: Valid initialization parameters
        WHEN: Creating {{ClassName}} instance
        THEN: Should set all attributes correctly
        """
        # Arrange
        {{param1}} = {{value1}}
        {{param2}} = {{value2}}

        # Act
        instance = {{ClassName}}({{param1}}, {{param2}})

        # Assert
        assert instance.{{param1}} == {{param1}}
        assert instance.{{param2}} == {{param2}}

    def test_{{method_name}}_returns_expected_result(self):
        """
        Test {{method_name}} method returns correct result.

        GIVEN: {{ClassName}} instance with {{state}}
        WHEN: {{method_name}} is called
        THEN: Should return {{expected_result}}
        """
        # Arrange
        instance = {{ClassName}}({{param1}}={{value1}})
        {{input_var}} = {{input_value}}

        # Act
        result = instance.{{method_name}}({{input_var}})

        # Assert
        assert result == {{expected_value}}

    def test_{{method_name}}_modifies_state_correctly(self):
        """
        Test {{method_name}} updates internal state correctly.

        GIVEN: {{ClassName}} instance with initial state
        WHEN: {{method_name}} is called
        THEN: Should update state to {{new_state}}
        """
        # Arrange
        instance = {{ClassName}}({{initial_state}})
        original_{{attribute}} = instance.{{attribute}}

        # Act
        instance.{{method_name}}({{new_value}})

        # Assert
        assert instance.{{attribute}} != original_{{attribute}}
        assert instance.{{attribute}} == {{expected_new_value}}

    def test_{{method_name}}_raises_on_invalid_state(self):
        """
        Test {{method_name}} raises exception when called in invalid state.

        GIVEN: {{ClassName}} instance in invalid state
        WHEN: {{method_name}} is called
        THEN: Should raise {{ExceptionType}}
        """
        # Arrange
        instance = {{ClassName}}({{invalid_state_params}})

        # Act & Assert
        with pytest.raises({{ExceptionType}}, match="{{expected_message}}"):
            instance.{{method_name}}()


# ============================================================================
# TESTS - {{UtilityFunctionName}}
# ============================================================================

def test_{{utility_function}}_with_typical_input():
    """
    Test {{utility_function}} with typical use case.

    GIVEN: Typical {{input_description}}
    WHEN: {{utility_function}} is called
    THEN: Should return {{expected_output}}
    """
    # Arrange
    {{input}} = {{typical_value}}

    # Act
    result = {{utility_function}}({{input}})

    # Assert
    assert result == {{expected}}


def test_{{utility_function}}_is_idempotent():
    """
    Test {{utility_function}} is idempotent (calling twice gives same result).

    GIVEN: Any valid input
    WHEN: {{utility_function}} is called twice
    THEN: Both results should be identical
    """
    # Arrange
    {{input}} = {{value}}

    # Act
    result1 = {{utility_function}}({{input}})
    result2 = {{utility_function}}({{input}})

    # Assert
    assert result1 == result2


def test_{{validator_function}}_accepts_valid_input():
    """
    Test {{validator_function}} returns True for valid input.

    GIVEN: Valid {{input_type}}
    WHEN: {{validator_function}} validates it
    THEN: Should return True
    """
    # Arrange
    valid_{{input}} = {{valid_value}}

    # Act
    result = {{validator_function}}(valid_{{input}})

    # Assert
    assert result is True


def test_{{validator_function}}_rejects_invalid_input():
    """
    Test {{validator_function}} returns False for invalid input.

    GIVEN: Invalid {{input_type}}
    WHEN: {{validator_function}} validates it
    THEN: Should return False
    """
    # Arrange
    invalid_{{input}} = {{invalid_value}}

    # Act
    result = {{validator_function}}(invalid_{{input}})

    # Assert
    assert result is False


# ============================================================================
# TESTS - Complex scenarios
# ============================================================================

def test_{{function_name}}_with_multiple_operations({{list_fixture}}):
    """
    Test {{function_name}} correctly handles multiple operations.

    GIVEN: List of {{items}}
    WHEN: {{function_name}} processes all items
    THEN: Should return aggregated result
    """
    # Arrange
    items = {{list_fixture}}
    expected_count = len(items)

    # Act
    result = {{function_name}}(items)

    # Assert
    assert len(result) == expected_count
    assert all({{condition}} for {{item}} in result)
```

## Adaptation Rules

- [ ] Replace `{{module_name}}` with the actual module being tested
- [ ] Replace `{{function_name}}`, `{{class_name}}` with actual names
- [ ] Update imports to match your project structure
- [ ] Remove test classes/functions for code you're not testing
- [ ] Add more edge cases specific to your domain
- [ ] Ensure all fixtures return appropriate types with type hints
- [ ] Use descriptive test names that explain what's being tested
- [ ] Follow AAA (Arrange-Act-Assert) pattern in every test
- [ ] Add GIVEN-WHEN-THEN comments for complex tests
- [ ] Use `pytest.raises()` for exception testing
- [ ] Group related tests in test classes

## Related

- Rule: @rules/pytest-best-practices.md (pytest conventions)
- Rule: @rules/aaa-pattern.md (Arrange-Act-Assert structure)
- Template: @templates/pytest/test_parametrized.py (for testing multiple inputs)
- Template: @templates/pytest/test_mock.py (when you need to mock dependencies)

## pytest.ini Configuration

```ini
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts =
    -v
    --strict-markers
    --tb=short
    --cov={{package_name}}
    --cov-report=term-missing
    --cov-report=html
```

## Notes

### AAA Pattern (Arrange-Act-Assert)

Always structure tests with three clear sections:

```python
def test_example():
    # Arrange - Set up test data and preconditions
    input_value = 42
    expected = 84

    # Act - Execute the code under test
    result = double(input_value)

    # Assert - Verify the result
    assert result == expected
```

### Clear Failure Messages

Use pytest's assert introspection or add messages:

```python
# ✅ Good - pytest shows clear failure with values
assert result == expected

# ✅ Good - custom message for complex assertions
assert result > 0, f"Expected positive result, got {result}"

# ❌ Avoid - unclear what failed
assert some_complex_condition()
```

### Exception Testing

Always use `pytest.raises()` with match parameter:

```python
# ✅ Good - tests exception type and message
with pytest.raises(ValueError, match="must be positive"):
    calculate(-1)

# ❌ Avoid - doesn't verify exception message
with pytest.raises(ValueError):
    calculate(-1)
```

### Test Organization

Group related tests using classes:

```python
class TestCalculator:
    """Tests for Calculator class."""

    def test_add(self):
        pass

    def test_subtract(self):
        pass
```

### Fixtures for Test Data

Use fixtures instead of duplicating setup code:

```python
# ✅ Good - reusable fixture
@pytest.fixture
def calculator():
    return Calculator()

def test_add(calculator):
    assert calculator.add(2, 3) == 5

# ❌ Avoid - duplicated setup
def test_add():
    calculator = Calculator()
    assert calculator.add(2, 3) == 5
```
