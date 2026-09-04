# Template: Mock Testing with Mockito

**When to Use**: Testing code with external dependencies (databases, REST APIs, file systems, third-party services) by mocking those dependencies.

**Complexity**: Medium

**Common Mistakes Agents Make**:
- Over-mocking (mocking everything instead of testing real behavior)
- Not using `@InjectMocks` properly with constructor injection
- Complex `verify()` chains that are hard to maintain
- Not resetting mocks between tests
- Using `any()` matchers inconsistently (mixing matchers and concrete values)
- Not stubbing void methods with `doNothing()`, `doThrow()`, etc.
- Verifying internal implementation details instead of behavior
- Not using `ArgumentCaptor` to verify complex objects
- Mocking value objects or DTOs (should use real instances)
- Not testing that mocked methods are actually called

## Maven Dependencies

```xml
<dependencies>
    <!-- JUnit 5 -->
    <dependency>
        <groupId>org.junit.jupiter</groupId>
        <artifactId>junit-jupiter</artifactId>
        <version>5.10.1</version>
        <scope>test</scope>
    </dependency>

    <!-- Mockito with JUnit 5 -->
    <dependency>
        <groupId>org.mockito</groupId>
        <artifactId>mockito-junit-jupiter</artifactId>
        <version>5.7.0</version>
        <scope>test</scope>
    </dependency>

    <!-- Optional: MockitoExtension is included above -->
</dependencies>
```

## Gradle Dependencies

```gradle
dependencies {
    testImplementation 'org.junit.jupiter:junit-jupiter:5.10.1'
    testImplementation 'org.mockito:mockito-junit-jupiter:5.7.0'
}

test {
    useJUnitPlatform()
}
```

## Template

```java
package {{package}}.{{module}};

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

/**
 * Mock tests for {{ClassName}}
 *
 * Tests {{ClassName}} behavior with mocked dependencies
 */
@ExtendWith(MockitoExtension.class) // Enables Mockito annotations
@DisplayName("{{ClassName}} Mock Tests")
class {{ClassName}}MockTest {

    @Mock // Creates a mock instance
    private {{DependencyType}} {{mockDependency}};

    @Mock
    private {{AnotherDependencyType}} {{anotherMockDependency}};

    @InjectMocks // Injects mocks into this instance
    private {{ClassName}} {{objectUnderTest}};

    @Captor // Captures arguments passed to mocked methods
    private ArgumentCaptor<{{ArgumentType}}> {{argumentCaptor}};

    @BeforeEach
    void setUp() {
        // MockitoExtension automatically initializes @Mock and @InjectMocks
        // Additional setup if needed
    }

    @AfterEach
    void tearDown() {
        // Verify no unexpected interactions (optional, use sparingly)
        // verifyNoMoreInteractions({{mockDependency}});
    }

    // ==================== BASIC MOCKING ====================

    @Test
    @DisplayName("should return mocked value when dependency is called")
    void shouldReturnMockedValueWhenDependencyIsCalled() {
        // Arrange
        {{InputType}} input = {{testValue}};
        {{ReturnType}} mockedReturn = {{mockValue}};

        when({{mockDependency}}.{{method}}(input))
            .thenReturn(mockedReturn);

        // Act
        {{ResultType}} result = {{objectUnderTest}}.{{methodUnderTest}}(input);

        // Assert
        assertNotNull(result);
        assertEquals({{expectedValue}}, result.{{getProperty}}());

        // Verify the mock was called
        verify({{mockDependency}}, times(1)).{{method}}(input);
    }

    @Test
    @DisplayName("should handle null return from dependency")
    void shouldHandleNullReturnFromDependency() {
        // Arrange
        {{InputType}} input = {{testValue}};

        when({{mockDependency}}.{{method}}(input))
            .thenReturn(null);

        // Act
        {{ResultType}} result = {{objectUnderTest}}.{{methodUnderTest}}(input);

        // Assert
        assertNull(result, "Should handle null dependency return");
        verify({{mockDependency}}).{{method}}(input);
    }

    @Test
    @DisplayName("should call dependency with correct parameters")
    void shouldCallDependencyWithCorrectParameters() {
        // Arrange
        {{InputType}} input = {{testValue}};

        when({{mockDependency}}.{{method}}(any({{ArgumentType}}.class)))
            .thenReturn({{mockValue}});

        // Act
        {{objectUnderTest}}.{{methodUnderTest}}(input);

        // Assert - Capture argument
        verify({{mockDependency}}).{{method}}({{argumentCaptor}}.capture());

        {{ArgumentType}} capturedArg = {{argumentCaptor}}.getValue();
        assertEquals({{expectedArgValue}}, capturedArg.{{getProperty}}());
    }

    // ==================== EXCEPTION HANDLING ====================

    @Test
    @DisplayName("should throw exception when dependency throws exception")
    void shouldThrowExceptionWhenDependencyThrowsException() {
        // Arrange
        {{InputType}} input = {{testValue}};

        when({{mockDependency}}.{{method}}(input))
            .thenThrow(new {{ExceptionType}}("{{error message}}"));

        // Act & Assert
        {{ExceptionType}} exception = assertThrows(
            {{ExceptionType}}.class,
            () -> {{objectUnderTest}}.{{methodUnderTest}}(input)
        );

        assertEquals("{{expected error message}}", exception.getMessage());
        verify({{mockDependency}}).{{method}}(input);
    }

    @Test
    @DisplayName("should handle exception and provide fallback")
    void shouldHandleExceptionAndProvideFallback() {
        // Arrange
        {{InputType}} input = {{testValue}};

        when({{mockDependency}}.{{method}}(input))
            .thenThrow(new RuntimeException("Service unavailable"));

        // Act
        {{ResultType}} result = {{objectUnderTest}}.{{methodWithFallback}}(input);

        // Assert
        assertNotNull(result, "Should provide fallback value");
        assertEquals({{fallbackValue}}, result.{{getProperty}}());
        verify({{mockDependency}}).{{method}}(input);
    }

    // ==================== VOID METHODS ====================

    @Test
    @DisplayName("should call void method on dependency")
    void shouldCallVoidMethodOnDependency() {
        // Arrange
        {{InputType}} input = {{testValue}};

        doNothing().when({{mockDependency}}).{{voidMethod}}(input);

        // Act
        {{objectUnderTest}}.{{methodUnderTest}}(input);

        // Assert
        verify({{mockDependency}}, times(1)).{{voidMethod}}(input);
    }

    @Test
    @DisplayName("should throw exception from void method")
    void shouldThrowExceptionFromVoidMethod() {
        // Arrange
        {{InputType}} input = {{testValue}};

        doThrow(new {{ExceptionType}}("{{error message}}"))
            .when({{mockDependency}}).{{voidMethod}}(input);

        // Act & Assert
        assertThrows(
            {{ExceptionType}}.class,
            () -> {{objectUnderTest}}.{{methodUnderTest}}(input)
        );

        verify({{mockDependency}}).{{voidMethod}}(input);
    }

    // ==================== MULTIPLE INVOCATIONS ====================

    @Test
    @DisplayName("should return different values on subsequent calls")
    void shouldReturnDifferentValuesOnSubsequentCalls() {
        // Arrange
        {{InputType}} input = {{testValue}};

        when({{mockDependency}}.{{method}}(input))
            .thenReturn({{firstValue}})
            .thenReturn({{secondValue}})
            .thenReturn({{thirdValue}});

        // Act
        {{ResultType}} result1 = {{objectUnderTest}}.{{methodUnderTest}}(input);
        {{ResultType}} result2 = {{objectUnderTest}}.{{methodUnderTest}}(input);
        {{ResultType}} result3 = {{objectUnderTest}}.{{methodUnderTest}}(input);

        // Assert
        assertEquals({{firstValue}}, result1);
        assertEquals({{secondValue}}, result2);
        assertEquals({{thirdValue}}, result3);

        verify({{mockDependency}}, times(3)).{{method}}(input);
    }

    @Test
    @DisplayName("should verify method called multiple times with different arguments")
    void shouldVerifyMethodCalledMultipleTimesWithDifferentArguments() {
        // Arrange
        {{InputType}} input1 = {{value1}};
        {{InputType}} input2 = {{value2}};

        when({{mockDependency}}.{{method}}(any()))
            .thenReturn({{mockValue}});

        // Act
        {{objectUnderTest}}.{{methodUnderTest}}(input1);
        {{objectUnderTest}}.{{methodUnderTest}}(input2);

        // Assert
        verify({{mockDependency}}).{{method}}(input1);
        verify({{mockDependency}}).{{method}}(input2);
        verify({{mockDependency}}, times(2)).{{method}}(any());
    }

    // ==================== ARGUMENT MATCHERS ====================

    @Test
    @DisplayName("should match any argument with any() matcher")
    void shouldMatchAnyArgumentWithAnyMatcher() {
        // Arrange
        when({{mockDependency}}.{{method}}(any({{ArgumentType}}.class)))
            .thenReturn({{mockValue}});

        // Act
        {{ResultType}} result = {{objectUnderTest}}.{{methodUnderTest}}({{anyInput}});

        // Assert
        assertNotNull(result);
        verify({{mockDependency}}).{{method}}(any({{ArgumentType}}.class));
    }

    @Test
    @DisplayName("should match specific values with eq() matcher")
    void shouldMatchSpecificValuesWithEqMatcher() {
        // Arrange
        {{InputType}} specificInput = {{testValue}};

        when({{mockDependency}}.{{method}}(eq(specificInput), anyString()))
            .thenReturn({{mockValue}});

        // Act
        {{objectUnderTest}}.{{methodUnderTest}}(specificInput, "any string");

        // Assert
        verify({{mockDependency}}).{{method}}(eq(specificInput), anyString());
    }

    @Test
    @DisplayName("should use custom argument matcher")
    void shouldUseCustomArgumentMatcher() {
        // Arrange
        when({{mockDependency}}.{{method}}(argThat(arg ->
            arg != null && arg.{{getProperty}}() > {{threshold}}
        ))).thenReturn({{mockValue}});

        // Act
        {{InputType}} input = {{createInputWithValue}}({{highValue}});
        {{ResultType}} result = {{objectUnderTest}}.{{methodUnderTest}}(input);

        // Assert
        assertNotNull(result);
        verify({{mockDependency}}).{{method}}(argThat(arg ->
            arg.{{getProperty}}() > {{threshold}}
        ));
    }

    // ==================== ARGUMENT CAPTORS ====================

    @Test
    @DisplayName("should capture and verify complex argument")
    void shouldCaptureAndVerifyComplexArgument() {
        // Arrange
        {{InputType}} input = {{testValue}};

        when({{mockDependency}}.{{method}}(any({{ArgumentType}}.class)))
            .thenReturn({{mockValue}});

        // Act
        {{objectUnderTest}}.{{methodUnderTest}}(input);

        // Assert
        verify({{mockDependency}}).{{method}}({{argumentCaptor}}.capture());

        {{ArgumentType}} captured = {{argumentCaptor}}.getValue();
        assertAll("Captured argument verification",
            () -> assertEquals({{expectedProperty1}}, captured.{{getProperty1}}()),
            () -> assertEquals({{expectedProperty2}}, captured.{{getProperty2}}()),
            () -> assertTrue(captured.{{isValid}}())
        );
    }

    @Test
    @DisplayName("should capture multiple invocations")
    void shouldCaptureMultipleInvocations() {
        // Arrange
        when({{mockDependency}}.{{method}}(any()))
            .thenReturn({{mockValue}});

        // Act
        {{objectUnderTest}}.{{methodUnderTest}}({{input1}});
        {{objectUnderTest}}.{{methodUnderTest}}({{input2}});
        {{objectUnderTest}}.{{methodUnderTest}}({{input3}});

        // Assert
        verify({{mockDependency}}, times(3)).{{method}}({{argumentCaptor}}.capture());

        List<{{ArgumentType}}> capturedArgs = {{argumentCaptor}}.getAllValues();
        assertEquals(3, capturedArgs.size());
        assertEquals({{expectedValue1}}, capturedArgs.get(0).{{getProperty}}());
        assertEquals({{expectedValue2}}, capturedArgs.get(1).{{getProperty}}());
        assertEquals({{expectedValue3}}, capturedArgs.get(2).{{getProperty}}());
    }

    // ==================== VERIFICATION ====================

    @Test
    @DisplayName("should verify method never called")
    void shouldVerifyMethodNeverCalled() {
        // Act
        {{objectUnderTest}}.{{methodThatDoesNotCallDependency}}();

        // Assert
        verify({{mockDependency}}, never()).{{method}}(any());
    }

    @Test
    @DisplayName("should verify method called at least once")
    void shouldVerifyMethodCalledAtLeastOnce() {
        // Arrange
        when({{mockDependency}}.{{method}}(any()))
            .thenReturn({{mockValue}});

        // Act
        {{objectUnderTest}}.{{methodUnderTest}}({{input}});

        // Assert
        verify({{mockDependency}}, atLeastOnce()).{{method}}(any());
    }

    @Test
    @DisplayName("should verify method called at most n times")
    void shouldVerifyMethodCalledAtMostNTimes() {
        // Arrange
        when({{mockDependency}}.{{method}}(any()))
            .thenReturn({{mockValue}});

        // Act
        {{objectUnderTest}}.{{methodUnderTest}}({{input}});

        // Assert
        verify({{mockDependency}}, atMost(2)).{{method}}(any());
    }

    @Test
    @DisplayName("should verify call order with InOrder")
    void shouldVerifyCallOrderWithInOrder() {
        // Arrange
        when({{mockDependency}}.{{method1}}(any())).thenReturn({{value1}});
        when({{mockDependency}}.{{method2}}(any())).thenReturn({{value2}});

        // Act
        {{objectUnderTest}}.{{methodUnderTest}}({{input}});

        // Assert - Verify methods called in specific order
        InOrder inOrder = inOrder({{mockDependency}});
        inOrder.verify({{mockDependency}}).{{method1}}(any());
        inOrder.verify({{mockDependency}}).{{method2}}(any());
    }

    // ==================== SPY OBJECTS ====================

    @Test
    @DisplayName("should use spy to partially mock object")
    void shouldUseSpyToPartiallyMockObject() {
        // Arrange
        {{RealClass}} realObject = new {{RealClass}}();
        {{RealClass}} spyObject = spy(realObject);

        // Stub only specific method, other methods use real implementation
        when(spyObject.{{methodToMock}}(any()))
            .thenReturn({{mockValue}});

        // Act
        {{ResultType}} result1 = spyObject.{{methodToMock}}({{input}}); // Uses stub
        {{ResultType}} result2 = spyObject.{{realMethod}}({{input}});   // Uses real implementation

        // Assert
        assertEquals({{mockValue}}, result1, "Should use mocked value");
        assertNotNull(result2, "Should use real implementation");
        verify(spyObject).{{methodToMock}}(any());
        verify(spyObject).{{realMethod}}(any());
    }

    // ==================== MULTIPLE MOCKS ====================

    @Test
    @DisplayName("should work with multiple mock dependencies")
    void shouldWorkWithMultipleMockDependencies() {
        // Arrange
        {{InputType}} input = {{testValue}};

        when({{mockDependency}}.{{method1}}(input))
            .thenReturn({{value1}});

        when({{anotherMockDependency}}.{{method2}}(any()))
            .thenReturn({{value2}});

        // Act
        {{ResultType}} result = {{objectUnderTest}}.{{methodUnderTest}}(input);

        // Assert
        assertNotNull(result);
        assertEquals({{expectedValue}}, result.{{getProperty}}());

        verify({{mockDependency}}).{{method1}}(input);
        verify({{anotherMockDependency}}).{{method2}}(any());
    }
}
```

## Adaptation Rules

- [ ] Replace `{{ClassName}}` with class being tested
- [ ] Replace `{{DependencyType}}` with mocked dependency types
- [ ] Use `@ExtendWith(MockitoExtension.class)` to enable Mockito
- [ ] Use `@Mock` for dependencies, `@InjectMocks` for object under test
- [ ] Use `when().thenReturn()` for non-void methods
- [ ] Use `doNothing().when()` or `doThrow().when()` for void methods
- [ ] Use `verify()` to assert mock interactions
- [ ] Use `ArgumentCaptor` to capture and verify complex arguments
- [ ] Don't over-mock - mock only external dependencies
- [ ] Test behavior, not implementation details

## Related

- Template: @templates/junit/BasicUnitTest.java (for testing without mocks)
- Template: @templates/junit/IntegrationTest.java (for testing with real dependencies)

## Example: User Service Mock Test

```java
package com.example.user;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("User Service Mock Tests")
class UserServiceMockTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private EmailService emailService;

    @InjectMocks
    private UserService userService;

    @Captor
    private ArgumentCaptor<User> userCaptor;

    @Test
    @DisplayName("should find user by ID")
    void shouldFindUserById() {
        // Arrange
        Long userId = 1L;
        User mockUser = new User(userId, "testuser", "test@example.com");

        when(userRepository.findById(userId))
            .thenReturn(Optional.of(mockUser));

        // Act
        Optional<User> result = userService.findById(userId);

        // Assert
        assertTrue(result.isPresent());
        assertEquals("testuser", result.get().getUsername());
        verify(userRepository, times(1)).findById(userId);
    }

    @Test
    @DisplayName("should create user and send welcome email")
    void shouldCreateUserAndSendWelcomeEmail() {
        // Arrange
        String username = "newuser";
        String email = "new@example.com";
        User newUser = new User(null, username, email);

        when(userRepository.save(any(User.class)))
            .thenAnswer(invocation -> {
                User saved = invocation.getArgument(0);
                saved.setId(1L);
                return saved;
            });

        doNothing().when(emailService).sendWelcomeEmail(anyString());

        // Act
        User created = userService.createUser(username, email);

        // Assert
        assertNotNull(created.getId());
        assertEquals(username, created.getUsername());

        verify(userRepository).save(userCaptor.capture());
        User capturedUser = userCaptor.getValue();
        assertEquals(username, capturedUser.getUsername());
        assertEquals(email, capturedUser.getEmail());

        verify(emailService).sendWelcomeEmail(email);
    }

    @Test
    @DisplayName("should throw exception when user not found")
    void shouldThrowExceptionWhenUserNotFound() {
        // Arrange
        Long userId = 999L;

        when(userRepository.findById(userId))
            .thenReturn(Optional.empty());

        // Act & Assert
        assertThrows(
            UserNotFoundException.class,
            () -> userService.getUserById(userId)
        );

        verify(userRepository).findById(userId);
    }

    @Test
    @DisplayName("should verify email service never called for invalid user")
    void shouldVerifyEmailServiceNeverCalledForInvalidUser() {
        // Arrange
        String invalidUsername = "";

        // Act & Assert
        assertThrows(
            IllegalArgumentException.class,
            () -> userService.createUser(invalidUsername, "email@example.com")
        );

        verify(emailService, never()).sendWelcomeEmail(anyString());
    }
}
```

## Notes

### Mockito Annotations

```java
@Mock              // Creates a mock instance
@InjectMocks       // Injects mocks into this instance
@Captor            // Creates ArgumentCaptor
@Spy               // Creates partial mock (real object with some methods mocked)
```

### When to Use Mocks

```java
// ✅ Good: Mock external dependencies
@Mock private Database database;
@Mock private RestClient restClient;
@Mock private FileSystem fileSystem;

// ❌ Bad: Don't mock value objects or DTOs
// Just create real instances
User user = new User("username");
```

### Stubbing vs Verification

```java
// Stubbing: Define what mock should return
when(mock.method()).thenReturn(value);

// Verification: Assert mock was called
verify(mock).method();
```

### Argument Matchers

```java
// ✅ Good: All matchers or all concrete values
when(mock.method(any(), eq("test"))).thenReturn(value);

// ❌ Bad: Mixing matchers and concrete values inconsistently
when(mock.method(any(), "test")).thenReturn(value); // Error!
```
