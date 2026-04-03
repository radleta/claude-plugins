# Test Structure Rules

Effective test structure is the foundation of maintainable test suites. Well-structured tests are easy to read, debug, and maintain. Poorly structured tests become technical debt that slows development and obscures bugs. These rules provide a comprehensive framework for writing clear, reliable tests across all testing frameworks.

## The Problem: Why Test Structure Matters

Tests are read far more often than they're written. When a test fails, developers need to quickly understand:
1. What behavior was being tested
2. What inputs were provided
3. What the test expected to happen
4. Why the expectation wasn't met

Poor test structure makes debugging exponentially harder. A test with unclear setup, multiple assertions, or cryptic names forces developers to reverse-engineer intent from code. This wastes time and increases the risk of misdiagnosing failures.

**Key insight**: A test is documentation of system behavior. If you can't understand a test in 30 seconds, it needs restructuring.

---

## Rule 1: Follow the AAA Pattern (Arrange-Act-Assert)

**Statement**: Every test must follow three distinct phases: Arrange (setup), Act (execute), Assert (verify).

### Why This Matters

The AAA pattern provides a consistent structure that makes tests predictable and scannable. When every test follows the same pattern, developers can instantly locate setup code, identify the behavior being tested, and understand expected outcomes. This pattern separates concerns and makes tests self-documenting.

The AAA pattern is equivalent to BDD's Given-When-Then:
- **Arrange** = Given (setup preconditions)
- **Act** = When (execute action)
- **Assert** = Then (verify outcome)

### ❌ WRONG: Mixed Phases

```javascript
// Jest - mixed arrange/act/assert
describe('UserService', () => {
  it('processes user data', () => {
    const service = new UserService();
    const result = service.processUser({ id: 1, name: 'Alice' });
    expect(result.processed).toBe(true);
    const user2 = { id: 2, name: 'Bob' };
    const result2 = service.processUser(user2);
    expect(result2.processed).toBe(true);
    expect(service.getProcessedCount()).toBe(2);
  });
});
```

**What breaks**:
- Setup, actions, and assertions are interleaved
- Hard to identify what's being tested
- Multiple actions obscure the test's intent
- Cannot determine which assertion failed without debugging

### ❌ WRONG: No Clear Separation

```python
# Pytest - no visual separation
def test_calculate_discount():
    calculator = DiscountCalculator()
    product = Product(price=100, category='electronics')
    calculator.set_discount_rate(0.1)
    result = calculator.calculate(product)
    assert result == 90
```

**What breaks**:
- Phases blend together
- Hard to scan quickly
- Difficult to distinguish setup from test action
- No visual cues for structure

### ✅ CORRECT: Clear AAA Pattern with Comments

```javascript
// Jest - clear AAA structure
describe('UserService', () => {
  it('should mark user as processed after processing', () => {
    // Arrange
    const service = new UserService();
    const user = { id: 1, name: 'Alice' };

    // Act
    const result = service.processUser(user);

    // Assert
    expect(result.processed).toBe(true);
  });
});
```

**Why this works**:
- Clear visual separation between phases
- Easy to locate setup, action, and verification
- Intent is immediately obvious
- Each phase has a single responsibility

### ✅ CORRECT: AAA with Blank Lines

```python
# Pytest - AAA with visual separation
def test_calculate_discount_for_electronics():
    # Arrange
    calculator = DiscountCalculator()
    product = Product(price=100, category='electronics')
    calculator.set_discount_rate(0.1)

    # Act
    result = calculator.calculate(product)

    # Assert
    assert result == 90
```

**Why this works**:
- Comments clearly label each phase
- Blank lines provide visual separation
- Easy to scan and understand flow
- Setup complexity is isolated

### Framework-Specific Notes

- **Jest/Mocha**: Use `describe()` blocks for grouping, `it()` or `test()` for individual tests
- **Pytest**: Use `def test_*()` naming convention, classes optional for grouping (`class TestUserService:`)
- **JUnit**: Use `@Test` annotation on methods, `@BeforeEach`/`@AfterEach` for common setup
- **RSpec**: Use `describe` and `it` blocks (no parentheses), `context` for scenarios

---

## Rule 2: One Logical Assertion Per Test

**Statement**: Each test should verify a single logical concept, even if that requires multiple assertion statements.

### Why This Matters

Tests with multiple unrelated assertions suffer from **Assertion Roulette**: when the test fails, you can't immediately tell which assertion failed or why. This forces developers to run the test in a debugger just to understand the failure. Multiple assertions also make tests harder to name and violate the single responsibility principle.

**Important distinction**: "One logical assertion" doesn't mean "one assert statement." It means testing one behavioral concept. Multiple assertions about the same outcome are acceptable if they verify one logical behavior.

### ❌ WRONG: Multiple Unrelated Assertions (Assertion Roulette)

```java
// JUnit - tests multiple unrelated behaviors
@Test
public void testUserOperations() {
    UserService service = new UserService();

    // Testing creation
    User user = service.createUser("Alice", "alice@example.com");
    assertEquals("Alice", user.getName());

    // Testing validation (unrelated)
    boolean isValid = service.validateEmail("invalid");
    assertFalse(isValid);

    // Testing deletion (unrelated)
    boolean deleted = service.deleteUser(user.getId());
    assertTrue(deleted);
}
```

**What breaks**:
- Test name is meaningless ("testUserOperations" describes nothing)
- If second assertion fails, can't tell which behavior broke
- Three unrelated behaviors in one test
- No clear failure message

### ❌ WRONG: Assertion Without Message

```typescript
// Jest - multiple assertions without context
describe('OrderCalculator', () => {
  it('calculates order total', () => {
    const calculator = new OrderCalculator();
    const order = new Order();
    order.addItem({ price: 10, quantity: 2 });
    order.addItem({ price: 5, quantity: 3 });

    expect(calculator.getSubtotal(order)).toBe(35);
    expect(calculator.getTax(order)).toBe(3.5);
    expect(calculator.getTotal(order)).toBe(38.5);
    expect(calculator.getItemCount(order)).toBe(5);
  });
});
```

**What breaks**:
- When assertion fails, no context provided
- Testing multiple concepts (subtotal, tax, total, count)
- Should be four separate tests
- Poor debuggability

### ✅ CORRECT: Single Logical Assertion

```java
// JUnit - one behavior per test
@Test
public void shouldCreateUserWithCorrectName() {
    // Arrange
    UserService service = new UserService();

    // Act
    User user = service.createUser("Alice", "alice@example.com");

    // Assert
    assertEquals("Alice", user.getName());
}

@Test
public void shouldRejectInvalidEmailFormat() {
    // Arrange
    UserService service = new UserService();

    // Act
    boolean isValid = service.validateEmail("invalid");

    // Assert
    assertFalse(isValid, "Email 'invalid' should be rejected as invalid format");
}

@Test
public void shouldSuccessfullyDeleteExistingUser() {
    // Arrange
    UserService service = new UserService();
    User user = service.createUser("Alice", "alice@example.com");

    // Act
    boolean deleted = service.deleteUser(user.getId());

    // Assert
    assertTrue(deleted, "Existing user should be deleted successfully");
}
```

**Why this works**:
- Each test has a clear, specific name
- Failure immediately identifies which behavior broke
- Each test can be run independently
- Assertion messages provide context

### ✅ CORRECT: Multiple Assertions for One Concept

```typescript
// Jest - multiple assertions verifying one logical outcome
describe('OrderCalculator', () => {
  it('should calculate correct total including tax', () => {
    // Arrange
    const calculator = new OrderCalculator();
    const order = new Order();
    order.addItem({ price: 10, quantity: 2 });
    order.addItem({ price: 5, quantity: 3 });

    // Act
    const result = calculator.calculate(order);

    // Assert - all verify the calculation result
    expect(result.subtotal).toBe(35);
    expect(result.tax).toBe(3.5);
    expect(result.total).toBe(38.5);
  });

  it('should count items correctly in order', () => {
    // Arrange
    const calculator = new OrderCalculator();
    const order = new Order();
    order.addItem({ price: 10, quantity: 2 });
    order.addItem({ price: 5, quantity: 3 });

    // Act
    const count = calculator.getItemCount(order);

    // Assert
    expect(count).toBe(5);
  });
});
```

**Why this works**:
- First test verifies one logical concept: "calculation result"
- Multiple assertions are related parts of that result
- Second test verifies different concept: "item counting"
- Clear separation of concerns

---

## Rule 3: Test Names Must Describe Behavior

**Statement**: Test names should clearly describe what behavior is being tested and under what conditions, using the format "should [expected behavior] when [condition]".

### Why This Matters

Test names are the first line of documentation. When a test fails in CI/CD, developers see the test name before anything else. A good name immediately communicates what broke and why it matters. Poor names force developers to read the test code to understand what failed.

Test names should describe **behavior**, not implementation. They should read like specifications.

### ❌ WRONG: Implementation-Focused Names

```python
# Pytest - names describe implementation, not behavior
def test_user():
    user = User(name="Alice", age=30)
    assert user.name == "Alice"

def test_process():
    service = UserService()
    result = service.process()
    assert result is not None

def test1():
    assert calculate_total(10, 20) == 30
```

**What breaks**:
- "test_user" - what about the user?
- "test_process" - what should processing do?
- "test1" - completely meaningless
- No context for failures
- Can't understand intent without reading code

### ❌ WRONG: Method Name Only

```javascript
// Mocha - just testing method names
describe('Calculator', () => {
  it('add', () => {
    expect(calculator.add(2, 3)).toBe(5);
  });

  it('divide', () => {
    expect(calculator.divide(10, 2)).toBe(5);
  });

  it('divide2', () => {
    expect(() => calculator.divide(10, 0)).toThrow();
  });
});
```

**What breaks**:
- "add" and "divide" don't describe expected behavior
- "divide2" is ambiguous (why a second divide test?)
- No indication of what conditions are being tested
- Poor failure messages

### ✅ CORRECT: Behavior-Focused Names

```python
# Pytest - describes behavior and conditions
def test_should_store_user_name_on_creation():
    # Arrange
    name = "Alice"

    # Act
    user = User(name=name, age=30)

    # Assert
    assert user.name == name

def test_should_return_processed_users_when_processing_valid_data():
    # Arrange
    service = UserService()

    # Act
    result = service.process()

    # Assert
    assert result is not None
    assert len(result) > 0

def test_should_sum_two_positive_numbers_correctly():
    # Arrange
    first = 10
    second = 20

    # Act
    result = calculate_total(first, second)

    # Assert
    assert result == 30
```

**Why this works**:
- Immediately clear what behavior is tested
- Describes expected outcome
- Provides context for conditions
- Failure messages are self-explanatory

### ✅ CORRECT: should/when Pattern

```javascript
// Mocha - clear behavior description
describe('Calculator', () => {
  it('should return sum when adding two positive numbers', () => {
    // Arrange
    const calculator = new Calculator();

    // Act
    const result = calculator.add(2, 3);

    // Assert
    expect(result).toBe(5);
  });

  it('should return quotient when dividing by non-zero number', () => {
    // Arrange
    const calculator = new Calculator();

    // Act
    const result = calculator.divide(10, 2);

    // Assert
    expect(result).toBe(5);
  });

  it('should throw error when dividing by zero', () => {
    // Arrange
    const calculator = new Calculator();

    // Act & Assert
    expect(() => calculator.divide(10, 0)).toThrow('Division by zero');
  });
});
```

**Why this works**:
- "should [behavior] when [condition]" format
- Clear distinction between normal and error cases
- Descriptive without being verbose
- Test failures immediately indicate what broke

### Naming Patterns by Framework

- **Jest/Mocha**: `should [behavior] when [condition]` or `[behavior] when [condition]`
- **Pytest**: `test_should_[behavior]_when_[condition]` (snake_case)
- **JUnit**: `shouldBehaviorWhenCondition` (camelCase) or `@DisplayName` annotation
- **RSpec**: `it 'should [behavior] when [condition]'` (string descriptions)

---

## Rule 4: Tests Must Be Isolated and Independent

**Statement**: Each test must run independently without depending on execution order, shared mutable state, or other tests.

### Why This Matters

Test interdependence creates unpredictable failures. Tests that pass when run in sequence but fail when run individually or in parallel waste developer time and break CI/CD pipelines. Isolated tests can be run in any order, in parallel, or selectively - essential for fast feedback loops.

This follows the **I** (Isolated/Independent) principle in **FIRST**:
- **F**ast: Tests run quickly
- **I**solated: No dependencies between tests
- **R**epeatable: Consistent results across runs
- **S**elf-validating: Clear pass/fail
- **T**imely: Written with code

### ❌ WRONG: Shared Mutable State (Test Interdependence)

```ruby
# RSpec - tests depend on execution order
describe 'UserService' do
  # Shared mutable state
  @@user_count = 0
  @@created_user = nil

  it 'creates a user' do
    service = UserService.new
    @@created_user = service.create_user('Alice')
    @@user_count = 1

    expect(@@created_user).not_to be_nil
  end

  it 'finds created user' do
    # Depends on previous test running first!
    service = UserService.new
    found = service.find_user(@@created_user.id)

    expect(found.name).to eq('Alice')
  end

  it 'counts users correctly' do
    # Depends on previous tests!
    service = UserService.new

    expect(service.user_count).to eq(@@user_count)
  end
end
```

**What breaks**:
- Second test fails when run alone (@@created_user is nil)
- Third test fails if first test didn't run (@@user_count is 0)
- Cannot run tests in parallel
- Cannot run single test in isolation
- Brittle to test execution order

### ❌ WRONG: No Cleanup (Resource Leakage)

```java
// JUnit - no cleanup of shared resources
public class DatabaseTest {
    private static Database db = new Database();

    @Test
    public void testInsertUser() {
        db.insert(new User(1, "Alice"));
        User user = db.findById(1);
        assertEquals("Alice", user.getName());
        // No cleanup - user remains in database!
    }

    @Test
    public void testUserCount() {
        // Expects empty database, but previous test left data!
        assertEquals(0, db.count());
    }
}
```

**What breaks**:
- Second test expects clean state but gets polluted state
- Tests pass when run individually, fail when run together
- Order-dependent failures
- Database not reset between tests

### ✅ CORRECT: Isolated Setup with beforeEach

```ruby
# RSpec - each test has isolated setup
describe 'UserService' do
  let(:service) { UserService.new }

  before(:each) do
    # Fresh database state for each test
    clear_database
  end

  it 'should create user with provided name' do
    # Arrange
    name = 'Alice'

    # Act
    user = service.create_user(name)

    # Assert
    expect(user).not_to be_nil
    expect(user.name).to eq(name)
  end

  it 'should find user by id when user exists' do
    # Arrange - create user in this test
    user = service.create_user('Alice')

    # Act
    found = service.find_user(user.id)

    # Assert
    expect(found.name).to eq('Alice')
  end

  it 'should count only users in database' do
    # Arrange - explicit setup
    service.create_user('Alice')
    service.create_user('Bob')

    # Act
    count = service.user_count

    # Assert
    expect(count).to eq(2)
  end
end
```

**Why this works**:
- `before(:each)` ensures clean state for every test
- Each test creates its own test data
- No shared mutable state
- Tests can run in any order
- Tests can run in parallel

### ✅ CORRECT: Setup and Teardown

```java
// JUnit - proper setup and teardown
public class DatabaseTest {
    private Database db;

    @BeforeEach
    public void setUp() {
        // Fresh database for each test
        db = new Database();
        db.connect();
    }

    @AfterEach
    public void tearDown() {
        // Clean up after each test
        db.clear();
        db.disconnect();
    }

    @Test
    public void shouldInsertUserWithCorrectData() {
        // Arrange
        User user = new User(1, "Alice");

        // Act
        db.insert(user);
        User found = db.findById(1);

        // Assert
        assertEquals("Alice", found.getName());
    }

    @Test
    public void shouldReturnZeroForEmptyDatabase() {
        // Arrange - database already clean from setUp

        // Act
        int count = db.count();

        // Assert
        assertEquals(0, count);
    }
}
```

**Why this works**:
- `@BeforeEach` creates fresh state before each test
- `@AfterEach` cleans up resources after each test
- No test pollution
- Tests are completely independent
- Can run in any order or parallel

### Framework-Specific Setup/Teardown

- **Jest**: `beforeEach()`, `afterEach()`, `beforeAll()`, `afterAll()`
- **Pytest**: `@pytest.fixture` with scope, or `setup_method()`/`teardown_method()`
- **JUnit**: `@BeforeEach`, `@AfterEach`, `@BeforeAll`, `@AfterAll`
- **RSpec**: `before(:each)`, `after(:each)`, `let()` for lazy initialization

---

## Rule 5: Minimize Setup Complexity (Avoid Excessive Setup and Mystery Guest)

**Statement**: Keep test setup simple, explicit, and visible. Avoid hidden dependencies on external resources or excessively complex fixture code.

### Why This Matters

**Excessive Setup** (the "Mother Hen" anti-pattern) obscures the test's actual behavior. When setup requires hundreds of lines or deeply nested helper methods, developers can't understand what's being tested. This violates the AAA pattern's readability goals.

**Mystery Guest** occurs when tests depend on external resources (files, databases, network) that aren't visible in the test code. When the external resource changes, tests break mysteriously. Developers can't see cause-and-effect relationships.

### ❌ WRONG: Mystery Guest - External File Dependency

```python
# Pytest - depends on external file
def test_load_user_configuration():
    # Arrange - relies on external file "config.json"
    # File path is not visible, content is unknown
    loader = ConfigLoader()

    # Act
    config = loader.load('config.json')

    # Assert
    assert config['timeout'] == 30
    assert config['retries'] == 3
```

**What breaks**:
- Test reader can't see what's in config.json
- If someone edits config.json, test breaks mysteriously
- Cause-effect relationship is hidden
- Cannot understand test without external context
- Shared resource between multiple tests

### ❌ WRONG: Excessive Setup - Hundreds of Lines

```typescript
// Jest - excessive setup obscures test
describe('OrderProcessor', () => {
  it('should process order with discount', () => {
    // Arrange - 50+ lines of setup
    const user = new User();
    user.setId(1);
    user.setName('Alice');
    user.setEmail('alice@example.com');
    user.setAddress(new Address());
    user.getAddress().setStreet('123 Main St');
    user.getAddress().setCity('Springfield');
    user.getAddress().setState('IL');
    user.getAddress().setZip('62701');

    const product1 = new Product();
    product1.setId(101);
    product1.setName('Widget');
    product1.setPrice(10.00);
    product1.setCategory('Hardware');

    const product2 = new Product();
    product2.setId(102);
    product2.setName('Gadget');
    product2.setPrice(20.00);
    product2.setCategory('Hardware');

    const cart = new ShoppingCart();
    cart.setUser(user);
    cart.addItem(new CartItem(product1, 2));
    cart.addItem(new CartItem(product2, 1));

    const discountRules = new DiscountRules();
    discountRules.addRule(new PercentageDiscount(0.1, 'Hardware'));

    const processor = new OrderProcessor(discountRules);

    // Act - actual test action buried in noise
    const order = processor.process(cart);

    // Assert
    expect(order.total).toBe(36.00);
  });
});
```

**What breaks**:
- Setup is longer than the actual test
- Hard to identify what's relevant vs. noise
- Violates AAA readability
- Difficult to maintain
- Obscures the test's intent

### ✅ CORRECT: Inline Test Data (Avoid Mystery Guest)

```python
# Pytest - all test data visible in test
def test_should_load_configuration_with_expected_values():
    # Arrange - test data visible and explicit
    test_config = {
        'timeout': 30,
        'retries': 3,
        'endpoint': 'https://api.example.com'
    }
    loader = ConfigLoader()

    # Act
    config = loader.parse(test_config)

    # Assert
    assert config['timeout'] == 30
    assert config['retries'] == 3
```

**Why this works**:
- All test data visible in test
- No hidden external dependencies
- Clear cause-effect relationship
- Test is self-contained
- No mysterious failures from external changes

### ✅ CORRECT: Test Data Builder Pattern

```typescript
// Jest - builder pattern for complex setup
class UserBuilder {
  private user: User;

  constructor() {
    this.user = new User();
  }

  withName(name: string): UserBuilder {
    this.user.setName(name);
    return this;
  }

  withEmail(email: string): UserBuilder {
    this.user.setEmail(email);
    return this;
  }

  withAddress(address: Address): UserBuilder {
    this.user.setAddress(address);
    return this;
  }

  build(): User {
    return this.user;
  }
}

class ProductBuilder {
  private product: Product;

  constructor() {
    this.product = new Product();
  }

  withId(id: number): ProductBuilder {
    this.product.setId(id);
    return this;
  }

  withPrice(price: number): ProductBuilder {
    this.product.setPrice(price);
    return this;
  }

  withCategory(category: string): ProductBuilder {
    this.product.setCategory(category);
    return this;
  }

  build(): Product {
    return this.product;
  }
}

describe('OrderProcessor', () => {
  it('should apply 10% discount to hardware items', () => {
    // Arrange - clean, readable setup with builders
    const user = new UserBuilder()
      .withName('Alice')
      .withEmail('alice@example.com')
      .build();

    const product1 = new ProductBuilder()
      .withId(101)
      .withPrice(10.00)
      .withCategory('Hardware')
      .build();

    const product2 = new ProductBuilder()
      .withId(102)
      .withPrice(20.00)
      .withCategory('Hardware')
      .build();

    const cart = new ShoppingCart(user);
    cart.addItem(product1, 2);
    cart.addItem(product2, 1);

    const processor = new OrderProcessor(new PercentageDiscount(0.1, 'Hardware'));

    // Act
    const order = processor.process(cart);

    // Assert
    expect(order.total).toBe(36.00);
  });
});
```

**Why this works**:
- Builder pattern makes setup readable
- Only relevant properties are set
- Fluent API is easy to understand
- Setup complexity is encapsulated but visible
- Test remains focused on behavior

### Pattern: Object Mother for Reusable Test Data

```java
// JUnit - Object Mother pattern
public class UserMother {
    public static User createDefault() {
        return new User(1, "Alice", "alice@example.com");
    }

    public static User createWithName(String name) {
        return new User(1, name, name.toLowerCase() + "@example.com");
    }

    public static User createAdmin() {
        User user = createDefault();
        user.setRole(Role.ADMIN);
        return user;
    }
}

public class UserServiceTest {
    @Test
    public void shouldGrantAccessWhenUserIsAdmin() {
        // Arrange - clear intent with Object Mother
        User admin = UserMother.createAdmin();
        UserService service = new UserService();

        // Act
        boolean hasAccess = service.checkAccess(admin, Resource.ADMIN_PANEL);

        // Assert
        assertTrue(hasAccess, "Admin users should have access to admin panel");
    }
}
```

**Why this works**:
- Object Mother encapsulates common test data creation
- Keeps setup minimal and focused
- Names clearly indicate what data is created
- Reusable across multiple tests

---

## Rule 6: Each Test Should Be Fast

**Statement**: Unit tests should complete in under 100ms, integration tests in under 1 second. Slow tests violate the **F** (Fast) principle in FIRST.

### Why This Matters

The slower tests run, the less often developers run them. Slow tests break the TDD workflow and reduce feedback speed. A test suite that takes minutes to run means developers wait for feedback, context-switch, and lose productivity. Fast tests enable continuous testing and rapid iteration.

**Speed Guidelines**:
- **Unit tests**: < 100ms per test
- **Integration tests**: < 1 second per test
- **Full test suite**: Should run in seconds, not minutes

### ❌ WRONG: Direct Database Access in Unit Test

```javascript
// Jest - unit test with slow database calls
describe('UserRepository', () => {
  it('should save user to database', async () => {
    // Arrange
    const db = await connectToDatabase(); // SLOW: Real DB connection
    const repo = new UserRepository(db);
    const user = { id: 1, name: 'Alice' };

    // Act
    await repo.save(user); // SLOW: Real database write

    // Assert
    const saved = await repo.findById(1); // SLOW: Real database read
    expect(saved.name).toBe('Alice');

    // Cleanup
    await db.delete(user.id);
    await db.disconnect();
  });
});
```

**What breaks**:
- Database connection takes 100-500ms
- Database operations take 50-200ms each
- Test takes 500ms+ instead of <100ms
- Multiplied across hundreds of tests = minutes of wait time
- Violates unit test principle (should test in isolation)

### ❌ WRONG: Sleep/Wait Statements (Sleeping Snail)

```python
# Pytest - hard-coded sleep makes test slow
import time

def test_async_processing():
    # Arrange
    processor = AsyncProcessor()

    # Act
    processor.start_processing()
    time.sleep(2)  # WRONG: Hard-coded 2-second wait

    # Assert
    assert processor.is_complete()
```

**What breaks**:
- Test always waits 2 seconds, even if processing finishes in 100ms
- Wastes 1.9 seconds of time in the fast case
- Might still fail if processing takes > 2 seconds
- Multiplied across many tests = extremely slow suite

### ✅ CORRECT: In-Memory Fake for Database

```javascript
// Jest - fast test with in-memory fake
class FakeDatabase {
  constructor() {
    this.users = new Map();
  }

  async save(user) {
    this.users.set(user.id, { ...user });
  }

  async findById(id) {
    return this.users.get(id);
  }

  async delete(id) {
    this.users.delete(id);
  }
}

describe('UserRepository', () => {
  it('should save user to storage', async () => {
    // Arrange
    const db = new FakeDatabase(); // FAST: In-memory
    const repo = new UserRepository(db);
    const user = { id: 1, name: 'Alice' };

    // Act
    await repo.save(user);

    // Assert
    const saved = await repo.findById(1);
    expect(saved.name).toBe('Alice');
  });
});
```

**Why this works**:
- In-memory fake is instant (no I/O)
- Test completes in <10ms
- Still tests repository logic
- No cleanup needed (fake is discarded)
- True unit test (isolated from real database)

### ✅ CORRECT: Polling with Timeout Instead of Sleep

```python
# Pytest - explicit wait with timeout
import time

def wait_until(condition, timeout=1.0, poll_interval=0.01):
    """Wait until condition is true or timeout expires."""
    start = time.time()
    while time.time() - start < timeout:
        if condition():
            return True
        time.sleep(poll_interval)
    return False

def test_async_processing_completes():
    # Arrange
    processor = AsyncProcessor()

    # Act
    processor.start_processing()

    # Assert - wait efficiently with timeout
    completed = wait_until(lambda: processor.is_complete(), timeout=1.0)
    assert completed, "Processing should complete within 1 second"
```

**Why this works**:
- Returns as soon as condition is met (could be 50ms)
- Only waits full timeout if something is wrong
- More reliable than fixed sleep
- Still fast in the common case

### Framework-Specific Performance Tools

- **Jest**: Use `jest.useFakeTimers()` to control time
- **Pytest**: Use `pytest-timeout` plugin to enforce time limits
- **JUnit**: Use `@Timeout` annotation to fail slow tests
- **RSpec**: Use `around(:example)` with timeout

---

## Test Structure Checklist

Before committing test code, verify:

- [ ] Each test follows AAA pattern (Arrange-Act-Assert) with clear separation
- [ ] Each test verifies one logical concept with focused assertions
- [ ] Test names describe behavior using "should [behavior] when [condition]" format
- [ ] Tests are independent and can run in any order or in parallel
- [ ] Setup uses beforeEach/afterEach to ensure isolation
- [ ] No shared mutable state between tests
- [ ] Setup complexity is minimized (no Mystery Guest or Excessive Setup)
- [ ] All test data is visible in test or well-named helper methods
- [ ] Unit tests run in under 100ms
- [ ] No hard-coded sleep/wait statements
- [ ] External dependencies are mocked or faked

---

## Common Patterns and Solutions

### Pattern: Testing Multiple Scenarios

**WRONG**: Multiple behaviors in one test
```javascript
it('validates input', () => {
  expect(validate('')).toBe(false);
  expect(validate('a')).toBe(false);
  expect(validate('valid')).toBe(true);
});
```

**CORRECT**: Separate test per scenario
```javascript
it('should reject empty string', () => {
  expect(validate('')).toBe(false);
});

it('should reject string shorter than minimum length', () => {
  expect(validate('a')).toBe(false);
});

it('should accept valid string', () => {
  expect(validate('valid')).toBe(true);
});
```

### Pattern: Parameterized Tests (When Appropriate)

```python
# Pytest - parameterized for data-driven scenarios
import pytest

@pytest.mark.parametrize('email,expected', [
    ('valid@example.com', True),
    ('invalid', False),
    ('no@domain', False),
    ('', False),
])
def test_email_validation(email, expected):
    result = validate_email(email)
    assert result == expected
```

**When to use**: Multiple inputs testing the same logic with different data
**When not to use**: Different behaviors or different code paths

### Pattern: Explicit Waits for Async Tests

```typescript
// Jest - proper async test handling
it('should load user data asynchronously', async () => {
  // Arrange
  const service = new UserService();

  // Act
  const user = await service.loadUser(1);

  // Assert
  expect(user.name).toBe('Alice');
});
```

---

## Debugging Test Failures

**Test fails intermittently**:
- **Cause**: Test Interdependence, shared state, timing issues
- **Fix**: Add `beforeEach` to reset state, use explicit waits, check for shared mutable state

**Can't understand why test failed**:
- **Cause**: Poor test name, multiple assertions, obscure setup
- **Fix**: Rename test to describe behavior, split into focused tests, simplify setup

**Test is slow**:
- **Cause**: Real database/network/file I/O, hard-coded sleeps
- **Fix**: Use in-memory fakes, mock external dependencies, replace sleep with explicit waits

**Test fails when run alone but passes in suite**:
- **Cause**: Depends on state from previous test
- **Fix**: Add explicit setup in the test, ensure beforeEach creates all needed state

---

## Summary

Test structure is not optional - it's the foundation of maintainable test suites. Well-structured tests serve as executable documentation, making codebases easier to understand, debug, and evolve. These six rules provide a comprehensive framework:

1. **Follow AAA Pattern**: Arrange-Act-Assert provides clear structure
2. **One Logical Assertion**: Focus tests on single behaviors
3. **Descriptive Names**: "should [behavior] when [condition]"
4. **Isolation**: No dependencies between tests
5. **Minimal Setup**: Avoid Mystery Guest and Excessive Setup
6. **Fast Execution**: Unit tests <100ms, integration tests <1s

These rules apply across all testing frameworks and languages. They are based on decades of testing research and industry best practices from authorities including Gerard Meszaros (xUnit Test Patterns), Martin Fowler, Kent Beck, and Google's testing practices.

**Key insight**: Tests are code. Apply the same quality standards to test code as production code. Poor test structure creates technical debt that compounds over time.
