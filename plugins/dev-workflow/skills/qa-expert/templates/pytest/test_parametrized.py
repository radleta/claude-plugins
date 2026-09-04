# Template: Parametrized Test

**When to Use**: Testing the same logic with multiple different inputs, testing edge cases systematically, or when you have many similar test cases that differ only in input and expected output.

**Complexity**: Low

**Common Mistakes Agents Make**:
- Using unclear parameter names in @pytest.mark.parametrize (use descriptive IDs)
- Not using the `ids` parameter to make test names readable
- Putting too many parameters in one parametrize (split into separate tests)
- Missing important edge cases in parameter lists
- Not testing error cases alongside success cases
- Combining unrelated test scenarios in one parametrize
- Using parametrize when fixtures would be clearer
- Not using indirect parametrization when fixture setup varies

## Template

```python
"""
Parametrized tests for {{module_name}}.

Tests {{functionality}} with multiple inputs using pytest.mark.parametrize.
Covers edge cases, boundary conditions, and various input combinations.
"""
from typing import Any, List, Tuple, Optional
import pytest

from {{package_name}}.{{module_name}} import (
    {{function_name}},
    {{validator_function}},
    {{transformer_function}},
)


# ============================================================================
# PARAMETRIZED TESTS - Basic Usage
# ============================================================================

@pytest.mark.parametrize(
    "{{input_param}}, expected",
    [
        ({{value1}}, {{expected1}}),
        ({{value2}}, {{expected2}}),
        ({{value3}}, {{expected3}}),
    ],
)
def test_{{function}}_with_various_inputs({{input_param}}, expected):
    """
    Test {{function}} returns correct result for various inputs.

    GIVEN: Different input values
    WHEN: {{function}} is called with each input
    THEN: Should return corresponding expected result
    """
    # Act
    result = {{function}}({{input_param}})

    # Assert
    assert result == expected


# ============================================================================
# PARAMETRIZED TESTS - With Descriptive IDs
# ============================================================================

@pytest.mark.parametrize(
    "{{input_param}}, expected",
    [
        ({{value1}}, {{expected1}}),
        ({{value2}}, {{expected2}}),
        ({{value3}}, {{expected3}}),
    ],
    ids=[
        "{{descriptive_test_name_1}}",
        "{{descriptive_test_name_2}}",
        "{{descriptive_test_name_3}}",
    ],
)
def test_{{function}}_with_descriptive_ids({{input_param}}, expected):
    """
    Test {{function}} with clear test case IDs.

    GIVEN: Various {{input_type}} inputs
    WHEN: {{function}} processes each input
    THEN: Should return expected result for each case
    """
    # Act
    result = {{function}}({{input_param}})

    # Assert
    assert result == expected


# ============================================================================
# PARAMETRIZED TESTS - Edge Cases and Boundaries
# ============================================================================

@pytest.mark.parametrize(
    "{{input_param}}, expected",
    [
        # Empty/zero cases
        ({{empty_value}}, {{empty_expected}}),
        (0, {{zero_expected}}),

        # Boundary values
        ({{min_value}}, {{min_expected}}),
        ({{max_value}}, {{max_expected}}),

        # Negative cases
        (-1, {{negative_expected}}),
        ({{large_negative}}, {{large_negative_expected}}),

        # Large values
        ({{large_value}}, {{large_expected}}),

        # Special characters (if string)
        ("{{special_chars}}", {{special_expected}}),
    ],
    ids=[
        "empty_input",
        "zero_value",
        "minimum_boundary",
        "maximum_boundary",
        "negative_one",
        "large_negative",
        "large_positive",
        "special_characters",
    ],
)
def test_{{function}}_edge_cases({{input_param}}, expected):
    """
    Test {{function}} handles edge cases and boundary values correctly.

    GIVEN: Edge case inputs (empty, zero, boundaries, special values)
    WHEN: {{function}} processes edge cases
    THEN: Should handle each case appropriately
    """
    # Act
    result = {{function}}({{input_param}})

    # Assert
    assert result == expected


# ============================================================================
# PARAMETRIZED TESTS - Multiple Parameters
# ============================================================================

@pytest.mark.parametrize(
    "{{param1}}, {{param2}}, expected",
    [
        ({{value1a}}, {{value1b}}, {{expected1}}),
        ({{value2a}}, {{value2b}}, {{expected2}}),
        ({{value3a}}, {{value3b}}, {{expected3}}),
    ],
    ids=["{{case1}}", "{{case2}}", "{{case3}}"],
)
def test_{{function}}_with_multiple_params({{param1}}, {{param2}}, expected):
    """
    Test {{function}} with multiple varying parameters.

    GIVEN: Different combinations of {{param1}} and {{param2}}
    WHEN: {{function}} is called with each combination
    THEN: Should return expected result for each combination
    """
    # Act
    result = {{function}}({{param1}}, {{param2}})

    # Assert
    assert result == expected


# ============================================================================
# PARAMETRIZED TESTS - Testing Exceptions
# ============================================================================

@pytest.mark.parametrize(
    "{{invalid_input}}, expected_exception, error_message",
    [
        ({{invalid1}}, {{ExceptionType1}}, "{{error_msg1}}"),
        ({{invalid2}}, {{ExceptionType2}}, "{{error_msg2}}"),
        (None, TypeError, "{{none_error_msg}}"),
        ("{{invalid_string}}", ValueError, "{{value_error_msg}}"),
    ],
    ids=[
        "invalid_type_1",
        "invalid_type_2",
        "none_input",
        "invalid_string_format",
    ],
)
def test_{{function}}_raises_exceptions(
    {{invalid_input}},
    expected_exception,
    error_message
):
    """
    Test {{function}} raises appropriate exceptions for invalid inputs.

    GIVEN: Invalid inputs that should raise exceptions
    WHEN: {{function}} is called with invalid input
    THEN: Should raise expected exception with appropriate message
    """
    # Act & Assert
    with pytest.raises(expected_exception, match=error_message):
        {{function}}({{invalid_input}})


# ============================================================================
# PARAMETRIZED TESTS - Boolean/Validation Tests
# ============================================================================

@pytest.mark.parametrize(
    "{{input_value}}, expected_valid",
    [
        # Valid cases
        ({{valid1}}, True),
        ({{valid2}}, True),
        ({{valid3}}, True),

        # Invalid cases
        ({{invalid1}}, False),
        ({{invalid2}}, False),
        ({{invalid3}}, False),
    ],
    ids=[
        "valid_case_1",
        "valid_case_2",
        "valid_case_3",
        "invalid_case_1",
        "invalid_case_2",
        "invalid_case_3",
    ],
)
def test_{{validator}}_correctly_validates({{input_value}}, expected_valid):
    """
    Test {{validator}} correctly identifies valid and invalid inputs.

    GIVEN: Mix of valid and invalid inputs
    WHEN: {{validator}} validates each input
    THEN: Should return True for valid, False for invalid
    """
    # Act
    result = {{validator}}({{input_value}})

    # Assert
    assert result is expected_valid


# ============================================================================
# PARAMETRIZED TESTS - With Fixtures (Indirect Parametrization)
# ============================================================================

@pytest.fixture
def {{setup_fixture}}(request) -> {{FixtureType}}:
    """
    Provide parametrized fixture setup.

    This fixture receives parameter values from parametrize via indirect.

    Args:
        request: pytest request object with param attribute

    Returns:
        {{FixtureType}}: Configured fixture based on parameter
    """
    {{config}} = request.param
    {{fixture_object}} = {{FixtureClass}}({{config}})
    {{fixture_object}}.setup()

    yield {{fixture_object}}

    {{fixture_object}}.teardown()


@pytest.mark.parametrize(
    "{{setup_fixture}}",
    [{{config1}}, {{config2}}, {{config3}}],
    indirect=True,
    ids=["config_1", "config_2", "config_3"],
)
def test_{{function}}_with_different_configs({{setup_fixture}}: {{FixtureType}}):
    """
    Test {{function}} with different fixture configurations.

    GIVEN: Fixture configured with different parameters
    WHEN: {{function}} uses configured fixture
    THEN: Should work correctly with each configuration
    """
    # Act
    result = {{function}}({{setup_fixture}})

    # Assert
    assert result is not None
    assert {{setup_fixture}}.{{state_check}}


# ============================================================================
# PARAMETRIZED TESTS - Combining Multiple Parametrize Decorators
# ============================================================================

@pytest.mark.parametrize("{{param1}}", [{{value1a}}, {{value1b}}, {{value1c}}])
@pytest.mark.parametrize("{{param2}}", [{{value2a}}, {{value2b}}])
def test_{{function}}_with_cartesian_product({{param1}}, {{param2}}):
    """
    Test {{function}} with all combinations of parameters (cartesian product).

    This creates {{total_combinations}} test cases from all combinations.

    GIVEN: All combinations of {{param1}} and {{param2}}
    WHEN: {{function}} is called with each combination
    THEN: Should work correctly for all combinations
    """
    # Act
    result = {{function}}({{param1}}, {{param2}})

    # Assert
    assert result is not None
    # Add specific assertions based on your logic


# ============================================================================
# PARAMETRIZED TESTS - Complex Data Structures
# ============================================================================

@pytest.mark.parametrize(
    "input_data, expected",
    [
        (
            {"{{key1}}": {{value1}}, "{{key2}}": {{value2}}},
            {{expected_dict_1}}
        ),
        (
            {"{{key1}}": {{value3}}, "{{key2}}": {{value4}}},
            {{expected_dict_2}}
        ),
        (
            [{{list_item1}}, {{list_item2}}, {{list_item3}}],
            {{expected_list_result}}
        ),
    ],
    ids=["dict_case_1", "dict_case_2", "list_case"],
)
def test_{{function}}_with_complex_data(input_data, expected):
    """
    Test {{function}} with complex data structures (dicts, lists, nested).

    GIVEN: Complex data structures as input
    WHEN: {{function}} processes data
    THEN: Should transform or validate correctly
    """
    # Act
    result = {{function}}(input_data)

    # Assert
    assert result == expected


# ============================================================================
# PARAMETRIZED TESTS - Using pytest.param for Custom Test Cases
# ============================================================================

@pytest.mark.parametrize(
    "{{input_param}}, expected",
    [
        pytest.param({{value1}}, {{expected1}}, id="normal_case"),
        pytest.param({{value2}}, {{expected2}}, id="edge_case"),
        pytest.param(
            {{value3}},
            {{expected3}},
            marks=pytest.mark.slow,
            id="slow_computation"
        ),
        pytest.param(
            {{value4}},
            {{expected4}},
            marks=pytest.mark.xfail(reason="Known bug #123"),
            id="known_failure"
        ),
    ],
)
def test_{{function}}_with_pytest_param({{input_param}}, expected):
    """
    Test {{function}} using pytest.param for custom test configuration.

    Uses pytest.param to add marks or skip specific test cases.

    GIVEN: Various inputs with custom test markers
    WHEN: {{function}} processes each input
    THEN: Should return expected result (respecting markers)
    """
    # Act
    result = {{function}}({{input_param}})

    # Assert
    assert result == expected


# ============================================================================
# PARAMETRIZED TESTS - String Processing/Transformation
# ============================================================================

@pytest.mark.parametrize(
    "input_string, expected_output",
    [
        ("{{lowercase}}", "{{expected_lowercase}}"),
        ("{{UPPERCASE}}", "{{expected_uppercase}}"),
        ("{{MixedCase}}", "{{expected_mixed}}"),
        ("{{with spaces}}", "{{expected_spaces}}"),
        ("{{with-special-chars!}}", "{{expected_special}}"),
        ("", "{{expected_empty}}"),
        ("   ", "{{expected_whitespace}}"),
        ("{{unicode: 你好}}", "{{expected_unicode}}"),
    ],
    ids=[
        "lowercase_input",
        "uppercase_input",
        "mixed_case",
        "spaces",
        "special_characters",
        "empty_string",
        "whitespace_only",
        "unicode_characters",
    ],
)
def test_{{transformer}}_string_variations(input_string, expected_output):
    """
    Test {{transformer}} handles various string formats.

    GIVEN: Strings with different cases, special chars, unicode
    WHEN: {{transformer}} processes each string
    THEN: Should transform according to specification
    """
    # Act
    result = {{transformer}}(input_string)

    # Assert
    assert result == expected_output


# ============================================================================
# PARAMETRIZED TESTS - Numeric Calculations
# ============================================================================

@pytest.mark.parametrize(
    "num1, num2, operation, expected",
    [
        (10, 5, "add", 15),
        (10, 5, "subtract", 5),
        (10, 5, "multiply", 50),
        (10, 5, "divide", 2.0),
        (10, 0, "divide", None),  # Division by zero case
        (-10, 5, "add", -5),
        (0, 0, "multiply", 0),
    ],
    ids=[
        "addition",
        "subtraction",
        "multiplication",
        "division",
        "division_by_zero",
        "negative_numbers",
        "zero_multiplication",
    ],
)
def test_{{calculator}}_operations(num1, num2, operation, expected):
    """
    Test {{calculator}} performs various operations correctly.

    GIVEN: Two numbers and an operation
    WHEN: {{calculator}} performs the operation
    THEN: Should return correct result or None for invalid ops
    """
    # Act
    result = {{calculator}}(num1, num2, operation)

    # Assert
    if expected is None:
        assert result is None
    else:
        assert result == expected


# ============================================================================
# PARAMETRIZED CLASS TESTS
# ============================================================================

class Test{{ClassName}}:
    """Parametrized tests organized in a class."""

    @pytest.mark.parametrize(
        "{{input_param}}, expected",
        [
            ({{value1}}, {{expected1}}),
            ({{value2}}, {{expected2}}),
            ({{value3}}, {{expected3}}),
        ],
        ids=["case_1", "case_2", "case_3"],
    )
    def test_{{method}}_variations(self, {{input_param}}, expected):
        """
        Test {{method}} with various inputs.

        GIVEN: Different input values
        WHEN: {{method}} is called
        THEN: Should return expected result
        """
        # Arrange
        instance = {{ClassName}}()

        # Act
        result = instance.{{method}}({{input_param}})

        # Assert
        assert result == expected

    @pytest.mark.parametrize(
        "initial_state, action, expected_state",
        [
            ({{state1}}, {{action1}}, {{expected_state1}}),
            ({{state2}}, {{action2}}, {{expected_state2}}),
            ({{state3}}, {{action3}}, {{expected_state3}}),
        ],
        ids=["transition_1", "transition_2", "transition_3"],
    )
    def test_state_transitions(self, initial_state, action, expected_state):
        """
        Test state transitions with various actions.

        GIVEN: Object in initial state
        WHEN: Action is performed
        THEN: Should transition to expected state
        """
        # Arrange
        instance = {{ClassName}}(state=initial_state)

        # Act
        instance.perform(action)

        # Assert
        assert instance.state == expected_state


# ============================================================================
# PARAMETRIZED TESTS - Using External Data
# ============================================================================

@pytest.mark.parametrize(
    "test_case",
    [
        {"input": {{value1}}, "expected": {{expected1}}, "description": "{{desc1}}"},
        {"input": {{value2}}, "expected": {{expected2}}, "description": "{{desc2}}"},
        {"input": {{value3}}, "expected": {{expected3}}, "description": "{{desc3}}"},
    ],
    ids=lambda tc: tc["description"],
)
def test_{{function}}_with_dict_params(test_case):
    """
    Test {{function}} using dictionary-based test cases.

    GIVEN: Test case with input, expected, and description
    WHEN: {{function}} processes input
    THEN: Should match expected output
    """
    # Act
    result = {{function}}(test_case["input"])

    # Assert
    assert result == test_case["expected"]
```

## Adaptation Rules

- [ ] Replace `{{module_name}}`, `{{function}}`, `{{input_param}}` with actual names
- [ ] Always use descriptive parameter names (not `a`, `b`, `x`, `y`)
- [ ] Use `ids` parameter or `id` in pytest.param for readable test names
- [ ] Group related test cases together in one parametrize
- [ ] Split unrelated test scenarios into separate test functions
- [ ] Test both success and error cases in separate parametrize blocks
- [ ] Use `indirect=True` when parametrizing fixtures
- [ ] Use multiple `@pytest.mark.parametrize` decorators for cartesian products
- [ ] Use `pytest.param()` with `marks` for conditional tests
- [ ] Consider using `pytest.mark.xfail` for known failures

## Related

- Rule: @rules/parametrize-best-practices.md (parametrization patterns)
- Rule: @rules/test-organization.md (organizing parametrized tests)
- Template: @templates/pytest/test_basic_unit.py (for non-parametrized tests)
- Pattern: @patterns/data-driven-testing.md (external test data)

## pytest.ini Configuration

```ini
[pytest]
# Show parametrize values in test output
console_output_style = progress
# Or: console_output_style = count

# Verbose output shows parameter values
addopts = -v
```

## Notes

### Using ids for Readable Test Names

Always provide descriptive IDs:

```python
# ✅ Good - readable test names
@pytest.mark.parametrize(
    "value, expected",
    [
        (10, 100),
        (-5, 25),
    ],
    ids=["positive_number", "negative_number"]
)

# ❌ Avoid - unclear test names
@pytest.mark.parametrize(
    "value, expected",
    [
        (10, 100),
        (-5, 25),
    ]
)
# Test names: test_func[10-100], test_func[-5-25]
```

### Parametrize vs Fixtures

Use parametrize for simple input variations, fixtures for complex setup:

```python
# ✅ Good - simple values use parametrize
@pytest.mark.parametrize("value", [1, 2, 3])

# ✅ Good - complex setup uses fixture
@pytest.fixture
def database():
    db = Database()
    db.connect()
    yield db
    db.disconnect()
```

### Indirect Parametrization

Use `indirect=True` to pass parameters through fixtures:

```python
@pytest.fixture
def user(request):
    return User(role=request.param)

@pytest.mark.parametrize(
    "user",
    ["admin", "guest"],
    indirect=True
)
def test_permissions(user):
    assert user.role in ["admin", "guest"]
```

### Combining Parametrize Decorators

Creates cartesian product of all parameters:

```python
@pytest.mark.parametrize("x", [1, 2])
@pytest.mark.parametrize("y", [3, 4])
def test_multiply(x, y):
    # Creates 4 tests: (1,3), (1,4), (2,3), (2,4)
    assert x * y > 0
```

### Using pytest.param for Markers

Add marks to specific test cases:

```python
@pytest.mark.parametrize(
    "value, expected",
    [
        pytest.param(1, 2, id="normal"),
        pytest.param(999, 1000, marks=pytest.mark.slow, id="slow"),
        pytest.param(None, None, marks=pytest.mark.xfail, id="known_bug"),
    ]
)
```

### Don't Over-Parametrize

Split unrelated test scenarios:

```python
# ❌ Avoid - mixing unrelated cases
@pytest.mark.parametrize("input, expected", [
    (valid_email, True),
    (invalid_email, False),
    (valid_phone, True),  # Different validation logic!
])

# ✅ Good - separate test functions
@pytest.mark.parametrize("email, expected", [
    (valid_email, True),
    (invalid_email, False),
])
def test_email_validation(email, expected):
    pass

@pytest.mark.parametrize("phone, expected", [
    (valid_phone, True),
])
def test_phone_validation(phone, expected):
    pass
```
