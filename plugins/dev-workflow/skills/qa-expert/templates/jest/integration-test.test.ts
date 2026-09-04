# Template: Integration Test

**When to Use**: Testing API endpoints, database interactions, service layers, multiple components working together, external service integrations, and workflows that span multiple modules.

**Complexity**: Medium

**Common Mistakes Agents Make**:
- Not cleaning up test data after each test (pollutes database, causes flaky tests)
- Sharing mutable state between tests (tests depend on execution order)
- Not mocking external dependencies (tests become slow, unreliable, hit real APIs)
- Not testing error responses and edge cases for API endpoints
- Forgetting to close database connections or server instances after tests
- Not using `beforeEach`/`afterEach` for setup/teardown properly
- Testing too many layers at once (blurs line between integration and E2E tests)
- Not using test databases or proper isolation between test runs
- Hardcoding ports or URLs instead of using configuration
- Not waiting for async operations to complete before assertions

## Template

```typescript
import request from 'supertest';
import { app } from './{{appPath}}';
import { setupTestDatabase, cleanupTestDatabase } from './{{testUtilsPath}}';
import { {{DatabaseConnection}} } from './{{databasePath}}';
import { {{ServiceClass}} } from './{{servicePath}}';

/**
 * Integration tests for {{FeatureName}} API
 *
 * Tests API endpoints with real database interactions
 * but mocked external services.
 */
describe('{{FeatureName}} API Integration Tests', () => {
  let db: {{DatabaseConnection}};
  let service: {{ServiceClass}};

  /**
   * Setup: Run once before all tests
   */
  beforeAll(async () => {
    // Setup test database
    db = await setupTestDatabase();

    // Initialize services
    service = new {{ServiceClass}}(db);

    // Run migrations if needed
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
    await db('{{tableName}}').delete();

    // Seed with known test data
    await db('{{tableName}}').insert([
      { id: 1, {{property1}}: '{{value1}}', {{property2}}: '{{value2}}' },
      { id: 2, {{property1}}: '{{value3}}', {{property2}}: '{{value4}}' },
    ]);
  });

  /**
   * Cleanup: Run after each test
   */
  afterEach(async () => {
    // Clear any test artifacts
    await db('{{tableName}}').delete();
  });

  /**
   * GET endpoint tests
   */
  describe('GET /{{apiPath}}', () => {
    it('should return list of items with 200 status', async () => {
      // Act
      const response = await request(app)
        .get('/{{apiPath}}')
        .expect('Content-Type', /json/)
        .expect(200);

      // Assert
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toMatchObject({
        id: expect.any(Number),
        {{property1}}: expect.any(String),
        {{property2}}: expect.any(String),
      });
    });

    it('should return empty array when no items exist', async () => {
      // Arrange
      await db('{{tableName}}').delete();

      // Act
      const response = await request(app)
        .get('/{{apiPath}}')
        .expect(200);

      // Assert
      expect(response.body).toEqual([]);
      expect(response.body).toHaveLength(0);
    });

    it('should filter items by query parameter', async () => {
      // Act
      const response = await request(app)
        .get('/{{apiPath}}?{{queryParam}}={{queryValue}}')
        .expect(200);

      // Assert
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body.every((item: any) =>
        item.{{property}} === '{{queryValue}}'
      )).toBe(true);
    });

    it('should paginate results', async () => {
      // Arrange
      const page = 1;
      const limit = 1;

      // Act
      const response = await request(app)
        .get(`/{{apiPath}}?page=${page}&limit=${limit}`)
        .expect(200);

      // Assert
      expect(response.body.data).toHaveLength(limit);
      expect(response.body).toMatchObject({
        data: expect.any(Array),
        page: page,
        limit: limit,
        total: expect.any(Number),
      });
    });

    it('should sort items by specified field', async () => {
      // Act
      const response = await request(app)
        .get('/{{apiPath}}?sortBy={{sortField}}&order=asc')
        .expect(200);

      // Assert
      const items = response.body;
      for (let i = 0; i < items.length - 1; i++) {
        expect(items[i].{{sortField}} <= items[i + 1].{{sortField}}).toBe(true);
      }
    });
  });

  /**
   * GET by ID endpoint tests
   */
  describe('GET /{{apiPath}}/:id', () => {
    it('should return item by id with 200 status', async () => {
      // Arrange
      const itemId = 1;

      // Act
      const response = await request(app)
        .get(`/{{apiPath}}/${itemId}`)
        .expect(200);

      // Assert
      expect(response.body).toMatchObject({
        id: itemId,
        {{property1}}: '{{value1}}',
        {{property2}}: '{{value2}}',
      });
    });

    it('should return 404 when item not found', async () => {
      // Arrange
      const nonExistentId = 99999;

      // Act
      const response = await request(app)
        .get(`/{{apiPath}}/${nonExistentId}`)
        .expect(404);

      // Assert
      expect(response.body).toMatchObject({
        error: expect.stringContaining('not found'),
      });
    });

    it('should return 400 for invalid id format', async () => {
      // Arrange
      const invalidId = 'invalid-id';

      // Act
      const response = await request(app)
        .get(`/{{apiPath}}/${invalidId}`)
        .expect(400);

      // Assert
      expect(response.body).toMatchObject({
        error: expect.stringContaining('invalid'),
      });
    });
  });

  /**
   * POST endpoint tests
   */
  describe('POST /{{apiPath}}', () => {
    it('should create new item with 201 status', async () => {
      // Arrange
      const newItem = {
        {{property1}}: '{{newValue1}}',
        {{property2}}: '{{newValue2}}',
      };

      // Act
      const response = await request(app)
        .post('/{{apiPath}}')
        .send(newItem)
        .expect('Content-Type', /json/)
        .expect(201);

      // Assert
      expect(response.body).toMatchObject({
        id: expect.any(Number),
        ...newItem,
      });

      // Verify in database
      const dbItem = await db('{{tableName}}')
        .where({ id: response.body.id })
        .first();
      expect(dbItem).toBeDefined();
      expect(dbItem.{{property1}}).toBe(newItem.{{property1}});
    });

    it('should return 400 for missing required fields', async () => {
      // Arrange
      const incompleteItem = {
        {{property1}}: '{{value1}}',
        // Missing {{property2}}
      };

      // Act
      const response = await request(app)
        .post('/{{apiPath}}')
        .send(incompleteItem)
        .expect(400);

      // Assert
      expect(response.body).toMatchObject({
        error: expect.stringContaining('required'),
      });
    });

    it('should return 400 for invalid field types', async () => {
      // Arrange
      const invalidItem = {
        {{property1}}: 123, // Should be string
        {{property2}}: '{{value2}}',
      };

      // Act
      const response = await request(app)
        .post('/{{apiPath}}')
        .send(invalidItem)
        .expect(400);

      // Assert
      expect(response.body.error).toBeDefined();
    });

    it('should return 409 for duplicate unique field', async () => {
      // Arrange
      const duplicateItem = {
        {{uniqueField}}: '{{existingValue}}',
        {{property2}}: '{{value2}}',
      };

      // Act
      const response = await request(app)
        .post('/{{apiPath}}')
        .send(duplicateItem)
        .expect(409);

      // Assert
      expect(response.body).toMatchObject({
        error: expect.stringContaining('already exists'),
      });
    });

    it('should sanitize and validate input data', async () => {
      // Arrange
      const itemWithExtraFields = {
        {{property1}}: '{{value1}}',
        {{property2}}: '{{value2}}',
        maliciousScript: '<script>alert("xss")</script>',
        unexpectedField: 'should be ignored',
      };

      // Act
      const response = await request(app)
        .post('/{{apiPath}}')
        .send(itemWithExtraFields)
        .expect(201);

      // Assert
      expect(response.body).not.toHaveProperty('maliciousScript');
      expect(response.body).not.toHaveProperty('unexpectedField');
    });
  });

  /**
   * PUT/PATCH endpoint tests
   */
  describe('PUT /{{apiPath}}/:id', () => {
    it('should update existing item with 200 status', async () => {
      // Arrange
      const itemId = 1;
      const updates = {
        {{property1}}: '{{updatedValue1}}',
        {{property2}}: '{{updatedValue2}}',
      };

      // Act
      const response = await request(app)
        .put(`/{{apiPath}}/${itemId}`)
        .send(updates)
        .expect(200);

      // Assert
      expect(response.body).toMatchObject({
        id: itemId,
        ...updates,
      });

      // Verify in database
      const dbItem = await db('{{tableName}}')
        .where({ id: itemId })
        .first();
      expect(dbItem.{{property1}}).toBe(updates.{{property1}});
    });

    it('should partially update with PATCH', async () => {
      // Arrange
      const itemId = 1;
      const partialUpdate = {
        {{property1}}: '{{updatedValue1}}',
        // Not updating {{property2}}
      };

      // Act
      const response = await request(app)
        .patch(`/{{apiPath}}/${itemId}`)
        .send(partialUpdate)
        .expect(200);

      // Assert
      expect(response.body.{{property1}}).toBe(partialUpdate.{{property1}});
      expect(response.body.{{property2}}).toBe('{{value2}}'); // Unchanged
    });

    it('should return 404 when updating non-existent item', async () => {
      // Arrange
      const nonExistentId = 99999;
      const updates = { {{property1}}: '{{value}}' };

      // Act
      await request(app)
        .put(`/{{apiPath}}/${nonExistentId}`)
        .send(updates)
        .expect(404);
    });

    it('should return 400 for invalid update data', async () => {
      // Arrange
      const itemId = 1;
      const invalidUpdates = {
        {{property1}}: '', // Invalid: empty string
      };

      // Act
      const response = await request(app)
        .put(`/{{apiPath}}/${itemId}`)
        .send(invalidUpdates)
        .expect(400);

      // Assert
      expect(response.body.error).toBeDefined();
    });
  });

  /**
   * DELETE endpoint tests
   */
  describe('DELETE /{{apiPath}}/:id', () => {
    it('should delete item with 204 status', async () => {
      // Arrange
      const itemId = 1;

      // Act
      await request(app)
        .delete(`/{{apiPath}}/${itemId}`)
        .expect(204);

      // Verify item is deleted from database
      const dbItem = await db('{{tableName}}')
        .where({ id: itemId })
        .first();
      expect(dbItem).toBeUndefined();
    });

    it('should return 404 when deleting non-existent item', async () => {
      // Arrange
      const nonExistentId = 99999;

      // Act
      await request(app)
        .delete(`/{{apiPath}}/${nonExistentId}`)
        .expect(404);
    });

    it('should handle cascade delete for related records', async () => {
      // Arrange
      const parentId = 1;
      await db('{{childTable}}').insert([
        { {{parentIdField}}: parentId, {{childProperty}}: '{{value}}' },
      ]);

      // Act
      await request(app)
        .delete(`/{{apiPath}}/${parentId}`)
        .expect(204);

      // Verify child records are also deleted
      const childRecords = await db('{{childTable}}')
        .where({ {{parentIdField}}: parentId });
      expect(childRecords).toHaveLength(0);
    });
  });

  /**
   * Authentication and authorization tests
   */
  describe('authentication and authorization', () => {
    it('should require authentication token', async () => {
      // Act
      await request(app)
        .get('/{{apiPath}}')
        .expect(401);
    });

    it('should accept valid authentication token', async () => {
      // Arrange
      const validToken = '{{validAuthToken}}';

      // Act
      await request(app)
        .get('/{{apiPath}}')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);
    });

    it('should reject invalid authentication token', async () => {
      // Arrange
      const invalidToken = 'invalid-token';

      // Act
      await request(app)
        .get('/{{apiPath}}')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);
    });

    it('should enforce role-based permissions', async () => {
      // Arrange
      const readOnlyToken = '{{readOnlyToken}}';

      // Act
      await request(app)
        .post('/{{apiPath}}')
        .set('Authorization', `Bearer ${readOnlyToken}`)
        .send({ {{property}}: '{{value}}' })
        .expect(403);
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
        .get('/{{apiPath}}')
        .expect(500);

      // Assert
      expect(response.body).toMatchObject({
        error: expect.stringContaining('server error'),
      });

      // Cleanup: Reconnect
      db = await setupTestDatabase();
    });

    it('should return 400 for malformed JSON', async () => {
      // Act
      const response = await request(app)
        .post('/{{apiPath}}')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      // Assert
      expect(response.body.error).toBeDefined();
    });

    it('should handle concurrent requests safely', async () => {
      // Arrange
      const requests = Array(10).fill(null).map((_, i) =>
        request(app)
          .post('/{{apiPath}}')
          .send({ {{property}}: `value-${i}` })
      );

      // Act
      const responses = await Promise.all(requests);

      // Assert
      responses.forEach(response => {
        expect([200, 201]).toContain(response.status);
      });

      const items = await db('{{tableName}}').select();
      expect(items.length).toBeGreaterThanOrEqual(10);
    });
  });
});
```

## Adaptation Rules

- [ ] Replace `{{FeatureName}}` with the feature or module being tested
- [ ] Replace `{{apiPath}}` with actual API endpoint path
- [ ] Set up proper test database with `beforeAll`/`afterAll`
- [ ] Clean up test data in `beforeEach`/`afterEach` for isolation
- [ ] Use `supertest` for HTTP request testing
- [ ] Mock external services (payment gateways, email services, etc.)
- [ ] Test all HTTP methods (GET, POST, PUT, PATCH, DELETE)
- [ ] Verify both response and database state changes
- [ ] Test authentication and authorization flows
- [ ] Include error scenarios and edge cases
- [ ] Close all connections in `afterAll` to prevent hanging tests

## Related

- Template: @templates/jest/basic-unit-test.test.ts (for isolated function tests)
- Template: @templates/jest/mock-test.test.ts (for mocking external dependencies)
- Template: @templates/jest/async-test.test.ts (for async operation patterns)

## Example: User API Integration Test

```typescript
import request from 'supertest';
import { app } from '../app';
import { setupTestDatabase, cleanupTestDatabase } from '../test/utils';
import { db } from '../database';

describe('User API Integration Tests', () => {
  beforeAll(async () => {
    await setupTestDatabase();
    await db.migrate.latest();
  });

  afterAll(async () => {
    await db.destroy();
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    await db('users').delete();
    await db('users').insert([
      { id: 1, name: 'John Doe', email: 'john@example.com' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
    ]);
  });

  describe('GET /api/users', () => {
    it('should return list of users', async () => {
      const response = await request(app)
        .get('/api/users')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toMatchObject({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
      });
    });
  });

  describe('POST /api/users', () => {
    it('should create new user', async () => {
      const newUser = {
        name: 'Bob Wilson',
        email: 'bob@example.com',
      };

      const response = await request(app)
        .post('/api/users')
        .send(newUser)
        .expect(201);

      expect(response.body).toMatchObject(newUser);

      const dbUser = await db('users').where({ id: response.body.id }).first();
      expect(dbUser.name).toBe(newUser.name);
    });

    it('should return 400 for duplicate email', async () => {
      const duplicateUser = {
        name: 'Duplicate',
        email: 'john@example.com', // Already exists
      };

      await request(app)
        .post('/api/users')
        .send(duplicateUser)
        .expect(409);
    });
  });
});
```

## jest.config.js for Integration Tests

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Separate integration tests from unit tests
  testMatch: [
    '**/__tests__/integration/**/*.test.ts',
    '**/*.integration.test.ts',
  ],

  // Longer timeout for integration tests
  testTimeout: 30000,

  // Setup file for test environment
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/test/**',
  ],

  // Globals
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json',
    },
  },
};
```
