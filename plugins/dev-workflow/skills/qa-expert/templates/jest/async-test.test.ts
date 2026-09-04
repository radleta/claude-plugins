# Template: Async Test

**When to Use**: Testing promises, async/await functions, timers, setTimeout/setInterval, callbacks, event emitters, delayed operations, polling, retries, and any asynchronous code.

**Complexity**: Medium

**Common Mistakes Agents Make**:
- Not returning promises from test functions (test completes before async operation)
- Using fixed `setTimeout` instead of `jest.useFakeTimers()` (tests become slow and flaky)
- Not cleaning up timers with `jest.clearAllTimers()` after tests
- Forgetting to use `await` or `return` with async operations
- Not handling promise rejections properly in tests
- Using `done` callback incorrectly or unnecessarily (prefer async/await)
- Race conditions when testing concurrent operations
- Not waiting for state updates with `waitFor` in React tests
- Mixing fake timers and real timers without proper cleanup
- Not testing both success and failure paths for async operations

## Template

```typescript
import { {{asyncFunction}} } from './{{modulePath}}';
import { {{ApiClient}} } from './{{apiPath}}';

/**
 * Test suite for async operations in {{FeatureName}}
 *
 * Tests promises, async/await, timers, and delayed operations
 * using Jest's async testing utilities.
 */
describe('{{FeatureName}} - Async Operations', () => {
  /**
   * Basic async/await tests
   */
  describe('async/await pattern', () => {
    it('should resolve with expected value', async () => {
      // Arrange
      const input = {{inputValue}};

      // Act
      const result = await {{asyncFunction}}(input);

      // Assert
      expect(result).toEqual({{expectedValue}});
    });

    it('should reject with error for invalid input', async () => {
      // Arrange
      const invalidInput = {{invalidValue}};

      // Act & Assert
      await expect({{asyncFunction}}(invalidInput))
        .rejects
        .toThrow('{{errorMessage}}');
    });

    it('should reject with specific error type', async () => {
      // Arrange
      const invalidInput = {{invalidValue}};

      // Act & Assert
      await expect({{asyncFunction}}(invalidInput))
        .rejects
        .toThrow({{ErrorClass}});
    });

    it('should handle multiple async operations in sequence', async () => {
      // Arrange
      const step1Input = {{input1}};
      const step2Input = {{input2}};

      // Act
      const result1 = await {{asyncFunction1}}(step1Input);
      const result2 = await {{asyncFunction2}}(result1, step2Input);

      // Assert
      expect(result2).toEqual({{expectedFinalResult}});
    });

    it('should handle multiple async operations in parallel', async () => {
      // Arrange
      const inputs = [{{input1}}, {{input2}}, {{input3}}];

      // Act
      const results = await Promise.all(
        inputs.map(input => {{asyncFunction}}(input))
      );

      // Assert
      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({{expected1}});
      expect(results[1]).toEqual({{expected2}});
      expect(results[2]).toEqual({{expected3}});
    });
  });

  /**
   * Promise-based tests
   */
  describe('promise handling', () => {
    it('should resolve promise successfully', () => {
      // Arrange
      const input = {{inputValue}};

      // Act & Assert
      // Must return the promise
      return {{asyncFunction}}(input).then(result => {
        expect(result).toEqual({{expectedValue}});
      });
    });

    it('should reject promise with error', () => {
      // Arrange
      const invalidInput = {{invalidValue}};

      // Act & Assert
      return {{asyncFunction}}(invalidInput).catch(error => {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('{{errorMessage}}');
      });
    });

    it('should chain multiple promises', () => {
      // Arrange
      const input = {{inputValue}};

      // Act & Assert
      return {{asyncFunction1}}(input)
        .then(result1 => {{asyncFunction2}}(result1))
        .then(result2 => {{asyncFunction3}}(result2))
        .then(finalResult => {
          expect(finalResult).toEqual({{expectedFinalValue}});
        });
    });

    it('should use Promise.all for parallel execution', () => {
      // Arrange
      const promises = [
        {{asyncFunction}}({{input1}}),
        {{asyncFunction}}({{input2}}),
        {{asyncFunction}}({{input3}}),
      ];

      // Act & Assert
      return Promise.all(promises).then(results => {
        expect(results).toHaveLength(3);
        expect(results).toEqual([{{expected1}}, {{expected2}}, {{expected3}}]);
      });
    });

    it('should use Promise.race for first completed', () => {
      // Arrange
      const promises = [
        {{asyncFunction}}({{input1}}, 100), // 100ms delay
        {{asyncFunction}}({{input2}}, 50),  // 50ms delay (fastest)
        {{asyncFunction}}({{input3}}, 200), // 200ms delay
      ];

      // Act & Assert
      return Promise.race(promises).then(result => {
        expect(result).toEqual({{expected2}}); // Fastest one
      });
    });

    it('should use Promise.allSettled for mixed results', async () => {
      // Arrange
      const promises = [
        {{asyncFunction}}({{validInput}}),    // Will succeed
        {{asyncFunction}}({{invalidInput}}),  // Will fail
        {{asyncFunction}}({{anotherValid}}),  // Will succeed
      ];

      // Act
      const results = await Promise.allSettled(promises);

      // Assert
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
    });
  });

  /**
   * Callback-based async tests (legacy pattern)
   */
  describe('callback pattern (legacy)', () => {
    it('should handle callback with done parameter', (done) => {
      // Arrange
      const input = {{inputValue}};

      // Act
      {{callbackFunction}}(input, (error, result) => {
        // Assert
        expect(error).toBeNull();
        expect(result).toEqual({{expectedValue}});

        // CRITICAL: Must call done() to complete test
        done();
      });
    });

    it('should handle callback errors with done', (done) => {
      // Arrange
      const invalidInput = {{invalidValue}};

      // Act
      {{callbackFunction}}(invalidInput, (error, result) => {
        // Assert
        expect(error).toBeDefined();
        expect(error.message).toContain('{{errorMessage}}');
        expect(result).toBeUndefined();

        done();
      });
    });

    it('should timeout if callback never called', (done) => {
      // This test will fail after Jest's default timeout (5000ms)
      // Use jest.setTimeout() to customize

      {{callbackFunction}}({{input}}, (error, result) => {
        expect(result).toBeDefined();
        done();
      });
    }, 1000); // Custom timeout: 1 second
  });

  /**
   * Fake timers tests
   */
  describe('timer-based operations', () => {
    beforeEach(() => {
      // Enable fake timers before each test
      jest.useFakeTimers();
    });

    afterEach(() => {
      // Clean up timers after each test
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    it('should execute after timeout with fake timers', () => {
      // Arrange
      const callback = jest.fn();
      const delay = 1000;

      // Act
      setTimeout(callback, delay);

      // Assert - not called yet
      expect(callback).not.toHaveBeenCalled();

      // Fast-forward time
      jest.advanceTimersByTime(delay);

      // Assert - now called
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle setInterval with fake timers', () => {
      // Arrange
      const callback = jest.fn();
      const interval = 1000;

      // Act
      setInterval(callback, interval);

      // Assert - not called yet
      expect(callback).not.toHaveBeenCalled();

      // Fast-forward through 3 intervals
      jest.advanceTimersByTime(3000);

      // Assert - called 3 times
      expect(callback).toHaveBeenCalledTimes(3);
    });

    it('should run all pending timers', () => {
      // Arrange
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      // Act
      setTimeout(callback1, 1000);
      setTimeout(callback2, 2000);

      // Assert - not called yet
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();

      // Run all timers
      jest.runAllTimers();

      // Assert - both called
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should run only next timer', () => {
      // Arrange
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      // Act
      setTimeout(callback1, 1000);
      setTimeout(callback2, 2000);

      // Run only the next pending timer
      jest.runOnlyPendingTimers();

      // Assert
      expect(callback1).toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });

    it('should test debounced function', () => {
      // Arrange
      const callback = jest.fn();
      const debouncedFn = {{debounce}}(callback, 500);

      // Act - call multiple times rapidly
      debouncedFn();
      debouncedFn();
      debouncedFn();

      // Assert - not called yet (debounced)
      expect(callback).not.toHaveBeenCalled();

      // Fast-forward past debounce delay
      jest.advanceTimersByTime(500);

      // Assert - called only once
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should test throttled function', () => {
      // Arrange
      const callback = jest.fn();
      const throttledFn = {{throttle}}(callback, 1000);

      // Act - call multiple times
      throttledFn();
      throttledFn();
      throttledFn();

      // Assert - called immediately (first call)
      expect(callback).toHaveBeenCalledTimes(1);

      // Fast-forward
      jest.advanceTimersByTime(1000);
      throttledFn();

      // Assert - called again after throttle period
      expect(callback).toHaveBeenCalledTimes(2);
    });
  });

  /**
   * Retry and polling tests
   */
  describe('retry and polling logic', () => {
    it('should retry failed operation', async () => {
      // Arrange
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('First attempt'))
        .mockRejectedValueOnce(new Error('Second attempt'))
        .mockResolvedValueOnce({{successValue}});

      // Act
      const result = await {{retryFunction}}(mockFn, { maxRetries: 3 });

      // Assert
      expect(mockFn).toHaveBeenCalledTimes(3);
      expect(result).toEqual({{successValue}});
    });

    it('should fail after max retries exceeded', async () => {
      // Arrange
      const mockFn = jest.fn()
        .mockRejectedValue(new Error('Always fails'));

      // Act & Assert
      await expect({{retryFunction}}(mockFn, { maxRetries: 3 }))
        .rejects
        .toThrow('Always fails');

      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should poll until condition met', async () => {
      // Arrange
      let callCount = 0;
      const pollFn = jest.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve(callCount >= 3 ? {{targetValue}} : {{intermediateValue}});
      });

      const condition = (value: any) => value === {{targetValue}};

      // Act
      const result = await {{pollUntil}}(pollFn, condition, {
        interval: 100,
        timeout: 1000,
      });

      // Assert
      expect(result).toEqual({{targetValue}});
      expect(pollFn).toHaveBeenCalledTimes(3);
    });

    it('should timeout polling after max duration', async () => {
      // Arrange
      const pollFn = jest.fn().mockResolvedValue({{wrongValue}});
      const condition = (value: any) => value === {{targetValue}};

      // Act & Assert
      await expect(
        {{pollUntil}}(pollFn, condition, { interval: 100, timeout: 500 })
      ).rejects.toThrow('Timeout');
    });
  });

  /**
   * Async state management tests
   */
  describe('async state changes', () => {
    it('should wait for async state update', async () => {
      // Arrange
      const initialState = {{initialValue}};
      const component = new {{ComponentClass}}(initialState);

      // Act
      component.{{triggerAsyncUpdate}}();

      // Wait for state to update
      await {{waitFor}}(() => {
        expect(component.state).toEqual({{expectedState}});
      }, { timeout: 2000 });

      // Assert
      expect(component.state).toEqual({{expectedState}});
    });

    it('should handle multiple concurrent state updates', async () => {
      // Arrange
      const component = new {{ComponentClass}}();

      // Act - trigger multiple updates
      const updates = [
        component.{{update1}}(),
        component.{{update2}}(),
        component.{{update3}}(),
      ];

      await Promise.all(updates);

      // Assert
      expect(component.state).toMatchObject({
        {{property1}}: {{expectedValue1}},
        {{property2}}: {{expectedValue2}},
        {{property3}}: {{expectedValue3}},
      });
    });
  });

  /**
   * Error handling and timeout tests
   */
  describe('error handling and timeouts', () => {
    it('should handle network timeout', async () => {
      // Arrange
      const slowApi = {{createSlowApi}}(5000); // 5 second delay

      // Act & Assert
      await expect(
        {{fetchWithTimeout}}(slowApi, { timeout: 1000 })
      ).rejects.toThrow('Timeout');
    });

    it('should cancel pending request', async () => {
      // Arrange
      const abortController = new AbortController();
      const request = {{fetchData}}({{url}}, {
        signal: abortController.signal,
      });

      // Act
      setTimeout(() => abortController.abort(), 100);

      // Assert
      await expect(request).rejects.toThrow('AbortError');
    });

    it('should handle race condition safely', async () => {
      // Arrange
      let latestRequestId = 0;

      const makeRequest = (id: number) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            if (id === latestRequestId) {
              resolve({{successValue}});
            }
          }, Math.random() * 100);
        });
      };

      // Act - fire multiple requests
      latestRequestId = 1;
      const request1 = makeRequest(1);
      latestRequestId = 2;
      const request2 = makeRequest(2);
      latestRequestId = 3;
      const request3 = makeRequest(3);

      const results = await Promise.all([request1, request2, request3]);

      // Assert - only latest request succeeded
      const successCount = results.filter(r => r === {{successValue}}).length;
      expect(successCount).toBeLessThanOrEqual(1);
    });
  });
});
```

## Adaptation Rules

- [ ] Replace `{{asyncFunction}}` with actual async function name
- [ ] Use `async/await` syntax (modern, preferred over promises)
- [ ] Always `await` or `return` promises in tests
- [ ] Use `jest.useFakeTimers()` for testing timers (don't use real delays)
- [ ] Clean up timers in `afterEach` to prevent test interference
- [ ] Test both success and error paths for async operations
- [ ] Use `jest.advanceTimersByTime()` instead of waiting for real time
- [ ] Handle promise rejections with `rejects.toThrow()`
- [ ] Test retry logic, timeouts, and cancellation
- [ ] Avoid `done` callback (use async/await instead unless testing callbacks)

## Related

- Template: @templates/jest/basic-unit-test.test.ts (for synchronous tests)
- Template: @templates/jest/integration-test.test.ts (for API tests with async operations)
- Template: @templates/jest/mock-test.test.ts (for mocking async dependencies)

## Example: Async Data Fetching Test

```typescript
import { fetchUserData, retryFetch } from './api';

describe('User Data Fetching', () => {
  describe('async/await pattern', () => {
    it('should fetch user data successfully', async () => {
      const userId = 123;

      const userData = await fetchUserData(userId);

      expect(userData).toMatchObject({
        id: userId,
        name: expect.any(String),
        email: expect.any(String),
      });
    });

    it('should throw error for invalid user id', async () => {
      const invalidId = -1;

      await expect(fetchUserData(invalidId))
        .rejects
        .toThrow('Invalid user ID');
    });
  });

  describe('timer-based operations', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    it('should debounce search requests', () => {
      const searchFn = jest.fn();
      const debouncedSearch = debounce(searchFn, 300);

      debouncedSearch('a');
      debouncedSearch('ab');
      debouncedSearch('abc');

      expect(searchFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(300);

      expect(searchFn).toHaveBeenCalledTimes(1);
      expect(searchFn).toHaveBeenCalledWith('abc');
    });
  });

  describe('retry logic', () => {
    it('should retry failed requests', async () => {
      const mockFetch = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: 'success' });

      const result = await retryFetch(mockFetch, { maxRetries: 3 });

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ data: 'success' });
    });
  });
});
```

## Common Patterns

### Always return or await promises

```typescript
// ❌ Wrong - test completes before promise resolves
it('should fetch data', () => {
  fetchData().then(data => {
    expect(data).toBeDefined();
  });
});

// ✅ Correct - using async/await
it('should fetch data', async () => {
  const data = await fetchData();
  expect(data).toBeDefined();
});

// ✅ Correct - returning promise
it('should fetch data', () => {
  return fetchData().then(data => {
    expect(data).toBeDefined();
  });
});
```

### Use fake timers for speed

```typescript
// ❌ Wrong - test takes 5 seconds
it('should delay', async () => {
  const callback = jest.fn();
  setTimeout(callback, 5000);
  await new Promise(resolve => setTimeout(resolve, 5000));
  expect(callback).toHaveBeenCalled();
});

// ✅ Correct - test completes instantly
it('should delay', () => {
  jest.useFakeTimers();
  const callback = jest.fn();
  setTimeout(callback, 5000);
  jest.advanceTimersByTime(5000);
  expect(callback).toHaveBeenCalled();
  jest.useRealTimers();
});
```
