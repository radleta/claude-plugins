# Example: Generating a Unit Test

This example demonstrates the complete 4-step workflow for generating unit tests using test-driven development principles.

## User Request

"Write unit tests for the UserService.createUser method"

---

## Step 1: Investigate

**Tool: Read** → `package.json`
```
Jest 29.7 installed
TypeScript present (@types/jest)
Test script: "jest --coverage"
```

**Tool: Read** → `tsconfig.json`
```
strict mode enabled
esModuleInterop: true
```

**Tool: Grep** → existing test patterns
```
Found: describe/it blocks (Jest format)
Found: expect() matchers
Found: beforeEach/afterEach hooks
Pattern: AAA (Arrange, Act, Assert)
```

**Tool: Glob** → test file locations
```
Pattern: src/__tests__/**/*.test.ts
Pattern: src/**/__tests__/*.test.ts
Naming: [filename].test.ts
```

**Findings**:
- Jest 29 available (modern syntax supported)
- TypeScript enabled (need proper types for mocks)
- Co-located tests (tests near source files)
- AAA pattern used throughout codebase
- expect() matchers preferred (not other assertion libraries)

---

## Step 2: Detect Pattern

**Keywords extracted**: "unit test", "UserService", "createUser", "method"

**Pattern identified**: Service method test with mocks (basic unit test)

**Context from source**:
- UserService is a class with database dependency
- createUser takes email and password
- Returns Promise<User> with id, email, createdAt
- May throw ValidationError or DatabaseError

**Files to load**:
- @templates/jest/basic-unit-test.test.ts → Jest describe/it structure
- @rules/test-structure-rules.md → Test organization
- @rules/assertion-rules.md → Specific assertion expectations
- @patterns/mocking-pattern.md → Mock dependencies (database)

---

## Step 3: Generate

**Using template** from @templates/jest/basic-unit-test.test.ts

**Adapted to project**:
- TypeScript types (strict mode)
- AAA pattern for organization
- Mock database dependency
- Async/await for promises
- Descriptive test names focused on behavior
- Proper error handling tests

```typescript
import { UserService } from './UserService';
import { Database } from './Database';
import { ValidationError, DatabaseError } from './errors';

jest.mock('./Database');

describe('UserService', () => {
  let userService: UserService;
  let mockDatabase: jest.Mocked<Database>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabase = Database as jest.Mocked<Database>;
    userService = new UserService(mockDatabase);
  });

  describe('createUser', () => {
    it('should create a user with valid email and password', async () => {
      // Arrange
      const email = 'test@example.com';
      const password = 'SecurePass123!';
      const expectedUser = {
        id: '123',
        email,
        createdAt: new Date('2025-12-12')
      };

      mockDatabase.insertUser.mockResolvedValue(expectedUser);

      // Act
      const result = await userService.createUser(email, password);

      // Assert
      expect(result).toEqual(expectedUser);
      expect(mockDatabase.insertUser).toHaveBeenCalledWith({
        email,
        passwordHash: expect.any(String)
      });
      expect(mockDatabase.insertUser).toHaveBeenCalledTimes(1);
    });

    it('should throw ValidationError when email is invalid', async () => {
      // Arrange
      const invalidEmail = 'not-an-email';
      const password = 'SecurePass123!';

      // Act & Assert
      await expect(
        userService.createUser(invalidEmail, password)
      ).rejects.toThrow(ValidationError);

      expect(mockDatabase.insertUser).not.toHaveBeenCalled();
    });

    it('should throw ValidationError when password is too weak', async () => {
      // Arrange
      const email = 'test@example.com';
      const weakPassword = 'weak';

      // Act & Assert
      await expect(
        userService.createUser(email, weakPassword)
      ).rejects.toThrow(ValidationError);

      expect(mockDatabase.insertUser).not.toHaveBeenCalled();
    });

    it('should propagate DatabaseError from database layer', async () => {
      // Arrange
      const email = 'test@example.com';
      const password = 'SecurePass123!';
      const dbError = new DatabaseError('Connection failed');

      mockDatabase.insertUser.mockRejectedValue(dbError);

      // Act & Assert
      await expect(
        userService.createUser(email, password)
      ).rejects.toThrow(DatabaseError);
    });

    it('should hash password before storing', async () => {
      // Arrange
      const email = 'test@example.com';
      const password = 'SecurePass123!';
      const expectedUser = {
        id: '123',
        email,
        createdAt: new Date('2025-12-12')
      };

      mockDatabase.insertUser.mockResolvedValue(expectedUser);

      // Act
      await userService.createUser(email, password);

      // Assert
      expect(mockDatabase.insertUser).toHaveBeenCalledWith({
        email,
        passwordHash: expect.stringContaining('$2b$')  // bcrypt hash format
      });
    });
  });
});
```

---

## Step 4: Verify

**Verification against** @validation/ checklist:

- [x] AAA pattern followed (Arrange/Act/Assert clearly separated)
- [x] Test names describe behavior (not implementation)
- [x] Assertions are specific (expect exact values/calls)
- [x] Tests are isolated (clearAllMocks in beforeEach)
- [x] Mocks properly configured (jest.mock and jest.Mocked<T>)
- [x] Async/await handled correctly (async test, await promise)
- [x] Error cases tested (three error scenarios)
- [x] Edge cases covered (weak password, invalid email)
- [x] No test interdependencies (each test independent)
- [x] TypeScript types correct (no any types in tests)
- [x] Mock call assertions clear (toHaveBeenCalledWith checks)
- [x] Setup/teardown proper (beforeEach clears mocks)

**Run automated checks**:
```bash
npm test UserService.test.ts
```

**Output**:
```
PASS  src/__tests__/UserService.test.ts
  UserService
    createUser
      ✓ should create a user with valid email and password (12ms)
      ✓ should throw ValidationError when email is invalid (2ms)
      ✓ should throw ValidationError when password is too weak (2ms)
      ✓ should propagate DatabaseError from database layer (3ms)
      ✓ should hash password before storing (4ms)

Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
Coverage:    100% (UserService methods)
```

**Result**: ✅ All tests pass. Coverage is complete. Code is production-ready.

---

## Key Takeaways

**Investigation mattered**:
- Found Jest version → Used modern expect() syntax
- Found TypeScript → Used jest.Mocked<T> for type-safe mocks
- Found AAA pattern → Organized tests with same structure
- Found co-located tests → Placed file in correct directory

**Template saved time**:
- Correct describe/it structure
- Proper mock setup with beforeEach
- AAA pattern comments for clarity
- Error test cases included

**Verification caught potential issues**:
- Confirmed mocks cleared between tests (no test pollution)
- Confirmed async/await properly handled
- Confirmed assertions check both success and failure paths
- Confirmed mock call assertions verify behavior

**This workflow prevents**:
- Top QA Mistake #1: Tests that don't catch real bugs (comprehensive error cases)
- Top QA Mistake #3: Brittle tests dependent on execution order (cleared mocks, isolated tests)
- Top QA Mistake #5: Untestable code (mocked external dependencies)
- Top QA Mistake #8: Assertion ambiguity (specific expect() calls)

---

**See other examples**: Load @examples/ for more workflow examples
