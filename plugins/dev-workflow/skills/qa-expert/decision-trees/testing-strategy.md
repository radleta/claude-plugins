# Testing Strategy Decision Tree

## When to Use This Tree

Use this tree when you need to decide **what types of tests to write and in what proportion** for your application. This is one of the most critical quality decisions and also one of the most frequently done wrong. The wrong testing strategy leads to slow test suites, brittle tests, and low confidence in deployments.

## The Core Question

**"What level of testing does this code need, and what's the optimal test distribution?"**

---

## The Decision Tree

```
Start: What are you testing?

├─ Pure business logic (no external dependencies, I/O, or state)?
│   │
│   ├─ Algorithmic logic, calculations, data transformations?
│   │   └─ → Unit Test (Jest, Pytest, JUnit)
│   │       Fast, isolated, high code coverage
│   │
│   └─ Pure functions with edge cases?
│       └─ → Property-Based Test (Hypothesis, fast-check)
│           Generates test cases automatically
│
├─ Component/module with external dependencies?
│   │
│   ├─ Database queries, API calls, file I/O?
│   │   │
│   │   ├─ Testing data access layer or repository?
│   │   │   └─ → Integration Test with Test Containers
│   │   │       Real database, isolated environment
│   │   │
│   │   └─ Testing service orchestration across boundaries?
│   │       └─ → Integration Test with real dependencies
│   │           Multiple components working together
│   │
│   └─ External service dependency (third-party API)?
│       └─ → Contract Test (Pact, Spring Cloud Contract)
│           Verify API contract without E2E tests
│
├─ Full user journey across system boundaries?
│   │
│   ├─ Critical business path (login, checkout, payment)?
│   │   └─ → E2E Test (Cypress, Playwright, Selenium)
│   │       Critical paths only, user perspective
│   │
│   └─ Happy path validation across microservices?
│       └─ → E2E Smoke Test (subset of critical flows)
│           Fast feedback on deployment
│
├─ UI component in isolation?
│   │
│   ├─ Component behavior, user interactions, accessibility?
│   │   └─ → Component Test (React Testing Library, Vue Test Utils)
│   │       Render component, simulate events, assert output
│   │
│   └─ Visual appearance, responsive design?
│       └─ → Visual Regression Test (Percy, Chromatic, BackstopJS)
│           Screenshot comparison, catches UI bugs
│
└─ Non-functional requirements?
    │
    ├─ Performance under load?
    │   └─ → Performance Test (k6, JMeter, Gatling)
    │       Load, stress, spike testing
    │
    ├─ Security vulnerabilities?
    │   └─ → Security Test (OWASP ZAP, Snyk, static analysis)
    │       Penetration testing, dependency scanning
    │
    └─ Type safety and correctness?
        └─ → Static Analysis (TypeScript, Mypy, ESLint)
            Catch errors at compile time
```

---

## Code Examples for Each Solution

### Solution 1: Unit Test (Pure Business Logic)

**When:** Pure functions, algorithmic logic, calculations, no I/O or dependencies

#### JavaScript/TypeScript with Jest

```typescript
// ✅ Perfect for unit testing pure logic
// src/utils/pricing.ts
export function calculateDiscount(price: number, discountPercent: number): number {
  if (price < 0 || discountPercent < 0 || discountPercent > 100) {
    throw new Error('Invalid input');
  }
  return price * (1 - discountPercent / 100);
}

export function calculateTax(subtotal: number, taxRate: number): number {
  return subtotal * taxRate;
}

export function calculateTotal(subtotal: number, taxRate: number, discountPercent: number): number {
  const discounted = calculateDiscount(subtotal, discountPercent);
  const tax = calculateTax(discounted, taxRate);
  return discounted + tax;
}

// src/utils/pricing.test.ts
import { calculateDiscount, calculateTax, calculateTotal } from './pricing';

describe('Pricing calculations', () => {
  describe('calculateDiscount', () => {
    it('applies 10% discount correctly', () => {
      expect(calculateDiscount(100, 10)).toBe(90);
    });

    it('applies 0% discount (returns original price)', () => {
      expect(calculateDiscount(100, 0)).toBe(100);
    });

    it('throws error for negative price', () => {
      expect(() => calculateDiscount(-100, 10)).toThrow('Invalid input');
    });

    it('throws error for discount > 100%', () => {
      expect(() => calculateDiscount(100, 150)).toThrow('Invalid input');
    });
  });

  describe('calculateTotal', () => {
    it('calculates total with discount and tax', () => {
      // $100 - 10% = $90, $90 + 8% tax = $97.20
      expect(calculateTotal(100, 0.08, 10)).toBeCloseTo(97.20);
    });

    it('handles zero discount', () => {
      // $100 + 8% tax = $108
      expect(calculateTotal(100, 0.08, 0)).toBeCloseTo(108);
    });
  });
});
```

#### Python with Pytest

```python
# ✅ Pure function testing in Python
# src/pricing.py
def calculate_discount(price: float, discount_percent: float) -> float:
    """Calculate price after applying discount percentage."""
    if price < 0 or discount_percent < 0 or discount_percent > 100:
        raise ValueError("Invalid input")
    return price * (1 - discount_percent / 100)

def calculate_total(subtotal: float, tax_rate: float, discount_percent: float) -> float:
    """Calculate final total with discount and tax."""
    discounted = calculate_discount(subtotal, discount_percent)
    tax = discounted * tax_rate
    return discounted + tax

# tests/test_pricing.py
import pytest
from src.pricing import calculate_discount, calculate_total

class TestPricing:
    def test_calculate_discount_applies_correctly(self):
        assert calculate_discount(100, 10) == 90

    def test_calculate_discount_zero_discount(self):
        assert calculate_discount(100, 0) == 100

    def test_calculate_discount_negative_price_raises_error(self):
        with pytest.raises(ValueError, match="Invalid input"):
            calculate_discount(-100, 10)

    @pytest.mark.parametrize("price,discount,expected", [
        (100, 10, 90),
        (50, 20, 40),
        (200, 50, 100),
    ])
    def test_calculate_discount_multiple_cases(self, price, discount, expected):
        assert calculate_discount(price, discount) == expected

    def test_calculate_total_with_discount_and_tax(self):
        # $100 - 10% = $90, $90 + 8% tax = $97.20
        result = calculate_total(100, 0.08, 10)
        assert abs(result - 97.20) < 0.01
```

#### Java with JUnit 5

```java
// ✅ Unit testing in Java
// src/main/java/com/example/PricingService.java
public class PricingService {
    public double calculateDiscount(double price, double discountPercent) {
        if (price < 0 || discountPercent < 0 || discountPercent > 100) {
            throw new IllegalArgumentException("Invalid input");
        }
        return price * (1 - discountPercent / 100);
    }

    public double calculateTotal(double subtotal, double taxRate, double discountPercent) {
        double discounted = calculateDiscount(subtotal, discountPercent);
        double tax = discounted * taxRate;
        return discounted + tax;
    }
}

// src/test/java/com/example/PricingServiceTest.java
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import static org.junit.jupiter.api.Assertions.*;

class PricingServiceTest {
    private final PricingService pricingService = new PricingService();

    @Test
    @DisplayName("Should apply 10% discount correctly")
    void testCalculateDiscountAppliesCorrectly() {
        assertEquals(90.0, pricingService.calculateDiscount(100, 10));
    }

    @Test
    @DisplayName("Should throw exception for negative price")
    void testCalculateDiscountNegativePrice() {
        assertThrows(IllegalArgumentException.class,
            () -> pricingService.calculateDiscount(-100, 10));
    }

    @ParameterizedTest
    @CsvSource({
        "100, 10, 90",
        "50, 20, 40",
        "200, 50, 100"
    })
    @DisplayName("Should calculate discount for multiple cases")
    void testCalculateDiscountMultipleCases(double price, double discount, double expected) {
        assertEquals(expected, pricingService.calculateDiscount(price, discount));
    }

    @Test
    @DisplayName("Should calculate total with discount and tax")
    void testCalculateTotal() {
        double result = pricingService.calculateTotal(100, 0.08, 10);
        assertEquals(97.20, result, 0.01);
    }
}
```

**Use unit tests for:** Pure functions, algorithms, calculations, data transformations, validation logic, formatters, parsers

**Characteristics:**
- **Fast**: Thousands run in seconds
- **Isolated**: No external dependencies
- **Reliable**: No flakiness from network/database
- **High coverage**: Easy to achieve 90%+ coverage

---

### Solution 2: Integration Test (Service + Database)

**When:** Testing data access layer, repositories, service orchestration across boundaries

#### Node.js with Test Containers (PostgreSQL)

```typescript
// ✅ Integration test with real database
// src/repositories/UserRepository.ts
import { Pool } from 'pg';

export class UserRepository {
  constructor(private pool: Pool) {}

  async createUser(email: string, name: string): Promise<{ id: number; email: string; name: string }> {
    const result = await this.pool.query(
      'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *',
      [email, name]
    );
    return result.rows[0];
  }

  async getUserByEmail(email: string): Promise<{ id: number; email: string; name: string } | null> {
    const result = await this.pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] || null;
  }
}

// src/repositories/UserRepository.integration.test.ts
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { Pool } from 'pg';
import { UserRepository } from './UserRepository';

describe('UserRepository Integration Tests', () => {
  let container: StartedTestContainer;
  let pool: Pool;
  let repository: UserRepository;

  beforeAll(async () => {
    // Start real PostgreSQL container
    container = await new GenericContainer('postgres:15')
      .withEnvironment({ POSTGRES_PASSWORD: 'test' })
      .withExposedPorts(5432)
      .start();

    pool = new Pool({
      host: container.getHost(),
      port: container.getMappedPort(5432),
      database: 'postgres',
      user: 'postgres',
      password: 'test',
    });

    // Create schema
    await pool.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL
      )
    `);

    repository = new UserRepository(pool);
  }, 60000); // 60s timeout for container startup

  afterAll(async () => {
    await pool.end();
    await container.stop();
  });

  afterEach(async () => {
    // Clean up data between tests
    await pool.query('TRUNCATE users RESTART IDENTITY');
  });

  it('should create user and retrieve by email', async () => {
    // Create user
    const created = await repository.createUser('test@example.com', 'Test User');
    expect(created.email).toBe('test@example.com');
    expect(created.name).toBe('Test User');
    expect(created.id).toBeDefined();

    // Retrieve user
    const retrieved = await repository.getUserByEmail('test@example.com');
    expect(retrieved).toEqual(created);
  });

  it('should return null for non-existent user', async () => {
    const user = await repository.getUserByEmail('nonexistent@example.com');
    expect(user).toBeNull();
  });

  it('should enforce unique email constraint', async () => {
    await repository.createUser('test@example.com', 'User 1');

    await expect(
      repository.createUser('test@example.com', 'User 2')
    ).rejects.toThrow();
  });
});
```

#### Python with Pytest and Docker

```python
# ✅ Integration test with real database in Python
# tests/integration/test_user_repository.py
import pytest
import psycopg2
from testcontainers.postgres import PostgresContainer
from src.repositories.user_repository import UserRepository

@pytest.fixture(scope="module")
def postgres_container():
    """Start PostgreSQL container for tests."""
    with PostgresContainer("postgres:15") as postgres:
        connection = psycopg2.connect(postgres.get_connection_url())
        cursor = connection.cursor()

        # Create schema
        cursor.execute("""
            CREATE TABLE users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL
            )
        """)
        connection.commit()

        yield connection

        connection.close()

@pytest.fixture
def repository(postgres_container):
    """Create repository with test database connection."""
    return UserRepository(postgres_container)

@pytest.fixture(autouse=True)
def cleanup(postgres_container):
    """Clean up data between tests."""
    yield
    cursor = postgres_container.cursor()
    cursor.execute("TRUNCATE users RESTART IDENTITY")
    postgres_container.commit()

class TestUserRepositoryIntegration:
    def test_create_and_retrieve_user(self, repository):
        # Create user
        created = repository.create_user("test@example.com", "Test User")
        assert created["email"] == "test@example.com"
        assert created["name"] == "Test User"
        assert created["id"] is not None

        # Retrieve user
        retrieved = repository.get_user_by_email("test@example.com")
        assert retrieved == created

    def test_get_nonexistent_user_returns_none(self, repository):
        user = repository.get_user_by_email("nonexistent@example.com")
        assert user is None

    def test_unique_email_constraint(self, repository):
        repository.create_user("test@example.com", "User 1")

        with pytest.raises(Exception):  # psycopg2.IntegrityError
            repository.create_user("test@example.com", "User 2")
```

**Use integration tests for:** Repositories, data access layers, service-to-service communication, API clients, message queues

**Characteristics:**
- **Medium speed**: Slower than unit tests, faster than E2E
- **Real dependencies**: Uses actual database, message broker, etc.
- **Isolated**: Test containers provide clean environment
- **High confidence**: Tests actual integration points

---

### Solution 3: E2E Test (Full User Journey)

**When:** Testing critical business paths from user perspective (login, checkout, payment)

#### Playwright (Modern E2E framework)

```typescript
// ✅ E2E test for critical user journey
// tests/e2e/checkout.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Checkout Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to application
    await page.goto('http://localhost:3000');

    // Login
    await page.click('text=Login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Wait for successful login
    await expect(page.locator('text=Welcome')).toBeVisible();
  });

  test('should complete full checkout process', async ({ page }) => {
    // Add item to cart
    await page.goto('http://localhost:3000/products/123');
    await page.click('button:has-text("Add to Cart")');
    await expect(page.locator('.cart-count')).toHaveText('1');

    // Go to cart
    await page.click('.cart-icon');
    await expect(page).toHaveURL(/.*\/cart/);
    await expect(page.locator('.cart-item')).toHaveCount(1);

    // Proceed to checkout
    await page.click('button:has-text("Checkout")');
    await expect(page).toHaveURL(/.*\/checkout/);

    // Fill shipping information
    await page.fill('input[name="address"]', '123 Main St');
    await page.fill('input[name="city"]', 'San Francisco');
    await page.fill('input[name="zipCode"]', '94102');
    await page.click('button:has-text("Continue to Payment")');

    // Fill payment information
    await page.fill('input[name="cardNumber"]', '4242424242424242');
    await page.fill('input[name="expiry"]', '12/25');
    await page.fill('input[name="cvv"]', '123');

    // Submit order
    await page.click('button:has-text("Place Order")');

    // Verify success
    await expect(page).toHaveURL(/.*\/order-confirmation/);
    await expect(page.locator('h1')).toContainText('Order Confirmed');
    await expect(page.locator('.order-number')).toBeVisible();
  });

  test('should show validation errors for invalid payment', async ({ page }) => {
    await page.goto('http://localhost:3000/checkout');

    // Try to submit with invalid card
    await page.fill('input[name="cardNumber"]', '1234');
    await page.click('button:has-text("Place Order")');

    // Verify error message
    await expect(page.locator('.error-message')).toContainText('Invalid card number');
  });

  test('should persist cart across page refreshes', async ({ page }) => {
    // Add item to cart
    await page.goto('http://localhost:3000/products/123');
    await page.click('button:has-text("Add to Cart")');

    // Refresh page
    await page.reload();

    // Verify cart still has item
    await expect(page.locator('.cart-count')).toHaveText('1');
  });
});
```

#### Cypress (Alternative E2E framework)

```typescript
// ✅ Cypress E2E test
// cypress/e2e/authentication.cy.ts
describe('Authentication Flow', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000');
  });

  it('should allow user to login with valid credentials', () => {
    // Click login button
    cy.contains('Login').click();

    // Fill login form
    cy.get('input[name="email"]').type('test@example.com');
    cy.get('input[name="password"]').type('password123');
    cy.get('button[type="submit"]').click();

    // Verify successful login
    cy.url().should('include', '/dashboard');
    cy.contains('Welcome, Test User').should('be.visible');
  });

  it('should show error for invalid credentials', () => {
    cy.contains('Login').click();

    cy.get('input[name="email"]').type('wrong@example.com');
    cy.get('input[name="password"]').type('wrongpassword');
    cy.get('button[type="submit"]').click();

    // Verify error message
    cy.contains('Invalid email or password').should('be.visible');
    cy.url().should('include', '/login');
  });

  it('should allow user to logout', () => {
    // Login first
    cy.login('test@example.com', 'password123'); // Custom command

    // Logout
    cy.get('[data-testid="user-menu"]').click();
    cy.contains('Logout').click();

    // Verify logged out
    cy.url().should('eq', 'http://localhost:3000/');
    cy.contains('Login').should('be.visible');
  });
});

// cypress/support/commands.ts
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.session([email, password], () => {
    cy.visit('http://localhost:3000/login');
    cy.get('input[name="email"]').type(email);
    cy.get('input[name="password"]').type(password);
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/dashboard');
  });
});
```

**Use E2E tests for:** Critical user journeys, authentication flows, checkout processes, payment flows, core business functionality

**Characteristics:**
- **Slow**: Takes minutes to run full suite
- **Brittle**: Can break with UI changes
- **High confidence**: Tests from user perspective
- **Critical paths only**: 5-15% of total tests

---

### Solution 4: Contract Test (Service-to-Service)

**When:** Testing API contracts between microservices without full E2E tests

#### Pact (Consumer-Driven Contract Testing)

```typescript
// ✅ Consumer-side contract test (frontend testing API contract)
// tests/contract/user-api.pact.test.ts
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import { UserApiClient } from '../../src/clients/UserApiClient';

const { like, eachLike } = MatchersV3;

describe('User API Contract', () => {
  const provider = new PactV3({
    consumer: 'frontend-app',
    provider: 'user-api',
  });

  it('should return user by ID', async () => {
    await provider
      .given('user with ID 123 exists')
      .uponReceiving('a request for user 123')
      .withRequest({
        method: 'GET',
        path: '/api/users/123',
        headers: {
          'Accept': 'application/json',
        },
      })
      .willRespondWith({
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
        body: like({
          id: 123,
          email: 'user@example.com',
          name: 'Test User',
          createdAt: '2024-01-01T00:00:00Z',
        }),
      })
      .executeTest(async (mockServer) => {
        const client = new UserApiClient(mockServer.url);
        const user = await client.getUserById(123);

        expect(user.id).toBe(123);
        expect(user.email).toBe('user@example.com');
        expect(user.name).toBe('Test User');
      });
  });

  it('should return 404 for non-existent user', async () => {
    await provider
      .given('user with ID 999 does not exist')
      .uponReceiving('a request for non-existent user 999')
      .withRequest({
        method: 'GET',
        path: '/api/users/999',
      })
      .willRespondWith({
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          error: 'User not found',
        },
      })
      .executeTest(async (mockServer) => {
        const client = new UserApiClient(mockServer.url);

        await expect(client.getUserById(999)).rejects.toThrow('User not found');
      });
  });

  it('should create user with valid data', async () => {
    await provider
      .given('no user with email test@example.com exists')
      .uponReceiving('a request to create user')
      .withRequest({
        method: 'POST',
        path: '/api/users',
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          email: 'test@example.com',
          name: 'New User',
        },
      })
      .willRespondWith({
        status: 201,
        body: like({
          id: 456,
          email: 'test@example.com',
          name: 'New User',
          createdAt: '2024-01-01T00:00:00Z',
        }),
      })
      .executeTest(async (mockServer) => {
        const client = new UserApiClient(mockServer.url);
        const user = await client.createUser('test@example.com', 'New User');

        expect(user.id).toBeDefined();
        expect(user.email).toBe('test@example.com');
      });
  });
});
```

**Use contract tests for:** Microservice communication, third-party API integration, service boundaries

**Characteristics:**
- **Fast**: Faster than E2E, uses mock server
- **Focused**: Tests contract, not implementation
- **Prevents breaking changes**: Catches incompatibilities early
- **Independent testing**: No need to run all services

---

## Antipatterns: Common Wrong Choices

### Antipattern 1: Testing Diamond (Too Many E2E Tests)

❌ **Wrong: Inverting the test pyramid**

```
Distribution:
- 70% E2E tests (slow, brittle, expensive)
- 20% integration tests
- 10% unit tests
```

**Problems:**
- Test suite takes 2+ hours to run
- Frequent flaky test failures
- Expensive CI infrastructure
- Developers skip running tests locally
- Slow feedback loop kills productivity

✅ **Right: Test Pyramid**

```
Distribution:
- 70% unit tests (fast, reliable)
- 20% integration tests
- 10% E2E tests (critical paths only)
```

**Benefits:**
- Test suite runs in minutes
- Fast feedback on every commit
- High confidence with low cost
- Developers run tests frequently

---

### Antipattern 2: Testing Only Happy Paths

❌ **Wrong: Ignoring error cases**

```typescript
// Only testing success case
describe('User registration', () => {
  it('should register user successfully', async () => {
    const user = await register('test@example.com', 'password');
    expect(user).toBeDefined();
  });

  // Missing: validation errors, duplicate emails, weak passwords, etc.
});
```

✅ **Right: Test error paths thoroughly**

```typescript
describe('User registration', () => {
  it('should register user with valid data', async () => {
    const user = await register('test@example.com', 'SecurePass123!');
    expect(user.email).toBe('test@example.com');
  });

  it('should reject invalid email format', async () => {
    await expect(register('invalid-email', 'password')).rejects.toThrow('Invalid email');
  });

  it('should reject weak password', async () => {
    await expect(register('test@example.com', '123')).rejects.toThrow('Password too weak');
  });

  it('should reject duplicate email', async () => {
    await register('test@example.com', 'password');
    await expect(register('test@example.com', 'password')).rejects.toThrow('Email already exists');
  });

  it('should handle database connection failure', async () => {
    // Simulate DB failure
    mockDb.connect.mockRejectedValue(new Error('Connection failed'));
    await expect(register('test@example.com', 'password')).rejects.toThrow('Service unavailable');
  });
});
```

**Error paths to test:**
- Invalid input validation
- Boundary conditions (min/max values)
- Duplicate/conflict scenarios
- Network/database failures
- Timeout scenarios
- Permission/authorization failures

---

### Antipattern 3: Not Testing at the Right Level

❌ **Wrong: E2E test for business logic**

```typescript
// Testing calculation logic through UI (slow, brittle)
it('should calculate discount correctly', async () => {
  await page.goto('/cart');
  await page.fill('[data-testid="discount-code"]', 'SAVE10');
  await page.click('button:has-text("Apply")');

  const total = await page.textContent('[data-testid="total"]');
  expect(total).toBe('$90.00'); // Testing $100 - 10%
});
```

✅ **Right: Unit test for business logic**

```typescript
// Testing calculation directly (fast, reliable)
it('should calculate discount correctly', () => {
  const result = calculateDiscount(100, 10);
  expect(result).toBe(90);
});

// E2E only tests the integration
it('should apply discount through UI', async () => {
  await page.goto('/cart');
  await page.fill('[data-testid="discount-code"]', 'SAVE10');
  await page.click('button:has-text("Apply")');

  // Just verify discount was applied, not the exact calculation
  await expect(page.locator('[data-testid="discount-applied"]')).toBeVisible();
});
```

**Test at the right level:**
- **Unit**: Business logic, calculations, validation
- **Integration**: Data access, service orchestration
- **E2E**: User journeys, critical flows

---

### Antipattern 4: Mocking Everything (Unit Test Hell)

❌ **Wrong: Over-mocking makes tests meaningless**

```typescript
// Mocking everything, testing nothing
it('should create order', async () => {
  const mockUserRepo = { findById: jest.fn().mockResolvedValue({ id: 1 }) };
  const mockProductRepo = { findById: jest.fn().mockResolvedValue({ id: 1, price: 100 }) };
  const mockOrderRepo = { create: jest.fn().mockResolvedValue({ id: 1 }) };
  const mockPaymentService = { charge: jest.fn().mockResolvedValue({ success: true }) };
  const mockEmailService = { send: jest.fn().mockResolvedValue(true) };

  const service = new OrderService(
    mockUserRepo,
    mockProductRepo,
    mockOrderRepo,
    mockPaymentService,
    mockEmailService
  );

  const order = await service.createOrder(1, 1);

  expect(order.id).toBe(1); // This test tells us nothing!
});
```

✅ **Right: Use integration tests when testing integration**

```typescript
// Integration test with real dependencies (Test Containers)
it('should create order with real database and payment service', async () => {
  // Use real database (Test Container)
  const user = await userRepo.create({ email: 'test@example.com' });
  const product = await productRepo.create({ name: 'Widget', price: 100 });

  // Use real or staging payment API
  const order = await orderService.createOrder(user.id, product.id);

  // Verify in database
  const savedOrder = await orderRepo.findById(order.id);
  expect(savedOrder.userId).toBe(user.id);
  expect(savedOrder.productId).toBe(product.id);
  expect(savedOrder.status).toBe('confirmed');
});
```

**When to mock vs use real dependencies:**
- **Mock**: External APIs (third-party), slow operations, unreliable services
- **Real**: Database (with Test Containers), internal services, file system

---

## Test Distribution Recommendations

### Strategy 1: Testing Pyramid (Traditional)

**Originated by:** Mike Cohn (2009) - "Succeeding with Agile"

```
        /\
       /  \      10% E2E
      /----\
     /      \    20% Integration
    /--------\
   /          \  70% Unit
  /____________\
```

**Distribution:**
- **70% Unit Tests**: Pure business logic, calculations, validation
- **20% Integration Tests**: Database, API clients, service boundaries
- **10% E2E Tests**: Critical user journeys only

**Best for:**
- Backend services with lots of business logic
- APIs with complex domain models
- Systems with well-defined service boundaries

**Example application:**
```
Total: 1000 tests
- 700 unit tests (run in 30 seconds)
- 200 integration tests (run in 3 minutes)
- 100 E2E tests (run in 15 minutes)

Total suite time: ~20 minutes
```

---

### Strategy 2: Testing Trophy (Frontend)

**Originated by:** Kent C. Dodds - "Write tests. Not too many. Mostly integration."

```
      ___
     /   \     15% E2E
    /     \
   /       \   60% Integration (Component Tests)
  /         \
 /           \  20% Unit
/_____________\ 5% Static Analysis
```

**Distribution:**
- **5% Static Analysis**: TypeScript, ESLint, type checking
- **20% Unit Tests**: Utilities, helpers, pure functions
- **60% Integration Tests**: Component tests with React Testing Library
- **15% E2E Tests**: Critical user flows

**Best for:**
- Frontend applications (React, Vue, Angular)
- UI-heavy applications
- Applications where integration points are most critical

**Example application:**
```
Total: 500 tests
- 25 static checks (compile time)
- 100 unit tests (run in 10 seconds)
- 300 component tests (run in 2 minutes)
- 75 E2E tests (run in 10 minutes)

Total suite time: ~12 minutes
```

---

### Strategy 3: Testing Diamond (Microservices)

**For:** Distributed systems, microservices architectures

```
        /\
       /  \      10% E2E (full system)
      /----\
     /      \    20% Contract Tests (service boundaries)
    /--------\
   /          \  30% Integration (within service)
  /____________\ 40% Unit
```

**Distribution:**
- **40% Unit Tests**: Business logic within each service
- **30% Integration Tests**: Database, message queues, within service
- **20% Contract Tests**: API contracts between services (Pact)
- **10% E2E Tests**: End-to-end smoke tests

**Best for:**
- Microservices architectures
- Distributed systems
- Systems with multiple teams/services

**Example application:**
```
Total: 2000 tests across 10 services
- 800 unit tests (30 sec per service)
- 600 integration tests (2 min per service)
- 400 contract tests (1 min total)
- 200 E2E tests (20 min total)

Per service: ~3 minutes
Full suite: ~25 minutes
```

---

## When to Adjust the Strategy

### When to Increase E2E Tests

**Increase E2E proportion (15-20%) when:**
- Regulatory requirements demand full system validation
- Critical business functions (payments, healthcare, finance)
- Frequent regressions in user journeys
- Lack of confidence in deployment

**Example:** E-commerce checkout, banking transactions, healthcare workflows

---

### When to Increase Integration Tests

**Increase integration proportion (40-50%) when:**
- Complex data access patterns
- Heavy database logic
- Service orchestration is primary concern
- Testing actual SQL queries is critical

**Example:** Data-heavy applications, ETL pipelines, reporting systems

---

### When to Increase Unit Tests

**Increase unit proportion (80-90%) when:**
- Algorithm-heavy code
- Complex calculations
- Minimal external dependencies
- Pure functional programming style

**Example:** Scientific computing, game engines, compilers, parsers

---

### When to Add Contract Tests

**Add contract tests (20-30%) when:**
- Microservices architecture
- Multiple teams own different services
- API breaking changes are frequent
- Need to test service boundaries independently

**Example:** Large organizations with 10+ services, third-party integrations

---

## Performance Targets by Test Type

| Test Type | Speed Target | Acceptable Failure Rate | Cost |
|-----------|--------------|-------------------------|------|
| Unit | < 1ms per test | < 0.1% (near zero) | Very Low |
| Integration | 100-500ms per test | < 1% | Low |
| Contract | 50-200ms per test | < 1% | Low |
| E2E | 10-60s per test | < 5% (some flakiness OK) | High |
| Visual | 2-5s per screenshot | < 2% | Medium |

**Test suite targets:**
- **Commit stage**: < 10 minutes (unit + integration)
- **Pre-merge**: < 30 minutes (+ contract tests)
- **Full suite**: < 60 minutes (+ E2E tests)

---

## Sources and Further Reading

### Testing Pyramid
- **Mike Cohn** - "Succeeding with Agile" (2009)
- Martin Fowler - "TestPyramid" (https://martinfowler.com/bliki/TestPyramid.html)

### Testing Trophy
- **Kent C. Dodds** - "Write tests. Not too many. Mostly integration."
- Static Analysis → Unit → Integration → E2E
- https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications

### Testing Diamond (Anti-pattern)
- Google Testing Blog - "Just Say No to More End-to-End Tests"
- Too many E2E tests creates an inverted pyramid (diamond shape)

### Test Containers
- https://www.testcontainers.org/
- Lightweight, throwaway instances for integration testing

### Contract Testing
- **Pact** - https://pact.io/
- Consumer-driven contract testing for microservices

### General Testing Practices
- Google Testing Blog - https://testing.googleblog.com/
- Martin Fowler - Testing Guide - https://martinfowler.com/testing/
- "Growing Object-Oriented Software, Guided by Tests" - Steve Freeman, Nat Pryce

---

## See Also

- `@decision-trees/test-type-selection.md` - When to use mocks vs real dependencies
- `@rules/test-naming-conventions.md` - How to name tests clearly
- `@templates/unit-test-template.ts` - Unit test template
- `@templates/integration-test-template.ts` - Integration test with Test Containers
- `@templates/e2e-test-template.ts` - E2E test with Playwright
