# Async Testing Rules

Asynchronous code is one of the most common sources of test failures and flakiness. Research shows that **67% of test flakiness traces to async handling issues** - race conditions, unhandled promise rejections, improper timeouts, and timing assumptions. These problems manifest as intermittent failures, hanging tests, false positives, and mysterious state corruption.

This guide provides concrete rules for testing async code correctly across Jest, Pytest, JUnit 5, Mocha, and RSpec.

## The Problem: Why Async Tests Fail

Async operations introduce timing uncertainty. Tests must wait for operations to complete, but how long? Too short and tests fail intermittently. Too long and test suites become unbearably slow. The wrong async pattern entirely and tests hang indefinitely or silently pass when they should fail.

**Key insight**: Most async test bugs come from three sources:
1. **Not waiting for promises** - Test completes before async operation, missing failures
2. **Arbitrary timeouts** ("Sleeping Snail" anti-pattern) - Tests sleep for fixed durations instead of waiting for conditions
3. **Unhandled rejections** - Rejected promises without proper error handling cause mysterious failures

---

## Rule 1: Always Return or Await Promises

**Statement**: Never fire-and-forget async operations in tests. Always await promises or return them to the test framework.

### Why This Matters

When you call an async function without awaiting or returning it, the test completes immediately - before the async operation finishes. If the operation fails, the test won't detect it. If the operation succeeds, assertions run before results are available.

**Result**: False positives, missed failures, and unpredictable test behavior.

### ❌ WRONG: Promise Not Awaited (Jest/JavaScript)

```javascript
// This is WRONG - promise is ignored
test('fetches user data', () => {
  fetchUser(1); // Promise ignored!
  expect(user).toBeDefined(); // Runs immediately, user is undefined
});
```

**What breaks**: Test completes before `fetchUser` resolves. Assertion runs with undefined data. If `fetchUser` throws, test doesn't catch it.

### ❌ WRONG: Promise Not Awaited (Pytest)

```python
# This is WRONG - coroutine not awaited
def test_fetch_user_data():
    fetch_user(1)  # Coroutine not awaited!
    assert user is not None  # Runs immediately, user is undefined
```

**What breaks**: Python warning: "coroutine 'fetch_user' was never awaited". Test runs synchronously, async operation never executes.

### ❌ WRONG: Promise Not Awaited (JUnit 5)

```java
// This is WRONG - CompletableFuture not waited
@Test
void testFetchUserData() {
    userService.fetchUserAsync(1); // Future ignored!
    assertNotNull(user); // Runs immediately, user is null
}
```

**What breaks**: Test completes before future resolves. Assertion runs with null data.

### ❌ WRONG: Promise Not Awaited (Mocha)

```javascript
// This is WRONG - promise not returned or awaited
it('fetches user data', () => {
  fetchUser(1); // Promise ignored!
  expect(user).to.exist; // Runs immediately
});
```

**What breaks**: Same as Jest - test completes before promise resolves.

### ❌ WRONG: Promise Not Awaited (RSpec)

```ruby
# This is WRONG - async operation not awaited
it 'fetches user data' do
  fetch_user(1) # Async call ignored!
  expect(user).not_to be_nil # Runs immediately
end
```

**What breaks**: Test runs synchronously, async operation may not complete.

### ✅ CORRECT: Await Promise (Jest/JavaScript)

```javascript
// Correct - async/await pattern
test('fetches user data', async () => {
  const user = await fetchUser(1);
  expect(user).toBeDefined();
  expect(user.name).toBe('John');
});

// Alternative - return promise
test('fetches user data', () => {
  return fetchUser(1).then(user => {
    expect(user).toBeDefined();
    expect(user.name).toBe('John');
  });
});
```

**Why this works**: Test framework waits for promise to resolve before completing. Failures in async code are caught and reported.

### ✅ CORRECT: Await Promise (Pytest)

```python
import pytest

# Correct - async test with pytest-asyncio
@pytest.mark.asyncio
async def test_fetch_user_data():
    user = await fetch_user(1)
    assert user is not None
    assert user.name == "John"
```

**Why this works**: `@pytest.mark.asyncio` decorator enables async/await. Pytest waits for coroutine to complete.

### ✅ CORRECT: Await Promise (JUnit 5)

```java
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

@Test
void testFetchUserData() throws Exception {
    CompletableFuture<User> future = userService.fetchUserAsync(1);
    User user = future.get(); // Wait for completion
    assertNotNull(user);
    assertEquals("John", user.getName());
}

// Alternative - Awaitility library (recommended)
@Test
void testFetchUserDataWithAwaitility() {
    userService.fetchUserAsync(1);
    await().atMost(5, SECONDS).until(() -> user != null);
    assertEquals("John", user.getName());
}
```

**Why this works**: `future.get()` blocks until completion. Awaitility provides readable waiting patterns.

### ✅ CORRECT: Await Promise (Mocha)

```javascript
// Correct - async/await
it('fetches user data', async () => {
  const user = await fetchUser(1);
  expect(user).to.exist;
  expect(user.name).to.equal('John');
});

// Alternative - return promise
it('fetches user data', () => {
  return fetchUser(1).then(user => {
    expect(user).to.exist;
    expect(user.name).to.equal('John');
  });
});
```

**Why this works**: Same as Jest - test waits for promise resolution.

### ✅ CORRECT: Await Promise (RSpec)

```ruby
# Correct - using async/await (Ruby 3.1+)
it 'fetches user data' do
  user = fetch_user(1).wait # Wait for async operation
  expect(user).not_to be_nil
  expect(user.name).to eq('John')
end

# Alternative - using async testing gems
it 'fetches user data', async: true do
  result = Async do
    fetch_user(1)
  end
  expect(result.wait).not_to be_nil
end
```

**Why this works**: Explicit wait ensures async operation completes before assertions.

---

## Rule 2: Don't Use Fixed Timeouts (Sleeping Snail Anti-Pattern)

**Statement**: Never use arbitrary sleep/wait durations in tests. Use condition-based waiting with reasonable timeouts.

### Why This Matters

Fixed timeouts are either:
- **Too short**: Tests fail intermittently on slower machines or under load
- **Too long**: Tests waste time waiting when operation completes quickly
- **Both**: As systems change, previously-safe timeouts become too short

The "Sleeping Snail" anti-pattern is the #1 cause of flaky tests in production systems.

**Citation**: Google Testing Blog (John Micco, "Flaky Tests at Google and How We Mitigate Them") identifies arbitrary timeouts as the leading cause of test flakiness.

### ❌ WRONG: Arbitrary Sleep (Jest)

```javascript
// This is WRONG - arbitrary timeout
test('element appears after API call', async () => {
  triggerApiCall();
  await sleep(1000); // Arbitrary 1 second wait
  expect(element.isVisible()).toBe(true);
});
```

**What breaks**:
- Fails intermittently if API takes >1000ms
- Wastes 1000ms even if API responds in 100ms
- No guarantee element actually appeared

### ❌ WRONG: Arbitrary Sleep (Pytest)

```python
import time

# This is WRONG - arbitrary sleep
def test_element_appears():
    trigger_api_call()
    time.sleep(1)  # Arbitrary 1 second wait
    assert element.is_visible()
```

**What breaks**: Same issues as Jest example.

### ❌ WRONG: Arbitrary Sleep (JUnit 5)

```java
// This is WRONG - arbitrary Thread.sleep
@Test
void testElementAppears() throws InterruptedException {
    triggerApiCall();
    Thread.sleep(1000); // Arbitrary 1 second wait
    assertTrue(element.isVisible());
}
```

**What breaks**: Same issues - flaky and slow.

### ❌ WRONG: Arbitrary Sleep (Mocha)

```javascript
// This is WRONG - arbitrary timeout
it('element appears after API call', async () => {
  triggerApiCall();
  await new Promise(resolve => setTimeout(resolve, 1000));
  expect(element.isVisible()).to.be.true;
});
```

**What breaks**: Same issues as Jest.

### ❌ WRONG: Arbitrary Sleep (RSpec)

```ruby
# This is WRONG - arbitrary sleep
it 'element appears after API call' do
  trigger_api_call
  sleep(1) # Arbitrary 1 second wait
  expect(element).to be_visible
end
```

**What breaks**: Same flakiness and slowness issues.

### ✅ CORRECT: Condition-Based Waiting (Jest with Testing Library)

```javascript
import { waitFor, screen } from '@testing-library/react';

test('element appears after API call', async () => {
  triggerApiCall();

  // Wait for condition, with timeout
  await waitFor(() => {
    expect(screen.getByText('Success')).toBeInTheDocument();
  }, { timeout: 5000 });
});

// Alternative - waitForElementToBeRemoved
test('loading spinner disappears', async () => {
  await waitForElementToBeRemoved(() => screen.getByText('Loading...'), {
    timeout: 5000
  });
});
```

**Why this works**: Polls condition repeatedly until true or timeout. Completes as soon as condition is met, but has safety timeout.

### ✅ CORRECT: Condition-Based Waiting (Pytest with pytest-timeout)

```python
import pytest
from unittest.mock import Mock

def wait_for_condition(condition_fn, timeout=5.0, interval=0.1):
    """Wait for condition to be true, polling at interval"""
    import time
    start = time.time()
    while time.time() - start < timeout:
        if condition_fn():
            return True
        time.sleep(interval)
    raise TimeoutError(f"Condition not met within {timeout}s")

@pytest.mark.timeout(5)
async def test_element_appears():
    trigger_api_call()

    # Wait for condition with timeout
    wait_for_condition(lambda: element.is_visible(), timeout=5.0)
    assert element.is_visible()
```

**Why this works**: Polls condition at intervals. Completes when condition true. Timeout provides safety net.

### ✅ CORRECT: Condition-Based Waiting (JUnit 5 with Awaitility)

```java
import static org.awaitility.Awaitility.*;
import static java.util.concurrent.TimeUnit.*;

@Test
void testElementAppears() {
    triggerApiCall();

    // Wait for condition with timeout
    await()
        .atMost(5, SECONDS)
        .pollInterval(100, MILLISECONDS)
        .until(() -> element.isVisible());

    assertTrue(element.isVisible());
}

// Alternative - wait for atomic value change
@Test
void testStatusChange() {
    AtomicBoolean completed = new AtomicBoolean(false);

    processAsync(() -> completed.set(true));

    await()
        .atMost(5, SECONDS)
        .untilTrue(completed);
}
```

**Why this works**: Awaitility provides fluent API for condition waiting. Polls until condition true or timeout.

### ✅ CORRECT: Condition-Based Waiting (Mocha with polling)

```javascript
const { expect } = require('chai');

// Helper for condition-based waiting
async function waitForCondition(conditionFn, timeout = 5000, interval = 100) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await conditionFn()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error(`Condition not met within ${timeout}ms`);
}

it('element appears after API call', async () => {
  triggerApiCall();

  // Wait for condition
  await waitForCondition(() => element.isVisible(), 5000);
  expect(element.isVisible()).to.be.true;
});
```

**Why this works**: Custom helper polls condition. Completes when true, throws after timeout.

### ✅ CORRECT: Condition-Based Waiting (RSpec with Capybara)

```ruby
# Using Capybara's built-in waiting (for browser tests)
it 'element appears after API call' do
  trigger_api_call

  # Capybara automatically waits for element
  expect(page).to have_text('Success', wait: 5)
end

# Custom waiting helper
def wait_for(timeout = 5, &block)
  Timeout.timeout(timeout) do
    loop do
      return if block.call
      sleep 0.1
    end
  end
rescue Timeout::Error
  raise 'Condition not met within timeout'
end

it 'element appears with custom waiter' do
  trigger_api_call
  wait_for { element.visible? }
  expect(element).to be_visible
end
```

**Why this works**: Capybara has built-in smart waiting. Custom helper polls condition.

---

## Rule 3: Handle Promise Rejections Explicitly

**Statement**: Never leave promise rejections unhandled. Use try/catch, .catch(), or framework-specific error matchers.

### Why This Matters

Unhandled promise rejections cause:
- **Silent failures**: Test passes even though async operation failed
- **Mysterious hangs**: Some frameworks wait indefinitely for unhandled rejections
- **Process crashes**: Node.js terminates process on unhandled rejections (future versions)
- **False positives**: Test succeeds when it should fail

### ❌ WRONG: Unhandled Rejection (Jest)

```javascript
// This is WRONG - rejection not handled
test('handles API error', async () => {
  fetchUser(999); // Promise rejected, but not caught!
  // Test completes, unhandled rejection in background
});
```

**What breaks**: Jest may report success even though operation failed. Unhandled rejection warning appears.

### ❌ WRONG: Unhandled Rejection (Pytest)

```python
# This is WRONG - exception not caught
@pytest.mark.asyncio
async def test_handles_api_error():
    fetch_user(999)  # Raises exception, not caught!
    # Test fails, but with confusing stack trace
```

**What breaks**: Test fails with raw exception, not clear assertion error.

### ❌ WRONG: Unhandled Rejection (JUnit 5)

```java
// This is WRONG - exception not caught
@Test
void testHandlesApiError() throws Exception {
    CompletableFuture<User> future = userService.fetchUserAsync(999);
    future.get(); // Throws ExecutionException, not caught!
}
```

**What breaks**: Test fails with ExecutionException wrapper instead of expected exception.

### ❌ WRONG: Unhandled Rejection (Mocha)

```javascript
// This is WRONG - rejection not handled
it('handles API error', async () => {
  fetchUser(999); // Promise rejected, not awaited!
  // Test completes, unhandled rejection warning
});
```

**What breaks**: Mocha issues unhandled rejection warning. Test may pass incorrectly.

### ❌ WRONG: Unhandled Rejection (RSpec)

```ruby
# This is WRONG - exception not rescued
it 'handles API error' do
  fetch_user(999) # Raises exception, not rescued!
end
```

**What breaks**: Test fails with raw exception.

### ✅ CORRECT: Explicit Error Handling (Jest)

```javascript
// Correct - expect().rejects matcher
test('handles API error', async () => {
  await expect(fetchUser(999)).rejects.toThrow('User not found');
});

// Alternative - try/catch
test('handles API error', async () => {
  try {
    await fetchUser(999);
    fail('Should have thrown error');
  } catch (error) {
    expect(error.message).toBe('User not found');
  }
});

// Alternative - .catch() with assertion
test('handles API error', () => {
  return fetchUser(999).catch(error => {
    expect(error.message).toBe('User not found');
  });
});
```

**Why this works**: Explicit error handling ensures rejection is caught and verified. Test fails if error not thrown.

### ✅ CORRECT: Explicit Error Handling (Pytest)

```python
import pytest

# Correct - pytest.raises context manager
@pytest.mark.asyncio
async def test_handles_api_error():
    with pytest.raises(UserNotFoundError) as exc_info:
        await fetch_user(999)
    assert "not found" in str(exc_info.value)

# Alternative - manual try/except
@pytest.mark.asyncio
async def test_handles_api_error():
    try:
        await fetch_user(999)
        pytest.fail("Should have raised UserNotFoundError")
    except UserNotFoundError as e:
        assert "not found" in str(e)
```

**Why this works**: `pytest.raises` catches expected exception and allows inspection.

### ✅ CORRECT: Explicit Error Handling (JUnit 5)

```java
import static org.junit.jupiter.api.Assertions.*;

// Correct - assertThrows
@Test
void testHandlesApiError() {
    CompletableFuture<User> future = userService.fetchUserAsync(999);

    ExecutionException exception = assertThrows(ExecutionException.class, () -> {
        future.get();
    });

    assertTrue(exception.getCause() instanceof UserNotFoundException);
    assertEquals("User not found", exception.getCause().getMessage());
}

// Alternative - Awaitility with exception matcher
@Test
void testHandlesApiErrorWithAwaitility() {
    assertThrows(UserNotFoundException.class, () -> {
        await()
            .atMost(5, SECONDS)
            .until(() -> userService.getUser(999) != null);
    });
}
```

**Why this works**: `assertThrows` catches expected exception type. Cause inspection for CompletableFuture exceptions.

### ✅ CORRECT: Explicit Error Handling (Mocha)

```javascript
const { expect } = require('chai');

// Correct - try/catch with async/await
it('handles API error', async () => {
  try {
    await fetchUser(999);
    expect.fail('Should have thrown error');
  } catch (error) {
    expect(error.message).to.equal('User not found');
  }
});

// Alternative - expect().to.be.rejected (with chai-as-promised)
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

it('handles API error', async () => {
  await expect(fetchUser(999))
    .to.be.rejectedWith('User not found');
});
```

**Why this works**: Explicit error catching with try/catch or chai-as-promised matcher.

### ✅ CORRECT: Explicit Error Handling (RSpec)

```ruby
# Correct - expect { }.to raise_error
it 'handles API error' do
  expect { fetch_user(999) }.to raise_error(UserNotFoundError, /not found/)
end

# Alternative - rescue with assertion
it 'handles API error' do
  begin
    fetch_user(999)
    fail 'Should have raised UserNotFoundError'
  rescue UserNotFoundError => e
    expect(e.message).to include('not found')
  end
end
```

**Why this works**: `expect { }.to raise_error` catches and verifies exception.

---

## Rule 4: Test Both Success and Error Paths

**Statement**: For every async operation, write tests for both successful completion and error conditions.

### Why This Matters

Async operations can fail in many ways:
- Network timeouts
- API errors (4xx, 5xx)
- Invalid responses
- Connection failures
- Cancellation

Testing only the happy path leaves error handling unverified. When failures occur in production, untested error paths often have bugs.

### ❌ WRONG: Only Testing Success Path

```javascript
// This is WRONG - no error path tests
describe('UserService', () => {
  test('fetches user successfully', async () => {
    const user = await userService.getUser(1);
    expect(user.name).toBe('John');
  });

  // Missing: What if user doesn't exist?
  // Missing: What if network fails?
  // Missing: What if API returns 500?
});
```

**What breaks**: Error handling code is never tested. Bugs hide in error paths until production.

### ✅ CORRECT: Test Both Paths (Jest)

```javascript
describe('UserService', () => {
  describe('getUser', () => {
    test('returns user when exists', async () => {
      mockApi.get.mockResolvedValue({ data: { id: 1, name: 'John' } });

      const user = await userService.getUser(1);

      expect(user).toEqual({ id: 1, name: 'John' });
    });

    test('throws error when user not found', async () => {
      mockApi.get.mockRejectedValue(new Error('404 Not Found'));

      await expect(userService.getUser(999))
        .rejects.toThrow('User not found');
    });

    test('throws error on network failure', async () => {
      mockApi.get.mockRejectedValue(new Error('Network error'));

      await expect(userService.getUser(1))
        .rejects.toThrow('Network error');
    });

    test('throws error on invalid response', async () => {
      mockApi.get.mockResolvedValue({ data: null });

      await expect(userService.getUser(1))
        .rejects.toThrow('Invalid response');
    });
  });
});
```

**Why this works**: Comprehensive coverage of success and all error scenarios.

### ✅ CORRECT: Test Both Paths (Pytest)

```python
class TestUserService:
    @pytest.mark.asyncio
    async def test_returns_user_when_exists(self, mock_api):
        mock_api.get.return_value = {'id': 1, 'name': 'John'}

        user = await user_service.get_user(1)

        assert user == {'id': 1, 'name': 'John'}

    @pytest.mark.asyncio
    async def test_raises_error_when_not_found(self, mock_api):
        mock_api.get.side_effect = ApiError('404 Not Found')

        with pytest.raises(UserNotFoundError):
            await user_service.get_user(999)

    @pytest.mark.asyncio
    async def test_raises_error_on_network_failure(self, mock_api):
        mock_api.get.side_effect = NetworkError('Connection failed')

        with pytest.raises(NetworkError):
            await user_service.get_user(1)
```

**Why this works**: Each error condition tested separately.

### ✅ CORRECT: Test Both Paths (JUnit 5)

```java
@ExtendWith(MockitoExtension.class)
class UserServiceTest {
    @Mock
    private ApiClient apiClient;

    @InjectMocks
    private UserService userService;

    @Test
    void returnsUserWhenExists() throws Exception {
        when(apiClient.get("/users/1"))
            .thenReturn(CompletableFuture.completedFuture(
                new User(1, "John")
            ));

        User user = userService.getUser(1).get();

        assertEquals("John", user.getName());
    }

    @Test
    void throwsErrorWhenUserNotFound() {
        when(apiClient.get("/users/999"))
            .thenReturn(CompletableFuture.failedFuture(
                new ApiException("404 Not Found")
            ));

        ExecutionException exception = assertThrows(ExecutionException.class, () -> {
            userService.getUser(999).get();
        });

        assertTrue(exception.getCause() instanceof UserNotFoundException);
    }

    @Test
    void throwsErrorOnNetworkFailure() {
        when(apiClient.get("/users/1"))
            .thenReturn(CompletableFuture.failedFuture(
                new NetworkException("Connection failed")
            ));

        ExecutionException exception = assertThrows(ExecutionException.class, () -> {
            userService.getUser(1).get();
        });

        assertTrue(exception.getCause() instanceof NetworkException);
    }
}
```

**Why this works**: Success and multiple error scenarios covered.

---

## Rule 5: Avoid Race Conditions

**Statement**: Coordinate multiple async operations properly using Promise.all(), proper sequencing, or synchronization primitives.

### Why This Matters

Race conditions occur when:
- Multiple async operations run concurrently without coordination
- Test assumes operation A completes before operation B
- Shared state is modified by concurrent operations

**Result**: Intermittent failures that are hard to reproduce and debug.

### ❌ WRONG: Uncoordinated Concurrent Operations (Jest)

```javascript
// This is WRONG - race condition
test('processes items concurrently', async () => {
  const items = [1, 2, 3];
  const results = [];

  // Race condition - forEach doesn't wait for promises
  items.forEach(async (item) => {
    const result = await processItem(item);
    results.push(result); // Concurrent array mutation!
  });

  expect(results).toHaveLength(3); // Fails! Results is empty
});
```

**What breaks**:
- forEach doesn't await promises
- Test continues before any processing completes
- Concurrent array mutation may lose updates

### ❌ WRONG: Assuming Order Without Coordination (Pytest)

```python
# This is WRONG - race condition
@pytest.mark.asyncio
async def test_sequential_processing():
    # These run concurrently, not sequentially!
    fetch_data()  # Not awaited
    process_data()  # Not awaited
    save_data()  # Not awaited

    # Data might not be saved yet
    assert data_is_saved()
```

**What breaks**: Operations run concurrently. No guarantee of order.

### ❌ WRONG: Shared State Without Synchronization (JUnit 5)

```java
// This is WRONG - race condition on shared state
@Test
void testConcurrentUpdates() throws Exception {
    AtomicInteger counter = new AtomicInteger(0);

    // Multiple threads updating counter
    CompletableFuture<Void> future1 = CompletableFuture.runAsync(() -> {
        for (int i = 0; i < 1000; i++) {
            counter.incrementAndGet();
        }
    });

    CompletableFuture<Void> future2 = CompletableFuture.runAsync(() -> {
        for (int i = 0; i < 1000; i++) {
            counter.incrementAndGet();
        }
    });

    // Not waiting for both to complete!
    assertEquals(2000, counter.get()); // Fails intermittently
}
```

**What breaks**: Test doesn't wait for futures. Counter read before operations complete.

### ✅ CORRECT: Coordinate with Promise.all() (Jest)

```javascript
// Correct - wait for all promises
test('processes items concurrently', async () => {
  const items = [1, 2, 3];

  // Promise.all waits for all to complete
  const results = await Promise.all(
    items.map(item => processItem(item))
  );

  expect(results).toHaveLength(3);
  expect(results).toEqual([2, 4, 6]);
});

// Alternative - sequential processing
test('processes items sequentially', async () => {
  const items = [1, 2, 3];
  const results = [];

  for (const item of items) {
    const result = await processItem(item);
    results.push(result);
  }

  expect(results).toEqual([2, 4, 6]);
});
```

**Why this works**:
- Promise.all waits for all operations
- Sequential loop awaits each operation
- No race conditions on results array

### ✅ CORRECT: Coordinate with asyncio.gather (Pytest)

```python
import asyncio
import pytest

# Correct - wait for all coroutines
@pytest.mark.asyncio
async def test_processes_items_concurrently():
    items = [1, 2, 3]

    # asyncio.gather waits for all
    results = await asyncio.gather(
        *[process_item(item) for item in items]
    )

    assert results == [2, 4, 6]

# Alternative - sequential processing
@pytest.mark.asyncio
async def test_processes_items_sequentially():
    await fetch_data()
    await process_data()
    await save_data()

    assert data_is_saved()
```

**Why this works**: asyncio.gather coordinates concurrent operations. Sequential await ensures order.

### ✅ CORRECT: Coordinate with allOf (JUnit 5)

```java
// Correct - wait for all futures
@Test
void testConcurrentUpdates() throws Exception {
    AtomicInteger counter = new AtomicInteger(0);

    CompletableFuture<Void> future1 = CompletableFuture.runAsync(() -> {
        for (int i = 0; i < 1000; i++) {
            counter.incrementAndGet();
        }
    });

    CompletableFuture<Void> future2 = CompletableFuture.runAsync(() -> {
        for (int i = 0; i < 1000; i++) {
            counter.incrementAndGet();
        }
    });

    // Wait for both to complete
    CompletableFuture.allOf(future1, future2).get();

    assertEquals(2000, counter.get());
}

// Alternative - sequential execution
@Test
void testSequentialProcessing() throws Exception {
    fetchData().get();
    processData().get();
    saveData().get();

    assertTrue(dataIsSaved());
}
```

**Why this works**: allOf waits for all futures. Sequential .get() ensures order.

---

## Rule 6: Set Appropriate Timeouts

**Statement**: Use reasonable timeouts based on operation type. Different operations need different timeout values.

### Why This Matters

Timeouts prevent tests from hanging indefinitely when operations fail. But timeout values matter:
- **Too short**: Intermittent failures on slower machines
- **Too long**: Slow test suite, long waits when failures occur
- **Infinite**: Tests hang forever on failures

**Guidelines**:
- **API calls**: 5-10 seconds
- **Database queries**: 2-5 seconds
- **Animations/UI updates**: 1-2 seconds
- **File I/O**: 3-5 seconds
- **Heavy computation**: 10-30 seconds

### ❌ WRONG: No Timeout (Infinite Wait)

```javascript
// This is WRONG - no timeout, hangs forever if operation fails
test('fetches data', async () => {
  const data = await fetchData(); // Hangs forever if server down
  expect(data).toBeDefined();
});
```

**What breaks**: Test hangs indefinitely if operation never completes.

### ❌ WRONG: Too Short Timeout

```javascript
// This is WRONG - 100ms timeout too short for API call
test('fetches data', async () => {
  const data = await fetchData({ timeout: 100 }); // Too short!
  expect(data).toBeDefined();
}, 100); // Jest timeout also too short
```

**What breaks**: Fails intermittently on slow networks or under load.

### ✅ CORRECT: Appropriate Timeouts (Jest)

```javascript
// API call - 5 second timeout
test('fetches data from API', async () => {
  const data = await fetchData();
  expect(data).toBeDefined();
}, 5000); // 5 second Jest timeout

// Animation - 1 second timeout
test('element fades in', async () => {
  triggerAnimation();
  await waitFor(() => {
    expect(element.opacity).toBe(1);
  }, { timeout: 1000 }); // 1 second for animation
});

// Custom timeout per operation
jest.setTimeout(10000); // Set global timeout to 10s
```

**Why this works**: Timeout matches operation duration expectations.

### ✅ CORRECT: Appropriate Timeouts (Pytest)

```python
# API call - 5 second timeout
@pytest.mark.asyncio
@pytest.mark.timeout(5)
async def test_fetches_data_from_api():
    data = await fetch_data()
    assert data is not None

# Database query - 3 second timeout
@pytest.mark.asyncio
@pytest.mark.timeout(3)
async def test_database_query():
    result = await db.query("SELECT * FROM users")
    assert len(result) > 0

# Configure timeout in pytest.ini
# [pytest]
# timeout = 10  # Default 10 second timeout for all tests
```

**Why this works**: pytest-timeout plugin enforces timeouts. Values match operation types.

### ✅ CORRECT: Appropriate Timeouts (JUnit 5)

```java
// API call - 5 second timeout
@Test
@Timeout(5)
void testFetchesDataFromApi() throws Exception {
    User user = userService.fetchUser(1).get();
    assertNotNull(user);
}

// Alternative - @Timeout with unit
@Test
@Timeout(value = 5, unit = TimeUnit.SECONDS)
void testApiCall() {
    // Test code
}

// Awaitility with timeout
@Test
void testWithAwaitility() {
    await()
        .atMost(5, SECONDS)
        .until(() -> userService.isDataLoaded());
}
```

**Why this works**: @Timeout annotation prevents hanging. Awaitility provides operation-specific timeouts.

### ✅ CORRECT: Appropriate Timeouts (Mocha)

```javascript
// API call - 5 second timeout
it('fetches data from API', async function() {
  this.timeout(5000); // 5 second timeout

  const data = await fetchData();
  expect(data).to.exist;
});

// Set timeout for entire suite
describe('API Tests', function() {
  this.timeout(5000); // All tests in suite have 5s timeout

  it('test 1', async () => { /* ... */ });
  it('test 2', async () => { /* ... */ });
});

// Configure in mocha.opts or package.json
// mocha --timeout 5000
```

**Why this works**: this.timeout() sets per-test timeout. Suite-level timeout applies to all tests.

### ✅ CORRECT: Appropriate Timeouts (RSpec)

```ruby
# API call - 5 second timeout
it 'fetches data from API', timeout: 5 do
  data = fetch_data
  expect(data).not_to be_nil
end

# Configure in spec_helper.rb
RSpec.configure do |config|
  config.around(:each) do |example|
    Timeout.timeout(5) do
      example.run
    end
  end
end

# Capybara timeout for browser tests
Capybara.default_max_wait_time = 5
```

**Why this works**: Timeout metadata or around hook enforces timeouts.

---

## Framework-Specific Patterns

### Jest: async/await, expect().resolves/rejects

```javascript
// Pattern 1: async/await (recommended)
test('async operation', async () => {
  const result = await asyncFunction();
  expect(result).toBe(expected);
});

// Pattern 2: expect().resolves
test('async operation', () => {
  return expect(asyncFunction()).resolves.toBe(expected);
});

// Pattern 3: expect().rejects
test('async error', () => {
  return expect(asyncFunction()).rejects.toThrow('Error message');
});

// Pattern 4: Manual promise return
test('async operation', () => {
  return asyncFunction().then(result => {
    expect(result).toBe(expected);
  });
});

// Pattern 5: done callback (legacy, avoid)
test('async operation', (done) => {
  asyncFunction().then(result => {
    expect(result).toBe(expected);
    done();
  });
});
```

### Pytest: @pytest.mark.asyncio, async def test_

```python
import pytest

# Pattern 1: async test with asyncio marker (recommended)
@pytest.mark.asyncio
async def test_async_operation():
    result = await async_function()
    assert result == expected

# Pattern 2: async fixture
@pytest.fixture
async def async_resource():
    resource = await create_resource()
    yield resource
    await resource.cleanup()

@pytest.mark.asyncio
async def test_with_async_fixture(async_resource):
    result = await async_resource.get_data()
    assert result is not None

# Pattern 3: asyncio.gather for concurrent tests
@pytest.mark.asyncio
async def test_concurrent_operations():
    results = await asyncio.gather(
        operation1(),
        operation2(),
        operation3()
    )
    assert all(results)
```

### JUnit 5: CompletableFuture, @Timeout, Awaitility

```java
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import static org.awaitility.Awaitility.*;

// Pattern 1: CompletableFuture.get() (basic)
@Test
void testAsyncOperation() throws Exception {
    CompletableFuture<String> future = asyncOperation();
    String result = future.get(); // Blocks until complete
    assertEquals("expected", result);
}

// Pattern 2: Awaitility (recommended)
@Test
void testAsyncOperationWithAwaitility() {
    asyncOperation();

    await()
        .atMost(5, SECONDS)
        .until(() -> resultIsReady());

    assertEquals("expected", getResult());
}

// Pattern 3: @Timeout annotation
@Test
@Timeout(5)
void testWithTimeout() throws Exception {
    CompletableFuture<String> future = asyncOperation();
    assertEquals("expected", future.get());
}

// Pattern 4: CompletableFuture chaining
@Test
void testAsyncChain() throws Exception {
    String result = asyncOperation()
        .thenApply(String::toUpperCase)
        .thenApply(s -> s + "!")
        .get();

    assertEquals("EXPECTED!", result);
}
```

### Mocha: async/await, done() callback, this.timeout()

```javascript
const { expect } = require('chai');

// Pattern 1: async/await (recommended)
it('async operation', async () => {
  const result = await asyncOperation();
  expect(result).to.equal(expected);
});

// Pattern 2: Promise return
it('async operation', () => {
  return asyncOperation().then(result => {
    expect(result).to.equal(expected);
  });
});

// Pattern 3: done callback (legacy)
it('async operation', (done) => {
  asyncOperation().then(result => {
    expect(result).to.equal(expected);
    done();
  }).catch(done);
});

// Pattern 4: Set timeout
it('async operation', async function() {
  this.timeout(5000);
  const result = await asyncOperation();
  expect(result).to.equal(expected);
});

// WRONG: Never mix patterns
it('async operation', (done) => {
  return asyncOperation().then(result => { // Error!
    expect(result).to.equal(expected);
    done();
  });
});
```

### RSpec: async/await, Async gem, Capybara waiting

```ruby
require 'async'
require 'capybara/rspec'

# Pattern 1: Async gem (recommended for Ruby async)
it 'async operation' do
  result = Async do
    async_operation
  end.wait

  expect(result).to eq(expected)
end

# Pattern 2: Capybara smart waiting (browser tests)
it 'element appears', js: true do
  click_button 'Load'
  expect(page).to have_text('Loaded', wait: 5)
end

# Pattern 3: Custom wait helper
def wait_for(timeout = 5, &block)
  Timeout.timeout(timeout) do
    loop do
      return if block.call
      sleep 0.1
    end
  end
end

it 'condition becomes true' do
  trigger_operation
  wait_for { condition_is_true? }
  expect(result).to be_truthy
end

# Pattern 4: EventMachine for async (older pattern)
it 'async operation with EM' do
  EM.run do
    async_operation do |result|
      expect(result).to eq(expected)
      EM.stop
    end
  end
end
```

---

## Common Anti-Patterns

### Sleeping Snail

```javascript
// WRONG - arbitrary sleep
test('data loads', async () => {
  triggerLoad();
  await sleep(1000); // Arbitrary wait
  expect(data).toBeDefined();
});

// CORRECT - condition-based wait
test('data loads', async () => {
  triggerLoad();
  await waitFor(() => data !== null, { timeout: 5000 });
  expect(data).toBeDefined();
});
```

### Fire and Forget

```javascript
// WRONG - promise not awaited
test('saves data', async () => {
  saveData(); // Promise ignored!
  expect(dataSaved).toBe(true); // Runs immediately
});

// CORRECT - await promise
test('saves data', async () => {
  await saveData();
  expect(dataSaved).toBe(true);
});
```

### Unhandled Rejection

```javascript
// WRONG - rejection not handled
test('handles error', async () => {
  failingOperation(); // Rejection unhandled!
});

// CORRECT - explicit error handling
test('handles error', async () => {
  await expect(failingOperation()).rejects.toThrow();
});
```

### Race Condition

```javascript
// WRONG - concurrent operations without coordination
test('processes all', async () => {
  items.forEach(async (item) => {
    await process(item); // forEach doesn't wait!
  });
  expect(allProcessed).toBe(true); // False! Nothing processed yet
});

// CORRECT - Promise.all coordination
test('processes all', async () => {
  await Promise.all(items.map(item => process(item)));
  expect(allProcessed).toBe(true);
});
```

### No Timeout

```javascript
// WRONG - infinite wait
test('fetches data', async () => {
  const data = await fetchData(); // Hangs forever if fails
  expect(data).toBeDefined();
});

// CORRECT - appropriate timeout
test('fetches data', async () => {
  const data = await fetchData();
  expect(data).toBeDefined();
}, 5000); // 5 second timeout
```

---

## Debugging Async Test Failures

### "Test hangs indefinitely"

**Causes**:
- Unhandled promise rejection
- Missing await/return
- No timeout configured
- Infinite loop in condition waiting

**Solutions**:
- Enable unhandled rejection warnings
- Add timeouts to all async tests
- Verify all promises awaited/returned
- Add logging to see where test hangs

### "Intermittent failures"

**Causes**:
- Race conditions
- Fixed timeouts too short
- Timing assumptions
- Shared state between tests

**Solutions**:
- Use condition-based waiting instead of sleep
- Increase timeouts or use dynamic waiting
- Isolate test state properly
- Add logging to identify timing issues

### "UnhandledPromiseRejectionWarning"

**Causes**:
- Promise rejection not caught
- Async function not awaited
- Error in async callback

**Solutions**:
- Wrap async calls in try/catch
- Use expect().rejects matchers
- Ensure all promises awaited
- Enable strict unhandled rejection mode

### "Test passes but operation failed"

**Causes**:
- Promise not awaited
- Assertion runs before async completes
- Error silently swallowed

**Solutions**:
- Always await async operations
- Verify promises returned/awaited
- Add explicit error handling
- Check test framework async mode

---

## Agent Checklist: Async Testing

Before submitting async tests, verify:

- [ ] All promises awaited or returned to framework
- [ ] No arbitrary sleep/wait calls (use condition-based waiting)
- [ ] All promise rejections explicitly handled
- [ ] Both success and error paths tested
- [ ] No race conditions (concurrent operations coordinated)
- [ ] Appropriate timeouts set (5s for APIs, 1s for animations, etc.)
- [ ] No mixing of async patterns (pick one: async/await, promises, or done)
- [ ] Unhandled rejection warnings enabled
- [ ] Tests don't hang on failures
- [ ] No shared state between concurrent operations

---

## Summary

Async testing failures stem from three root causes:

1. **Not waiting properly** - Promises ignored, arbitrary sleeps, no condition waiting
2. **Not handling errors** - Unhandled rejections, missing error tests
3. **Race conditions** - Uncoordinated concurrent operations, timing assumptions

**Golden rules**:
- Always await or return promises
- Use condition-based waiting with timeouts, never arbitrary sleeps
- Test both success and error paths
- Coordinate concurrent operations with Promise.all/asyncio.gather/etc
- Set appropriate timeouts based on operation type

**67% of test flakiness traces to async issues**. Follow these rules to eliminate the majority of test reliability problems.

---

## Sources and References

- **Google Testing Blog**: John Micco, "Flaky Tests at Google and How We Mitigate Them"
- **Jest Documentation**: [Asynchronous Testing](https://jestjs.io/docs/asynchronous)
- **Pytest Documentation**: [How to use fixtures with async tests](https://docs.pytest.org/en/stable/how-to/fixtures.html)
- **JUnit 5 User Guide**: [Conditional Test Execution](https://junit.org/junit5/docs/current/user-guide/)
- **Mocha Documentation**: [Asynchronous Code](https://mochajs.org/#asynchronous-code)
- **Awaitility**: [Java DSL for synchronizing asynchronous operations](https://github.com/awaitility/awaitility)
- **Testing Frameworks Research Report**: 67% async flakiness statistic from comprehensive 2025 framework analysis
