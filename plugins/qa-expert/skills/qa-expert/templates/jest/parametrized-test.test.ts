# Template: Parametrized Test

**When to Use**: Testing the same logic with multiple different inputs (data-driven testing), testing boundary values, exhaustively testing input combinations, testing across different configurations, or when you have similar test cases with only data variations.

**Complexity**: Low

**Common Mistakes Agents Make**:
- Not using descriptive test names with the parameter values shown
- Grouping unrelated test cases in the same parametrized test
- Testing too many parameters at once (making failures hard to debug)
- Not using the right test.each() format (table vs array)
- Forgetting to use printf tokens (%s, %i, %p) in test names
- Creating parametrized tests when edge cases have different logic
- Not organizing parameters clearly (poor table structure)
- Using parametrized tests for tests that should be separate (hiding important cases)
- Not testing error cases separately with clear names
- Mixing happy path and error cases in the same parametrized test

## Template

```typescript
import { {{functionName}} } from './{{modulePath}}';

/**
 * Parametrized tests for {{functionName}}
 *
 * Tests the same logic with multiple input variations
 * using Jest's test.each() for data-driven testing.
 */
describe('{{functionName}} - Parametrized Tests', () => {
  /**
   * Table syntax - Best for readability with many parameters
   */
  describe('table syntax with test.each', () => {
    test.each`
      {{param1}}     | {{param2}}     | {{expected}}     | {{description}}
      ${{{value1}}}  | ${{{value2}}}  | ${{{result1}}}  | ${'{{case1Description}}'}
      ${{{value3}}}  | ${{{value4}}}  | ${{{result2}}}  | ${'{{case2Description}}'}
      ${{{value5}}}  | ${{{value6}}}  | ${{{result3}}}  | ${'{{case3Description}}'}
      ${{{value7}}}  | ${{{value8}}}  | ${{{result4}}}  | ${'{{case4Description}}'}
    `('should return $expected when {{param1}} is ${{param1}} and {{param2}} is ${{param2}}',
      ({ {{param1}}, {{param2}}, {{expected}}, {{description}} }) => {
        // Arrange
        // (parameters are already arranged via test.each)

        // Act
        const result = {{functionName}}({{param1}}, {{param2}});

        // Assert
        expect(result).toBe({{expected}});
      }
    );
  });

  /**
   * Array syntax - Best for simple cases with few parameters
   */
  describe('array syntax with test.each', () => {
    test.each([
      [{{input1}}, {{expected1}}],
      [{{input2}}, {{expected2}}],
      [{{input3}}, {{expected3}}],
      [{{input4}}, {{expected4}}],
      [{{input5}}, {{expected5}}],
    ])('should return %p when input is %p', (input, expected) => {
      // Act
      const result = {{functionName}}(input);

      // Assert
      expect(result).toBe(expected);
    });
  });

  /**
   * Object array syntax - Best for named parameters
   */
  describe('object array syntax', () => {
    test.each([
      { {{param}}: {{value1}}, {{expected}}: {{result1}}, {{description}}: '{{case1}}' },
      { {{param}}: {{value2}}, {{expected}}: {{result2}}, {{description}}: '{{case2}}' },
      { {{param}}: {{value3}}, {{expected}}: {{result3}}, {{description}}: '{{case3}}' },
    ])('${{description}}: should return ${{expected}} for input ${{param}}',
      ({ {{param}}, {{expected}} }) => {
        // Act
        const result = {{functionName}}({{param}});

        // Assert
        expect(result).toBe({{expected}});
      }
    );
  });

  /**
   * Mathematical operations - Common use case
   */
  describe('mathematical operations', () => {
    test.each`
      a      | b      | operation | expected
      ${1}   | ${2}   | ${'add'}  | ${3}
      ${5}   | ${3}   | ${'sub'}  | ${2}
      ${4}   | ${3}   | ${'mul'}  | ${12}
      ${10}  | ${2}   | ${'div'}  | ${5}
      ${10}  | ${3}   | ${'mod'}  | ${1}
    `('should $operation $a and $b to get $expected', ({ a, b, operation, expected }) => {
      // Act
      let result;
      switch (operation) {
        case 'add': result = {{add}}(a, b); break;
        case 'sub': result = {{subtract}}(a, b); break;
        case 'mul': result = {{multiply}}(a, b); break;
        case 'div': result = {{divide}}(a, b); break;
        case 'mod': result = {{modulo}}(a, b); break;
      }

      // Assert
      expect(result).toBe(expected);
    });
  });

  /**
   * Boundary value testing
   */
  describe('boundary values', () => {
    test.each`
      value                       | expected        | description
      ${0}                        | ${{{result}}}   | ${'zero'}
      ${-1}                       | ${{{result}}}   | ${'negative one'}
      ${1}                        | ${{{result}}}   | ${'positive one'}
      ${Number.MAX_SAFE_INTEGER}  | ${{{result}}}   | ${'max safe integer'}
      ${Number.MIN_SAFE_INTEGER}  | ${{{result}}}   | ${'min safe integer'}
      ${Infinity}                 | ${{{result}}}   | ${'infinity'}
      ${-Infinity}                | ${{{result}}}   | ${'negative infinity'}
    `('should handle $description ($value)', ({ value, expected }) => {
      // Act
      const result = {{functionName}}(value);

      // Assert
      expect(result).toBe(expected);
    });
  });

  /**
   * String validation testing
   */
  describe('string validation', () => {
    test.each`
      input                       | valid    | description
      ${'valid@email.com'}        | ${true}  | ${'valid email'}
      ${'invalid.email'}          | ${false} | ${'missing @ symbol'}
      ${'@nodomain.com'}          | ${false} | ${'missing local part'}
      ${'user@'}                  | ${false} | ${'missing domain'}
      ${'user@domain'}            | ${false} | ${'missing TLD'}
      ${'user@domain.co.uk'}      | ${true}  | ${'multiple TLD'}
      ${'user+tag@domain.com'}    | ${true}  | ${'plus addressing'}
      ${''}                       | ${false} | ${'empty string'}
    `('$description: "$input" should be $valid', ({ input, valid }) => {
      // Act
      const result = {{validateEmail}}(input);

      // Assert
      expect(result).toBe(valid);
    });
  });

  /**
   * Date and time testing
   */
  describe('date formatting', () => {
    test.each`
      date                          | format        | expected
      ${new Date('2024-01-01')}     | ${'YYYY-MM-DD'} | ${'2024-01-01'}
      ${new Date('2024-01-01')}     | ${'MM/DD/YYYY'} | ${'01/01/2024'}
      ${new Date('2024-12-25')}     | ${'DD-MM-YYYY'} | ${'25-12-2024'}
      ${new Date('2024-06-15')}     | ${'YYYY/MM/DD'} | ${'2024/06/15'}
    `('should format $date as "$expected" using format "$format"',
      ({ date, format, expected }) => {
        // Act
        const result = {{formatDate}}(date, format);

        // Assert
        expect(result).toBe(expected);
      }
    );
  });

  /**
   * Array operations testing
   */
  describe('array operations', () => {
    test.each`
      array                  | operation    | expected
      ${[1, 2, 3, 4]}       | ${'sum'}     | ${10}
      ${[1, 2, 3, 4]}       | ${'avg'}     | ${2.5}
      ${[1, 2, 3, 4]}       | ${'min'}     | ${1}
      ${[1, 2, 3, 4]}       | ${'max'}     | ${4}
      ${[]}                 | ${'sum'}     | ${0}
      ${[5]}                | ${'sum'}     | ${5}
      ${[-1, -2, -3]}       | ${'sum'}     | ${-6}
    `('should calculate $operation of $array as $expected',
      ({ array, operation, expected }) => {
        // Act
        let result;
        switch (operation) {
          case 'sum': result = {{arraySum}}(array); break;
          case 'avg': result = {{arrayAvg}}(array); break;
          case 'min': result = {{arrayMin}}(array); break;
          case 'max': result = {{arrayMax}}(array); break;
        }

        // Assert
        expect(result).toBe(expected);
      }
    );
  });

  /**
   * Permissions and roles testing
   */
  describe('access control', () => {
    test.each`
      role          | resource       | action     | allowed
      ${'admin'}    | ${'users'}     | ${'read'}  | ${true}
      ${'admin'}    | ${'users'}     | ${'write'} | ${true}
      ${'admin'}    | ${'users'}     | ${'delete'}| ${true}
      ${'editor'}   | ${'posts'}     | ${'read'}  | ${true}
      ${'editor'}   | ${'posts'}     | ${'write'} | ${true}
      ${'editor'}   | ${'posts'}     | ${'delete'}| ${false}
      ${'viewer'}   | ${'posts'}     | ${'read'}  | ${true}
      ${'viewer'}   | ${'posts'}     | ${'write'} | ${false}
      ${'viewer'}   | ${'posts'}     | ${'delete'}| ${false}
      ${'guest'}    | ${'posts'}     | ${'read'}  | ${false}
    `('$role should ${allowed ? "" : "not "}be allowed to $action $resource',
      ({ role, resource, action, allowed }) => {
        // Act
        const result = {{checkPermission}}(role, resource, action);

        // Assert
        expect(result).toBe(allowed);
      }
    );
  });

  /**
   * HTTP status code testing
   */
  describe('HTTP status handling', () => {
    test.each([
      [200, 'OK', true],
      [201, 'Created', true],
      [204, 'No Content', true],
      [400, 'Bad Request', false],
      [401, 'Unauthorized', false],
      [403, 'Forbidden', false],
      [404, 'Not Found', false],
      [500, 'Internal Server Error', false],
      [502, 'Bad Gateway', false],
      [503, 'Service Unavailable', false],
    ])('should handle status %i (%s) as %s', (statusCode, statusText, isSuccess) => {
      // Act
      const result = {{isSuccessStatus}}(statusCode);

      // Assert
      expect(result).toBe(isSuccess);
    });
  });

  /**
   * Type conversion testing
   */
  describe('type conversions', () => {
    test.each`
      input          | type         | expected     | description
      ${'123'}       | ${'number'}  | ${123}       | ${'string to number'}
      ${'true'}      | ${'boolean'} | ${true}      | ${'string to boolean'}
      ${123}         | ${'string'}  | ${'123'}     | ${'number to string'}
      ${true}        | ${'string'}  | ${'true'}    | ${'boolean to string'}
      ${''}          | ${'number'}  | ${0}         | ${'empty string to number'}
      ${'invalid'}   | ${'number'}  | ${NaN}       | ${'invalid string to number'}
    `('$description: should convert $input to $expected',
      ({ input, type, expected }) => {
        // Act
        const result = {{convert}}(input, type);

        // Assert
        if (Number.isNaN(expected)) {
          expect(Number.isNaN(result)).toBe(true);
        } else {
          expect(result).toBe(expected);
        }
      }
    );
  });

  /**
   * Currency formatting testing
   */
  describe('currency formatting', () => {
    test.each`
      amount     | currency | locale      | expected
      ${100}     | ${'USD'} | ${'en-US'}  | ${'$100.00'}
      ${1000}    | ${'EUR'} | ${'de-DE'}  | ${'1.000,00 €'}
      ${50.5}    | ${'GBP'} | ${'en-GB'}  | ${'£50.50'}
      ${0}       | ${'USD'} | ${'en-US'}  | ${'$0.00'}
      ${-25}     | ${'USD'} | ${'en-US'}  | ${'-$25.00'}
    `('should format $amount $currency in $locale as "$expected"',
      ({ amount, currency, locale, expected }) => {
        // Act
        const result = {{formatCurrency}}(amount, currency, locale);

        // Assert
        expect(result).toBe(expected);
      }
    );
  });

  /**
   * Password strength testing
   */
  describe('password validation', () => {
    test.each`
      password              | strength   | description
      ${'abc'}              | ${'weak'}  | ${'too short'}
      ${'password'}         | ${'weak'}  | ${'common word'}
      ${'password123'}      | ${'weak'}  | ${'common with numbers'}
      ${'Password123'}      | ${'medium'}| ${'mixed case with numbers'}
      ${'P@ssw0rd123'}      | ${'strong'}| ${'mixed case, numbers, symbols'}
      ${'Tr0ng!P@ss'}       | ${'strong'}| ${'strong password'}
      ${''}                 | ${'weak'}  | ${'empty'}
    `('$description: "$password" should be $strength',
      ({ password, strength }) => {
        // Act
        const result = {{checkPasswordStrength}}(password);

        // Assert
        expect(result).toBe(strength);
      }
    );
  });

  /**
   * File size formatting
   */
  describe('file size formatting', () => {
    test.each([
      [0, '0 B'],
      [1, '1 B'],
      [1024, '1 KB'],
      [1536, '1.5 KB'],
      [1048576, '1 MB'],
      [1073741824, '1 GB'],
      [1099511627776, '1 TB'],
    ])('should format %i bytes as "%s"', (bytes, expected) => {
      // Act
      const result = {{formatFileSize}}(bytes);

      // Assert
      expect(result).toBe(expected);
    });
  });

  /**
   * URL validation testing
   */
  describe('URL validation', () => {
    test.each`
      url                                  | valid    | description
      ${'https://example.com'}             | ${true}  | ${'valid HTTPS URL'}
      ${'http://example.com'}              | ${true}  | ${'valid HTTP URL'}
      ${'https://example.com/path'}        | ${true}  | ${'with path'}
      ${'https://example.com?query=1'}     | ${true}  | ${'with query string'}
      ${'https://sub.example.com'}         | ${true}  | ${'with subdomain'}
      ${'example.com'}                     | ${false} | ${'missing protocol'}
      ${'https://'}                        | ${false} | ${'missing domain'}
      ${''}                                | ${false} | ${'empty string'}
      ${'not-a-url'}                       | ${false} | ${'invalid format'}
    `('$description: "$url" should be $valid', ({ url, valid }) => {
      // Act
      const result = {{isValidUrl}}(url);

      // Assert
      expect(result).toBe(valid);
    });
  });

  /**
   * Complex object transformation
   */
  describe('object transformations', () => {
    test.each([
      {
        input: { firstName: 'John', lastName: 'Doe' },
        expected: { fullName: 'John Doe' },
        description: 'combine first and last name',
      },
      {
        input: { price: 100, tax: 0.1 },
        expected: { total: 110 },
        description: 'calculate total with tax',
      },
      {
        input: { celsius: 0 },
        expected: { fahrenheit: 32 },
        description: 'convert celsius to fahrenheit',
      },
    ])('should $description', ({ input, expected }) => {
      // Act
      const result = {{transformObject}}(input);

      // Assert
      expect(result).toMatchObject(expected);
    });
  });
});
```

## Adaptation Rules

- [ ] Replace `{{functionName}}` with the actual function being tested
- [ ] Choose the right syntax: table for readability, array for simplicity, object for clarity
- [ ] Use descriptive test names with parameter placeholders (`$param`, `%p`, `%s`, `%i`)
- [ ] Group related test cases in the same parametrized test
- [ ] Keep parametrized tests focused on one behavior with varying data
- [ ] Test edge cases and boundary values systematically
- [ ] Use separate parametrized tests for different concerns (happy path vs errors)
- [ ] Make tables readable with clear column names and alignment
- [ ] Include a description column for complex test cases
- [ ] Don't mix unrelated test cases just to use parametrization

## Related

- Template: @templates/jest/basic-unit-test.test.ts (for non-parametrized tests)
- Template: @templates/jest/integration-test.test.ts (for API endpoint testing)
- Template: @templates/jest/async-test.test.ts (for async parametrized tests)

## Example: Calculator Parametrized Tests

```typescript
import { calculate } from './calculator';

describe('Calculator - Parametrized Tests', () => {
  describe('basic operations', () => {
    test.each`
      a      | b      | operation | expected
      ${2}   | ${3}   | ${'add'}  | ${5}
      ${5}   | ${2}   | ${'sub'}  | ${3}
      ${4}   | ${3}   | ${'mul'}  | ${12}
      ${10}  | ${2}   | ${'div'}  | ${5}
    `('should $operation $a and $b to get $expected', ({ a, b, operation, expected }) => {
      const result = calculate(a, b, operation);
      expect(result).toBe(expected);
    });
  });

  describe('edge cases', () => {
    test.each([
      [10, 0, 'div', Infinity],
      [0, 5, 'mul', 0],
      [-5, 3, 'add', -2],
      [100, 100, 'sub', 0],
    ])('should handle edge case: %i %s %i = %p', (a, b, operation, expected) => {
      const result = calculate(a, b, operation);
      expect(result).toBe(expected);
    });
  });
});
```

## Printf Tokens Reference

```typescript
// %s - String
test.each([['hello'], ['world']])('should handle %s', (str) => { });

// %i or %d - Integer
test.each([[1], [2], [3]])('should handle %i', (num) => { });

// %f - Float
test.each([[1.5], [2.7]])('should handle %f', (float) => { });

// %p - Pretty-print value
test.each([[{ a: 1 }], [[1, 2, 3]]])('should handle %p', (value) => { });

// %j - JSON.stringify
test.each([[{ a: 1 }]])('should handle %j', (obj) => { });

// %o - Object
test.each([[{ a: 1 }]])('should handle %o', (obj) => { });

// $variable - Template literal (table syntax)
test.each`
  value
  ${1}
  ${2}
`('should handle $value', ({ value }) => { });
```

## Syntax Comparison

```typescript
// ❌ Repetitive without parametrization
it('should add 1 + 2', () => expect(add(1, 2)).toBe(3));
it('should add 5 + 3', () => expect(add(5, 3)).toBe(8));
it('should add 10 + 20', () => expect(add(10, 20)).toBe(30));

// ✅ Clean with parametrization
test.each([
  [1, 2, 3],
  [5, 3, 8],
  [10, 20, 30],
])('should add %i + %i = %i', (a, b, expected) => {
  expect(add(a, b)).toBe(expected);
});

// ✅ Even cleaner with table syntax
test.each`
  a      | b     | expected
  ${1}   | ${2}  | ${3}
  ${5}   | ${3}  | ${8}
  ${10}  | ${20} | ${30}
`('should add $a + $b = $expected', ({ a, b, expected }) => {
  expect(add(a, b)).toBe(expected);
});
```
