# Template: Basic Unit Test with Mocha + Chai

**When to Use**: Testing pure functions, utility modules, business logic calculations, data transformations, validators, and any synchronous code without external dependencies.

**Complexity**: Low

**Common Mistakes Agents Make**:
- Not organizing tests into proper `describe` blocks for logical grouping
- Writing vague test names instead of descriptive "should..." statements
- Using `assert` instead of more expressive Chai `expect()` syntax
- Not testing edge cases (null, undefined, empty values, boundaries)
- Testing implementation details instead of behavior
- Not following the Arrange-Act-Assert (AAA) pattern
- Mixing unrelated tests in the same `describe` block
- Not using nested `describe` blocks for better organization
- Forgetting to test error conditions and validation logic
- Not isolating tests properly, causing interdependencies

## Template

```javascript
/**
 * Test suite for {{ModuleName}}
 *
 * Purpose: {{Brief description of what this module does}}
 *
 * Test Coverage:
 * - {{Feature area 1}}
 * - {{Feature area 2}}
 * - Edge cases and error handling
 */

const { expect } = require('chai');
const { {{functionName}}, {{anotherFunction}} } = require('{{./path/to/module}}');

describe('{{ModuleName}}', function() {
  // Optional: Set timeout for all tests in this suite
  // this.timeout({{2000}});

  describe('{{functionName}}', function() {
    // Test happy path scenarios
    describe('when {{condition/scenario}}', function() {
      it('should {{expected behavior}}', function() {
        // Arrange: Set up test data and dependencies
        const {{input}} = {{testValue}};
        const {{expected}} = {{expectedValue}};

        // Act: Execute the function under test
        const {{result}} = {{functionName}}({{input}});

        // Assert: Verify the result
        expect({{result}}).to.equal({{expected}});
      });

      it('should {{another expected behavior}}', function() {
        // Arrange
        const {{input}} = {{testValue}};

        // Act
        const {{result}} = {{functionName}}({{input}});

        // Assert: Chai provides many assertion styles
        expect({{result}}).to.be.a('{{type}}');
        expect({{result}}).to.have.property('{{propertyName}}');
        expect({{result}}.{{propertyName}}).to.equal({{expectedValue}});
      });
    });

    // Test edge cases
    describe('edge cases', function() {
      it('should handle null input', function() {
        // Arrange
        const {{input}} = null;

        // Act
        const {{result}} = {{functionName}}({{input}});

        // Assert
        expect({{result}}).to.be.null;
        // Or if it should return a default value:
        // expect({{result}}).to.deep.equal({{defaultValue}});
      });

      it('should handle undefined input', function() {
        // Arrange & Act
        const {{result}} = {{functionName}}(undefined);

        // Assert
        expect({{result}}).to.be.undefined;
      });

      it('should handle empty {{inputType}}', function() {
        // Arrange
        const {{input}} = {{emptyValue}};  // [], {}, '', etc.

        // Act
        const {{result}} = {{functionName}}({{input}});

        // Assert
        expect({{result}}).to.deep.equal({{expectedEmptyResult}});
      });

      it('should handle boundary values', function() {
        // Arrange
        const {{boundaryValue}} = {{value}};  // 0, -1, MAX_VALUE, etc.

        // Act
        const {{result}} = {{functionName}}({{boundaryValue}});

        // Assert
        expect({{result}}).to.equal({{expectedBoundaryResult}});
      });
    });

    // Test error conditions
    describe('error handling', function() {
      it('should throw error for invalid input type', function() {
        // Arrange
        const {{invalidInput}} = {{invalidValue}};

        // Act & Assert: Expect function to throw
        expect(() => {{functionName}}({{invalidInput}}))
          .to.throw({{ErrorType}}, '{{expected error message}}');
      });

      it('should throw error when {{validation condition fails}}', function() {
        // Arrange
        const {{input}} = {{invalidValue}};

        // Act & Assert: Alternative assertion syntax
        const {{testFn}} = () => {{functionName}}({{input}});
        expect({{testFn}}).to.throw();
      });
    });
  });

  describe('{{anotherFunction}}', function() {
    describe('when {{condition}}', function() {
      it('should {{expected behavior}}', function() {
        // Arrange
        const {{param1}} = {{value1}};
        const {{param2}} = {{value2}};
        const {{expected}} = {{expectedValue}};

        // Act
        const {{result}} = {{anotherFunction}}({{param1}}, {{param2}});

        // Assert: Testing arrays
        expect({{result}}).to.be.an('array');
        expect({{result}}).to.have.lengthOf({{expectedLength}});
        expect({{result}}).to.include({{expectedElement}});
      });

      it('should {{behavior with complex objects}}', function() {
        // Arrange
        const {{input}} = {
          {{property1}}: {{value1}},
          {{property2}}: {{value2}}
        };
        const {{expected}} = {
          {{property1}}: {{transformedValue1}},
          {{property2}}: {{transformedValue2}}
        };

        // Act
        const {{result}} = {{anotherFunction}}({{input}});

        // Assert: Deep equality for objects/arrays
        expect({{result}}).to.deep.equal({{expected}});
      });
    });

    describe('return value validation', function() {
      it('should return object with correct structure', function() {
        // Arrange
        const {{input}} = {{testValue}};

        // Act
        const {{result}} = {{anotherFunction}}({{input}});

        // Assert: Check object structure
        expect({{result}}).to.be.an('object');
        expect({{result}}).to.have.all.keys('{{key1}}', '{{key2}}', '{{key3}}');
        expect({{result}}.{{key1}}).to.be.a('{{type}}');
      });

      it('should return immutable result', function() {
        // Arrange
        const {{originalInput}} = { {{property}}: {{value}} };
        const {{inputCopy}} = { ...{{originalInput}} };

        // Act
        const {{result}} = {{anotherFunction}}({{originalInput}});

        // Assert: Original input should not be modified
        expect({{originalInput}}).to.deep.equal({{inputCopy}});
        expect({{result}}).to.not.equal({{originalInput}});  // Different reference
      });
    });
  });

  // Test multiple functions together if they interact
  describe('integration between functions', function() {
    it('should work together for {{use case}}', function() {
      // Arrange
      const {{input}} = {{testValue}};

      // Act: Chain functions
      const {{intermediate}} = {{functionName}}({{input}});
      const {{result}} = {{anotherFunction}}({{intermediate}});

      // Assert
      expect({{result}}).to.equal({{expectedFinalValue}});
    });
  });
});
```

## Adaptation Rules

- [ ] Replace `{{ModuleName}}` with the module/class name being tested (PascalCase)
- [ ] Replace `{{functionName}}`, `{{anotherFunction}}` with actual function names
- [ ] Replace `{{./path/to/module}}` with actual module path
- [ ] Update test scenarios to match actual function behavior
- [ ] Add more `describe` blocks for complex modules
- [ ] Include all edge cases relevant to your functions
- [ ] Remove unused sections (error handling if no errors expected)
- [ ] Ensure test names clearly describe expected behavior
- [ ] Use appropriate Chai assertions for data types
- [ ] Add more test cases for complete coverage

## Common Chai Assertions Reference

```javascript
// Equality
expect({{value}}).to.equal({{primitive}});           // Strict equality (===)
expect({{value}}).to.deep.equal({{object}});         // Deep equality for objects/arrays

// Type checking
expect({{value}}).to.be.a('string');                 // Type assertion
expect({{value}}).to.be.an('array');
expect({{value}}).to.be.instanceof({{Class}});

// Truthiness
expect({{value}}).to.be.true;                        // Exactly true
expect({{value}}).to.be.false;                       // Exactly false
expect({{value}}).to.be.null;
expect({{value}}).to.be.undefined;
expect({{value}}).to.exist;                          // Not null/undefined
expect({{value}}).to.be.ok;                          // Truthy

// Numbers
expect({{value}}).to.be.above({{number}});           // Greater than
expect({{value}}).to.be.below({{number}});           // Less than
expect({{value}}).to.be.within({{min}}, {{max}});    // Range

// Strings
expect({{string}}).to.include('{{substring}}');      // Contains substring
expect({{string}}).to.match(/{{regex}}/);            // Regex match

// Arrays
expect({{array}}).to.have.lengthOf({{number}});
expect({{array}}).to.include({{element}});
expect({{array}}).to.have.members([{{elements}}]);   // Same members, any order
expect({{array}}).to.deep.include({{object}});       // Array contains object

// Objects
expect({{object}}).to.have.property('{{key}}');
expect({{object}}).to.have.all.keys('{{key1}}', '{{key2}}');
expect({{object}}).to.have.any.keys('{{key1}}', '{{key2}}');
expect({{object}}).to.deep.include({ {{key}}: {{value}} });

// Functions/Errors
expect({{fn}}).to.throw();
expect({{fn}}).to.throw({{ErrorType}});
expect({{fn}}).to.throw({{ErrorType}}, '{{message}}');
```

## .mocharc.json Configuration

```json
{
  "require": ["{{./test/setup.js}}"],
  "spec": ["{{test/**/*.spec.js}}"],
  "timeout": {{2000}},
  "ui": "bdd",
  "reporter": "spec",
  "color": true,
  "bail": false,
  "recursive": true
}
```

## Related

- Template: @templates/mocha/integration.spec.js (for API/database tests)
- Template: @templates/mocha/async.spec.js (for async function tests)
- Template: @templates/mocha/mock.spec.js (for tests with dependencies)

## Example: Math Utility Tests

```javascript
/**
 * Test suite for MathUtils
 *
 * Purpose: Utility functions for mathematical operations
 *
 * Test Coverage:
 * - Addition and subtraction
 * - Multiplication and division
 * - Edge cases (zero, negative numbers, floats)
 * - Error handling (division by zero, invalid inputs)
 */

const { expect } = require('chai');
const { add, divide, calculateAverage } = require('../src/utils/math');

describe('MathUtils', function() {
  describe('add', function() {
    describe('when adding positive numbers', function() {
      it('should return sum of two numbers', function() {
        // Arrange
        const a = 5;
        const b = 3;
        const expected = 8;

        // Act
        const result = add(a, b);

        // Assert
        expect(result).to.equal(expected);
      });

      it('should handle floating point numbers', function() {
        // Arrange
        const a = 0.1;
        const b = 0.2;

        // Act
        const result = add(a, b);

        // Assert
        expect(result).to.be.closeTo(0.3, 0.0001);
      });
    });

    describe('edge cases', function() {
      it('should handle zero values', function() {
        expect(add(0, 5)).to.equal(5);
        expect(add(5, 0)).to.equal(5);
        expect(add(0, 0)).to.equal(0);
      });

      it('should handle negative numbers', function() {
        expect(add(-5, 3)).to.equal(-2);
        expect(add(-5, -3)).to.equal(-8);
      });
    });
  });

  describe('divide', function() {
    it('should divide two numbers', function() {
      // Arrange
      const dividend = 10;
      const divisor = 2;

      // Act
      const result = divide(dividend, divisor);

      // Assert
      expect(result).to.equal(5);
    });

    describe('error handling', function() {
      it('should throw error when dividing by zero', function() {
        // Act & Assert
        expect(() => divide(10, 0))
          .to.throw(Error, 'Cannot divide by zero');
      });

      it('should throw error for non-numeric inputs', function() {
        expect(() => divide('10', 2)).to.throw();
        expect(() => divide(10, '2')).to.throw();
      });
    });
  });

  describe('calculateAverage', function() {
    it('should calculate average of array of numbers', function() {
      // Arrange
      const numbers = [10, 20, 30, 40, 50];
      const expected = 30;

      // Act
      const result = calculateAverage(numbers);

      // Assert
      expect(result).to.equal(expected);
    });

    describe('edge cases', function() {
      it('should handle single number', function() {
        const result = calculateAverage([42]);
        expect(result).to.equal(42);
      });

      it('should return 0 for empty array', function() {
        const result = calculateAverage([]);
        expect(result).to.equal(0);
      });

      it('should handle negative numbers', function() {
        const result = calculateAverage([-10, -20, -30]);
        expect(result).to.equal(-20);
      });
    });
  });
});
```
