# Test Data Management Rules

Test data quality directly impacts test maintainability, readability, and reliability. Poor test data practices lead to two critical anti-patterns: **Hard-Coded Test Data** (magic numbers and strings that obscure test intent) and **General Fixture** (shared setup containing data not needed by all tests). Well-managed test data makes tests self-documenting, isolated, and resilient to change.

**The golden rule**: Test data should reveal intent, not obscure it. Every test should create exactly the data it needs, with names and values that explain why they matter.

---

## Rule 1: Avoid Magic Numbers and Strings

**Statement**: Never use unexplained literal values in test assertions or setup. Always use named constants or descriptive variables that reveal the value's significance.

### Why This Matters

Hard-coded values like `42`, `"abc123"`, or `true` don't communicate intent. When a test fails, developers waste time figuring out what these values represent and why they were chosen. Magic values create **Obscure Tests** that are difficult to understand and maintain.

**Key insight**: Test data should be self-documenting. A reader should understand both what the test does and why specific values matter.

### ❌ WRONG: Magic Numbers in Assertions

```typescript
describe('UserValidator', () => {
  it('validates user age', () => {
    const user = { name: 'Alice', age: 42 };

    // WRONG: Why 42? What makes this valid?
    expect(validator.isValid(user)).toBe(true);
  });

  it('rejects invalid age', () => {
    const user = { name: 'Bob', age: 15 };

    // WRONG: Why is 15 invalid? What's the threshold?
    expect(validator.isValid(user)).toBe(false);
  });
});
```

**What breaks**:
- No explanation for why 42 is valid
- No indication of what rule 15 violates
- Future maintainer must read implementation to understand
- **Symptom**: Tests that document "what" but not "why"

### ❌ WRONG: Magic Strings in Setup

```python
def test_order_processing():
    # WRONG: What do these status codes mean?
    order = Order(status="PND", priority="H")

    result = process_order(order)

    # WRONG: Why "CMP"? What does it represent?
    assert result.status == "CMP"
```

**What breaks**:
- Cryptic abbreviations obscure meaning
- Reader must decode "PND", "H", "CMP"
- No indication of business logic
- **Symptom**: Tests require constant reference to documentation

### ✅ CORRECT: Named Constants Reveal Intent

```typescript
describe('UserValidator', () => {
  const MINIMUM_AGE = 18;
  const ADULT_AGE = 25;
  const MINOR_AGE = 15;

  it('validates adult users', () => {
    const user = { name: 'Alice', age: ADULT_AGE };

    expect(validator.isValid(user)).toBe(true);
  });

  it('rejects users below minimum age', () => {
    const user = { name: 'Bob', age: MINOR_AGE };

    expect(validator.isValid(user)).toBe(false);
    expect(validator.getError()).toContain(`minimum age is ${MINIMUM_AGE}`);
  });
});
```

**Why this works**: Constants make the rule explicit (18 is minimum). Test intent is clear without reading implementation.

### ✅ CORRECT: Descriptive Variables Explain Values

```python
def test_order_processing():
    STATUS_PENDING = "PND"
    STATUS_COMPLETE = "CMP"
    PRIORITY_HIGH = "H"

    order = Order(status=STATUS_PENDING, priority=PRIORITY_HIGH)

    result = process_order(order)

    assert result.status == STATUS_COMPLETE
```

**Why this works**: Variable names document the meaning of cryptic codes. Self-documenting test.

### ✅ CORRECT: Intent-Revealing Test Data

```java
@Test
public void calculatesDiscountForLoyaltyMember() {
    // Values chosen to demonstrate loyalty discount threshold
    final int LOYALTY_TIER_THRESHOLD = 100;
    final int POINTS_ABOVE_THRESHOLD = 150;
    final double EXPECTED_DISCOUNT_PERCENT = 0.15;

    User member = new User(loyaltyPoints: POINTS_ABOVE_THRESHOLD);

    double discount = discountCalculator.calculate(member);

    assertEquals(EXPECTED_DISCOUNT_PERCENT, discount, 0.001);
}
```

**Why this works**: Every value has a name explaining its role. Reader understands the business rule (100 points triggers 15% discount) without reading code.

---

## Rule 2: Use Test Data Builders and Factories

**Statement**: Create reusable patterns for generating test objects with sensible defaults and fluent APIs for customization. Use **Object Mother**, **Builder**, or **Factory** patterns to avoid excessive setup and test data duplication.

### Why This Matters

Tests often need similar-but-not-identical objects. Copy-pasting setup creates **Test Code Duplication** and **Excessive Setup** anti-patterns. Test data builders provide defaults for the common case while allowing easy customization for specific scenarios.

### Test Data Pattern Comparison

| Pattern | Purpose | When to Use | Pros | Cons |
|---------|---------|-------------|------|------|
| **Object Mother** | Preconfigured test objects | Need standard test objects (validUser, adminUser) | Simple, self-documenting | Can proliferate into many methods |
| **Builder** | Fluent API for object creation | Need variations on similar objects | Flexible, readable chains | More code upfront |
| **Factory** | Create objects with defaults | Simple objects with optional overrides | Minimal code, easy to use | Less discoverable than builders |

### ❌ WRONG: Duplicated Setup Everywhere

```typescript
describe('OrderService', () => {
  it('processes standard order', () => {
    // WRONG: Full setup duplicated in every test
    const user = {
      id: 'user-123',
      name: 'Alice Smith',
      email: 'alice@example.com',
      address: {
        street: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zip: '97201'
      },
      paymentMethod: {
        type: 'credit_card',
        last4: '4242'
      }
    };

    const order = {
      id: 'order-456',
      user: user,
      items: [{ sku: 'WIDGET', quantity: 2, price: 29.99 }],
      total: 59.98
    };

    const result = orderService.process(order);
    expect(result.status).toBe('confirmed');
  });

  it('handles international shipping', () => {
    // WRONG: Copy-paste the same setup, change one field
    const user = {
      id: 'user-123',
      name: 'Alice Smith',
      email: 'alice@example.com',
      address: {
        street: '123 Main St',
        city: 'Toronto',      // Only this changes
        state: 'ON',          // And this
        zip: 'M5H 2N2'        // And this
      },
      paymentMethod: {
        type: 'credit_card',
        last4: '4242'
      }
    };

    const order = {
      id: 'order-456',
      user: user,
      items: [{ sku: 'WIDGET', quantity: 2, price: 29.99 }],
      total: 59.98
    };

    const result = orderService.process(order);
    expect(result.shippingMethod).toBe('international');
  });
});
```

**What breaks**:
- **Test Code Duplication**: Same setup repeated with minor variations
- **Excessive Setup**: Hundreds of lines obscure the actual test
- **Maintenance nightmare**: Change user structure → update 20 tests
- **Obscure intent**: Hard to see what's different between tests
- **Symptom**: Copy-paste programming in tests

### ✅ CORRECT: Object Mother Pattern

```typescript
// test/fixtures/users.ts
class TestUsers {
  static validUser(): User {
    return {
      id: 'user-123',
      name: 'Alice Smith',
      email: 'alice@example.com',
      address: {
        street: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zip: '97201'
      },
      paymentMethod: {
        type: 'credit_card',
        last4: '4242'
      }
    };
  }

  static internationalUser(): User {
    return {
      ...this.validUser(),
      address: {
        street: '123 Main St',
        city: 'Toronto',
        state: 'ON',
        zip: 'M5H 2N2'
      }
    };
  }

  static adminUser(): User {
    return {
      ...this.validUser(),
      role: 'admin',
      permissions: ['read', 'write', 'delete']
    };
  }
}

// test/orderService.test.ts
describe('OrderService', () => {
  it('processes standard order', () => {
    const order = { user: TestUsers.validUser(), items: [...] };

    const result = orderService.process(order);
    expect(result.status).toBe('confirmed');
  });

  it('handles international shipping', () => {
    const order = { user: TestUsers.internationalUser(), items: [...] };

    const result = orderService.process(order);
    expect(result.shippingMethod).toBe('international');
  });
});
```

**Why this works**: Named methods create standard test objects. Intent is clear (internationalUser). Changes to user structure happen in one place.

### ✅ CORRECT: Builder Pattern

```typescript
// test/builders/userBuilder.ts
class UserBuilder {
  private user: User = {
    id: 'user-123',
    name: 'Default User',
    email: 'user@example.com',
    address: {
      street: '123 Main St',
      city: 'Portland',
      state: 'OR',
      zip: '97201'
    }
  };

  withId(id: string): UserBuilder {
    this.user.id = id;
    return this;
  }

  withName(name: string): UserBuilder {
    this.user.name = name;
    return this;
  }

  withAddress(address: Partial<Address>): UserBuilder {
    this.user.address = { ...this.user.address, ...address };
    return this;
  }

  asAdmin(): UserBuilder {
    this.user.role = 'admin';
    this.user.permissions = ['read', 'write', 'delete'];
    return this;
  }

  build(): User {
    return this.user;
  }
}

// test/orderService.test.ts
describe('OrderService', () => {
  it('processes order from international user', () => {
    const user = new UserBuilder()
      .withAddress({ city: 'Toronto', state: 'ON', zip: 'M5H 2N2' })
      .build();

    const order = { user, items: [...] };

    const result = orderService.process(order);
    expect(result.shippingMethod).toBe('international');
  });

  it('applies admin discount', () => {
    const admin = new UserBuilder()
      .withName('Admin Alice')
      .asAdmin()
      .build();

    const order = { user: admin, items: [...] };

    const result = orderService.process(order);
    expect(result.discount).toBeGreaterThan(0);
  });
});
```

**Why this works**: Fluent API reads naturally. Only specify what matters for each test. Defaults handle the rest.

### ✅ CORRECT: Factory Pattern

```python
# test/factories.py
class UserFactory:
    @staticmethod
    def create(**overrides):
        defaults = {
            'id': 'user-123',
            'name': 'Alice Smith',
            'email': 'alice@example.com',
            'address': {
                'street': '123 Main St',
                'city': 'Portland',
                'state': 'OR',
                'zip': '97201'
            }
        }
        return User(**{**defaults, **overrides})

# test/test_order_service.py
def test_processes_international_order():
    user = UserFactory.create(
        address={'city': 'Toronto', 'state': 'ON', 'zip': 'M5H 2N2'}
    )
    order = Order(user=user, items=[...])

    result = order_service.process(order)

    assert result.shipping_method == 'international'

def test_applies_loyalty_discount():
    loyal_user = UserFactory.create(loyalty_points=500)
    order = Order(user=loyal_user, items=[...])

    result = order_service.process(order)

    assert result.discount > 0
```

**Why this works**: Minimal factory code. Override only what matters. Reads like documentation.

### Framework-Specific Builders

**Jest / JavaScript**:
```javascript
// Use plain functions or classes
const createUser = (overrides = {}) => ({
  id: 'user-123',
  name: 'Alice',
  ...overrides
});

test('processes order', () => {
  const user = createUser({ loyaltyPoints: 500 });
  // ...
});
```

**Pytest / Python**:
```python
# Use pytest fixtures with parameters
@pytest.fixture
def user(request):
    defaults = {'id': 'user-123', 'name': 'Alice'}
    overrides = getattr(request, 'param', {})
    return User(**{**defaults, **overrides})

def test_order(user):
    # user has defaults
    pass

@pytest.mark.parametrize('user', [{'loyalty_points': 500}], indirect=True)
def test_loyal_customer(user):
    # user has loyalty_points=500
    pass
```

**JUnit / Java**:
```java
// Use builder pattern
public class UserTestBuilder {
    private User user = new User();

    public UserTestBuilder withDefaults() {
        user.setId("user-123");
        user.setName("Alice");
        return this;
    }

    public UserTestBuilder withLoyaltyPoints(int points) {
        user.setLoyaltyPoints(points);
        return this;
    }

    public User build() {
        return user;
    }
}
```

**RSpec / Ruby (FactoryBot)**:
```ruby
# spec/factories/users.rb
FactoryBot.define do
  factory :user do
    id { "user-123" }
    name { "Alice" }
    email { "alice@example.com" }

    trait :loyal do
      loyalty_points { 500 }
    end

    trait :admin do
      role { :admin }
    end
  end
end

# spec/order_service_spec.rb
RSpec.describe OrderService do
  it 'applies loyalty discount' do
    user = create(:user, :loyal)
    order = Order.new(user: user)

    result = order_service.process(order)

    expect(result.discount).to be > 0
  end
end
```

---

## Rule 3: Keep Test Data Close to Test

**Statement**: Create test data within the test method (or test-specific setup) rather than in shared fixtures used by unrelated tests. Avoid the **General Fixture** anti-pattern.

### Why This Matters

When test data lives in shared fixtures (beforeEach, setUp, fixtures files), tests become coupled to data they don't need. This creates:
- **Mystery Guest**: Tests depend on external data not visible in test
- **General Fixture**: Shared setup contains data not needed by all tests
- **Fragile Tests**: Changes to shared fixture break unrelated tests

**Key principle**: A reader should see all relevant test data by reading the test method, without hunting through fixture files.

### ❌ WRONG: General Fixture with Unrelated Data

```typescript
describe('UserService', () => {
  // WRONG: Massive shared fixture
  beforeEach(() => {
    this.adminUser = { role: 'admin', permissions: [...] };
    this.regularUser = { role: 'user' };
    this.suspendedUser = { role: 'user', status: 'suspended' };
    this.deletedUser = { role: 'user', deletedAt: new Date() };
    this.testProduct = { sku: 'WIDGET', price: 29.99 };
    this.testOrder = { id: 'order-123', total: 59.98 };
    this.discountCode = { code: 'SAVE10', percent: 0.10 };
  });

  it('validates user login', () => {
    // Only uses regularUser, but fixture creates 7 objects
    const result = userService.validateLogin(this.regularUser);
    expect(result).toBe(true);
  });

  it('rejects suspended users', () => {
    // Only uses suspendedUser
    const result = userService.validateLogin(this.suspendedUser);
    expect(result).toBe(false);
  });

  it('processes admin order', () => {
    // Uses adminUser and testOrder, not the others
    const result = orderService.process(this.adminUser, this.testOrder);
    expect(result.priority).toBe('high');
  });
});
```

**What breaks**:
- Each test uses 1-2 objects but fixture creates 7
- **Unclear dependencies**: Hard to see what each test needs
- **Slow tests**: Unnecessary object creation on every test
- **Fragile**: Changing adminUser breaks unrelated tests
- **Symptom**: Tests break when fixture changes, even though they don't use changed data

### ❌ WRONG: Mystery Guest from External File

```python
# tests/fixtures/users.json
{
  "user1": {"id": 1, "name": "Alice", "status": "active"},
  "user2": {"id": 2, "name": "Bob", "status": "suspended"},
  "admin": {"id": 99, "name": "Admin", "role": "admin"}
}

# tests/test_user_service.py
def test_validates_user():
    # WRONG: Must hunt in external file to understand test
    users = load_json('fixtures/users.json')

    result = user_service.validate(users['user1'])

    assert result is True
```

**What breaks**:
- Can't see user data in test
- External file becomes shared dependency
- Someone edits JSON → tests break mysteriously
- **Symptom**: "It worked on my machine" (local JSON differs from CI)

### ✅ CORRECT: Test-Specific Data Creation

```typescript
describe('UserService', () => {
  it('validates user login', () => {
    // Create only what this test needs, right here
    const user = { role: 'user', status: 'active' };

    const result = userService.validateLogin(user);

    expect(result).toBe(true);
  });

  it('rejects suspended users', () => {
    // Different test, different data, no shared state
    const suspendedUser = { role: 'user', status: 'suspended' };

    const result = userService.validateLogin(suspendedUser);

    expect(result).toBe(false);
  });

  it('processes admin order with priority', () => {
    // Only create what's needed for this specific test
    const admin = { role: 'admin' };
    const order = { id: 'order-123', total: 100 };

    const result = orderService.process(admin, order);

    expect(result.priority).toBe('high');
  });
});
```

**Why this works**: Each test creates minimal data. No mystery guests. No shared state. Easy to understand.

### ✅ CORRECT: Shared Setup Only for Truly Common Data

```python
class TestOrderProcessing:
    def setup_method(self):
        # Only shared setup that EVERY test needs
        self.tax_rate = 0.08  # All tests use tax calculation
        self.shipping_cost = 5.99  # All tests involve shipping

    def test_calculates_order_total(self):
        # Test-specific data created here
        order = Order(subtotal=100)

        result = order.calculate_total(self.tax_rate, self.shipping_cost)

        assert result == 113.99  # 100 + 8% tax + 5.99 shipping

    def test_free_shipping_threshold(self):
        # Different test data, same shared constants
        large_order = Order(subtotal=200)

        result = large_order.calculate_total(self.tax_rate, 0)  # Free shipping

        assert result == 216.0
```

**Why this works**: Shared setup contains only constants used by ALL tests. Specific objects created per-test.

### When Fixtures Are Appropriate

**✅ GOOD Use of Fixtures**:
```typescript
describe('Database integration', () => {
  beforeEach(async () => {
    // Appropriate: Database connection needed by ALL tests
    await db.connect();
    await db.migrations.run();
  });

  afterEach(async () => {
    await db.clean();
    await db.disconnect();
  });

  it('saves user', async () => {
    // Test creates its own data
    const user = { name: 'Alice' };
    await db.users.save(user);

    const found = await db.users.findByName('Alice');
    expect(found.name).toBe('Alice');
  });
});
```

**Why this works**: Fixture handles infrastructure (DB connection) used by all tests. Test data created per-test.

---

## Rule 4: Make Test Data Intention-Revealing

**Statement**: Name test data variables to describe their role in the test, not generic names like `user1`, `data`, `obj`. Names should reveal why this particular data matters.

### Why This Matters

Generic names like `user1`, `input`, `expected` don't communicate intent. Descriptive names make tests self-documenting and failures immediately understandable.

### ❌ WRONG: Generic, Meaningless Names

```java
@Test
public void testUserProcessing() {
    // WRONG: What's special about user1 vs user2?
    User user1 = new User("alice@example.com", 25);
    User user2 = new User("bob@example.com", 15);
    User user3 = new User("charlie@example.com", 30);

    assertTrue(processor.isValid(user1));
    assertFalse(processor.isValid(user2));
    assertTrue(processor.isValid(user3));
}
```

**What breaks**:
- No indication why user1 passes and user2 fails
- Numbers don't explain purpose
- Future maintainer must debug to understand

### ❌ WRONG: Non-Descriptive Variable Names

```python
def test_order_discount():
    # WRONG: What does 'data' represent? Why these values?
    data = {'total': 100, 'code': 'SAVE10', 'user_type': 'premium'}

    result = apply_discount(data)

    assert result == 90
```

**What breaks**: Name "data" is content-free. Doesn't explain why total=100 or why result=90.

### ✅ CORRECT: Intention-Revealing Names

```java
@Test
public void validatesUsersAboveMinimumAge() {
    final int MINIMUM_AGE = 18;
    User adultUser = new User("alice@example.com", 25);
    User minorUser = new User("bob@example.com", 15);
    User seniorUser = new User("charlie@example.com", 65);

    assertTrue(processor.isValid(adultUser));
    assertFalse(processor.isValid(minorUser));
    assertTrue(processor.isValid(seniorUser));
}
```

**Why this works**: Names explain role (adultUser, minorUser). Immediately clear why minorUser fails.

### ✅ CORRECT: Names Document Business Rules

```python
def test_applies_premium_discount():
    PREMIUM_DISCOUNT_RATE = 0.10
    order_total = 100
    premium_code = 'SAVE10'

    premium_user_order = {
        'total': order_total,
        'code': premium_code,
        'user_type': 'premium'
    }

    discounted_total = apply_discount(premium_user_order)
    expected_total = order_total * (1 - PREMIUM_DISCOUNT_RATE)

    assert discounted_total == expected_total
```

**Why this works**: Every name documents what it represents. Test reads like business requirements.

### Pattern: Role-Based Naming

```typescript
describe('Authorization', () => {
  it('allows admins to delete users', () => {
    const adminUser = { role: 'admin', permissions: ['delete'] };
    const targetUser = { id: 'user-456' };

    const result = authService.canDelete(adminUser, targetUser);

    expect(result).toBe(true);
  });

  it('prevents regular users from deleting others', () => {
    const regularUser = { role: 'user', permissions: ['read'] };
    const targetUser = { id: 'user-456' };

    const result = authService.canDelete(regularUser, targetUser);

    expect(result).toBe(false);
  });
});
```

**Why this works**: Names describe roles (adminUser, regularUser, targetUser). Intent is crystal clear.

---

## Rule 5: Use Fixtures Appropriately

**Statement**: Use fixtures (beforeEach, setUp, @fixture) for infrastructure setup and truly common data, not as a dumping ground for all test data. Distinguish between **infrastructure fixtures** (good) and **general fixtures** (anti-pattern).

### Why This Matters

Fixtures are powerful for reducing duplication but dangerous when misused. The **General Fixture** anti-pattern occurs when tests share setup containing data not needed by all tests, creating coupling and obscurity.

### Fixtures vs Factories Trade-offs

| Approach | Good For | Bad For | When to Use |
|----------|----------|---------|-------------|
| **Fixtures** | Infrastructure (DB, API mocks), truly common config | Test-specific data | All tests need the same setup |
| **Factories/Builders** | Test data objects with variations | Simple value creation | Tests need similar but customized objects |
| **Inline creation** | Test-specific simple values | Complex repeated objects | Simple, one-off data |

### ❌ WRONG: General Fixture Anti-Pattern

```python
class TestUserOperations:
    def setup_method(self):
        # WRONG: Creating data not all tests need
        self.admin = User(role='admin')
        self.regular_user = User(role='user')
        self.suspended_user = User(role='user', status='suspended')
        self.premium_user = User(role='user', tier='premium')
        self.trial_user = User(role='user', tier='trial')

        self.product_a = Product(sku='A', price=10)
        self.product_b = Product(sku='B', price=20)

        self.discount_code = DiscountCode(code='SAVE10')

    def test_login(self):
        # Only uses regular_user, but fixture creates 9 objects
        assert self.regular_user.can_login()

    def test_admin_access(self):
        # Only uses admin
        assert self.admin.has_permission('delete')
```

**What breaks**:
- **Unnecessary work**: 9 objects created, most tests use 1-2
- **Obscure dependencies**: Must read setup to see what's available
- **Coupling**: All tests break if setup changes
- **Slow**: Wasted object creation on every test

### ✅ CORRECT: Infrastructure Fixture Only

```python
class TestUserOperations:
    def setup_method(self):
        # Good: Only infrastructure setup that ALL tests need
        self.db = TestDatabase()
        self.db.connect()
        self.db.migrate()

    def teardown_method(self):
        self.db.clean()
        self.db.disconnect()

    def test_saves_user(self):
        # Test creates its own data
        user = User(name='Alice')

        self.db.save(user)

        found = self.db.find_user('Alice')
        assert found.name == 'Alice'

    def test_updates_user(self):
        # Different test, different data
        user = User(name='Bob')
        self.db.save(user)

        user.name = 'Robert'
        self.db.save(user)

        found = self.db.find_user('Robert')
        assert found.name == 'Robert'
```

**Why this works**: Fixture handles infrastructure (DB). Each test creates its own data. Clear separation.

### ✅ CORRECT: Parameterized Fixtures (Pytest)

```python
# conftest.py - Define parameterizable fixtures
@pytest.fixture
def user(request):
    """Creates user with optional overrides via indirect parametrization."""
    defaults = {'id': 'user-123', 'name': 'Default User', 'role': 'user'}
    overrides = getattr(request, 'param', {})
    return User(**{**defaults, **overrides})

# test_authorization.py
def test_regular_user_cannot_delete(user):
    # user fixture has defaults
    assert not user.can_delete()

@pytest.mark.parametrize('user', [{'role': 'admin'}], indirect=True)
def test_admin_can_delete(user):
    # user fixture overridden with role='admin'
    assert user.can_delete()

@pytest.mark.parametrize('user', [
    {'role': 'admin'},
    {'role': 'moderator'}
], indirect=True)
def test_elevated_roles_can_delete(user):
    # Same test runs twice with different user data
    assert user.can_delete()
```

**Why this works**: Fixtures provide defaults, parametrization customizes. Best of both worlds.

### ✅ CORRECT: Scoped Fixtures for Common Setup (Jest)

```javascript
describe('Order processing', () => {
  let orderService;
  let taxCalculator;

  beforeEach(() => {
    // Infrastructure: service instances all tests need
    taxCalculator = new TaxCalculator(TAX_RATE);
    orderService = new OrderService(taxCalculator);
  });

  describe('standard orders', () => {
    it('calculates tax for small order', () => {
      // Test-specific data
      const smallOrder = { subtotal: 10, items: [...] };

      const result = orderService.process(smallOrder);

      expect(result.tax).toBe(0.80);
    });

    it('calculates tax for large order', () => {
      // Different test, different data
      const largeOrder = { subtotal: 1000, items: [...] };

      const result = orderService.process(largeOrder);

      expect(result.tax).toBe(80);
    });
  });
});
```

**Why this works**: Fixture creates service instances (infrastructure). Each test creates order data (test-specific).

### ✅ CORRECT: Shared Examples with Fixtures (RSpec)

```ruby
RSpec.shared_examples 'authenticated resource' do
  let(:authenticated_user) { create(:user, :authenticated) }
  let(:unauthenticated_user) { create(:user) }

  it 'allows access for authenticated users' do
    resource = described_class.new(authenticated_user)
    expect(resource.can_access?).to be true
  end

  it 'denies access for unauthenticated users' do
    resource = described_class.new(unauthenticated_user)
    expect(resource.can_access?).to be false
  end
end

RSpec.describe AdminPanel do
  it_behaves_like 'authenticated resource'
end

RSpec.describe UserDashboard do
  it_behaves_like 'authenticated resource'
end
```

**Why this works**: Shared examples encapsulate common test patterns. Each use creates its own data via let().

### When to Use Each Approach

**Use Infrastructure Fixtures**:
- Database connections
- API client setup
- Mock server initialization
- Test framework configuration

**Use Factory/Builder Pattern**:
- Complex domain objects
- Objects with many variations
- Objects used across many tests

**Use Inline Creation**:
- Simple values (numbers, strings)
- Test-specific unique data
- One-off objects

---

## Rule 6: Parametrize Tests for Data Variations

**Statement**: When testing the same behavior with multiple inputs, use parameterized tests instead of duplicating test code. This eliminates duplication while documenting all tested cases.

### Why This Matters

Testing multiple inputs often leads to **Test Code Duplication**: same test logic copy-pasted with different values. Parameterized tests eliminate duplication while making all test cases visible.

### ❌ WRONG: Duplicated Tests for Each Input

```typescript
describe('EmailValidator', () => {
  it('validates gmail addresses', () => {
    expect(validator.isValid('user@gmail.com')).toBe(true);
  });

  it('validates yahoo addresses', () => {
    expect(validator.isValid('user@yahoo.com')).toBe(true);
  });

  it('validates corporate addresses', () => {
    expect(validator.isValid('user@company.com')).toBe(true);
  });

  it('rejects missing at symbol', () => {
    expect(validator.isValid('user.gmail.com')).toBe(false);
  });

  it('rejects missing domain', () => {
    expect(validator.isValid('user@')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validator.isValid('')).toBe(false);
  });
});
```

**What breaks**:
- Same logic duplicated 6 times
- Adding test case requires new test method
- Hard to see the pattern (valid vs invalid)
- **Symptom**: 20 nearly-identical test methods

### ✅ CORRECT: Parameterized Tests (Jest)

```typescript
describe('EmailValidator', () => {
  // Test valid emails
  test.each([
    ['user@gmail.com', 'Gmail address'],
    ['user@yahoo.com', 'Yahoo address'],
    ['user@company.com', 'Corporate address'],
    ['first.last@example.co.uk', 'Multi-dot domain'],
    ['user+tag@example.com', 'Plus addressing']
  ])('validates %s (%s)', (email, description) => {
    expect(validator.isValid(email)).toBe(true);
  });

  // Test invalid emails
  test.each([
    ['user.gmail.com', 'Missing @ symbol'],
    ['user@', 'Missing domain'],
    ['@example.com', 'Missing local part'],
    ['', 'Empty string'],
    ['user @example.com', 'Space in local part']
  ])('rejects %s (%s)', (email, description) => {
    expect(validator.isValid(email)).toBe(false);
  });
});
```

**Why this works**:
- One test definition, many executions
- Easy to add new cases (add to array)
- Description documents why each case matters
- Clear separation of valid vs invalid

### ✅ CORRECT: Pytest Parametrize

```python
import pytest

class TestEmailValidator:
    @pytest.mark.parametrize('email', [
        'user@gmail.com',
        'user@yahoo.com',
        'user@company.com',
        'first.last@example.co.uk',
        'user+tag@example.com'
    ])
    def test_validates_correct_emails(self, email):
        assert validator.is_valid(email)

    @pytest.mark.parametrize('email,reason', [
        ('user.gmail.com', 'missing @ symbol'),
        ('user@', 'missing domain'),
        ('@example.com', 'missing local part'),
        ('', 'empty string'),
        ('user @example.com', 'space in local part')
    ])
    def test_rejects_invalid_emails(self, email, reason):
        assert not validator.is_valid(email), f"Should reject {reason}"
```

**Why this works**: Pytest generates one test per parameter. Failure messages include the specific input.

### ✅ CORRECT: JUnit ParameterizedTest

```java
@ParameterizedTest
@CsvSource({
    "user@gmail.com, true",
    "user@yahoo.com, true",
    "user@company.com, true",
    "user.gmail.com, false",
    "user@, false",
    "@example.com, false"
})
void testEmailValidation(String email, boolean expected) {
    assertEquals(expected, validator.isValid(email));
}

// Or with @ValueSource for simpler cases
@ParameterizedTest
@ValueSource(strings = {
    "user@gmail.com",
    "user@yahoo.com",
    "user@company.com"
})
void testValidatesCorrectEmails(String email) {
    assertTrue(validator.isValid(email));
}

// Or with @MethodSource for complex objects
@ParameterizedTest
@MethodSource("invalidEmailProvider")
void testRejectsInvalidEmails(String email, String reason) {
    assertFalse(validator.isValid(email), "Should reject: " + reason);
}

static Stream<Arguments> invalidEmailProvider() {
    return Stream.of(
        Arguments.of("user.gmail.com", "missing @ symbol"),
        Arguments.of("user@", "missing domain"),
        Arguments.of("@example.com", "missing local part")
    );
}
```

**Why this works**: JUnit creates one test execution per CSV row. Clear, concise, easy to extend.

### ✅ CORRECT: Mocha with Data-Driven Tests

```javascript
const testCases = [
  { input: 10, expected: 20, description: 'doubles single digit' },
  { input: 50, expected: 100, description: 'doubles two digits' },
  { input: -5, expected: -10, description: 'doubles negative' },
  { input: 0, expected: 0, description: 'handles zero' }
];

describe('Doubler', () => {
  testCases.forEach(({ input, expected, description }) => {
    it(description, () => {
      expect(doubler(input)).to.equal(expected);
    });
  });
});
```

**Why this works**: Array of test cases drives multiple it() calls. Easy to read, easy to extend.

### ✅ CORRECT: RSpec Shared Examples

```ruby
RSpec.describe EmailValidator do
  shared_examples 'valid email' do |email|
    it "validates #{email}" do
      expect(validator.valid?(email)).to be true
    end
  end

  shared_examples 'invalid email' do |email, reason|
    it "rejects #{email} (#{reason})" do
      expect(validator.valid?(email)).to be false
    end
  end

  # Test valid emails
  include_examples 'valid email', 'user@gmail.com'
  include_examples 'valid email', 'user@yahoo.com'
  include_examples 'valid email', 'user@company.com'

  # Test invalid emails
  include_examples 'invalid email', 'user.gmail.com', 'missing @ symbol'
  include_examples 'invalid email', 'user@', 'missing domain'
  include_examples 'invalid email', '@example.com', 'missing local part'
end
```

**Why this works**: Shared examples define the pattern, include_examples applies it to each case.

### Complex Parametrization Example

```typescript
// Testing discount calculation with multiple factors
describe('DiscountCalculator', () => {
  test.each([
    // [userType, orderTotal, couponCode, expectedDiscount, description]
    ['regular', 100, null, 0, 'no discount for regular user without coupon'],
    ['regular', 100, 'SAVE10', 10, '10% coupon for regular user'],
    ['premium', 100, null, 5, '5% automatic premium discount'],
    ['premium', 100, 'SAVE10', 15, 'premium discount stacks with coupon'],
    ['premium', 500, null, 50, '10% premium discount on large order'],
    ['premium', 500, 'SAVE10', 100, 'max discount cap applied'],
  ])('calculates discount for %s user with $%d order and %s coupon',
     (userType, orderTotal, couponCode, expectedDiscount, description) => {
    const user = { type: userType };
    const order = { total: orderTotal };

    const discount = calculator.calculate(user, order, couponCode);

    expect(discount).toBe(expectedDiscount);
  });
});
```

**Why this works**: Table format documents all test cases. Easy to spot missing combinations.

---

## Framework-Specific Patterns Reference

### Jest / Vitest

**Parametrized Tests**:
```javascript
test.each([
  [input1, expected1],
  [input2, expected2]
])('description with %s', (input, expected) => {
  expect(fn(input)).toBe(expected);
});
```

**Fixtures (beforeEach)**:
```javascript
describe('suite', () => {
  let resource;

  beforeEach(() => {
    resource = new Resource();
  });

  afterEach(() => {
    resource.cleanup();
  });
});
```

### Pytest

**Parametrized Tests**:
```python
@pytest.mark.parametrize('input,expected', [
    (input1, expected1),
    (input2, expected2)
])
def test_function(input, expected):
    assert fn(input) == expected
```

**Fixtures**:
```python
@pytest.fixture
def resource():
    r = Resource()
    yield r
    r.cleanup()

def test_uses_resource(resource):
    assert resource.is_ready()
```

**Fixture Parametrization**:
```python
@pytest.fixture
def user(request):
    return User(**getattr(request, 'param', {}))

@pytest.mark.parametrize('user', [{'role': 'admin'}], indirect=True)
def test_admin(user):
    assert user.is_admin()
```

### JUnit 5

**Parametrized Tests**:
```java
@ParameterizedTest
@CsvSource({"input1,expected1", "input2,expected2"})
void test(String input, String expected) {
    assertEquals(expected, fn(input));
}

@ParameterizedTest
@MethodSource("dataProvider")
void test(String input, String expected) {
    assertEquals(expected, fn(input));
}

static Stream<Arguments> dataProvider() {
    return Stream.of(
        Arguments.of("input1", "expected1"),
        Arguments.of("input2", "expected2")
    );
}
```

**Fixtures (BeforeEach)**:
```java
class TestSuite {
    private Resource resource;

    @BeforeEach
    void setUp() {
        resource = new Resource();
    }

    @AfterEach
    void tearDown() {
        resource.cleanup();
    }
}
```

### Mocha / Chai

**Data-Driven Tests**:
```javascript
const cases = [
  { input: 1, expected: 2 },
  { input: 2, expected: 4 }
];

describe('suite', () => {
  cases.forEach(({ input, expected }) => {
    it(`handles ${input}`, () => {
      expect(fn(input)).to.equal(expected);
    });
  });
});
```

**Fixtures (beforeEach)**:
```javascript
describe('suite', () => {
  beforeEach(function() {
    this.resource = new Resource();
  });

  afterEach(function() {
    this.resource.cleanup();
  });
});
```

### RSpec

**Shared Examples**:
```ruby
shared_examples 'behavior' do |param|
  it 'does something' do
    expect(subject.method(param)).to be_truthy
  end
end

describe MyClass do
  include_examples 'behavior', value1
  include_examples 'behavior', value2
end
```

**Fixtures (let and before)**:
```ruby
describe Suite do
  let(:resource) { Resource.new }

  before do
    resource.setup
  end

  after do
    resource.cleanup
  end
end
```

**FactoryBot**:
```ruby
FactoryBot.define do
  factory :user do
    name { 'Alice' }

    trait :admin do
      role { :admin }
    end
  end
end

# Usage
user = create(:user)
admin = create(:user, :admin)
```

---

## Common Patterns Summary

### Pattern: Minimal Test Data

```typescript
// Create only what the test needs
it('validates email format', () => {
  const email = 'user@example.com';  // Just a string, not a full User object

  expect(validator.isValid(email)).toBe(true);
});
```

### Pattern: Named Constants for Business Rules

```python
def test_adult_age_verification():
    LEGAL_DRINKING_AGE = 21
    ADULT_AGE = 25
    MINOR_AGE = 17

    assert age_verifier.can_drink(ADULT_AGE)
    assert age_verifier.can_drink(LEGAL_DRINKING_AGE)
    assert not age_verifier.can_drink(MINOR_AGE)
```

### Pattern: Builder for Complex Objects

```java
User user = new UserBuilder()
    .withName("Alice")
    .withEmail("alice@example.com")
    .asAdmin()
    .build();
```

### Pattern: Factory for Simple Customization

```typescript
const createOrder = (overrides = {}) => ({
  id: 'order-123',
  total: 100,
  status: 'pending',
  ...overrides
});

// Usage
const paidOrder = createOrder({ status: 'paid' });
const largeOrder = createOrder({ total: 1000 });
```

### Pattern: Object Mother for Standard Cases

```python
class TestUsers:
    @staticmethod
    def admin():
        return User(role='admin', permissions=['all'])

    @staticmethod
    def regular():
        return User(role='user', permissions=['read'])

# Usage
user = TestUsers.admin()
```

---

## Agent Checklist: Test Data Management

Before submitting tests, verify:

- [ ] No magic numbers or strings - all values have named constants or descriptive variables
- [ ] Test data builders/factories exist for complex objects used across tests
- [ ] Each test creates its own data or uses test-specific setup
- [ ] Shared fixtures contain only infrastructure or truly common data
- [ ] Variable names reveal intent (adminUser, not user1)
- [ ] Parameterized tests used for multiple input variations
- [ ] No Mystery Guest - all test data visible in test or test-specific setup
- [ ] No General Fixture - shared setup doesn't contain data used by only some tests
- [ ] Test data is minimal - only creating what's needed for each test

---

## Debugging Test Data Issues

**Symptom**: Hard to understand why test fails
- **Cause**: Magic numbers, generic variable names
- **Fix**: Use named constants and intention-revealing names

**Symptom**: Test breaks when unrelated test changes
- **Cause**: Shared fixture coupling (General Fixture)
- **Fix**: Move test-specific data from fixture into test method

**Symptom**: Hundreds of lines of setup before test
- **Cause**: Excessive Setup anti-pattern
- **Fix**: Extract to Test Data Builder or Object Mother pattern

**Symptom**: Copy-pasted test code everywhere
- **Cause**: Test Code Duplication
- **Fix**: Use parameterized tests or extract helper methods

**Symptom**: Test depends on external file that changed
- **Cause**: Mystery Guest anti-pattern
- **Fix**: Move test data into test or use builders

**Symptom**: Can't run single test in isolation
- **Cause**: Test depends on other tests' data
- **Fix**: Ensure each test creates fresh data in beforeEach or test method

---

## Summary

Effective test data management requires discipline and patterns:

1. **Avoid Magic Values**: Use named constants that reveal business rules
2. **Use Builders/Factories**: Object Mother, Builder, and Factory patterns eliminate duplication
3. **Keep Data Close**: Create test data in test methods, not distant fixtures
4. **Intention-Revealing Names**: adminUser, not user1; MINIMUM_AGE, not 18
5. **Appropriate Fixtures**: For infrastructure only, not test data
6. **Parametrize Variations**: One test definition, many executions

Well-managed test data makes tests self-documenting, maintainable, and reliable. Poor test data creates Mystery Guests, General Fixtures, and Obscure Tests that waste developer time and erode confidence in the test suite.

**Sources**: xUnit Test Patterns (Gerard Meszaros), Growing Object-Oriented Software Guided by Tests (Freeman & Pryce), Software Testing Anti-patterns (Codepipes), testsmells.org
