# Example: Generating an Integration Test

This example demonstrates the complete 4-step workflow for generating an integration test with database interactions and HTTP testing.

## User Request

"Write integration tests for the API endpoint POST /users"

---

## Step 1: Investigate

**Tool: Read** → `package.json`
```
Jest 29.7, TypeScript present
Supertest installed for HTTP testing
```

**Tool: Read** → `docker-compose.yml`
```
PostgreSQL test database on port 5433
Named: test-db
```

**Tool: Grep** → "integration" patterns
```
Found: __tests__/integration/ directory
Pattern: beforeEach cleanup, Supertest for HTTP, database connections
```

**Tool: Read** → existing integration test
```
Pattern identified:
- beforeAll: Setup test database and migrations
- beforeEach: Clear tables and seed test data
- afterEach: Clean up test artifacts
- Supertest for HTTP requests
- Database assertions verify state changes
```

**Findings**:
- Jest + Supertest for HTTP testing (can use pattern from template)
- PostgreSQL test database with beforeEach cleanup
- TypeScript enabled (need proper types)
- Integration tests follow AAA pattern with database setup
- Tests verify both HTTP response AND database state

---

## Step 2: Detect Pattern

**Keywords extracted**: "integration test", "API endpoint", "POST", "users", "database"

**Pattern identified**: Integration test for REST API endpoint with real database

**Files to load**:
- @templates/jest/integration-test.test.ts → Full integration test template
- @rules/test-structure-rules.md → AAA pattern, test isolation, database cleanup
- @investigation/coverage-setup.md → Coverage expectations for integration tests

---

## Step 3: Generate

**Using template** from @templates/jest/integration-test.test.ts

**Adapted to project**:
- Named export (project convention)
- TypeScript types (strict mode enabled)
- Supertest for HTTP testing
- PostgreSQL database with beforeEach cleanup pattern
- Tests verify both HTTP status AND database state
- Error cases: 400 (validation), 409 (duplicate), 201 (success)

```typescript
import request from 'supertest';
import { app } from '../app';
import { setupTestDatabase, cleanupTestDatabase } from '../test/utils';
import { db } from '../database';

/**
 * Integration tests for User API
 *
 * Tests POST /users endpoint with real database interactions.
 * Verifies both HTTP response and database state changes.
 */
describe('User API POST /users Integration Tests', () => {
  /**
   * Setup: Run once before all tests
   */
  beforeAll(async () => {
    // Setup test database
    await setupTestDatabase();

    // Run migrations
    await db.migrate.latest();
  });

  /**
   * Teardown: Run once after all tests
   */
  afterAll(async () => {
    // Close connections
    await db.destroy();
    await cleanupTestDatabase();
  });

  /**
   * Setup: Run before each test
   */
  beforeEach(async () => {
    // Clear test data to ensure isolation
    await db('users').delete();

    // Seed with known test data
    await db('users').insert([
      { id: 1, name: 'John Doe', email: 'john@example.com', created_at: new Date() },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com', created_at: new Date() },
    ]);
  });

  /**
   * Cleanup: Run after each test
   */
  afterEach(async () => {
    // Clear test data to prevent test pollution
    await db('users').delete();
  });

  /**
   * POST /users - Create User endpoint tests
   */
  describe('POST /users', () => {
    it('should create new user with 201 status and return user data', async () => {
      // Arrange
      const newUser = {
        name: 'Bob Wilson',
        email: 'bob@example.com',
      };

      // Act
      const response = await request(app)
        .post('/users')
        .send(newUser)
        .expect('Content-Type', /json/)
        .expect(201);

      // Assert - HTTP response
      expect(response.body).toMatchObject({
        id: expect.any(Number),
        name: 'Bob Wilson',
        email: 'bob@example.com',
        created_at: expect.any(String),
      });

      // Assert - Database state change
      const dbUser = await db('users')
        .where({ id: response.body.id })
        .first();
      expect(dbUser).toBeDefined();
      expect(dbUser.name).toBe(newUser.name);
      expect(dbUser.email).toBe(newUser.email);
    });

    it('should return 400 for missing required name field', async () => {
      // Arrange
      const incompleteUser = {
        email: 'incomplete@example.com',
        // Missing 'name' field
      };

      // Act
      const response = await request(app)
        .post('/users')
        .send(incompleteUser)
        .expect(400);

      // Assert
      expect(response.body).toMatchObject({
        error: expect.stringContaining('required'),
      });

      // Verify user not created
      const userCount = await db('users').count('* as count').first();
      expect(userCount.count).toBe(2); // Only seed data exists
    });

    it('should return 400 for missing required email field', async () => {
      // Arrange
      const incompleteUser = {
        name: 'Incomplete User',
        // Missing 'email' field
      };

      // Act
      const response = await request(app)
        .post('/users')
        .send(incompleteUser)
        .expect(400);

      // Assert
      expect(response.body).toMatchObject({
        error: expect.stringContaining('required'),
      });
    });

    it('should return 400 for invalid email format', async () => {
      // Arrange
      const invalidUser = {
        name: 'Invalid User',
        email: 'not-an-email', // Invalid format
      };

      // Act
      const response = await request(app)
        .post('/users')
        .send(invalidUser)
        .expect(400);

      // Assert
      expect(response.body).toMatchObject({
        error: expect.stringContaining('email'),
      });
    });

    it('should return 409 when email already exists (duplicate)', async () => {
      // Arrange
      const duplicateUser = {
        name: 'Duplicate Name',
        email: 'john@example.com', // Already in seed data
      };

      // Act
      const response = await request(app)
        .post('/users')
        .send(duplicateUser)
        .expect(409);

      // Assert
      expect(response.body).toMatchObject({
        error: expect.stringContaining('already exists'),
      });

      // Verify no new user created
      const userCount = await db('users').count('* as count').first();
      expect(userCount.count).toBe(2); // Still only seed data
    });

    it('should sanitize HTML and prevent XSS in user name', async () => {
      // Arrange
      const userWithXSS = {
        name: '<script>alert("xss")</script>',
        email: 'xss@example.com',
      };

      // Act
      const response = await request(app)
        .post('/users')
        .send(userWithXSS)
        .expect(201);

      // Assert - Name should be sanitized or escaped
      expect(response.body.name).not.toContain('<script>');
      expect(response.body.name).not.toContain('</script>');

      // Verify sanitized in database
      const dbUser = await db('users')
        .where({ id: response.body.id })
        .first();
      expect(dbUser.name).not.toContain('<script>');
    });

    it('should ignore extra fields and only store expected fields', async () => {
      // Arrange
      const userWithExtra = {
        name: 'Normal User',
        email: 'normal@example.com',
        maliciousScript: '<script>alert("bad")</script>',
        unexpectedField: 'should be ignored',
        isAdmin: true, // Attempt privilege escalation
      };

      // Act
      const response = await request(app)
        .post('/users')
        .send(userWithExtra)
        .expect(201);

      // Assert - Extra fields not in response
      expect(response.body).not.toHaveProperty('maliciousScript');
      expect(response.body).not.toHaveProperty('unexpectedField');
      expect(response.body).not.toHaveProperty('isAdmin');

      // Assert - Database only has allowed fields
      const dbUser = await db('users')
        .where({ id: response.body.id })
        .first();
      expect(dbUser).not.toHaveProperty('isAdmin');
    });

    it('should handle concurrent POST requests without race conditions', async () => {
      // Arrange - Create multiple concurrent requests
      const requests = Array(5).fill(null).map((_, i) =>
        request(app)
          .post('/users')
          .send({
            name: `Concurrent User ${i}`,
            email: `concurrent${i}@example.com`,
          })
      );

      // Act
      const responses = await Promise.all(requests);

      // Assert - All requests succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.id).toBeDefined();
      });

      // Verify all users created in database
      const users = await db('users').select();
      expect(users.length).toBe(7); // 2 seed + 5 concurrent
    });

    it('should maintain database integrity on error response', async () => {
      // Arrange
      const invalidUser = {
        name: 'Invalid', // Too short for validation
        email: 'missing-at-sign.com', // Invalid email
      };

      // Act
      const response = await request(app)
        .post('/users')
        .send(invalidUser)
        .expect(400);

      // Assert - Error response contains help message
      expect(response.body.error).toBeDefined();

      // Verify no partial data in database
      const allUsers = await db('users').select();
      const invalidCreated = allUsers.find(u => u.name === 'Invalid');
      expect(invalidCreated).toBeUndefined();
    });

    it('should return correct content-type header in response', async () => {
      // Arrange
      const newUser = {
        name: 'Content Type Test',
        email: 'content@example.com',
      };

      // Act
      const response = await request(app)
        .post('/users')
        .send(newUser);

      // Assert
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  /**
   * Error handling and edge cases
   */
  describe('error handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Arrange
      await db.destroy(); // Simulate connection loss

      // Act
      const response = await request(app)
        .post('/users')
        .send({ name: 'Test', email: 'test@example.com' });

      // Assert - Should return 500, not crash
      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();

      // Cleanup: Reconnect
      await setupTestDatabase();
    });

    it('should return 400 for malformed JSON in request body', async () => {
      // Act
      const response = await request(app)
        .post('/users')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should handle empty request body with 400', async () => {
      // Act
      const response = await request(app)
        .post('/users')
        .send({});

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });
  });
});
```

---

## Step 4: Verify

**Verification against** @validation/ checklist:

- [x] Database cleaned up in beforeEach (prevents test pollution)
- [x] Database connection closed in afterAll (prevents hanging)
- [x] Each test verifies ONE logical concept (single user creation scenario)
- [x] Test names describe behavior: "should [behavior] when [condition]"
- [x] AAA pattern clearly separated: Arrange-Act-Assert with comments
- [x] Tests are isolated: No shared state between tests
- [x] HTTP assertions use Supertest correctly
- [x] Success path tested (201 with user data)
- [x] Error paths tested (400 validation, 409 duplicate)
- [x] Database state verified after each operation
- [x] TypeScript types present (no any)
- [x] Sanitization/XSS protection tested
- [x] Race condition handling tested
- [x] Error recovery tested (connection loss)

**Run tests**:
```bash
npm test -- --testPathPattern=users.integration.test
```

**Expected output**:
```
PASS  __tests__/integration/users.integration.test.ts
  User API POST /users Integration Tests
    POST /users
      ✓ should create new user with 201 status and return user data (45ms)
      ✓ should return 400 for missing required name field (12ms)
      ✓ should return 400 for missing required email field (10ms)
      ✓ should return 400 for invalid email format (8ms)
      ✓ should return 409 when email already exists (duplicate) (22ms)
      ✓ should sanitize HTML and prevent XSS in user name (28ms)
      ✓ should ignore extra fields and only store expected fields (18ms)
      ✓ should handle concurrent POST requests without race conditions (55ms)
      ✓ should maintain database integrity on error response (14ms)
      ✓ should return correct content-type header in response (9ms)
    error handling
      ✓ should handle database connection errors gracefully (32ms)
      ✓ should return 400 for malformed JSON in request body (8ms)
      ✓ should handle empty request body with 400 (6ms)

Test Suites: 1 passed, 1 total
Tests:       13 passed, 13 total
Time:        2.847 s
Coverage:    85% branch coverage ✅
```

---

## Key Takeaways

**Investigation mattered**:
- Found Supertest in use → Used HTTP request patterns
- Found PostgreSQL test database → Used beforeEach cleanup pattern
- Found existing tests → Matched project's test structure conventions
- Found TypeScript → Added proper types throughout

**Template saved time**:
- Complete POST endpoint test structure
- Database setup/teardown pattern
- Supertest HTTP assertion examples
- Error scenario examples (400, 409, 500)

**Verification caught issues**:
- Database cleanup necessary for test isolation
- Both HTTP response AND database state must be verified
- Error cases need distinct tests (not bundled together)
- Concurrent operations need explicit testing
- Connection cleanup prevents test hanging

**This workflow prevents**:
- Common mistake #3: Not verifying database state (only checked HTTP response)
- Common mistake #8: Test pollution from shared mutable state (used beforeEach cleanup)
- Common mistake #10: No error path testing (explicit tests for 400, 409, 500)

---

**See other examples**: Load @examples/ for more workflow examples
