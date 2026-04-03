# Template: Async and Concurrent Testing

**When to Use**: Testing CompletableFuture, asynchronous operations, @Async methods, timeouts, concurrent code, or reactive programming.

**Complexity**: Medium

**Common Mistakes Agents Make**:
- Not waiting for async operations to complete before assertions
- Using fixed `Thread.sleep()` instead of proper waiting mechanisms
- Not testing timeout scenarios
- Causing deadlocks by blocking on main thread
- Not handling exceptions in async operations
- Using `@Timeout` incorrectly (wrong time units or placement)
- Not testing thread safety in concurrent code
- Missing race conditions in tests
- Not using `Awaitility` for polling conditions
- Forgetting to enable async support with `@EnableAsync` in tests

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

    <!-- Awaitility for async testing -->
    <dependency>
        <groupId>org.awaitility</groupId>
        <artifactId>awaitility</artifactId>
        <version>4.2.0</version>
        <scope>test</scope>
    </dependency>

    <!-- Spring Boot Test (if using @Async) -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-test</artifactId>
        <scope>test</scope>
    </dependency>
</dependencies>
```

## Gradle Dependencies

```gradle
dependencies {
    testImplementation 'org.junit.jupiter:junit-jupiter:5.10.1'
    testImplementation 'org.awaitility:awaitility:4.2.0'
    testImplementation 'org.springframework.boot:spring-boot-starter-test'
}

test {
    useJUnitPlatform()
}
```

## Template

```java
package {{package}}.{{module}};

import org.junit.jupiter.api.*;
import org.awaitility.Awaitility;

import java.time.Duration;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.awaitility.Awaitility.*;

/**
 * Async tests for {{ClassName}}
 *
 * Tests asynchronous operations, timeouts, and concurrent behavior
 */
@DisplayName("{{ClassName}} Async Tests")
class {{ClassName}}AsyncTest {

    private {{ClassName}} {{objectUnderTest}};
    private ExecutorService executorService;

    @BeforeEach
    void setUp() {
        {{objectUnderTest}} = new {{ClassName}}();
        executorService = Executors.newFixedThreadPool(4);

        // Configure Awaitility defaults
        Awaitility.setDefaultPollInterval(Duration.ofMillis(100));
        Awaitility.setDefaultTimeout(Duration.ofSeconds(5));
    }

    @AfterEach
    void tearDown() {
        // Shutdown executor service
        executorService.shutdown();
        try {
            if (!executorService.awaitTermination(5, TimeUnit.SECONDS)) {
                executorService.shutdownNow();
            }
        } catch (InterruptedException e) {
            executorService.shutdownNow();
            Thread.currentThread().interrupt();
        }

        // Reset Awaitility to defaults
        Awaitility.reset();
    }

    // ==================== COMPLETABLE FUTURE TESTS ====================

    @Test
    @DisplayName("should complete future successfully")
    @Timeout(value = 5, unit = TimeUnit.SECONDS)
    void shouldCompleteFutureSuccessfully() throws Exception {
        // Arrange
        {{InputType}} input = {{testValue}};

        // Act
        CompletableFuture<{{ResultType}}> future = {{objectUnderTest}}.{{asyncMethod}}(input);

        // Assert
        {{ResultType}} result = future.get(3, TimeUnit.SECONDS);
        assertNotNull(result, "Result should not be null");
        assertEquals({{expectedValue}}, result.{{getProperty}}());
        assertTrue(future.isDone(), "Future should be completed");
        assertFalse(future.isCompletedExceptionally(), "Future should not complete exceptionally");
    }

    @Test
    @DisplayName("should handle async exception correctly")
    @Timeout(value = 5, unit = TimeUnit.SECONDS)
    void shouldHandleAsyncExceptionCorrectly() {
        // Arrange
        {{InputType}} invalidInput = {{invalidValue}};

        // Act
        CompletableFuture<{{ResultType}}> future = {{objectUnderTest}}.{{asyncMethod}}(invalidInput);

        // Assert
        ExecutionException exception = assertThrows(
            ExecutionException.class,
            () -> future.get(3, TimeUnit.SECONDS),
            "Should throw ExecutionException for invalid input"
        );

        assertTrue(exception.getCause() instanceof {{ExceptionType}},
            "Cause should be {{ExceptionType}}");
        assertTrue(future.isCompletedExceptionally(), "Future should complete exceptionally");
    }

    @Test
    @DisplayName("should timeout when operation takes too long")
    void shouldTimeoutWhenOperationTakesTooLong() {
        // Arrange
        {{InputType}} slowInput = {{slowOperationValue}};

        // Act
        CompletableFuture<{{ResultType}}> future = {{objectUnderTest}}.{{asyncMethod}}(slowInput);

        // Assert
        assertThrows(
            TimeoutException.class,
            () -> future.get(1, TimeUnit.SECONDS),
            "Should timeout after 1 second"
        );
    }

    @Test
    @DisplayName("should chain multiple async operations")
    @Timeout(value = 5, unit = TimeUnit.SECONDS)
    void shouldChainMultipleAsyncOperations() throws Exception {
        // Arrange
        {{InputType}} input = {{testValue}};

        // Act
        CompletableFuture<{{FinalResultType}}> future = {{objectUnderTest}}.{{asyncMethod1}}(input)
            .thenCompose(result1 -> {{objectUnderTest}}.{{asyncMethod2}}(result1))
            .thenApply(result2 -> {{transformResult}}(result2));

        // Assert
        {{FinalResultType}} finalResult = future.get(3, TimeUnit.SECONDS);
        assertNotNull(finalResult);
        assertEquals({{expectedFinalValue}}, finalResult);
    }

    @Test
    @DisplayName("should combine multiple futures with allOf")
    @Timeout(value = 5, unit = TimeUnit.SECONDS)
    void shouldCombineMultipleFuturesWithAllOf() throws Exception {
        // Arrange
        {{InputType}} input1 = {{value1}};
        {{InputType}} input2 = {{value2}};
        {{InputType}} input3 = {{value3}};

        // Act
        CompletableFuture<{{ResultType}}> future1 = {{objectUnderTest}}.{{asyncMethod}}(input1);
        CompletableFuture<{{ResultType}}> future2 = {{objectUnderTest}}.{{asyncMethod}}(input2);
        CompletableFuture<{{ResultType}}> future3 = {{objectUnderTest}}.{{asyncMethod}}(input3);

        CompletableFuture<Void> allFutures = CompletableFuture.allOf(future1, future2, future3);

        // Assert
        allFutures.get(3, TimeUnit.SECONDS);

        assertTrue(future1.isDone(), "Future 1 should be done");
        assertTrue(future2.isDone(), "Future 2 should be done");
        assertTrue(future3.isDone(), "Future 3 should be done");

        assertNotNull(future1.get());
        assertNotNull(future2.get());
        assertNotNull(future3.get());
    }

    // ==================== AWAITILITY TESTS ====================

    @Test
    @DisplayName("should eventually update state")
    void shouldEventuallyUpdateState() {
        // Arrange
        {{InputType}} input = {{testValue}};

        // Act
        {{objectUnderTest}}.{{startAsyncOperation}}(input);

        // Assert - Wait until condition is true
        await()
            .atMost(Duration.ofSeconds(5))
            .pollInterval(Duration.ofMillis(100))
            .untilAsserted(() ->
                assertTrue({{objectUnderTest}}.{{isOperationComplete}}(),
                    "Operation should eventually complete")
            );

        // Verify final state
        assertEquals({{expectedState}}, {{objectUnderTest}}.{{getState}}());
    }

    @Test
    @DisplayName("should poll until value matches expected")
    void shouldPollUntilValueMatchesExpected() {
        // Arrange
        {{InputType}} input = {{testValue}};
        {{objectUnderTest}}.{{startAsyncOperation}}(input);

        // Act & Assert
        await()
            .atMost(Duration.ofSeconds(5))
            .until(() -> {{objectUnderTest}}.{{getValue}}(), value -> value.equals({{expectedValue}}));

        assertEquals({{expectedValue}}, {{objectUnderTest}}.{{getValue}}());
    }

    @Test
    @DisplayName("should timeout if condition never becomes true")
    void shouldTimeoutIfConditionNeverBecomesTrue() {
        // Arrange
        // Don't start any operation that would satisfy the condition

        // Act & Assert
        assertThrows(
            ConditionTimeoutException.class,
            () -> await()
                .atMost(Duration.ofSeconds(2))
                .until(() -> {{objectUnderTest}}.{{isOperationComplete}}()),
            "Should timeout waiting for operation that never completes"
        );
    }

    @Test
    @DisplayName("should wait for async callback to be invoked")
    void shouldWaitForAsyncCallbackToBeInvoked() {
        // Arrange
        AtomicBoolean callbackInvoked = new AtomicBoolean(false);
        {{InputType}} input = {{testValue}};

        // Act
        {{objectUnderTest}}.{{asyncMethodWithCallback}}(input, result -> {
            callbackInvoked.set(true);
        });

        // Assert
        await()
            .atMost(Duration.ofSeconds(5))
            .untilTrue(callbackInvoked);

        assertTrue(callbackInvoked.get(), "Callback should have been invoked");
    }

    // ==================== CONCURRENT EXECUTION TESTS ====================

    @Test
    @DisplayName("should handle concurrent calls without race conditions")
    @Timeout(value = 10, unit = TimeUnit.SECONDS)
    void shouldHandleConcurrentCallsWithoutRaceConditions() throws Exception {
        // Arrange
        int threadCount = 10;
        AtomicInteger successCount = new AtomicInteger(0);
        CountDownLatch latch = new CountDownLatch(threadCount);

        // Act - Execute method concurrently from multiple threads
        for (int i = 0; i < threadCount; i++) {
            final {{InputType}} input = {{generateTestValue}}(i);
            executorService.submit(() -> {
                try {
                    {{objectUnderTest}}.{{threadSafeMethod}}(input);
                    successCount.incrementAndGet();
                } finally {
                    latch.countDown();
                }
            });
        }

        // Wait for all threads to complete
        assertTrue(latch.await(5, TimeUnit.SECONDS), "All threads should complete");

        // Assert
        assertEquals(threadCount, successCount.get(), "All operations should succeed");
        assertEquals({{expectedFinalState}}, {{objectUnderTest}}.{{getState}}());
    }

    @Test
    @DisplayName("should maintain thread safety with concurrent modifications")
    @Timeout(value = 10, unit = TimeUnit.SECONDS)
    void shouldMaintainThreadSafetyWithConcurrentModifications() throws Exception {
        // Arrange
        int operationCount = 100;
        CountDownLatch latch = new CountDownLatch(operationCount);
        ConcurrentLinkedQueue<{{ResultType}}> results = new ConcurrentLinkedQueue<>();

        // Act
        for (int i = 0; i < operationCount; i++) {
            executorService.submit(() -> {
                try {
                    {{ResultType}} result = {{objectUnderTest}}.{{concurrentOperation}}();
                    results.add(result);
                } finally {
                    latch.countDown();
                }
            });
        }

        assertTrue(latch.await(5, TimeUnit.SECONDS), "All operations should complete");

        // Assert
        assertEquals(operationCount, results.size(), "Should have results from all operations");
        // Verify no duplicate or missing values
        assertEquals(operationCount, results.stream().distinct().count(),
            "All results should be unique (no race conditions)");
    }

    @Test
    @DisplayName("should execute tasks in parallel and aggregate results")
    @Timeout(value = 10, unit = TimeUnit.SECONDS)
    void shouldExecuteTasksInParallelAndAggregateResults() throws Exception {
        // Arrange
        int taskCount = 5;
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch completionLatch = new CountDownLatch(taskCount);
        ConcurrentLinkedQueue<{{ResultType}}> results = new ConcurrentLinkedQueue<>();

        // Act
        for (int i = 0; i < taskCount; i++) {
            final {{InputType}} input = {{generateTestValue}}(i);
            executorService.submit(() -> {
                try {
                    startLatch.await(); // Ensure all threads start simultaneously
                    {{ResultType}} result = {{objectUnderTest}}.{{parallelMethod}}(input);
                    results.add(result);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    completionLatch.countDown();
                }
            });
        }

        startLatch.countDown(); // Release all threads
        assertTrue(completionLatch.await(5, TimeUnit.SECONDS), "All tasks should complete");

        // Assert
        assertEquals(taskCount, results.size());
        {{AggregateType}} aggregate = {{aggregateResults}}(results);
        assertEquals({{expectedAggregate}}, aggregate);
    }

    // ==================== TIMEOUT TESTS ====================

    @Test
    @DisplayName("should complete before timeout")
    @Timeout(value = 2, unit = TimeUnit.SECONDS)
    void shouldCompleteBeforeTimeout() {
        // Act
        {{ResultType}} result = {{objectUnderTest}}.{{fastMethod}}();

        // Assert
        assertNotNull(result);
        assertEquals({{expectedValue}}, result);
    }

    @Test
    @DisplayName("should fail if method exceeds timeout")
    @Timeout(value = 1, unit = TimeUnit.SECONDS)
    void shouldFailIfMethodExceedsTimeout() {
        // This test will fail if {{slowMethod}} takes longer than 1 second
        assertThrows(
            Exception.class,
            () -> {{objectUnderTest}}.{{slowMethod}}(),
            "Method should not exceed timeout"
        );
    }

    @Test
    @DisplayName("should cancel future after timeout")
    void shouldCancelFutureAfterTimeout() throws Exception {
        // Arrange
        {{InputType}} input = {{testValue}};
        CompletableFuture<{{ResultType}}> future = {{objectUnderTest}}.{{asyncMethod}}(input);

        // Act - Cancel after short delay
        executorService.submit(() -> {
            try {
                Thread.sleep(500);
                future.cancel(true);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        });

        // Assert
        await()
            .atMost(Duration.ofSeconds(2))
            .until(future::isCancelled);

        assertTrue(future.isCancelled(), "Future should be cancelled");
        assertThrows(CancellationException.class, () -> future.get());
    }

    // ==================== REACTIVE STREAMS (IF APPLICABLE) ====================

    @Test
    @DisplayName("should process stream asynchronously")
    @Timeout(value = 5, unit = TimeUnit.SECONDS)
    void shouldProcessStreamAsynchronously() {
        // Arrange
        AtomicInteger processedCount = new AtomicInteger(0);

        // Act
        {{objectUnderTest}}.{{processStreamAsync}}()
            .thenAccept(result -> processedCount.set(result.size()));

        // Assert
        await()
            .atMost(Duration.ofSeconds(3))
            .until(() -> processedCount.get() > 0);

        assertTrue(processedCount.get() >= {{expectedMinCount}},
            "Should process at least " + {{expectedMinCount}} + " items");
    }
}
```

## Adaptation Rules

- [ ] Replace `{{ClassName}}` with class being tested
- [ ] Replace `{{asyncMethod}}` with actual async method names
- [ ] Use `@Timeout` annotation to prevent hanging tests
- [ ] Use `Awaitility` for polling conditions instead of `Thread.sleep()`
- [ ] Test CompletableFuture completion, exceptions, and timeouts
- [ ] Test concurrent execution with multiple threads
- [ ] Use `CountDownLatch` to synchronize threads in tests
- [ ] Clean up `ExecutorService` in `@AfterEach`
- [ ] Use `AtomicBoolean`, `AtomicInteger` for thread-safe state
- [ ] Test both successful completion and timeout scenarios

## Related

- Template: @templates/junit/BasicUnitTest.java (for non-async logic)
- Template: @templates/junit/MockTest.java (for mocking async dependencies)

## Example: Async User Service Test

```java
package com.example.user;

import org.junit.jupiter.api.*;
import org.awaitility.Awaitility;

import java.time.Duration;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.*;
import static org.awaitility.Awaitility.*;

@DisplayName("User Service Async Tests")
class UserServiceAsyncTest {

    private UserService userService;
    private ExecutorService executorService;

    @BeforeEach
    void setUp() {
        userService = new UserService();
        executorService = Executors.newFixedThreadPool(4);
    }

    @AfterEach
    void tearDown() {
        executorService.shutdown();
        try {
            if (!executorService.awaitTermination(5, TimeUnit.SECONDS)) {
                executorService.shutdownNow();
            }
        } catch (InterruptedException e) {
            executorService.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }

    @Test
    @DisplayName("should fetch user asynchronously")
    @Timeout(value = 5, unit = TimeUnit.SECONDS)
    void shouldFetchUserAsynchronously() throws Exception {
        // Arrange
        Long userId = 1L;

        // Act
        CompletableFuture<User> future = userService.findUserAsync(userId);

        // Assert
        User user = future.get(3, TimeUnit.SECONDS);
        assertNotNull(user);
        assertEquals(userId, user.getId());
        assertTrue(future.isDone());
    }

    @Test
    @DisplayName("should handle async exception")
    @Timeout(value = 5, unit = TimeUnit.SECONDS)
    void shouldHandleAsyncException() {
        // Arrange
        Long invalidUserId = -1L;

        // Act
        CompletableFuture<User> future = userService.findUserAsync(invalidUserId);

        // Assert
        ExecutionException exception = assertThrows(
            ExecutionException.class,
            () -> future.get(3, TimeUnit.SECONDS)
        );
        assertTrue(exception.getCause() instanceof IllegalArgumentException);
    }

    @Test
    @DisplayName("should eventually complete email sending")
    void shouldEventuallyCompleteEmailSending() {
        // Arrange
        String email = "user@example.com";
        String message = "Welcome!";

        // Act
        userService.sendEmailAsync(email, message);

        // Assert
        await()
            .atMost(Duration.ofSeconds(5))
            .untilAsserted(() ->
                assertTrue(userService.isEmailSent(email))
            );
    }

    @Test
    @DisplayName("should handle concurrent user creation")
    @Timeout(value = 10, unit = TimeUnit.SECONDS)
    void shouldHandleConcurrentUserCreation() throws Exception {
        // Arrange
        int userCount = 10;
        CountDownLatch latch = new CountDownLatch(userCount);
        ConcurrentLinkedQueue<User> createdUsers = new ConcurrentLinkedQueue<>();

        // Act
        for (int i = 0; i < userCount; i++) {
            final String username = "user" + i;
            executorService.submit(() -> {
                try {
                    User user = userService.createUser(username);
                    createdUsers.add(user);
                } finally {
                    latch.countDown();
                }
            });
        }

        assertTrue(latch.await(5, TimeUnit.SECONDS));

        // Assert
        assertEquals(userCount, createdUsers.size());
        assertEquals(userCount, createdUsers.stream()
            .map(User::getUsername)
            .distinct()
            .count(), "All usernames should be unique");
    }
}
```

## Notes

### Awaitility vs Thread.sleep()

```java
// ❌ Bad: Fixed sleep, may be too short or too long
Thread.sleep(2000);
assertTrue(service.isComplete());

// ✅ Good: Poll until condition is true
await()
    .atMost(Duration.ofSeconds(5))
    .until(() -> service.isComplete());
```

### @Timeout Annotation

```java
// Class-level timeout for all tests
@Timeout(value = 10, unit = TimeUnit.SECONDS)
class MyTest {

    // Method-level timeout overrides class-level
    @Test
    @Timeout(value = 2, unit = TimeUnit.SECONDS)
    void fastTest() {
        // Must complete in 2 seconds
    }
}
```

### CompletableFuture Best Practices

Always set a timeout when calling `.get()`:
```java
// ✅ Good: With timeout
future.get(3, TimeUnit.SECONDS);

// ❌ Bad: No timeout, may hang forever
future.get();
```
