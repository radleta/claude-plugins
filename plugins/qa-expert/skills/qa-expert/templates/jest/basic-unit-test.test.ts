# Template: Basic Unit Test

**When to Use**: Testing pure functions, business logic, utility functions, data transformations, calculations, and any code without external dependencies or side effects.

**Complexity**: Low

**Common Mistakes Agents Make**:
- Not organizing tests with `describe` blocks for logical grouping
- Writing vague test names like "it works" instead of descriptive behavior ("it returns sum of two numbers")
- Testing multiple behaviors in a single test (violates single responsibility)
- Not following the Arrange-Act-Assert (AAA) pattern clearly
- Forgetting to test edge cases (null, undefined, empty arrays, zero, negative numbers)
- Not testing error conditions and exception handling
- Using `toBe()` for object/array comparison instead of `toEqual()`
- Not using `toBeCloseTo()` for floating-point comparisons
- Over-relying on snapshots instead of specific assertions
- Not organizing test data as constants at the top of the file

## Template

```typescript
import { {{functionName}} } from './{{modulePath}}';

/**
 * Test suite for {{functionName}}
 *
 * Tests pure function behavior with various inputs
 * and validates error handling for invalid inputs.
 */
describe('{{functionName}}', () => {
  // Arrange: Test data constants
  const {{validInput1}} = {{value1}};
  const {{validInput2}} = {{value2}};
  const {{expectedOutput}} = {{expectedValue}};
  const {{invalidInput}} = {{invalidValue}};

  /**
   * Happy path tests
   */
  describe('when given valid inputs', () => {
    it('should {{expectedBehavior}}', () => {
      // Arrange
      const input = {{validInput1}};
      const expected = {{expectedOutput}};

      // Act
      const result = {{functionName}}(input);

      // Assert
      expect(result).toEqual(expected);
    });

    it('should {{anotherExpectedBehavior}}', () => {
      // Arrange
      const input1 = {{validInput1}};
      const input2 = {{validInput2}};

      // Act
      const result = {{functionName}}(input1, input2);

      // Assert
      expect(result).toBe({{expectedValue}});
      expect(result).toBeGreaterThan({{minValue}});
    });

    it('should handle {{specificCase}}', () => {
      // Arrange
      const specialInput = {{specialValue}};

      // Act
      const result = {{functionName}}(specialInput);

      // Assert
      expect(result).toMatchObject({
        {{property1}}: {{value1}},
        {{property2}}: {{value2}},
      });
    });
  });

  /**
   * Edge case tests
   */
  describe('edge cases', () => {
    it('should handle empty input', () => {
      // Arrange
      const emptyInput = {{emptyValue}};

      // Act
      const result = {{functionName}}(emptyInput);

      // Assert
      expect(result).toEqual({{defaultValue}});
    });

    it('should handle null input', () => {
      // Arrange
      const nullInput = null;

      // Act
      const result = {{functionName}}(nullInput);

      // Assert
      expect(result).toBeNull();
      // OR if function has default behavior:
      // expect(result).toEqual({{defaultValue}});
    });

    it('should handle undefined input', () => {
      // Arrange
      const undefinedInput = undefined;

      // Act
      const result = {{functionName}}(undefinedInput);

      // Assert
      expect(result).toBeUndefined();
    });

    it('should handle zero value', () => {
      // Arrange
      const zero = 0;

      // Act
      const result = {{functionName}}(zero);

      // Assert
      expect(result).toBe({{expectedForZero}});
    });

    it('should handle negative numbers', () => {
      // Arrange
      const negativeNumber = -10;

      // Act
      const result = {{functionName}}(negativeNumber);

      // Assert
      expect(result).toBeLessThan(0);
    });

    it('should handle large numbers', () => {
      // Arrange
      const largeNumber = Number.MAX_SAFE_INTEGER;

      // Act
      const result = {{functionName}}(largeNumber);

      // Assert
      expect(result).toBeDefined();
    });

    it('should handle floating point numbers accurately', () => {
      // Arrange
      const float1 = 0.1;
      const float2 = 0.2;

      // Act
      const result = {{functionName}}(float1, float2);

      // Assert
      // ❌ Don't use: expect(result).toBe(0.3) - fails due to floating point precision
      // ✅ Use toBeCloseTo for floats:
      expect(result).toBeCloseTo(0.3, 5); // 5 decimal places
    });

    it('should handle empty array', () => {
      // Arrange
      const emptyArray: {{ItemType}}[] = [];

      // Act
      const result = {{functionName}}(emptyArray);

      // Assert
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should handle single item array', () => {
      // Arrange
      const singleItemArray = [{{singleItem}}];

      // Act
      const result = {{functionName}}(singleItemArray);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({{expectedItem}});
    });
  });

  /**
   * Error handling tests
   */
  describe('error handling', () => {
    it('should throw error for invalid input type', () => {
      // Arrange
      const invalidInput = {{invalidValue}};

      // Act & Assert
      expect(() => {{functionName}}(invalidInput)).toThrow();
    });

    it('should throw specific error message', () => {
      // Arrange
      const invalidInput = {{invalidValue}};
      const expectedError = '{{errorMessage}}';

      // Act & Assert
      expect(() => {{functionName}}(invalidInput)).toThrow(expectedError);
    });

    it('should throw specific error type', () => {
      // Arrange
      const invalidInput = {{invalidValue}};

      // Act & Assert
      expect(() => {{functionName}}(invalidInput)).toThrow({{ErrorType}});
    });

    it('should not throw for valid boundary value', () => {
      // Arrange
      const boundaryValue = {{boundaryValue}};

      // Act & Assert
      expect(() => {{functionName}}(boundaryValue)).not.toThrow();
    });
  });

  /**
   * Array and collection tests
   */
  describe('array operations', () => {
    it('should return array with correct length', () => {
      // Arrange
      const input = {{arrayInput}};
      const expectedLength = {{expectedLength}};

      // Act
      const result = {{functionName}}(input);

      // Assert
      expect(result).toHaveLength(expectedLength);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should contain expected items', () => {
      // Arrange
      const input = {{arrayInput}};

      // Act
      const result = {{functionName}}(input);

      // Assert
      expect(result).toContain({{expectedItem}});
      expect(result).toContainEqual({{expectedObject}});
    });

    it('should maintain array order', () => {
      // Arrange
      const input = [{{item1}}, {{item2}}, {{item3}}];

      // Act
      const result = {{functionName}}(input);

      // Assert
      expect(result[0]).toEqual({{expectedFirst}});
      expect(result[result.length - 1]).toEqual({{expectedLast}});
    });

    it('should filter items correctly', () => {
      // Arrange
      const input = {{arrayInput}};
      const predicate = {{filterPredicate}};

      // Act
      const result = {{functionName}}(input, predicate);

      // Assert
      expect(result.every(predicate)).toBe(true);
    });
  });

  /**
   * Object and property tests
   */
  describe('object operations', () => {
    it('should return object with correct structure', () => {
      // Arrange
      const input = {{inputObject}};

      // Act
      const result = {{functionName}}(input);

      // Assert
      expect(result).toHaveProperty('{{propertyName}}');
      expect(result).toMatchObject({
        {{property1}}: expect.any({{Type1}}),
        {{property2}}: expect.any({{Type2}}),
      });
    });

    it('should transform object properties correctly', () => {
      // Arrange
      const input = {
        {{originalProperty}}: {{originalValue}},
      };

      // Act
      const result = {{functionName}}(input);

      // Assert
      expect(result.{{transformedProperty}}).toBe({{transformedValue}});
    });

    it('should not mutate original object', () => {
      // Arrange
      const original = { {{property}}: {{value}} };
      const originalCopy = { ...original };

      // Act
      {{functionName}}(original);

      // Assert
      expect(original).toEqual(originalCopy);
    });

    it('should handle nested objects', () => {
      // Arrange
      const nested = {
        {{level1}}: {
          {{level2}}: {
            {{level3}}: {{value}},
          },
        },
      };

      // Act
      const result = {{functionName}}(nested);

      // Assert
      expect(result.{{level1}}.{{level2}}.{{level3}}).toBe({{expectedValue}});
    });
  });

  /**
   * String operation tests
   */
  describe('string operations', () => {
    it('should handle empty string', () => {
      // Arrange
      const emptyString = '';

      // Act
      const result = {{functionName}}(emptyString);

      // Assert
      expect(result).toBe('');
    });

    it('should match expected pattern', () => {
      // Arrange
      const input = {{stringInput}};

      // Act
      const result = {{functionName}}(input);

      // Assert
      expect(result).toMatch(/{{regexPattern}}/);
      expect(result).toContain('{{substring}}');
    });

    it('should handle special characters', () => {
      // Arrange
      const specialChars = '!@#$%^&*()';

      // Act
      const result = {{functionName}}(specialChars);

      // Assert
      expect(result).toBeDefined();
    });

    it('should be case sensitive/insensitive', () => {
      // Arrange
      const uppercase = '{{UPPERCASE}}';
      const lowercase = '{{lowercase}}';

      // Act
      const result1 = {{functionName}}(uppercase);
      const result2 = {{functionName}}(lowercase);

      // Assert
      expect(result1).toBe(result2); // case insensitive
      // OR
      expect(result1).not.toBe(result2); // case sensitive
    });
  });

  /**
   * Boolean logic tests
   */
  describe('boolean logic', () => {
    it('should return true when condition met', () => {
      // Arrange
      const input = {{validConditionInput}};

      // Act
      const result = {{functionName}}(input);

      // Assert
      expect(result).toBe(true);
      expect(result).toBeTruthy();
    });

    it('should return false when condition not met', () => {
      // Arrange
      const input = {{invalidConditionInput}};

      // Act
      const result = {{functionName}}(input);

      // Assert
      expect(result).toBe(false);
      expect(result).toBeFalsy();
    });

    it('should handle truthy values', () => {
      // Arrange
      const truthyValues = [1, 'string', {}, [], true];

      // Act & Assert
      truthyValues.forEach(value => {
        expect({{functionName}}(value)).toBeTruthy();
      });
    });

    it('should handle falsy values', () => {
      // Arrange
      const falsyValues = [0, '', null, undefined, false, NaN];

      // Act & Assert
      falsyValues.forEach(value => {
        expect({{functionName}}(value)).toBeFalsy();
      });
    });
  });
});
```

## Adaptation Rules

- [ ] Replace `{{functionName}}` with the actual function being tested
- [ ] Replace `{{modulePath}}` with the import path
- [ ] Remove test groups (`describe` blocks) that don't apply to your function
- [ ] Use specific assertion matchers appropriate for the data type
- [ ] Always follow AAA pattern: Arrange, Act, Assert (with comments)
- [ ] Group related tests in `describe` blocks for organization
- [ ] Write descriptive test names that describe behavior, not implementation
- [ ] Test the happy path, edge cases, and error conditions
- [ ] Use `toEqual()` for deep equality (objects/arrays), `toBe()` for primitives
- [ ] Use `toBeCloseTo()` for floating-point number comparisons
- [ ] Verify functions don't mutate inputs (test immutability)

## Related

- Template: @templates/jest/integration-test.test.ts (for testing with dependencies)
- Template: @templates/jest/mock-test.test.ts (for testing with mocks)
- Template: @templates/jest/parametrized-test.test.ts (for data-driven tests)

## Example: calculateDiscount Function

```typescript
import { calculateDiscount } from './pricing';

/**
 * Test suite for calculateDiscount
 *
 * Tests discount calculation logic for various
 * price ranges and discount percentages.
 */
describe('calculateDiscount', () => {
  // Arrange: Test data constants
  const regularPrice = 100;
  const discountPercent = 20;
  const expectedDiscountedPrice = 80;

  /**
   * Happy path tests
   */
  describe('when given valid inputs', () => {
    it('should calculate discounted price correctly', () => {
      // Arrange
      const price = 100;
      const discount = 20;

      // Act
      const result = calculateDiscount(price, discount);

      // Assert
      expect(result).toBe(80);
    });

    it('should handle zero discount', () => {
      // Arrange
      const price = 100;
      const discount = 0;

      // Act
      const result = calculateDiscount(price, discount);

      // Assert
      expect(result).toBe(100);
    });

    it('should handle 100% discount', () => {
      // Arrange
      const price = 100;
      const discount = 100;

      // Act
      const result = calculateDiscount(price, discount);

      // Assert
      expect(result).toBe(0);
    });

    it('should round to 2 decimal places', () => {
      // Arrange
      const price = 99.99;
      const discount = 15.5;

      // Act
      const result = calculateDiscount(price, discount);

      // Assert
      expect(result).toBeCloseTo(84.49, 2);
    });
  });

  /**
   * Edge case tests
   */
  describe('edge cases', () => {
    it('should handle very small prices', () => {
      // Arrange
      const price = 0.01;
      const discount = 10;

      // Act
      const result = calculateDiscount(price, discount);

      // Assert
      expect(result).toBeCloseTo(0.009, 3);
    });

    it('should handle very large prices', () => {
      // Arrange
      const price = 1000000;
      const discount = 5;

      // Act
      const result = calculateDiscount(price, discount);

      // Assert
      expect(result).toBe(950000);
    });

    it('should handle fractional discounts', () => {
      // Arrange
      const price = 100;
      const discount = 12.5;

      // Act
      const result = calculateDiscount(price, discount);

      // Assert
      expect(result).toBeCloseTo(87.5, 2);
    });
  });

  /**
   * Error handling tests
   */
  describe('error handling', () => {
    it('should throw error for negative price', () => {
      // Arrange
      const negativePrice = -100;
      const discount = 20;

      // Act & Assert
      expect(() => calculateDiscount(negativePrice, discount))
        .toThrow('Price cannot be negative');
    });

    it('should throw error for discount over 100', () => {
      // Arrange
      const price = 100;
      const invalidDiscount = 150;

      // Act & Assert
      expect(() => calculateDiscount(price, invalidDiscount))
        .toThrow('Discount must be between 0 and 100');
    });

    it('should throw error for negative discount', () => {
      // Arrange
      const price = 100;
      const negativeDiscount = -10;

      // Act & Assert
      expect(() => calculateDiscount(price, negativeDiscount))
        .toThrow('Discount must be between 0 and 100');
    });
  });
});
```

## Common Assertion Matchers

```typescript
// Equality
expect(value).toBe(4);                    // Strict equality (===)
expect(value).toEqual({ a: 1 });          // Deep equality
expect(value).toStrictEqual({ a: 1 });    // Strict deep equality (checks undefined props)

// Truthiness
expect(value).toBeTruthy();               // Any truthy value
expect(value).toBeFalsy();                // Any falsy value
expect(value).toBeDefined();              // Not undefined
expect(value).toBeUndefined();            // Is undefined
expect(value).toBeNull();                 // Is null

// Numbers
expect(value).toBeGreaterThan(3);         // > 3
expect(value).toBeGreaterThanOrEqual(3);  // >= 3
expect(value).toBeLessThan(5);            // < 5
expect(value).toBeLessThanOrEqual(5);     // <= 5
expect(value).toBeCloseTo(0.3, 5);        // Floating point (5 decimals)

// Strings
expect(value).toMatch(/pattern/);         // Regex match
expect(value).toContain('substring');     // Contains substring

// Arrays
expect(array).toHaveLength(3);            // Array length
expect(array).toContain(item);            // Contains item
expect(array).toContainEqual({ id: 1 }); // Contains object

// Objects
expect(obj).toHaveProperty('key');        // Has property
expect(obj).toMatchObject({ a: 1 });      // Subset match

// Exceptions
expect(() => fn()).toThrow();             // Throws any error
expect(() => fn()).toThrow(Error);        // Throws specific error type
expect(() => fn()).toThrow('message');    // Throws with message

// Type checking
expect(value).toEqual(expect.any(Number));
expect(value).toEqual(expect.arrayContaining([1, 2]));
```
