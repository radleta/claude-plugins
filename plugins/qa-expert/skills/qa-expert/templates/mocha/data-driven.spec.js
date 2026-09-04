# Template: Data-Driven Testing with Mocha

**When to Use**: Testing the same logic with multiple input/output combinations, parameterized tests, testing boundary values, validation rules with many cases, or any scenario where test logic is identical but data varies.

**Complexity**: Low

**Common Mistakes Agents Make**:
- Creating test data structures that are too complex and hard to maintain
- Not using descriptive test names that include the data being tested
- Hard-coding test data instead of using programmatic generation
- Not testing enough edge cases in the data set
- Creating data-driven tests where logic should actually be different (forcing the pattern)
- Not organizing test data clearly (mixing setup with data)
- Forgetting to test the "why" behind failures in data-driven tests
- Making test data dependent on previous test results
- Not validating test data itself (garbage in, garbage out)
- Using data-driven tests when a single parameterized test would be clearer

## Template

```javascript
/**
 * Data-driven test suite for {{ModuleName}}
 *
 * Purpose: {{Brief description of functionality being tested}}
 *
 * Test Strategy:
 * - Test same logic with multiple data combinations
 * - Cover edge cases through comprehensive data sets
 * - Validate boundary conditions systematically
 *
 * Test Coverage:
 * - {{Feature 1}} with {{N}} data combinations
 * - {{Feature 2}} edge cases
 * - Validation rules with various inputs
 */

const { expect } = require('chai');
const { {{functionUnderTest}}, {{validationFunction}} } = require('{{./path/to/module}}');

describe('{{ModuleName}} - Data-Driven Tests', function() {

  describe('{{functionUnderTest}} - basic data-driven', function() {
    // Define test cases as array of objects
    const {{testCases}} = [
      {
        description: '{{test scenario 1}}',
        input: {{value1}},
        expected: {{expectedValue1}}
      },
      {
        description: '{{test scenario 2}}',
        input: {{value2}},
        expected: {{expectedValue2}}
      },
      {
        description: '{{test scenario 3}}',
        input: {{value3}},
        expected: {{expectedValue3}}
      },
      {
        description: '{{edge case - empty}}',
        input: {{emptyValue}},
        expected: {{expectedEmpty}}
      },
      {
        description: '{{edge case - null}}',
        input: null,
        expected: {{expectedNull}}
      },
      {
        description: '{{edge case - undefined}}',
        input: undefined,
        expected: {{expectedUndefined}}
      }
    ];

    // Generate test for each case
    {{testCases}}.forEach(({ description, input, expected }) => {
      it(`should ${description}`, function() {
        // Arrange
        const {{inputValue}} = input;

        // Act
        const {{result}} = {{functionUnderTest}}({{inputValue}});

        // Assert
        expect({{result}}).to.deep.equal(expected);
      });
    });
  });

  describe('{{functionUnderTest}} - with multiple parameters', function() {
    const {{multiParamCases}} = [
      {
        description: '{{scenario 1}}',
        inputs: {
          {{param1}}: {{value1}},
          {{param2}}: {{value2}},
          {{param3}}: {{value3}}
        },
        expected: {{expectedValue1}}
      },
      {
        description: '{{scenario 2}}',
        inputs: {
          {{param1}}: {{value4}},
          {{param2}}: {{value5}},
          {{param3}}: {{value6}}
        },
        expected: {{expectedValue2}}
      },
      {
        description: '{{boundary case}}',
        inputs: {
          {{param1}}: {{boundaryValue1}},
          {{param2}}: {{boundaryValue2}},
          {{param3}}: {{boundaryValue3}}
        },
        expected: {{expectedBoundary}}
      }
    ];

    {{multiParamCases}}.forEach(({ description, inputs, expected }) => {
      it(`should ${description}`, function() {
        // Arrange
        const { {{param1}}, {{param2}}, {{param3}} } = inputs;

        // Act
        const {{result}} = {{functionUnderTest}}({{param1}}, {{param2}}, {{param3}});

        // Assert
        expect({{result}}).to.equal(expected);
      });
    });
  });

  describe('{{validationFunction}} - validation rules', function() {
    // Test data for validation scenarios
    const {{validationCases}} = [
      {
        description: 'accept valid {{dataType}}',
        input: {{validInput}},
        shouldPass: true,
        expectedError: null
      },
      {
        description: 'reject {{invalid scenario 1}}',
        input: {{invalidInput1}},
        shouldPass: false,
        expectedError: '{{error message 1}}'
      },
      {
        description: 'reject {{invalid scenario 2}}',
        input: {{invalidInput2}},
        shouldPass: false,
        expectedError: '{{error message 2}}'
      },
      {
        description: 'reject empty value',
        input: '',
        shouldPass: false,
        expectedError: '{{required field error}}'
      }
    ];

    {{validationCases}}.forEach(({ description, input, shouldPass, expectedError }) => {
      it(`should ${description}`, function() {
        if (shouldPass) {
          // Arrange & Act
          const {{result}} = {{validationFunction}}(input);

          // Assert
          expect({{result}}.valid).to.be.true;
          expect({{result}}.error).to.be.undefined;
        } else {
          // Arrange & Act
          const {{result}} = {{validationFunction}}(input);

          // Assert
          expect({{result}}.valid).to.be.false;
          expect({{result}}.error).to.include(expectedError);
        }
      });
    });
  });

  describe('{{functionUnderTest}} - boundary value testing', function() {
    // Test boundary values systematically
    const {{boundaries}} = [
      { description: 'minimum valid value', input: {{minValue}}, expected: {{minExpected}} },
      { description: 'just below minimum', input: {{minValue}} - 1, expected: {{belowMinExpected}} },
      { description: 'maximum valid value', input: {{maxValue}}, expected: {{maxExpected}} },
      { description: 'just above maximum', input: {{maxValue}} + 1, expected: {{aboveMaxExpected}} },
      { description: 'zero', input: 0, expected: {{zeroExpected}} },
      { description: 'negative', input: -1, expected: {{negativeExpected}} }
    ];

    {{boundaries}}.forEach(({ description, input, expected }) => {
      it(`should handle ${description}`, function() {
        // Act
        const {{result}} = {{functionUnderTest}}(input);

        // Assert
        expect({{result}}).to.equal(expected);
      });
    });
  });

  describe('{{functionUnderTest}} - with nested describe blocks', function() {
    // Group related test data
    const {{categories}} = {
      '{{category1}}': [
        { input: {{value1}}, expected: {{result1}} },
        { input: {{value2}}, expected: {{result2}} }
      ],
      '{{category2}}': [
        { input: {{value3}}, expected: {{result3}} },
        { input: {{value4}}, expected: {{result4}} }
      ],
      '{{edgeCases}}': [
        { input: null, expected: {{nullResult}} },
        { input: undefined, expected: {{undefinedResult}} },
        { input: {{extremeValue}}, expected: {{extremeResult}} }
      ]
    };

    // Generate nested describe blocks
    Object.entries({{categories}}).forEach(([category, cases]) => {
      describe(`when testing ${category}`, function() {
        cases.forEach(({ input, expected }, index) => {
          it(`should handle case ${index + 1}: ${JSON.stringify(input)}`, function() {
            // Arrange & Act
            const {{result}} = {{functionUnderTest}}(input);

            // Assert
            expect({{result}}).to.deep.equal(expected);
          });
        });
      });
    });
  });

  describe('{{functionUnderTest}} - table-driven format', function() {
    // Table-like data structure for clarity
    const {{testTable}} = `
      Input           | Expected Output | Description
      --------------- | --------------- | ---------------------------
      {{value1}}      | {{result1}}     | {{description1}}
      {{value2}}      | {{result2}}     | {{description2}}
      {{value3}}      | {{result3}}     | {{description3}}
      {{emptyValue}}  | {{emptyResult}} | {{emptyDescription}}
    `.trim().split('\n').slice(2); // Skip header and separator

    {{testTable}}.forEach(row => {
      const [input, expected, description] = row.split('|').map(s => s.trim());

      it(`should ${description}`, function() {
        // Arrange: Parse input and expected from table
        const {{parsedInput}} = {{parseValue}}(input);
        const {{parsedExpected}} = {{parseValue}}(expected);

        // Act
        const {{result}} = {{functionUnderTest}}({{parsedInput}});

        // Assert
        expect({{result}}).to.equal({{parsedExpected}});
      });
    });
  });

  describe('{{functionUnderTest}} - with async operations', function() {
    const {{asyncCases}} = [
      {
        description: '{{async scenario 1}}',
        input: {{asyncInput1}},
        expected: {{asyncExpected1}}
      },
      {
        description: '{{async scenario 2}}',
        input: {{asyncInput2}},
        expected: {{asyncExpected2}}
      },
      {
        description: '{{async error scenario}}',
        input: {{invalidAsyncInput}},
        shouldReject: true,
        expectedError: '{{expected error message}}'
      }
    ];

    {{asyncCases}}.forEach(({ description, input, expected, shouldReject, expectedError }) => {
      it(`should ${description}`, async function() {
        if (shouldReject) {
          // Act & Assert: Expect rejection
          try {
            await {{functionUnderTest}}(input);
            expect.fail('Expected function to reject');
          } catch (error) {
            expect(error.message).to.include(expectedError);
          }
        } else {
          // Arrange & Act
          const {{result}} = await {{functionUnderTest}}(input);

          // Assert
          expect({{result}}).to.deep.equal(expected);
        }
      });
    });
  });

  describe('{{functionUnderTest}} - programmatically generated data', function() {
    // Generate test data programmatically
    const {{generatedCases}} = Array.from({ length: {{count}} }, (_, i) => ({
      description: `case ${i + 1}`,
      input: {{generateInput}}(i),
      expected: {{calculateExpected}}(i)
    }));

    {{generatedCases}}.forEach(({ description, input, expected }) => {
      it(`should handle ${description}`, function() {
        // Act
        const {{result}} = {{functionUnderTest}}(input);

        // Assert
        expect({{result}}).to.equal(expected);
      });
    });
  });

  describe('{{functionUnderTest}} - error cases', function() {
    const {{errorCases}} = [
      {
        description: 'throw for {{error scenario 1}}',
        input: {{errorInput1}},
        expectedErrorType: {{ErrorType1}},
        expectedMessage: '{{error message 1}}'
      },
      {
        description: 'throw for {{error scenario 2}}',
        input: {{errorInput2}},
        expectedErrorType: {{ErrorType2}},
        expectedMessage: '{{error message 2}}'
      },
      {
        description: 'throw for null input',
        input: null,
        expectedErrorType: TypeError,
        expectedMessage: '{{null error message}}'
      }
    ];

    {{errorCases}}.forEach(({ description, input, expectedErrorType, expectedMessage }) => {
      it(`should ${description}`, function() {
        // Act & Assert
        expect(() => {{functionUnderTest}}(input))
          .to.throw(expectedErrorType, expectedMessage);
      });
    });
  });

  describe('{{functionUnderTest}} - complex object transformations', function() {
    const {{transformCases}} = [
      {
        description: 'transform {{object type 1}}',
        input: {
          {{inputProp1}}: {{inputValue1}},
          {{inputProp2}}: {{inputValue2}}
        },
        expected: {
          {{outputProp1}}: {{outputValue1}},
          {{outputProp2}}: {{outputValue2}}
        }
      },
      {
        description: 'transform {{object type 2}}',
        input: {
          {{inputProp3}}: {{inputValue3}},
          {{inputProp4}}: {{inputValue4}}
        },
        expected: {
          {{outputProp3}}: {{outputValue3}},
          {{outputProp4}}: {{outputValue4}}
        }
      },
      {
        description: 'handle nested objects',
        input: {
          {{nestedProp}}: {
            {{innerProp1}}: {{innerValue1}},
            {{innerProp2}}: {{innerValue2}}
          }
        },
        expected: {
          {{transformedNestedProp}}: {
            {{transformedInner1}}: {{transformedValue1}},
            {{transformedInner2}}: {{transformedValue2}}
          }
        }
      }
    ];

    {{transformCases}}.forEach(({ description, input, expected }) => {
      it(`should ${description}`, function() {
        // Act
        const {{result}} = {{functionUnderTest}}(input);

        // Assert
        expect({{result}}).to.deep.equal(expected);
      });
    });
  });
});

// Helper function for table-driven tests
function {{parseValue}}(value) {
  // Parse string representation to actual value
  if (value === 'null') return null;
  if (value === 'undefined') return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (!isNaN(value)) return Number(value);
  return value;
}

// Helper functions for programmatic generation
function {{generateInput}}(index) {
  return {{baseValue}} + index;
}

function {{calculateExpected}}(index) {
  return {{transform}}({{generateInput}}(index));
}
```

## Adaptation Rules

- [ ] Replace `{{ModuleName}}` with module being tested
- [ ] Replace `{{functionUnderTest}}` with actual function name
- [ ] Update `{{./path/to/module}}` with actual path
- [ ] Define comprehensive test data arrays
- [ ] Use descriptive test case descriptions
- [ ] Include edge cases in data sets (null, undefined, empty, boundaries)
- [ ] Group related test cases logically
- [ ] Remove unused patterns (table-driven if not needed)
- [ ] Consider performance if generating hundreds of tests
- [ ] Ensure test data is maintainable and readable

## Data-Driven Test Patterns

```javascript
// Pattern 1: Simple array iteration
const cases = [{ input: 1, expected: 2 }];
cases.forEach(({ input, expected }) => {
  it(`test ${input}`, () => {
    expect(fn(input)).to.equal(expected);
  });
});

// Pattern 2: Nested describe blocks
Object.entries(categories).forEach(([category, cases]) => {
  describe(category, () => {
    cases.forEach(testCase => {
      it(testCase.description, () => {
        expect(fn(testCase.input)).to.equal(testCase.expected);
      });
    });
  });
});

// Pattern 3: Programmatic generation
Array.from({ length: 10 }, (_, i) => ({
  input: i,
  expected: i * 2
})).forEach(({ input, expected }) => {
  it(`double ${input}`, () => {
    expect(double(input)).to.equal(expected);
  });
});
```

## .mocharc.json Configuration

```json
{
  "require": ["{{./test/setup.js}}"],
  "spec": ["{{test/**/*.spec.js}}"],
  "timeout": {{2000}},
  "ui": "bdd",
  "reporter": "spec",
  "color": true
}
```

## Related

- Template: @templates/mocha/basic-unit.spec.js (for standard unit tests)
- Template: @templates/mocha/integration.spec.js (for integration tests)
- Template: @templates/mocha/async.spec.js (for async operations)

## Example: Email Validation with Data-Driven Tests

```javascript
const { expect } = require('chai');
const { validateEmail } = require('../src/utils/validation');

describe('Email Validation - Data-Driven', function() {
  describe('valid emails', function() {
    const validEmails = [
      'test@example.com',
      'user.name@example.com',
      'user+tag@example.co.uk',
      'user_name@example-domain.com',
      '123@example.com',
      'test@subdomain.example.com'
    ];

    validEmails.forEach(email => {
      it(`should accept "${email}" as valid`, function() {
        const result = validateEmail(email);
        expect(result.valid).to.be.true;
        expect(result.error).to.be.undefined;
      });
    });
  });

  describe('invalid emails', function() {
    const invalidCases = [
      { email: '', error: 'Email is required' },
      { email: 'invalid', error: 'Invalid email format' },
      { email: '@example.com', error: 'Invalid email format' },
      { email: 'user@', error: 'Invalid email format' },
      { email: 'user @example.com', error: 'Email cannot contain spaces' },
      { email: 'user@.com', error: 'Invalid domain' }
    ];

    invalidCases.forEach(({ email, error }) => {
      it(`should reject "${email}" with error: ${error}`, function() {
        const result = validateEmail(email);
        expect(result.valid).to.be.false;
        expect(result.error).to.include(error);
      });
    });
  });

  describe('boundary cases', function() {
    const boundaryCases = [
      {
        description: 'maximum length email',
        email: 'a'.repeat(64) + '@' + 'b'.repeat(63) + '.com',
        shouldPass: true
      },
      {
        description: 'email exceeding maximum length',
        email: 'a'.repeat(65) + '@example.com',
        shouldPass: false
      }
    ];

    boundaryCases.forEach(({ description, email, shouldPass }) => {
      it(`should ${shouldPass ? 'accept' : 'reject'} ${description}`, function() {
        const result = validateEmail(email);
        expect(result.valid).to.equal(shouldPass);
      });
    });
  });
});
```
