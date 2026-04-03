# Template: Mocking and Stubbing with Mocha + Chai + Sinon

**When to Use**: Testing code that depends on external services (databases, APIs, file systems), time-dependent code, or any function with side effects that should be isolated during testing.

**Complexity**: Medium

**Common Mistakes Agents Make**:
- Not restoring Sinon stubs after tests, causing test pollution
- Over-mocking: mocking too much makes tests fragile and not valuable
- Not using Sinon sandbox for automatic cleanup
- Mocking the wrong layer (mock at boundaries, not internal implementation)
- Not verifying that stubs/spies were called with correct arguments
- Creating stubs that don't match real behavior (stubs lie)
- Forgetting to assert on spy/stub calls (mock without verify)
- Not handling async stubs properly (forgetting resolves/rejects)
- Stubbing objects that get passed by value instead of reference
- Not testing the real integration at higher test levels

## Template

```javascript
/**
 * Test suite for {{ModuleName}} with mocking
 *
 * Purpose: {{Brief description of functionality being tested}}
 *
 * Mocking Strategy:
 * - {{External dependency 1}}: Stubbed to avoid {{reason}}
 * - {{External dependency 2}}: Spied to verify {{interaction}}
 * - {{External dependency 3}}: Mocked to control {{behavior}}
 *
 * Test Coverage:
 * - Function behavior with mocked dependencies
 * - Verification of dependency interactions
 * - Error handling with dependency failures
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { {{functionUnderTest}}, {{anotherFunction}} } = require('{{./path/to/module}}');
const {{DependencyModule}} = require('{{./path/to/dependency}}');

describe('{{ModuleName}} - With Mocking', function() {
  // Create sandbox for automatic cleanup
  let {{sandbox}};

  beforeEach(function() {
    // Arrange: Create fresh sandbox before each test
    {{sandbox}} = sinon.createSandbox();
  });

  afterEach(function() {
    // Cleanup: Restore all stubs/spies/mocks automatically
    {{sandbox}}.restore();
  });

  describe('{{functionUnderTest}} - with stubs', function() {
    it('should {{expected behavior}} when dependency returns {{value}}', async function() {
      // Arrange: Stub the dependency
      const {{stubReturn}} = { {{property}}: {{value}} };
      const {{dependencyStub}} = {{sandbox}}.stub({{DependencyModule}}, '{{methodName}}')
        .resolves({{stubReturn}});

      const {{input}} = {{testValue}};

      // Act
      const {{result}} = await {{functionUnderTest}}({{input}});

      // Assert: Verify result
      expect({{result}}).to.deep.equal({{expectedValue}});

      // Assert: Verify stub was called correctly
      expect({{dependencyStub}}.calledOnce).to.be.true;
      expect({{dependencyStub}}.calledWith({{expectedArg}})).to.be.true;
    });

    it('should handle dependency error', async function() {
      // Arrange: Stub to reject
      const {{error}} = new Error('{{Dependency failure}}');
      {{sandbox}}.stub({{DependencyModule}}, '{{methodName}}')
        .rejects({{error}});

      const {{input}} = {{testValue}};

      // Act & Assert
      try {
        await {{functionUnderTest}}({{input}});
        expect.fail('Expected function to throw');
      } catch (error) {
        expect(error.message).to.include('{{Dependency failure}}');
      }
    });

    it('should call dependency with correct arguments', async function() {
      // Arrange
      const {{stub}} = {{sandbox}}.stub({{DependencyModule}}, '{{methodName}}')
        .resolves({{returnValue}});

      const {{input}} = {{testValue}};

      // Act
      await {{functionUnderTest}}({{input}});

      // Assert: Verify call arguments
      expect({{stub}}.getCall(0).args[0]).to.equal({{expectedFirstArg}});
      expect({{stub}}.getCall(0).args[1]).to.deep.equal({{expectedSecondArg}});
    });

    it('should call dependency multiple times', async function() {
      // Arrange
      const {{stub}} = {{sandbox}}.stub({{DependencyModule}}, '{{methodName}}')
        .onFirstCall().resolves({{firstReturn}})
        .onSecondCall().resolves({{secondReturn}})
        .onThirdCall().resolves({{thirdReturn}});

      // Act
      const {{result1}} = await {{functionUnderTest}}({{input1}});
      const {{result2}} = await {{functionUnderTest}}({{input2}});
      const {{result3}} = await {{functionUnderTest}}({{input3}});

      // Assert
      expect({{stub}}.callCount).to.equal(3);
      expect({{result1}}).to.equal({{expectedResult1}});
      expect({{result2}}).to.equal({{expectedResult2}});
      expect({{result3}}).to.equal({{expectedResult3}});
    });
  });

  describe('{{functionUnderTest}} - with spies', function() {
    it('should call internal function with correct arguments', function() {
      // Arrange: Spy on internal function (not stubbing, real implementation runs)
      const {{spy}} = {{sandbox}}.spy({{DependencyModule}}, '{{methodName}}');
      const {{input}} = {{testValue}};

      // Act
      {{functionUnderTest}}({{input}});

      // Assert: Verify spy was called
      expect({{spy}}.calledOnce).to.be.true;
      expect({{spy}}.calledWith({{expectedArg}})).to.be.true;

      // Assert: Verify call details
      expect({{spy}}.firstCall.args[0]).to.equal({{expectedFirstArg}});
      expect({{spy}}.returnValues[0]).to.equal({{expectedReturnValue}});
    });

    it('should not call dependency when {{condition}}', function() {
      // Arrange
      const {{spy}} = {{sandbox}}.spy({{DependencyModule}}, '{{methodName}}');
      const {{input}} = {{specialValue}};

      // Act
      {{functionUnderTest}}({{input}});

      // Assert: Verify spy was NOT called
      expect({{spy}}.notCalled).to.be.true;
    });

    it('should call dependency in correct order', function() {
      // Arrange
      const {{spy1}} = {{sandbox}}.spy({{DependencyModule}}, '{{method1}}');
      const {{spy2}} = {{sandbox}}.spy({{DependencyModule}}, '{{method2}}');

      // Act
      {{functionUnderTest}}({{input}});

      // Assert: Verify call order
      expect({{spy1}}.calledBefore({{spy2}})).to.be.true;
    });
  });

  describe('{{functionUnderTest}} - with mocks', function() {
    it('should satisfy mock expectations', function() {
      // Arrange: Create mock with expectations
      const {{mock}} = {{sandbox}}.mock({{DependencyModule}});

      // Set expectations
      {{mock}}.expects('{{methodName}}')
        .once()
        .withArgs({{expectedArg}})
        .returns({{returnValue}});

      const {{input}} = {{testValue}};

      // Act
      const {{result}} = {{functionUnderTest}}({{input}});

      // Assert: Verify mock expectations
      {{mock}}.verify();  // Throws if expectations not met
      expect({{result}}).to.equal({{expectedValue}});
    });

    it('should fail if expectations not met', function() {
      // Arrange
      const {{mock}} = {{sandbox}}.mock({{DependencyModule}});
      {{mock}}.expects('{{methodName}}')
        .twice();  // Expect 2 calls

      // Act: Only call once
      {{functionUnderTest}}({{input}});

      // Assert: Verify will fail
      expect(() => {{mock}}.verify()).to.throw();
    });
  });

  describe('time-dependent code - using fake timers', function() {
    let {{clock}};

    beforeEach(function() {
      // Arrange: Create fake timer
      {{clock}} = {{sandbox}}.useFakeTimers();
    });

    it('should execute after delay', function() {
      // Arrange
      const {{callback}} = {{sandbox}}.spy();
      const {{delay}} = {{1000}};

      // Act: Set timeout
      setTimeout({{callback}}, {{delay}});

      // Fast-forward time
      {{clock}}.tick({{delay}});

      // Assert
      expect({{callback}}.calledOnce).to.be.true;
    });

    it('should execute interval multiple times', function() {
      // Arrange
      const {{callback}} = {{sandbox}}.spy();
      const {{interval}} = {{500}};

      // Act: Set interval
      setInterval({{callback}}, {{interval}});

      // Fast-forward time
      {{clock}}.tick({{interval}} * 3);

      // Assert
      expect({{callback}}.callCount).to.equal(3);
    });

    it('should debounce function calls', function() {
      // Arrange
      const {{callback}} = {{sandbox}}.spy();
      const {{debounceTime}} = {{300}};

      // Assuming a debounce function exists
      const {{debounced}} = {{debounce}}({{callback}}, {{debounceTime}});

      // Act: Call multiple times rapidly
      {{debounced}}();
      {{debounced}}();
      {{debounced}}();

      // Assert: Not called yet
      expect({{callback}}.notCalled).to.be.true;

      // Fast-forward past debounce time
      {{clock}}.tick({{debounceTime}});

      // Assert: Called once
      expect({{callback}}.calledOnce).to.be.true;
    });
  });

  describe('partial mocking - stub specific methods', function() {
    it('should stub one method while keeping others real', function() {
      // Arrange: Only stub one method
      const {{stub}} = {{sandbox}}.stub({{DependencyModule}}, '{{methodToStub}}')
        .returns({{stubValue}});

      // Other methods still use real implementation
      const {{input}} = {{testValue}};

      // Act
      const {{result}} = {{functionUnderTest}}({{input}});

      // Assert
      expect({{stub}}.calledOnce).to.be.true;
      expect({{result}}).to.have.property('{{property}}');
    });
  });

  describe('stubbing object instances', function() {
    it('should stub instance methods', function() {
      // Arrange
      const {{instance}} = new {{DependencyClass}}();
      const {{stub}} = {{sandbox}}.stub({{instance}}, '{{methodName}}')
        .returns({{returnValue}});

      // Act
      const {{result}} = {{functionUnderTest}}({{instance}});

      // Assert
      expect({{stub}}.calledOnce).to.be.true;
      expect({{result}}).to.equal({{expectedValue}});
    });
  });

  describe('complex stub behaviors', function() {
    it('should stub with conditional returns', function() {
      // Arrange
      const {{stub}} = {{sandbox}}.stub({{DependencyModule}}, '{{methodName}}');

      // Different returns based on arguments
      {{stub}}.withArgs({{arg1}}).returns({{return1}});
      {{stub}}.withArgs({{arg2}}).returns({{return2}});
      {{stub}}.returns({{defaultReturn}});  // Default

      // Act & Assert
      expect({{functionUnderTest}}({{arg1}})).to.equal({{expectedReturn1}});
      expect({{functionUnderTest}}({{arg2}})).to.equal({{expectedReturn2}});
      expect({{functionUnderTest}}({{arg3}})).to.equal({{expectedDefaultReturn}});
    });

    it('should stub with callback invocation', function(done) {
      // Arrange: Stub that invokes callback
      {{sandbox}}.stub({{DependencyModule}}, '{{methodName}}')
        .callsFake(({{param}}, {{callback}}) => {
          // Simulate async callback
          setTimeout(() => {
            {{callback}}(null, {{resultValue}});
          }, 10);
        });

      // Act
      {{functionUnderTest}}({{input}}, (error, result) => {
        // Assert
        try {
          expect(error).to.be.null;
          expect(result).to.equal({{expectedValue}});
          done();
        } catch (assertionError) {
          done(assertionError);
        }
      });
    });

    it('should stub with throws', function() {
      // Arrange: Stub that throws error
      const {{error}} = new Error('{{Stubbed error}}');
      {{sandbox}}.stub({{DependencyModule}}, '{{methodName}}')
        .throws({{error}});

      // Act & Assert
      expect(() => {{functionUnderTest}}({{input}}))
        .to.throw('{{Stubbed error}}');
    });
  });

  describe('verifying spy/stub call details', function() {
    it('should verify all call arguments', function() {
      // Arrange
      const {{spy}} = {{sandbox}}.spy({{DependencyModule}}, '{{methodName}}');

      // Act
      {{functionUnderTest}}({{arg1}}, {{arg2}}, {{arg3}});

      // Assert: Various assertion styles
      expect({{spy}}.calledOnce).to.be.true;
      expect({{spy}}.calledWith({{arg1}}, {{arg2}}, {{arg3}})).to.be.true;
      expect({{spy}}.calledWithExactly({{arg1}}, {{arg2}}, {{arg3}})).to.be.true;
      expect({{spy}}.calledWithMatch({ {{property}}: {{value}} })).to.be.true;

      // Access call details
      const {{call}} = {{spy}}.getCall(0);
      expect({{call}}.args).to.deep.equal([{{arg1}}, {{arg2}}, {{arg3}}]);
      expect({{call}}.returnValue).to.equal({{expectedReturn}});
      expect({{call}}.thisValue).to.equal({{expectedThis}});
    });
  });
});
```

## Adaptation Rules

- [ ] Replace `{{ModuleName}}` with module being tested
- [ ] Replace `{{functionUnderTest}}` with actual function name
- [ ] Replace `{{DependencyModule}}` with actual dependency to mock
- [ ] Update `{{./path/to/module}}` paths
- [ ] Choose appropriate mocking strategy (stub, spy, or mock)
- [ ] Remove unused sections (fake timers if not testing time-dependent code)
- [ ] Always use sandbox for automatic cleanup
- [ ] Verify stubs/spies are called with correct arguments
- [ ] Test both success and error scenarios with mocks
- [ ] Don't over-mock - keep tests meaningful

## Sinon API Reference

```javascript
// Sandbox (recommended approach)
const sandbox = sinon.createSandbox();
sandbox.restore();  // Restores all stubs/spies/mocks

// Stubs (replace function with test double)
const stub = sandbox.stub({{object}}, '{{method}}');
stub.returns({{value}});
stub.resolves({{value}});      // For promises
stub.rejects({{error}});        // For promise rejection
stub.throws({{error}});         // Synchronous throw
stub.callsFake({{fn}});         // Custom implementation
stub.onFirstCall().returns({{value}});
stub.withArgs({{arg}}).returns({{value}});

// Spies (observe function calls)
const spy = sandbox.spy({{object}}, '{{method}}');
spy.calledOnce;
spy.calledWith({{arg}});
spy.calledWithExactly({{args}});
spy.callCount;
spy.getCall({{n}}).args;

// Mocks (stubs with expectations)
const mock = sandbox.mock({{object}});
mock.expects('{{method}}').once().withArgs({{arg}}).returns({{value}});
mock.verify();  // Throws if expectations not met

// Fake Timers
const clock = sandbox.useFakeTimers();
clock.tick({{milliseconds}});
clock.restore();
```

## .mocharc.json Configuration

```json
{
  "require": ["{{./test/setup.js}}"],
  "spec": ["{{test/**/*.spec.js}}"],
  "timeout": {{3000}},
  "ui": "bdd",
  "reporter": "spec",
  "color": true
}
```

## Related

- Template: @templates/mocha/basic-unit.spec.js (for unit tests without mocking)
- Template: @templates/mocha/integration.spec.js (for integration tests)
- Template: @templates/mocha/async.spec.js (for async operations)

## Example: User Service with Database Mock

```javascript
const { expect } = require('chai');
const sinon = require('sinon');
const UserService = require('../src/services/UserService');
const Database = require('../src/db/Database');

describe('UserService - With Mocking', function() {
  let sandbox;

  beforeEach(function() {
    sandbox = sinon.createSandbox();
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('createUser', function() {
    it('should create user in database', async function() {
      // Arrange
      const userData = { name: 'John', email: 'john@example.com' };
      const dbReturn = { id: 1, ...userData };
      const dbStub = sandbox.stub(Database, 'insert').resolves(dbReturn);

      // Act
      const result = await UserService.createUser(userData);

      // Assert
      expect(result).to.deep.equal(dbReturn);
      expect(dbStub.calledOnce).to.be.true;
      expect(dbStub.calledWith('users', userData)).to.be.true;
    });

    it('should handle database error', async function() {
      // Arrange
      const error = new Error('Database connection failed');
      sandbox.stub(Database, 'insert').rejects(error);

      // Act & Assert
      try {
        await UserService.createUser({ name: 'John' });
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect(err.message).to.include('Database connection failed');
      }
    });
  });

  describe('getUserById', function() {
    it('should fetch user from database', async function() {
      // Arrange
      const userId = 123;
      const dbReturn = { id: userId, name: 'John' };
      const dbStub = sandbox.stub(Database, 'findById').resolves(dbReturn);

      // Act
      const result = await UserService.getUserById(userId);

      // Assert
      expect(result).to.deep.equal(dbReturn);
      expect(dbStub.calledWith('users', userId)).to.be.true;
    });

    it('should return null for non-existent user', async function() {
      // Arrange
      sandbox.stub(Database, 'findById').resolves(null);

      // Act
      const result = await UserService.getUserById(999);

      // Assert
      expect(result).to.be.null;
    });
  });

  describe('with spy on logger', function() {
    it('should log user creation', async function() {
      // Arrange
      const logSpy = sandbox.spy(console, 'log');
      sandbox.stub(Database, 'insert').resolves({ id: 1, name: 'John' });

      // Act
      await UserService.createUser({ name: 'John' });

      // Assert
      expect(logSpy.calledWith(sinon.match(/User created/))).to.be.true;
    });
  });
});
```
