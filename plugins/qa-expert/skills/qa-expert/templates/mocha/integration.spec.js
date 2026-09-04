# Template: Integration Test with Mocha + Chai + Supertest

**When to Use**: Testing Express.js APIs, REST endpoints, database interactions, HTTP request/response cycles, middleware chains, and any integration between multiple system components.

**Complexity**: Medium

**Common Mistakes Agents Make**:
- Not properly closing database connections or server instances in `after` hooks
- Using shared test data that creates interdependencies between tests
- Not cleaning up database state between tests with `beforeEach`/`afterEach`
- Forgetting to use `return` with promises or `async/await` in tests
- Not properly handling async setup/teardown in hooks
- Testing in wrong order due to missing hook dependencies
- Not setting proper timeout values for slow operations (DB, external APIs)
- Leaving test database in dirty state affecting other tests
- Not using isolated test databases or transactions
- Hardcoding URLs instead of using environment variables

## Template

```javascript
/**
 * Integration test suite for {{APIName}} API
 *
 * Purpose: {{Brief description of API functionality}}
 *
 * Test Coverage:
 * - {{Endpoint 1}} operations
 * - {{Endpoint 2}} operations
 * - Authentication and authorization
 * - Error handling and validation
 * - Database integration
 */

const { expect } = require('chai');
const request = require('supertest');
const { {{DatabaseClient}} } = require('{{./path/to/db}}');
const app = require('{{./path/to/app}}');

describe('{{APIName}} API Integration Tests', function() {
  // Increase timeout for integration tests (database operations can be slow)
  this.timeout({{5000}});

  let {{dbConnection}};
  let {{testServer}};

  // Run once before all tests in this suite
  before(async function() {
    // Arrange: Set up database connection
    {{dbConnection}} = await {{DatabaseClient}}.connect({
      host: process.env.{{TEST_DB_HOST}} || 'localhost',
      port: process.env.{{TEST_DB_PORT}} || {{5432}},
      database: process.env.{{TEST_DB_NAME}} || '{{test_db}}',
      user: process.env.{{TEST_DB_USER}} || '{{testuser}}',
      password: process.env.{{TEST_DB_PASSWORD}} || '{{testpass}}'
    });

    // Optional: Start server if not auto-started
    // {{testServer}} = app.listen({{testPort}});
  });

  // Run once after all tests in this suite
  after(async function() {
    // Cleanup: Close database connection
    if ({{dbConnection}}) {
      await {{dbConnection}}.close();
    }

    // Optional: Stop server
    // if ({{testServer}}) {
    //   {{testServer}}.close();
    // }
  });

  // Run before each test
  beforeEach(async function() {
    // Arrange: Clean database or seed test data
    await {{dbConnection}}.query('DELETE FROM {{tableName}}');

    // Optional: Seed with test data
    await {{dbConnection}}.query(`
      INSERT INTO {{tableName}} ({{column1}}, {{column2}})
      VALUES ($1, $2)
    `, [{{testValue1}}, {{testValue2}}]);
  });

  // Run after each test
  afterEach(async function() {
    // Optional: Additional cleanup per test
    // await {{dbConnection}}.query('ROLLBACK');
  });

  describe('GET {{/api/endpoint}}', function() {
    it('should return all {{resources}}', async function() {
      // Arrange: Data seeded in beforeEach

      // Act: Make HTTP request
      const response = await request(app)
        .get('{{/api/endpoint}}')
        .set('Accept', 'application/json');

      // Assert: Verify response
      expect(response.status).to.equal({{200}});
      expect(response.body).to.be.an('array');
      expect(response.body).to.have.lengthOf({{expectedCount}});
      expect(response.headers['content-type']).to.include('application/json');
    });

    it('should return {{resource}} by ID', async function() {
      // Arrange
      const {{existingId}} = {{testId}};

      // Act
      const response = await request(app)
        .get(`{{/api/endpoint}}/${{{existingId}}}`)
        .set('Accept', 'application/json');

      // Assert
      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('object');
      expect(response.body).to.have.property('{{id}}', {{existingId}});
      expect(response.body).to.have.property('{{property}}');
    });

    it('should return 404 for non-existent {{resource}}', async function() {
      // Arrange
      const {{nonExistentId}} = {{invalidId}};

      // Act
      const response = await request(app)
        .get(`{{/api/endpoint}}/${{{nonExistentId}}}`)
        .set('Accept', 'application/json');

      // Assert
      expect(response.status).to.equal(404);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.include('{{not found}}');
    });

    describe('with query parameters', function() {
      it('should filter results by {{parameter}}', async function() {
        // Arrange
        const {{filterValue}} = {{testValue}};

        // Act
        const response = await request(app)
          .get('{{/api/endpoint}}')
          .query({ {{paramName}}: {{filterValue}} })
          .set('Accept', 'application/json');

        // Assert
        expect(response.status).to.equal(200);
        expect(response.body).to.be.an('array');
        response.body.forEach(item => {
          expect(item.{{paramName}}).to.equal({{filterValue}});
        });
      });

      it('should paginate results', async function() {
        // Arrange
        const page = {{1}};
        const limit = {{10}};

        // Act
        const response = await request(app)
          .get('{{/api/endpoint}}')
          .query({ page, limit })
          .set('Accept', 'application/json');

        // Assert
        expect(response.status).to.equal(200);
        expect(response.body.data).to.have.lengthOf.at.most(limit);
        expect(response.body).to.have.property('pagination');
        expect(response.body.pagination).to.include({ page, limit });
      });
    });
  });

  describe('POST {{/api/endpoint}}', function() {
    it('should create new {{resource}}', async function() {
      // Arrange
      const {{newResource}} = {
        {{property1}}: {{value1}},
        {{property2}}: {{value2}}
      };

      // Act
      const response = await request(app)
        .post('{{/api/endpoint}}')
        .send({{newResource}})
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json');

      // Assert
      expect(response.status).to.equal({{201}});
      expect(response.body).to.be.an('object');
      expect(response.body).to.have.property('{{id}}');
      expect(response.body.{{property1}}).to.equal({{newResource}}.{{property1}});

      // Verify in database
      const {{dbResult}} = await {{dbConnection}}.query(
        'SELECT * FROM {{tableName}} WHERE {{id}} = $1',
        [response.body.{{id}}]
      );
      expect({{dbResult}}.rows).to.have.lengthOf(1);
      expect({{dbResult}}.rows[0].{{property1}}).to.equal({{value1}});
    });

    describe('validation', function() {
      it('should return 400 for missing required fields', async function() {
        // Arrange
        const {{incompleteData}} = {
          {{property1}}: {{value1}}
          // Missing {{property2}}
        };

        // Act
        const response = await request(app)
          .post('{{/api/endpoint}}')
          .send({{incompleteData}})
          .set('Content-Type', 'application/json');

        // Assert
        expect(response.status).to.equal(400);
        expect(response.body).to.have.property('error');
        expect(response.body.error).to.include('{{property2}}');
      });

      it('should return 400 for invalid data types', async function() {
        // Arrange
        const {{invalidData}} = {
          {{property1}}: {{invalidTypeValue}},  // e.g., string instead of number
          {{property2}}: {{value2}}
        };

        // Act
        const response = await request(app)
          .post('{{/api/endpoint}}')
          .send({{invalidData}})
          .set('Content-Type', 'application/json');

        // Assert
        expect(response.status).to.equal(400);
        expect(response.body.error).to.match(/{{validation error pattern}}/);
      });
    });

    describe('with authentication', function() {
      let {{authToken}};

      beforeEach(async function() {
        // Arrange: Get auth token
        const {{loginResponse}} = await request(app)
          .post('{{/api/auth/login}}')
          .send({
            {{username}}: {{testUser}},
            {{password}}: {{testPassword}}
          });

        {{authToken}} = {{loginResponse}}.body.token;
      });

      it('should create {{resource}} with valid token', async function() {
        // Arrange
        const {{newResource}} = { {{property}}: {{value}} };

        // Act
        const response = await request(app)
          .post('{{/api/endpoint}}')
          .set('Authorization', `Bearer ${{{authToken}}}`)
          .send({{newResource}});

        // Assert
        expect(response.status).to.equal(201);
      });

      it('should return 401 without token', async function() {
        // Arrange
        const {{newResource}} = { {{property}}: {{value}} };

        // Act
        const response = await request(app)
          .post('{{/api/endpoint}}')
          .send({{newResource}});

        // Assert
        expect(response.status).to.equal(401);
      });
    });
  });

  describe('PUT {{/api/endpoint}}/:id', function() {
    it('should update existing {{resource}}', async function() {
      // Arrange
      const {{existingId}} = {{testId}};
      const {{updateData}} = {
        {{property1}}: {{newValue1}},
        {{property2}}: {{newValue2}}
      };

      // Act
      const response = await request(app)
        .put(`{{/api/endpoint}}/${{{existingId}}}`)
        .send({{updateData}})
        .set('Content-Type', 'application/json');

      // Assert
      expect(response.status).to.equal(200);
      expect(response.body.{{property1}}).to.equal({{newValue1}});

      // Verify in database
      const {{dbResult}} = await {{dbConnection}}.query(
        'SELECT * FROM {{tableName}} WHERE {{id}} = $1',
        [{{existingId}}]
      );
      expect({{dbResult}}.rows[0].{{property1}}).to.equal({{newValue1}});
    });

    it('should return 404 for non-existent {{resource}}', async function() {
      // Arrange
      const {{nonExistentId}} = {{invalidId}};
      const {{updateData}} = { {{property}}: {{value}} };

      // Act
      const response = await request(app)
        .put(`{{/api/endpoint}}/${{{nonExistentId}}}`)
        .send({{updateData}});

      // Assert
      expect(response.status).to.equal(404);
    });
  });

  describe('DELETE {{/api/endpoint}}/:id', function() {
    it('should delete {{resource}}', async function() {
      // Arrange
      const {{existingId}} = {{testId}};

      // Act
      const response = await request(app)
        .delete(`{{/api/endpoint}}/${{{existingId}}}`);

      // Assert
      expect(response.status).to.equal({{204}});

      // Verify deleted from database
      const {{dbResult}} = await {{dbConnection}}.query(
        'SELECT * FROM {{tableName}} WHERE {{id}} = $1',
        [{{existingId}}]
      );
      expect({{dbResult}}.rows).to.have.lengthOf(0);
    });

    it('should return 404 when deleting non-existent {{resource}}', async function() {
      // Arrange
      const {{nonExistentId}} = {{invalidId}};

      // Act
      const response = await request(app)
        .delete(`{{/api/endpoint}}/${{{nonExistentId}}}`);

      // Assert
      expect(response.status).to.equal(404);
    });
  });
});
```

## Adaptation Rules

- [ ] Replace `{{APIName}}` with your API name (PascalCase)
- [ ] Replace `{{/api/endpoint}}` with actual API endpoints
- [ ] Replace `{{DatabaseClient}}` with your DB client (pg, mysql2, mongodb)
- [ ] Update database connection parameters
- [ ] Replace `{{tableName}}`, `{{column}}` with actual schema
- [ ] Add authentication setup if endpoints require auth
- [ ] Adjust timeout values based on operation speed
- [ ] Update HTTP status codes to match your API responses
- [ ] Add more endpoints as needed
- [ ] Configure proper test database isolation
- [ ] Replace `{{resource}}`, `{{property}}` with actual domain terms

## Supertest Assertion Patterns

```javascript
// Status codes
expect(response.status).to.equal({{200}});
expect(response).to.have.status({{200}});

// Headers
expect(response.headers['content-type']).to.include('application/json');
expect(response).to.have.header('content-type', /json/);

// Body structure
expect(response.body).to.be.an('object');
expect(response.body).to.have.property('{{key}}');
expect(response.body.{{key}}).to.equal({{value}});

// Arrays in response
expect(response.body.{{array}}).to.be.an('array');
expect(response.body.{{array}}).to.have.lengthOf({{n}});

// Nested properties
expect(response.body).to.have.nested.property('{{nested.property}}');
```

## .mocharc.json Configuration for Integration Tests

```json
{
  "require": ["{{./test/setup.js}}"],
  "spec": ["{{test/integration/**/*.spec.js}}"],
  "timeout": {{10000}},
  "slow": {{5000}},
  "ui": "bdd",
  "reporter": "spec",
  "color": true,
  "bail": false,
  "recursive": true,
  "exit": true
}
```

## Test Database Setup Example

```javascript
// test/setup.js
const { Client } = require('pg');

before(async function() {
  this.timeout(30000);

  // Create test database
  const client = new Client({
    host: 'localhost',
    user: 'postgres',
    password: 'postgres'
  });

  await client.connect();
  await client.query('DROP DATABASE IF EXISTS test_db');
  await client.query('CREATE DATABASE test_db');
  await client.end();
});
```

## Related

- Template: @templates/mocha/basic-unit.spec.js (for unit tests)
- Template: @templates/mocha/async.spec.js (for async patterns)
- Template: @templates/mocha/mock.spec.js (for mocking dependencies)

## Example: User API Integration Tests

```javascript
const { expect } = require('chai');
const request = require('supertest');
const { Pool } = require('pg');
const app = require('../src/app');

describe('User API Integration Tests', function() {
  this.timeout(5000);

  let dbPool;

  before(async function() {
    dbPool = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'test_users_db',
      user: 'testuser',
      password: 'testpass'
    });
  });

  after(async function() {
    await dbPool.end();
  });

  beforeEach(async function() {
    await dbPool.query('DELETE FROM users');
    await dbPool.query(`
      INSERT INTO users (id, name, email)
      VALUES (1, 'Test User', 'test@example.com')
    `);
  });

  describe('GET /api/users', function() {
    it('should return all users', async function() {
      const response = await request(app)
        .get('/api/users')
        .set('Accept', 'application/json');

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
      expect(response.body).to.have.lengthOf(1);
      expect(response.body[0]).to.have.property('email', 'test@example.com');
    });

    it('should return user by ID', async function() {
      const response = await request(app)
        .get('/api/users/1')
        .set('Accept', 'application/json');

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('id', 1);
      expect(response.body).to.have.property('name', 'Test User');
    });
  });

  describe('POST /api/users', function() {
    it('should create new user', async function() {
      const newUser = {
        name: 'Jane Doe',
        email: 'jane@example.com'
      };

      const response = await request(app)
        .post('/api/users')
        .send(newUser)
        .set('Content-Type', 'application/json');

      expect(response.status).to.equal(201);
      expect(response.body).to.have.property('id');
      expect(response.body.name).to.equal('Jane Doe');

      const dbResult = await dbPool.query(
        'SELECT * FROM users WHERE email = $1',
        ['jane@example.com']
      );
      expect(dbResult.rows).to.have.lengthOf(1);
    });

    it('should return 400 for duplicate email', async function() {
      const duplicateUser = {
        name: 'Duplicate',
        email: 'test@example.com'
      };

      const response = await request(app)
        .post('/api/users')
        .send(duplicateUser);

      expect(response.status).to.equal(400);
      expect(response.body.error).to.include('email already exists');
    });
  });
});
```
