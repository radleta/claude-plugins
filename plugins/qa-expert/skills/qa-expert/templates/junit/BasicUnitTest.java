# Template: Basic Unit Test

**When to Use**: Testing business logic, utilities, POJOs, services, and algorithms with no external dependencies.

**Complexity**: Low

**Common Mistakes Agents Make**:
- Not using `@DisplayName` for readable test descriptions
- Poor test method names (e.g., `test1()` instead of `shouldReturnTrueWhenInputIsValid()`)
- Missing edge cases (null, empty, boundary values)
- Not following AAA pattern (Arrange-Act-Assert)
- Testing multiple behaviors in a single test method
- Not using `assertAll()` for multiple related assertions
- Using `assertTrue(expected.equals(actual))` instead of `assertEquals(expected, actual)`
- Not testing exception messages, only exception types
- Hardcoding expected values instead of computing them
- Missing `@Test` annotation causing tests to be skipped

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

    <!-- Optional: AssertJ for fluent assertions -->
    <dependency>
        <groupId>org.assertj</groupId>
        <artifactId>assertj-core</artifactId>
        <version>3.24.2</version>
        <scope>test</scope>
    </dependency>
</dependencies>

<build>
    <plugins>
        <plugin>
            <groupId>org.apache.maven.plugins</groupId>
            <artifactId>maven-surefire-plugin</artifactId>
            <version>3.0.0</version>
        </plugin>
    </plugins>
</build>
```

## Gradle Dependencies

```gradle
dependencies {
    testImplementation 'org.junit.jupiter:junit-jupiter:5.10.1'

    // Optional: AssertJ for fluent assertions
    testImplementation 'org.assertj:assertj-core:3.24.2'
}

test {
    useJUnitPlatform()
}
```

## Template

```java
package {{package}}.{{module}};

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.function.Executable;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {{ClassName}}
 *
 * Tests business logic for {{brief description of class under test}}
 */
@DisplayName("{{ClassName}} Tests")
class {{ClassName}}Test {

    private {{ClassName}} {{objectUnderTest}};
    private {{DependencyType}} {{dependency}};

    /**
     * Set up test fixtures before each test
     * Runs before EVERY @Test method
     */
    @BeforeEach
    void setUp() {
        // Arrange: Initialize test dependencies and object under test
        {{dependency}} = new {{DependencyType}}({{constructorArgs}});
        {{objectUnderTest}} = new {{ClassName}}({{dependency}});
    }

    /**
     * Clean up resources after each test
     * Runs after EVERY @Test method
     */
    @AfterEach
    void tearDown() {
        // Clean up resources if needed
        {{objectUnderTest}} = null;
        {{dependency}} = null;
    }

    /**
     * One-time setup before all tests in this class
     * Runs ONCE before any @Test methods
     */
    @BeforeAll
    static void setUpAll() {
        // Initialize expensive resources shared across all tests
        // Example: database connections, thread pools, etc.
    }

    /**
     * One-time cleanup after all tests in this class
     * Runs ONCE after all @Test methods complete
     */
    @AfterAll
    static void tearDownAll() {
        // Clean up shared resources
    }

    // ==================== HAPPY PATH TESTS ====================

    @Test
    @DisplayName("should {{expected behavior}} when {{condition}}")
    void should{{Behavior}}When{{Condition}}() {
        // Arrange
        {{InputType}} input = {{validInputValue}};
        {{ExpectedType}} expected = {{expectedValue}};

        // Act
        {{ResultType}} actual = {{objectUnderTest}}.{{methodName}}(input);

        // Assert
        assertEquals(expected, actual, "{{Failure message describing what went wrong}}");
    }

    @Test
    @DisplayName("should return {{expected value}} for valid input")
    void shouldReturn{{ExpectedValue}}ForValidInput() {
        // Arrange
        {{InputType}} validInput = {{validValue}};

        // Act
        {{ResultType}} result = {{objectUnderTest}}.{{methodName}}(validInput);

        // Assert
        assertNotNull(result, "Result should not be null");
        assertEquals({{expected}}, result.{{getProperty}}());
    }

    @Test
    @DisplayName("should handle multiple operations correctly")
    void shouldHandleMultipleOperationsCorrectly() {
        // Arrange
        {{InputType}} input1 = {{value1}};
        {{InputType}} input2 = {{value2}};

        // Act
        {{objectUnderTest}}.{{operation1}}(input1);
        {{objectUnderTest}}.{{operation2}}(input2);
        {{ResultType}} result = {{objectUnderTest}}.{{getResult}}();

        // Assert - use assertAll for related assertions
        assertAll("{{Description of assertion group}}",
            () -> assertEquals({{expected1}}, result.{{property1}}(), "{{property1}} should match"),
            () -> assertEquals({{expected2}}, result.{{property2}}(), "{{property2}} should match"),
            () -> assertTrue(result.{{isValid}}(), "Result should be valid")
        );
    }

    // ==================== EDGE CASES ====================

    @Test
    @DisplayName("should handle null input gracefully")
    void shouldHandleNullInputGracefully() {
        // Arrange
        {{InputType}} nullInput = null;

        // Act & Assert
        assertThrows(
            NullPointerException.class,
            () -> {{objectUnderTest}}.{{methodName}}(nullInput),
            "Should throw NullPointerException for null input"
        );
    }

    @Test
    @DisplayName("should handle empty collection")
    void shouldHandleEmptyCollection() {
        // Arrange
        List<{{ElementType}}> emptyList = Collections.emptyList();

        // Act
        {{ResultType}} result = {{objectUnderTest}}.{{methodName}}(emptyList);

        // Assert
        assertNotNull(result, "Result should not be null even for empty input");
        assertTrue(result.{{isEmpty}}(), "Result should be empty");
    }

    @Test
    @DisplayName("should handle boundary value at minimum")
    void shouldHandleBoundaryValueAtMinimum() {
        // Arrange
        {{InputType}} minValue = {{minimumValue}};

        // Act
        {{ResultType}} result = {{objectUnderTest}}.{{methodName}}(minValue);

        // Assert
        assertEquals({{expectedMinResult}}, result);
    }

    @Test
    @DisplayName("should handle boundary value at maximum")
    void shouldHandleBoundaryValueAtMaximum() {
        // Arrange
        {{InputType}} maxValue = {{maximumValue}};

        // Act
        {{ResultType}} result = {{objectUnderTest}}.{{methodName}}(maxValue);

        // Assert
        assertEquals({{expectedMaxResult}}, result);
    }

    // ==================== EXCEPTION TESTS ====================

    @Test
    @DisplayName("should throw {{ExceptionType}} when {{invalid condition}}")
    void shouldThrow{{ExceptionType}}When{{InvalidCondition}}() {
        // Arrange
        {{InputType}} invalidInput = {{invalidValue}};

        // Act & Assert
        {{ExceptionType}} exception = assertThrows(
            {{ExceptionType}}.class,
            () -> {{objectUnderTest}}.{{methodName}}(invalidInput),
            "Expected {{ExceptionType}} to be thrown"
        );

        // Assert exception message
        String expectedMessage = "{{expected error message}}";
        String actualMessage = exception.getMessage();
        assertTrue(actualMessage.contains(expectedMessage),
            "Exception message should contain: " + expectedMessage);
    }

    @Test
    @DisplayName("should not throw exception for valid input")
    void shouldNotThrowExceptionForValidInput() {
        // Arrange
        {{InputType}} validInput = {{validValue}};

        // Act & Assert
        assertDoesNotThrow(
            () -> {{objectUnderTest}}.{{methodName}}(validInput),
            "Should not throw exception for valid input"
        );
    }

    // ==================== STATE VERIFICATION ====================

    @Test
    @DisplayName("should maintain correct state after operation")
    void shouldMaintainCorrectStateAfterOperation() {
        // Arrange
        {{InputType}} input = {{value}};

        // Act
        {{objectUnderTest}}.{{mutatingMethod}}(input);

        // Assert
        assertAll("State verification",
            () -> assertEquals({{expectedState1}}, {{objectUnderTest}}.{{getState1}}()),
            () -> assertTrue({{objectUnderTest}}.{{isStateValid}}()),
            () -> assertFalse({{objectUnderTest}}.{{isStateInvalid}}())
        );
    }
}
```

## Adaptation Rules

- [ ] Replace `{{ClassName}}` with the class being tested (PascalCase)
- [ ] Replace `{{objectUnderTest}}` with camelCase instance name
- [ ] Replace `{{methodName}}` with actual method names being tested
- [ ] Replace `{{InputType}}`, `{{ResultType}}` with actual types
- [ ] Add/remove test methods based on class complexity
- [ ] Update `@DisplayName` with descriptive test names
- [ ] Follow AAA pattern in every test: Arrange, Act, Assert
- [ ] Use `assertAll()` for multiple related assertions
- [ ] Test happy path, edge cases, and exceptions
- [ ] Ensure all test methods have `@Test` annotation
- [ ] Use descriptive assertion failure messages

## Related

- Template: @templates/junit/MockTest.java (if class has dependencies)
- Template: @templates/junit/ParameterizedTest.java (for testing multiple inputs)
- Template: @templates/junit/IntegrationTest.java (if testing requires Spring context)

## Example: Calculator Unit Test

```java
package com.example.calculator;

import org.junit.jupiter.api.*;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for Calculator
 *
 * Tests arithmetic operations for integer calculations
 */
@DisplayName("Calculator Tests")
class CalculatorTest {

    private Calculator calculator;

    @BeforeEach
    void setUp() {
        calculator = new Calculator();
    }

    @AfterEach
    void tearDown() {
        calculator = null;
    }

    // ==================== ADDITION TESTS ====================

    @Test
    @DisplayName("should return sum of two positive numbers")
    void shouldReturnSumOfTwoPositiveNumbers() {
        // Arrange
        int a = 5;
        int b = 3;
        int expected = 8;

        // Act
        int actual = calculator.add(a, b);

        // Assert
        assertEquals(expected, actual, "5 + 3 should equal 8");
    }

    @Test
    @DisplayName("should handle addition with zero")
    void shouldHandleAdditionWithZero() {
        // Arrange
        int a = 5;
        int b = 0;

        // Act
        int result = calculator.add(a, b);

        // Assert
        assertEquals(a, result, "Adding zero should return original value");
    }

    @Test
    @DisplayName("should handle negative numbers in addition")
    void shouldHandleNegativeNumbersInAddition() {
        // Arrange
        int a = -5;
        int b = 3;
        int expected = -2;

        // Act
        int actual = calculator.add(a, b);

        // Assert
        assertEquals(expected, actual, "-5 + 3 should equal -2");
    }

    // ==================== DIVISION TESTS ====================

    @Test
    @DisplayName("should divide two numbers correctly")
    void shouldDivideTwoNumbersCorrectly() {
        // Arrange
        int dividend = 10;
        int divisor = 2;
        int expected = 5;

        // Act
        int actual = calculator.divide(dividend, divisor);

        // Assert
        assertEquals(expected, actual, "10 / 2 should equal 5");
    }

    @Test
    @DisplayName("should throw ArithmeticException when dividing by zero")
    void shouldThrowArithmeticExceptionWhenDividingByZero() {
        // Arrange
        int dividend = 10;
        int divisor = 0;

        // Act & Assert
        ArithmeticException exception = assertThrows(
            ArithmeticException.class,
            () -> calculator.divide(dividend, divisor),
            "Expected ArithmeticException when dividing by zero"
        );

        assertTrue(exception.getMessage().contains("divide by zero"),
            "Exception message should mention 'divide by zero'");
    }

    @Test
    @DisplayName("should handle integer division truncation")
    void shouldHandleIntegerDivisionTruncation() {
        // Arrange
        int dividend = 7;
        int divisor = 2;
        int expected = 3; // Integer division truncates

        // Act
        int actual = calculator.divide(dividend, divisor);

        // Assert
        assertEquals(expected, actual, "7 / 2 should equal 3 (integer division)");
    }

    // ==================== MULTIPLE OPERATIONS ====================

    @Test
    @DisplayName("should handle multiple operations correctly")
    void shouldHandleMultipleOperationsCorrectly() {
        // Arrange & Act
        int result1 = calculator.add(5, 3);        // 8
        int result2 = calculator.multiply(result1, 2); // 16
        int result3 = calculator.subtract(result2, 6); // 10

        // Assert
        assertAll("Multiple operations",
            () -> assertEquals(8, result1, "First operation should equal 8"),
            () -> assertEquals(16, result2, "Second operation should equal 16"),
            () -> assertEquals(10, result3, "Final result should equal 10")
        );
    }
}
```

## Notes

### AAA Pattern (Arrange-Act-Assert)

Every test should follow this pattern:

```java
@Test
void testMethod() {
    // Arrange: Set up test data and dependencies
    InputType input = createTestInput();

    // Act: Execute the method being tested
    ResultType result = objectUnderTest.methodName(input);

    // Assert: Verify the result
    assertEquals(expected, result);
}
```

### Assertion Best Practices

```java
// ✅ Good: Use specific assertions
assertEquals(expected, actual, "Descriptive message");
assertNotNull(result);
assertTrue(list.isEmpty());

// ❌ Bad: Generic assertions
assertTrue(expected.equals(actual)); // Use assertEquals instead
assertNotNull(result.toString());    // Don't call methods in assertions
```

### Test Naming Conventions

```java
// ✅ Good: Descriptive method names
shouldReturnTrueWhenInputIsValid()
shouldThrowExceptionWhenInputIsNull()
shouldCalculateTotalForMultipleItems()

// ❌ Bad: Vague method names
test1()
testAdd()
testValidation()
```

### @DisplayName Usage

Always use `@DisplayName` for human-readable test descriptions:

```java
@Test
@DisplayName("should return user profile when user exists in database")
void shouldReturnUserProfileWhenUserExistsInDatabase() {
    // Test implementation
}
```

This appears in test reports and IDE test runners, making failures easier to understand.
