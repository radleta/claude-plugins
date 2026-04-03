# Template: Async Testing with Mocha + Chai

**When to Use**: Testing asynchronous operations including Promises, async/await functions, callbacks, event emitters, timers, file I/O, network requests, and any code with delayed execution.

**Complexity**: Medium

**Common Mistakes Agents Make**:
- Mixing `done()` callback with async/await (use one or the other, not both)
- Forgetting to `return` promises, causing tests to pass incorrectly
- Not using `await` on async operations, making assertions run too early
- Not handling promise rejections properly in tests
- Setting timeout too low for slow async operations
- Not cleaning up timers, intervals, or event listeners
- Using `done()` incorrectly with async/await patterns
- Not testing both success and error paths for async code
- Forgetting `async` keyword on test function when using `await`
- Not waiting for all async operations before assertions

## Template

```javascript
/**
 * Async test suite for {{ModuleName}}
 *
 * Purpose: {{Brief description of async functionality}}
 *
 * Test Coverage:
 * - Promise-based operations
 * - Async/await patterns
 * - Callback-based operations
 * - Error handling for async failures
 * - Timeout and retry logic
 */

const { expect } = require('chai');
const { {{asyncFunction}}, {{callbackFunction}}, {{promiseFunction}} } = require('{{./path/to/module}}');

describe('{{ModuleName}} - Async Operations', function() {
  // Set timeout for slow async operations
  this.timeout({{5000}});

  describe('{{asyncFunction}} - async/await pattern', function() {
    // ✅ CORRECT: async test with await
    it('should {{expected behavior}} using async/await', async function() {
      // Arrange
      const {{input}} = {{testValue}};
      const {{expected}} = {{expectedValue}};

      // Act: await the async function
      const {{result}} = await {{asyncFunction}}({{input}});

      // Assert: assertions run after promise resolves
      expect({{result}}).to.equal({{expected}});
      expect({{result}}).to.have.property('{{propertyName}}');
    });

    it('should handle successful async operation', async function() {
      // Arrange
      const {{param}} = {{value}};

      // Act
      const {{result}} = await {{asyncFunction}}({{param}});

      // Assert: Multiple assertions after await
      expect({{result}}).to.be.an('object');
      expect({{result}}.{{status}}).to.equal('{{success}}');
      expect({{result}}.{{data}}).to.exist;
    });

    describe('error handling', function() {
      // ✅ CORRECT: Testing async rejection
      it('should reject with error for invalid input', async function() {
        // Arrange
        const {{invalidInput}} = {{invalidValue}};

        // Act & Assert: Expect rejection
        try {
          await {{asyncFunction}}({{invalidInput}});
          // If we reach here, test should fail
          expect.fail('Expected function to reject');
        } catch (error) {
          expect(error).to.be.an('error');
          expect(error.message).to.include('{{expected error message}}');
        }
      });

      // Alternative: Using Chai as Promised
      it('should be rejected with error', async function() {
        // Arrange
        const {{invalidInput}} = {{invalidValue}};

        // Act & Assert
        await expect({{asyncFunction}}({{invalidInput}}))
          .to.be.rejectedWith({{ErrorType}}, '{{error message}}');
      });
    });

    describe('with multiple async operations', function() {
      it('should handle sequential async calls', async function() {
        // Arrange
        const {{input1}} = {{value1}};
        const {{input2}} = {{value2}};

        // Act: Sequential execution
        const {{result1}} = await {{asyncFunction}}({{input1}});
        const {{result2}} = await {{asyncFunction}}({{result1}}.{{data}});
        const {{result3}} = await {{asyncFunction}}({{result2}}.{{data}});

        // Assert
        expect({{result3}}.{{finalProperty}}).to.equal({{expectedFinalValue}});
      });

      it('should handle parallel async calls', async function() {
        // Arrange
        const {{inputs}} = [{{value1}}, {{value2}}, {{value3}}];

        // Act: Parallel execution with Promise.all
        const {{results}} = await Promise.all(
          {{inputs}}.map(input => {{asyncFunction}}(input))
        );

        // Assert
        expect({{results}}).to.have.lengthOf(3);
        {{results}}.forEach(result => {
          expect(result).to.have.property('{{status}}', '{{success}}');
        });
      });

      it('should handle race condition', async function() {
        // Arrange
        const {{fastOperation}} = {{asyncFunction}}({{quickValue}});
        const {{slowOperation}} = {{asyncFunction}}({{slowValue}});

        // Act: Race - first to resolve wins
        const {{winner}} = await Promise.race([{{fastOperation}}, {{slowOperation}}]);

        // Assert
        expect({{winner}}).to.have.property('{{property}}');
      });
    });
  });

  describe('{{promiseFunction}} - Promise-based pattern', function() {
    // ✅ CORRECT: Return the promise
    it('should {{expected behavior}} by returning promise', function() {
      // Arrange
      const {{input}} = {{testValue}};

      // Act & Assert: Return the promise chain
      return {{promiseFunction}}({{input}})
        .then(result => {
          expect(result).to.equal({{expectedValue}});
          expect(result).to.be.a('{{type}}');
        });
    });

    it('should chain promises correctly', function() {
      // Arrange
      const {{input}} = {{testValue}};

      // Act & Assert
      return {{promiseFunction}}({{input}})
        .then(result => {
          expect(result).to.exist;
          return {{promiseFunction}}(result.{{next}});
        })
        .then(finalResult => {
          expect(finalResult.{{status}}).to.equal('{{complete}}');
        });
    });

    describe('error handling', function() {
      // ✅ CORRECT: Testing promise rejection
      it('should reject for invalid input', function() {
        // Arrange
        const {{invalidInput}} = {{invalidValue}};

        // Act & Assert: Catch the rejection
        return {{promiseFunction}}({{invalidInput}})
          .then(() => {
            throw new Error('Expected promise to reject');
          })
          .catch(error => {
            expect(error).to.be.an('error');
            expect(error.message).to.include('{{expected message}}');
          });
      });
    });
  });

  describe('{{callbackFunction}} - Callback pattern', function() {
    // ✅ CORRECT: Use done() for callbacks
    it('should {{expected behavior}} with callback', function(done) {
      // Arrange
      const {{input}} = {{testValue}};

      // Act: Call function with callback
      {{callbackFunction}}({{input}}, (error, result) => {
        // Assert: Inside callback
        try {
          expect(error).to.be.null;
          expect(result).to.equal({{expectedValue}});
          done();  // Signal test completion
        } catch (assertionError) {
          done(assertionError);  // Pass assertion errors to done
        }
      });
    });

    it('should call callback with error for invalid input', function(done) {
      // Arrange
      const {{invalidInput}} = {{invalidValue}};

      // Act
      {{callbackFunction}}({{invalidInput}}, (error, result) => {
        // Assert: Expect error
        try {
          expect(error).to.exist;
          expect(error.message).to.include('{{expected error}}');
          expect(result).to.be.undefined;
          done();
        } catch (assertionError) {
          done(assertionError);
        }
      });
    });

    // ❌ WRONG: Don't mix done() with async/await
    // it('should NOT do this', async function(done) {
    //   const result = await someAsyncFunction();
    //   done();  // DON'T DO THIS
    // });
  });

  describe('timeout handling', function() {
    it('should complete before timeout', async function() {
      // Arrange: Set specific timeout for this test
      this.timeout({{2000}});
      const {{input}} = {{testValue}};

      // Act
      const {{result}} = await {{asyncFunction}}({{input}});

      // Assert
      expect({{result}}).to.exist;
    });

    it('should handle slow operation', async function() {
      // Arrange: Increase timeout for slow operation
      this.timeout({{10000}});
      const {{slowInput}} = {{largeDataSet}};

      // Act
      const {{result}} = await {{asyncFunction}}({{slowInput}});

      // Assert
      expect({{result}}).to.have.property('{{completedFlag}}', true);
    });

    it('should timeout and fail for infinite operation', async function() {
      // This test will timeout and fail - that's expected behavior
      this.timeout({{1000}});

      // Act: This should timeout
      const {{result}} = await new Promise(resolve => {
        // Never resolves - will timeout
      });
    });
  });

  describe('retry logic', function() {
    let {{attemptCount}};

    beforeEach(function() {
      {{attemptCount}} = 0;
    });

    it('should retry on failure', async function() {
      // Arrange
      const {{maxRetries}} = 3;
      const {{retryableOperation}} = async () => {
        {{attemptCount}}++;
        if ({{attemptCount}} < {{maxRetries}}) {
          throw new Error('Temporary failure');
        }
        return { success: true, attempts: {{attemptCount}} };
      };

      // Act
      let {{result}};
      for (let i = 0; i < {{maxRetries}}; i++) {
        try {
          {{result}} = await {{retryableOperation}}();
          break;
        } catch (error) {
          if (i === {{maxRetries}} - 1) throw error;
        }
      }

      // Assert
      expect({{result}}.success).to.be.true;
      expect({{result}}.attempts).to.equal({{maxRetries}});
    });
  });

  describe('event emitter pattern', function() {
    it('should emit event when operation completes', function(done) {
      // Arrange
      const { EventEmitter } = require('events');
      const {{emitter}} = new EventEmitter();
      const {{expectedData}} = {{testValue}};

      // Assert: Set up listener before acting
      {{emitter}}.on('{{eventName}}', (data) => {
        try {
          expect(data).to.equal({{expectedData}});
          done();
        } catch (error) {
          done(error);
        }
      });

      // Act: Trigger the event
      {{emitter}}.emit('{{eventName}}', {{expectedData}});
    });

    it('should handle multiple events', function(done) {
      // Arrange
      const { EventEmitter } = require('events');
      const {{emitter}} = new EventEmitter();
      let {{eventCount}} = 0;
      const {{expectedEvents}} = 3;

      // Assert
      {{emitter}}.on('{{eventName}}', () => {
        {{eventCount}}++;
        if ({{eventCount}} === {{expectedEvents}}) {
          try {
            expect({{eventCount}}).to.equal({{expectedEvents}});
            done();
          } catch (error) {
            done(error);
          }
        }
      });

      // Act
      {{emitter}}.emit('{{eventName}}');
      {{emitter}}.emit('{{eventName}}');
      {{emitter}}.emit('{{eventName}}');
    });
  });

  describe('timer operations', function() {
    let {{timerId}};

    afterEach(function() {
      // Cleanup: Clear any pending timers
      if ({{timerId}}) {
        clearTimeout({{timerId}});
        {{timerId}} = null;
      }
    });

    it('should execute after delay', function(done) {
      // Arrange
      this.timeout({{3000}});
      const {{delay}} = {{1000}};
      const {{startTime}} = Date.now();

      // Act
      {{timerId}} = setTimeout(() => {
        const {{elapsed}} = Date.now() - {{startTime}};

        // Assert
        try {
          expect({{elapsed}}).to.be.at.least({{delay}});
          done();
        } catch (error) {
          done(error);
        }
      }, {{delay}});
    });
  });
});
```

## Adaptation Rules

- [ ] Replace `{{ModuleName}}` with module name being tested
- [ ] Replace `{{asyncFunction}}`, `{{callbackFunction}}` with actual function names
- [ ] Update `{{./path/to/module}}` with actual module path
- [ ] Choose appropriate async pattern (async/await, promises, or callbacks)
- [ ] Set realistic timeout values for your operations
- [ ] Add error handling tests for all async operations
- [ ] Remove unused patterns (callback tests if only using async/await)
- [ ] Test both success and failure paths
- [ ] Add cleanup in afterEach for resources (timers, listeners)
- [ ] Use `return` with promises or `async/await`, never mix with `done()`

## Async Testing Patterns

```javascript
// ✅ CORRECT: async/await
it('correct async/await', async function() {
  const result = await asyncFunction();
  expect(result).to.exist;
});

// ✅ CORRECT: Returning promise
it('correct promise return', function() {
  return asyncFunction().then(result => {
    expect(result).to.exist;
  });
});

// ✅ CORRECT: done() callback
it('correct callback', function(done) {
  callbackFunction((err, result) => {
    expect(err).to.be.null;
    done();
  });
});

// ❌ WRONG: Forgetting async keyword
it('missing async keyword', function() {
  const result = await asyncFunction();  // ERROR
});

// ❌ WRONG: Not returning promise
it('not returning promise', function() {
  asyncFunction().then(result => {
    expect(result).to.exist;  // May not run!
  });
});

// ❌ WRONG: Mixing async/await with done
it('mixing patterns', async function(done) {
  const result = await asyncFunction();
  done();  // DON'T DO THIS
});
```

## .mocharc.json Configuration

```json
{
  "require": ["{{./test/setup.js}}"],
  "spec": ["{{test/**/*.spec.js}}"],
  "timeout": {{5000}},
  "ui": "bdd",
  "reporter": "spec",
  "color": true,
  "bail": false,
  "async-only": false
}
```

## Related

- Template: @templates/mocha/basic-unit.spec.js (for synchronous tests)
- Template: @templates/mocha/integration.spec.js (for API async tests)
- Template: @templates/mocha/mock.spec.js (for mocking async dependencies)

## Example: File System Async Operations

```javascript
const { expect } = require('chai');
const fs = require('fs').promises;
const path = require('path');

describe('File Operations - Async', function() {
  this.timeout(5000);

  const testDir = path.join(__dirname, 'temp');
  const testFile = path.join(testDir, 'test.txt');

  before(async function() {
    await fs.mkdir(testDir, { recursive: true });
  });

  after(async function() {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  afterEach(async function() {
    try {
      await fs.unlink(testFile);
    } catch (error) {
      // File might not exist, ignore
    }
  });

  describe('writeFile', function() {
    it('should write content to file', async function() {
      // Arrange
      const content = 'Hello, World!';

      // Act
      await fs.writeFile(testFile, content, 'utf8');

      // Assert
      const result = await fs.readFile(testFile, 'utf8');
      expect(result).to.equal(content);
    });

    it('should reject for invalid path', async function() {
      // Arrange
      const invalidPath = '/invalid/path/file.txt';

      // Act & Assert
      try {
        await fs.writeFile(invalidPath, 'content');
        expect.fail('Expected writeFile to reject');
      } catch (error) {
        expect(error.code).to.equal('ENOENT');
      }
    });
  });

  describe('readFile', function() {
    beforeEach(async function() {
      await fs.writeFile(testFile, 'test content', 'utf8');
    });

    it('should read file content', async function() {
      const content = await fs.readFile(testFile, 'utf8');
      expect(content).to.equal('test content');
    });

    it('should reject for non-existent file', async function() {
      await expect(
        fs.readFile('/nonexistent.txt', 'utf8')
      ).to.be.rejected;
    });
  });
});
```
