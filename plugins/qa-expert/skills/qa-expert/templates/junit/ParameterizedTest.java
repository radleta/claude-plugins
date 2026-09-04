# Template: Parameterized Tests

**When to Use**: Testing same logic with multiple inputs, boundary value testing, testing different combinations, or data-driven testing.

**Complexity**: Low

**Common Mistakes Agents Make**:
- Not using `@DisplayName` with parameter placeholders like `{0}`, `{1}`, `{index}`
- Missing null and empty cases in test data
- Using `@ParameterizedTest` without a source annotation (@ValueSource, @CsvSource, etc.)
- Not naming test parameters descriptively in `@MethodSource`
- Hardcoding test data in test method instead of using source annotations
- Using wrong parameter types in method signature
- Not testing edge cases (min, max, zero, negative)
- Creating overly complex `@MethodSource` methods
- Not using `@NullSource` and `@EmptySource` for null/empty testing
- Forgetting to add descriptive names to @CsvSource rows

## Maven Dependencies

```xml
<dependencies>
    <!-- JUnit 5 (Jupiter) -->
    <dependency>
        <groupId>org.junit.jupiter</groupId>
        <artifactId>junit-jupiter</artifactId>
        <version>5.10.1</version>
        <scope>test</scope>
    </dependency>

    <!-- JUnit 5 Parameterized Tests -->
    <dependency>
        <groupId>org.junit.jupiter</groupId>
        <artifactId>junit-jupiter-params</artifactId>
        <version>5.10.1</version>
        <scope>test</scope>
    </dependency>
</dependencies>
```

## Gradle Dependencies

```gradle
dependencies {
    testImplementation 'org.junit.jupiter:junit-jupiter:5.10.1'
    testImplementation 'org.junit.jupiter:junit-jupiter-params:5.10.1'
}

test {
    useJUnitPlatform()
}
```

## Template

```java
package {{package}}.{{module}};

import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;

import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Parameterized tests for {{ClassName}}
 *
 * Tests {{description}} with multiple input combinations
 */
@DisplayName("{{ClassName}} Parameterized Tests")
class {{ClassName}}ParameterizedTest {

    private {{ClassName}} {{objectUnderTest}};

    @BeforeEach
    void setUp() {
        {{objectUnderTest}} = new {{ClassName}}();
    }

    // ==================== @ValueSource TESTS ====================

    @ParameterizedTest(name = "[{index}] {{methodName}}({0}) should return {{expected}}")
    @DisplayName("should handle various {{inputType}} values")
    @ValueSource({{primitiveType}}s = {{{value1}}, {{value2}}, {{value3}}, {{value4}}})
    void shouldHandle{{InputType}}Values({{primitiveType}} input) {
        // Act
        {{ResultType}} result = {{objectUnderTest}}.{{methodName}}(input);

        // Assert
        assertNotNull(result, "Result should not be null for input: " + input);
        assertTrue(result.{{isValid}}(), "Result should be valid for input: " + input);
    }

    @ParameterizedTest(name = "[{index}] should accept string: ''{0}''")
    @ValueSource(strings = {"{{value1}}", "{{value2}}", "{{value3}}", ""})
    void shouldAcceptValidStrings(String input) {
        // Act
        {{ResultType}} result = {{objectUnderTest}}.{{methodName}}(input);

        // Assert
        assertNotNull(result);
    }

    @ParameterizedTest(name = "[{index}] should handle integer: {0}")
    @ValueSource(ints = {0, 1, -1, Integer.MAX_VALUE, Integer.MIN_VALUE})
    void shouldHandleBoundaryIntegers(int input) {
        // Act
        {{ResultType}} result = {{objectUnderTest}}.{{methodName}}(input);

        // Assert
        assertTrue(result >= {{expectedMin}} && result <= {{expectedMax}},
            "Result should be within expected range for input: " + input);
    }

    // ==================== @NullSource and @EmptySource ====================

    @ParameterizedTest
    @NullSource
    @DisplayName("should handle null input")
    void shouldHandleNullInput({{InputType}} input) {
        // Act & Assert
        assertThrows(
            NullPointerException.class,
            () -> {{objectUnderTest}}.{{methodName}}(input),
            "Should throw NullPointerException for null input"
        );
    }

    @ParameterizedTest
    @EmptySource
    @DisplayName("should handle empty string")
    void shouldHandleEmptyString(String input) {
        // Act
        {{ResultType}} result = {{objectUnderTest}}.{{methodName}}(input);

        // Assert
        assertTrue(result.{{isEmpty}}(), "Result should be empty for empty input");
    }

    @ParameterizedTest
    @NullAndEmptySource
    @DisplayName("should handle null and empty strings")
    void shouldHandleNullAndEmptyStrings(String input) {
        // Act & Assert
        assertThrows(
            IllegalArgumentException.class,
            () -> {{objectUnderTest}}.{{methodName}}(input),
            "Should throw exception for null or empty input"
        );
    }

    // ==================== @CsvSource TESTS ====================

    @ParameterizedTest(name = "[{index}] {{methodName}}({0}, {1}) should return {2}")
    @DisplayName("should calculate correct result for various inputs")
    @CsvSource({
        "{{input1}}, {{input2}}, {{expected1}}",
        "{{input1}}, {{input2}}, {{expected2}}",
        "{{input1}}, {{input2}}, {{expected3}}",
        "0, 0, 0",
        "1, 1, 2"
    })
    void shouldCalculateCorrectResult({{Type1}} input1, {{Type2}} input2, {{ResultType}} expected) {
        // Act
        {{ResultType}} actual = {{objectUnderTest}}.{{methodName}}(input1, input2);

        // Assert
        assertEquals(expected, actual,
            String.format("{{methodName}}(%s, %s) should equal %s", input1, input2, expected));
    }

    @ParameterizedTest(name = "[{index}] User ''{0}'' with email ''{1}'' should be {2}")
    @CsvSource({
        "validuser, user@example.com, true",
        "a, short@example.com, false",
        "toolongusernamethatexceedslimit, user@example.com, false",
        "validuser, invalid-email, false",
        "'', user@example.com, false"
    })
    void shouldValidateUser(String username, String email, boolean expectedValid) {
        // Arrange
        {{UserType}} user = new {{UserType}}(username, email);

        // Act
        boolean isValid = {{objectUnderTest}}.{{validateMethod}}(user);

        // Assert
        assertEquals(expectedValid, isValid,
            String.format("User(%s, %s) validation should be %s", username, email, expectedValid));
    }

    @ParameterizedTest
    @CsvSource(delimiterString = "|", textBlock = """
        INPUT           | EXPECTED_OUTPUT | DESCRIPTION
        {{value1}}      | {{result1}}     | Normal case
        {{value2}}      | {{result2}}     | Edge case
        {{value3}}      | {{result3}}     | Boundary case
        {{value4}}      | {{result4}}     | Special case
    """)
    void shouldHandleVariousCases(String input, String expected, String description) {
        // Act
        String actual = {{objectUnderTest}}.{{methodName}}(input);

        // Assert
        assertEquals(expected, actual, description);
    }

    // ==================== @MethodSource TESTS ====================

    @ParameterizedTest(name = "[{index}] {0}")
    @MethodSource("provide{{TestCaseName}}")
    @DisplayName("should handle complex test cases")
    void shouldHandleComplexTestCases({{TestCaseType}} testCase) {
        // Act
        {{ResultType}} result = {{objectUnderTest}}.{{methodName}}(testCase.getInput());

        // Assert
        assertEquals(testCase.getExpected(), result,
            "Failed for test case: " + testCase.getDescription());
    }

    static Stream<{{TestCaseType}}> provide{{TestCaseName}}() {
        return Stream.of(
            new {{TestCaseType}}({{input1}}, {{expected1}}, "{{description1}}"),
            new {{TestCaseType}}({{input2}}, {{expected2}}, "{{description2}}"),
            new {{TestCaseType}}({{input3}}, {{expected3}}, "{{description3}}")
        );
    }

    @ParameterizedTest(name = "[{index}] input={0}, expected={1}")
    @MethodSource("provideSimpleArguments")
    void shouldHandleSimpleArguments({{InputType}} input, {{ExpectedType}} expected) {
        // Act
        {{ResultType}} actual = {{objectUnderTest}}.{{methodName}}(input);

        // Assert
        assertEquals(expected, actual);
    }

    static Stream<Arguments> provideSimpleArguments() {
        return Stream.of(
            Arguments.of({{input1}}, {{expected1}}),
            Arguments.of({{input2}}, {{expected2}}),
            Arguments.of({{input3}}, {{expected3}}),
            Arguments.of({{input4}}, {{expected4}})
        );
    }

    @ParameterizedTest(name = "[{index}] Testing with: {0}")
    @MethodSource("provideComplexObjects")
    void shouldHandleComplexObjects({{ComplexType}} complexObject) {
        // Act
        {{ResultType}} result = {{objectUnderTest}}.{{processMethod}}(complexObject);

        // Assert
        assertNotNull(result);
        assertTrue(result.{{isValid}}());
    }

    static Stream<{{ComplexType}}> provideComplexObjects() {
        return Stream.of(
            {{createComplexObject1}}(),
            {{createComplexObject2}}(),
            {{createComplexObject3}}()
        );
    }

    // ==================== @EnumSource TESTS ====================

    @ParameterizedTest(name = "[{index}] should handle {0}")
    @EnumSource({{EnumType}}.class)
    void shouldHandleAllEnumValues({{EnumType}} enumValue) {
        // Act
        {{ResultType}} result = {{objectUnderTest}}.{{methodName}}(enumValue);

        // Assert
        assertNotNull(result, "Result should not be null for " + enumValue);
    }

    @ParameterizedTest
    @EnumSource(value = {{EnumType}}.class, names = {"{{VALUE1}}", "{{VALUE2}}"})
    @DisplayName("should handle specific enum values")
    void shouldHandleSpecificEnumValues({{EnumType}} enumValue) {
        // Act
        {{ResultType}} result = {{objectUnderTest}}.{{methodName}}(enumValue);

        // Assert
        assertEquals({{expectedValue}}, result.{{getProperty}}());
    }

    @ParameterizedTest
    @EnumSource(value = {{EnumType}}.class, mode = EnumSource.Mode.EXCLUDE, names = {"{{EXCLUDED}}"])
    @DisplayName("should handle all except excluded enum values")
    void shouldHandleAllExceptExcluded({{EnumType}} enumValue) {
        // Act
        boolean result = {{objectUnderTest}}.{{isValidMethod}}(enumValue);

        // Assert
        assertTrue(result, enumValue + " should be valid");
    }

    // ==================== @CsvFileSource TESTS ====================

    @ParameterizedTest(name = "[{index}] Test data from CSV: {0}, {1}")
    @CsvFileSource(resources = "/test-data/{{test-data}}.csv", numLinesToSkip = 1)
    @DisplayName("should process test data from CSV file")
    void shouldProcessTestDataFromCsv({{Type1}} input, {{Type2}} expected) {
        // Act
        {{ResultType}} actual = {{objectUnderTest}}.{{methodName}}(input);

        // Assert
        assertEquals(expected, actual);
    }

    // ==================== @ArgumentsSource TESTS ====================

    @ParameterizedTest
    @ArgumentsSource({{CustomArgumentsProvider}}.class)
    @DisplayName("should handle custom arguments provider")
    void shouldHandleCustomArgumentsProvider({{ArgumentType}} argument) {
        // Act
        {{ResultType}} result = {{objectUnderTest}}.{{methodName}}(argument);

        // Assert
        assertNotNull(result);
    }

    // Custom ArgumentsProvider implementation
    static class {{CustomArgumentsProvider}} implements ArgumentsProvider {
        @Override
        public Stream<? extends Arguments> provideArguments(ExtensionContext context) {
            return Stream.of(
                Arguments.of({{value1}}),
                Arguments.of({{value2}}),
                Arguments.of({{value3}})
            );
        }
    }

    // ==================== COMBINATION TESTS ====================

    @ParameterizedTest(name = "[{index}] {0} combined with {1} should produce {2}")
    @MethodSource("provideCombinations")
    void shouldHandleCombinations({{Type1}} param1, {{Type2}} param2, {{ResultType}} expected) {
        // Act
        {{ResultType}} actual = {{objectUnderTest}}.{{combineMethod}}(param1, param2);

        // Assert
        assertEquals(expected, actual,
            String.format("Combining %s and %s should produce %s", param1, param2, expected));
    }

    static Stream<Arguments> provideCombinations() {
        return Stream.of(
            // Happy path
            Arguments.of({{valid1}}, {{valid2}}, {{expected1}}),

            // Edge cases
            Arguments.of({{edge1}}, {{edge2}}, {{expected2}}),

            // Boundary values
            Arguments.of({{boundary1}}, {{boundary2}}, {{expected3}}),

            // Special cases
            Arguments.of({{special1}}, {{special2}}, {{expected4}})
        );
    }

    // ==================== HELPER CLASSES ====================

    /**
     * Test case container for parameterized tests
     */
    static class {{TestCaseType}} {
        private final {{InputType}} input;
        private final {{ExpectedType}} expected;
        private final String description;

        public {{TestCaseType}}({{InputType}} input, {{ExpectedType}} expected, String description) {
            this.input = input;
            this.expected = expected;
            this.description = description;
        }

        public {{InputType}} getInput() {
            return input;
        }

        public {{ExpectedType}} getExpected() {
            return expected;
        }

        public String getDescription() {
            return description;
        }

        @Override
        public String toString() {
            return description;
        }
    }
}
```

## CSV File Format

Create test data file at `src/test/resources/test-data/{{test-data}}.csv`:

```csv
input,expected
{{value1}},{{result1}}
{{value2}},{{result2}}
{{value3}},{{result3}}
{{value4}},{{result4}}
```

## Adaptation Rules

- [ ] Replace `{{ClassName}}` with class being tested
- [ ] Replace `{{methodName}}` with method being tested
- [ ] Choose appropriate source annotation: @ValueSource, @CsvSource, @MethodSource, etc.
- [ ] Use descriptive `@DisplayName` with parameter placeholders: `{0}`, `{1}`, `{index}`
- [ ] Test happy path, edge cases, and boundary values
- [ ] Use `@NullSource` and `@EmptySource` for null/empty testing
- [ ] Create `@MethodSource` for complex test cases
- [ ] Use `@CsvSource` for multiple parameter combinations
- [ ] Use `@EnumSource` for testing all enum values
- [ ] Create helper classes for complex test case data

## Related

- Template: @templates/junit/BasicUnitTest.java (for non-parameterized tests)

## Example: Calculator Parameterized Test

```java
package com.example.calculator;

import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;

import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Calculator Parameterized Tests")
class CalculatorParameterizedTest {

    private Calculator calculator;

    @BeforeEach
    void setUp() {
        calculator = new Calculator();
    }

    @ParameterizedTest(name = "[{index}] {0} + {1} = {2}")
    @CsvSource({
        "1, 2, 3",
        "0, 0, 0",
        "-1, 1, 0",
        "100, 200, 300",
        "-5, -3, -8"
    })
    @DisplayName("should add two numbers correctly")
    void shouldAddTwoNumbersCorrectly(int a, int b, int expected) {
        // Act
        int actual = calculator.add(a, b);

        // Assert
        assertEquals(expected, actual,
            String.format("%d + %d should equal %d", a, b, expected));
    }

    @ParameterizedTest(name = "[{index}] {0} / {1} = {2}")
    @CsvSource({
        "10, 2, 5",
        "9, 3, 3",
        "15, 5, 3",
        "-10, 2, -5",
        "7, 2, 3"  // Integer division
    })
    @DisplayName("should divide two numbers correctly")
    void shouldDivideTwoNumbersCorrectly(int dividend, int divisor, int expected) {
        // Act
        int actual = calculator.divide(dividend, divisor);

        // Assert
        assertEquals(expected, actual);
    }

    @ParameterizedTest
    @ValueSource(ints = {0, 1, 2, 3, 100, -1, Integer.MAX_VALUE})
    @DisplayName("should square any integer")
    void shouldSquareAnyInteger(int input) {
        // Act
        long result = calculator.square(input);

        // Assert
        assertEquals((long) input * input, result);
    }

    @ParameterizedTest(name = "[{index}] {0} is {1}")
    @MethodSource("provideNumbersForPrimeTest")
    @DisplayName("should correctly identify prime numbers")
    void shouldCorrectlyIdentifyPrimeNumbers(int number, boolean expectedPrime) {
        // Act
        boolean isPrime = calculator.isPrime(number);

        // Assert
        assertEquals(expectedPrime, isPrime,
            number + (expectedPrime ? " should be prime" : " should not be prime"));
    }

    static Stream<Arguments> provideNumbersForPrimeTest() {
        return Stream.of(
            Arguments.of(2, true),
            Arguments.of(3, true),
            Arguments.of(4, false),
            Arguments.of(5, true),
            Arguments.of(17, true),
            Arguments.of(20, false),
            Arguments.of(1, false),
            Arguments.of(0, false),
            Arguments.of(-5, false)
        );
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"  ", "\t", "\n"})
    @DisplayName("should reject invalid input strings")
    void shouldRejectInvalidInputStrings(String input) {
        // Act & Assert
        assertThrows(
            IllegalArgumentException.class,
            () -> calculator.parseExpression(input),
            "Should throw exception for invalid input: '" + input + "'"
        );
    }
}
```

## Notes

### Parameter Placeholders in @DisplayName

Use placeholders to show parameter values in test names:
- `{0}`, `{1}`, `{2}` - Parameter by index
- `{index}` - Test invocation index

```java
@ParameterizedTest(name = "[{index}] add({0}, {1}) = {2}")
@CsvSource({"1, 2, 3", "2, 3, 5"})
void testAdd(int a, int b, int expected) { }
```

### Choosing the Right Source

```java
@ValueSource       // Single primitive or string values
@NullSource        // Null input
@EmptySource       // Empty strings/collections
@CsvSource         // Multiple parameters per test
@MethodSource      // Complex objects or dynamic data
@EnumSource        // All enum values
@CsvFileSource     // External CSV file
@ArgumentsSource   // Custom provider
```

### @MethodSource Best Practices

```java
// ✅ Good: Static method returns Stream<Arguments>
@MethodSource("provideTestCases")
static Stream<Arguments> provideTestCases() {
    return Stream.of(
        Arguments.of(input1, expected1),
        Arguments.of(input2, expected2)
    );
}

// ✅ Good: For single parameters, return Stream<Type>
@MethodSource("provideStrings")
static Stream<String> provideStrings() {
    return Stream.of("test1", "test2", "test3");
}
```
