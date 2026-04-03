# Assertion Rules

Clear, meaningful assertions are the foundation of maintainable test suites. Assertions communicate test intent, provide diagnostic information when failures occur, and serve as living documentation of expected behavior. Poor assertion practices lead to the "Assertion Roulette" anti-pattern, where developers waste hours debugging test failures because they can't tell which assertion failed or why.

## The Problem: Unclear Test Failures

When tests fail with generic messages like "expected true but got false" or "AssertionError", developers must:

1. Read the entire test to understand context
2. Add debugging statements to identify which assertion failed
3. Re-run the test multiple times to diagnose the issue
4. Waste 10-20 minutes per failure that could take 30 seconds with clear assertions

**Key insight**: Assertions are not just validation—they're documentation and diagnostic tools.

---

## Rule 1: Use Specific Assertions

**Statement**: Use the most specific assertion method available for the comparison being made. Never use generic assertions when specific ones exist.

### Why This Matters

Generic assertions like `assertTrue()` or `assert condition` provide minimal context when they fail. Specific assertion methods include the expected and actual values in failure messages, making failures instantly diagnosable.

Consider the failure messages:

- Generic: `AssertionError: False is not true` (what was false?)
- Specific: `AssertionError: Expected user age 17 to be greater than 18` (immediately clear)

### The Assertion Hierarchy

```
Generic (least specific, worst failures)
  ↓
Boolean checks (assertTrue/assertFalse)
  ↓
Equality checks (assertEquals/toBe)
  ↓
Specialized checks (toBeGreaterThan, toContain, toThrow)
  ↓
Domain-specific matchers (best diagnostics)
```

Always use the most specific assertion available.

### ❌ WRONG: Generic assertTrue/assert

**Jest (JavaScript/TypeScript):**
```typescript
// ❌ WRONG: Generic boolean assertion
test('validates user age', () => {
  const user = { name: 'John', age: 17 };
  expect(user.age > 18).toBe(true);
  // Failure: "Expected: true, Received: false" - no context!
});

// ❌ WRONG: Truthiness check
test('finds user by email', () => {
  const user = findUserByEmail('john@example.com');
  expect(!!user).toBeTruthy();
  // Failure: "Expected: truthy, Received: undefined" - which user?
});
```

**Pytest (Python):**
```python
# ❌ WRONG: Generic assert
def test_user_age_validation():
    user = {"name": "John", "age": 17}
    assert user["age"] > 18  # Failure: "assert 17 > 18" - minimal context

# ❌ WRONG: Boolean comparison
def test_email_validation():
    is_valid = validate_email("invalid-email")
    assert is_valid == True  # Should use specific assertion
```

**JUnit 5 (Java):**
```java
// ❌ WRONG: assertTrue with comparison
@Test
void validateUserAge() {
    User user = new User("John", 17);
    assertTrue(user.getAge() > 18);
    // Failure: "expected: <true> but was: <false>" - what age?
}

// ❌ WRONG: Generic boolean
@Test
void findUserByEmail() {
    User user = userService.findByEmail("john@example.com");
    assertTrue(user != null);
    // Failure: "expected: <true> but was: <false>" - no diagnostic info
}
```

**Mocha + Chai (JavaScript/Node.js):**
```javascript
// ❌ WRONG: Generic boolean expectation
describe('User validation', () => {
  it('validates user age', () => {
    const user = { name: 'John', age: 17 };
    expect(user.age > 18).to.be.true;
    // Failure: "expected false to be true" - no context!
  });

  it('validates email format', () => {
    const result = validateEmail('invalid-email');
    expect(!!result).to.equal(true);
    // Failure: "expected false to equal true" - what failed?
  });
});
```

**RSpec (Ruby):**
```ruby
# ❌ WRONG: Generic boolean expectation
describe 'User validation' do
  it 'validates user age' do
    user = { name: 'John', age: 17 }
    expect(user[:age] > 18).to be(true)
    # Failure: "expected true, got false" - no diagnostic info
  end

  it 'finds user by email' do
    user = find_user_by_email('john@example.com')
    expect(user.nil?).to be(false)
    # Failure: "expected false, got true" - which user?
  end
end
```

### ✅ CORRECT: Specific Assertion Methods

**Jest (JavaScript/TypeScript):**
```typescript
// ✅ CORRECT: Specific comparison matcher
test('validates user age', () => {
  const user = { name: 'John', age: 17 };
  expect(user.age).toBeGreaterThan(18);
  // Failure: "Expected 17 to be greater than 18" - crystal clear!
});

// ✅ CORRECT: Specific existence matcher
test('finds user by email', () => {
  const user = findUserByEmail('john@example.com');
  expect(user).toBeDefined();
  expect(user.email).toBe('john@example.com');
  // Failure: "Expected: defined, Received: undefined" - clear what's missing
});

// ✅ CORRECT: Collection matchers
test('shopping cart contains product', () => {
  const cart = new ShoppingCart();
  cart.addItem({ id: 1, name: 'Laptop' });
  expect(cart.getItems()).toContainEqual({ id: 1, name: 'Laptop' });
  // Failure shows actual cart contents vs expected item
});

// ✅ CORRECT: String matchers
test('error message contains details', () => {
  const error = new ValidationError('Email format is invalid for user@');
  expect(error.message).toContain('Email format is invalid');
  // Failure shows full actual message: "Expected 'Email format...' to contain 'Email format...'"
});
```

**Pytest (Python):**
```python
# ✅ CORRECT: Comparison operators with pytest's introspection
def test_user_age_validation():
    user = {"name": "John", "age": 17}
    assert user["age"] > 18
    # Failure: "AssertionError: assert 17 > 18" (pytest shows full context)

# ✅ CORRECT: Specific pytest assertions
def test_user_age_validation_explicit():
    user = {"name": "John", "age": 17}
    assert user["age"] > 18, f"User age {user['age']} must be greater than 18"
    # Failure: "AssertionError: User age 17 must be greater than 18"

# ✅ CORRECT: Collection membership
def test_user_roles():
    user_roles = ["viewer", "editor"]
    assert "admin" in user_roles, f"Expected 'admin' in {user_roles}"
    # Failure: "AssertionError: Expected 'admin' in ['viewer', 'editor']"

# ✅ CORRECT: String containment
def test_error_message():
    error = ValidationError("Email format is invalid for user@")
    assert "Email format" in str(error)
    # Failure shows actual message content

# ✅ CORRECT: pytest.raises for exceptions
def test_division_by_zero():
    with pytest.raises(ZeroDivisionError, match="division by zero"):
        calculator.divide(10, 0)
    # Failure shows if wrong exception or wrong message
```

**JUnit 5 (Java):**
```java
// ✅ CORRECT: Specific comparison assertion
@Test
void validateUserAge() {
    User user = new User("John", 17);
    assertTrue(user.getAge() > 18,
        () -> "User age " + user.getAge() + " must be greater than 18");
    // Failure: "User age 17 must be greater than 18"
}

// ✅ CORRECT: Null/not-null assertions
@Test
void findUserByEmail() {
    User user = userService.findByEmail("john@example.com");
    assertNotNull(user, "User with email john@example.com should exist");
    assertEquals("john@example.com", user.getEmail());
    // Clear diagnostic: "User with email john@example.com should exist"
}

// ✅ CORRECT: Collection assertions
@Test
void shoppingCartContainsProduct() {
    ShoppingCart cart = new ShoppingCart();
    cart.addItem(new Item(1, "Laptop"));
    assertTrue(cart.getItems().stream()
        .anyMatch(item -> item.getName().equals("Laptop")),
        "Cart should contain Laptop");
    // Or use assertIterableEquals for complete comparison
}

// ✅ CORRECT: Exception assertions
@Test
void divisionByZeroThrowsException() {
    Exception exception = assertThrows(ArithmeticException.class, () -> {
        calculator.divide(10, 0);
    });
    assertEquals("/ by zero", exception.getMessage());
    // Failure shows actual exception type and message
}
```

**Mocha + Chai (JavaScript/Node.js):**
```javascript
// ✅ CORRECT: Specific comparison matchers
describe('User validation', () => {
  it('validates user age', () => {
    const user = { name: 'John', age: 17 };
    expect(user.age).to.be.above(18);
    // Failure: "expected 17 to be above 18" - specific!
  });

  it('finds user by email', () => {
    const user = findUserByEmail('john@example.com');
    expect(user).to.exist;
    expect(user).to.have.property('email', 'john@example.com');
    // Failure shows which property failed and why
  });

  it('shopping cart contains product', () => {
    const cart = new ShoppingCart();
    cart.addItem({ id: 1, name: 'Laptop' });
    expect(cart.getItems()).to.deep.include({ id: 1, name: 'Laptop' });
    // Failure shows actual array contents vs expected object
  });

  it('error message contains details', () => {
    const error = new ValidationError('Email format is invalid');
    expect(error.message).to.include('Email format');
    // Failure shows actual message: "expected 'Email...' to include 'Email...'"
  });
});
```

**RSpec (Ruby):**
```ruby
# ✅ CORRECT: Specific matchers
describe 'User validation' do
  it 'validates user age' do
    user = { name: 'John', age: 17 }
    expect(user[:age]).to be > 18
    # Failure: "expected 17 to be > 18" - clear comparison
  end

  it 'finds user by email' do
    user = find_user_by_email('john@example.com')
    expect(user).not_to be_nil
    expect(user.email).to eq('john@example.com')
    # Failure shows expected vs actual values
  end

  it 'shopping cart contains product' do
    cart = ShoppingCart.new
    cart.add_item(id: 1, name: 'Laptop')
    expect(cart.items).to include(hash_including(name: 'Laptop'))
    # Failure shows array contents and missing element
  end

  it 'error message contains details' do
    error = ValidationError.new('Email format is invalid')
    expect(error.message).to include('Email format')
    # Failure shows actual message vs expected substring
  end

  it 'raises exception on division by zero' do
    expect { calculator.divide(10, 0) }.to raise_error(ZeroDivisionError, /division/)
    # Failure shows actual exception type and message
  end
end
```

### Framework-Specific Assertion Libraries

**Jest Matchers:**
- Equality: `.toBe()` (===), `.toEqual()` (deep equality)
- Truthiness: `.toBeTruthy()`, `.toBeFalsy()`, `.toBeNull()`, `.toBeUndefined()`, `.toBeDefined()`
- Numbers: `.toBeGreaterThan()`, `.toBeLessThan()`, `.toBeCloseTo()` (floating point)
- Strings: `.toMatch()`, `.toContain()`
- Arrays/Iterables: `.toContain()`, `.toContainEqual()`, `.toHaveLength()`
- Objects: `.toHaveProperty()`, `.toMatchObject()`
- Exceptions: `.toThrow()`, `.toThrowError()`
- Async: `.resolves`, `.rejects`
- Mocks: `.toHaveBeenCalled()`, `.toHaveBeenCalledWith()`

**Pytest Assertions:**
- Use Python's native `assert` statement with comparison operators
- `pytest.raises(ExceptionType, match="regex")` for exceptions
- `pytest.approx()` for floating-point comparisons
- `assert x in collection` for membership
- Pytest's introspection shows detailed failure context automatically

**JUnit 5 Assertions:**
- Equality: `assertEquals(expected, actual)`, `assertNotEquals()`
- Boolean: `assertTrue(condition)`, `assertFalse(condition)`
- Null: `assertNull(object)`, `assertNotNull(object)`
- Same reference: `assertSame()`, `assertNotSame()`
- Arrays: `assertArrayEquals()`
- Exceptions: `assertThrows(ExceptionType.class, executable)`
- Timeouts: `assertTimeout(duration, executable)`
- Grouped: `assertAll(executables...)` - reports all failures

**Chai Matchers (with Mocha):**
- Chains: `.to`, `.be`, `.been`, `.is`, `.that`, `.which`, `.and`, `.has`, `.have`, `.with`
- Equality: `.equal()`, `.eql()` (deep), `.deep.equal()`
- Truthiness: `.true`, `.false`, `.null`, `.undefined`, `.exist`
- Type: `.a('type')`, `.instanceof()`
- Comparison: `.above()`, `.below()`, `.within(start, finish)`
- Strings: `.match()`, `.string()`, `.include()`
- Properties: `.property()`, `.own.property()`, `.deep.property()`
- Length: `.length`, `.lengthOf()`
- Collections: `.include()`, `.contain()`, `.members()`

**RSpec Matchers:**
- Equality: `eq(expected)`, `eql(expected)` (value), `equal(expected)` (object identity)
- Truthiness: `be_truthy`, `be_falsy`, `be_nil`, `be(true)`, `be(false)`
- Comparison: `be > value`, `be >= value`, `be < value`, `be <= value`
- Type: `be_a(ClassName)`, `be_an_instance_of(ClassName)`
- Predicates: `be_empty`, `be_valid`, any `be_*` method
- Collections: `include(item)`, `contain_exactly()`, `match_array()`
- Strings: `match(/regex/)`, `start_with()`, `end_with()`, `include(substring)`
- Exceptions: `raise_error(ExceptionType)`, `raise_error(ExceptionType, message)`
- Change: `change { }.from(old).to(new)`, `change { }.by(delta)`

---

## Rule 2: Include Meaningful Failure Messages

**Statement**: Every non-obvious assertion should include a descriptive failure message that explains what was expected and why the test failed.

### Why This Matters

When a test fails in CI/CD at 3 AM, the failure message is your only diagnostic tool. A clear message lets you identify the problem instantly. A generic message forces you to:

1. Pull down the branch
2. Check out the failing commit
3. Read the test code
4. Re-run the test locally with debugging
5. Waste 30+ minutes on something that should take 30 seconds

**Google Testing Blog**: "Good test failure messages reduce debugging time by 80%."

### The Anatomy of a Good Failure Message

A good failure message includes:
1. **What** was being tested (context)
2. **Expected** behavior or value
3. **Actual** result
4. **Why** this matters (optional, for complex cases)

### ❌ WRONG: No Failure Message

**Jest:**
```typescript
test('processes payment', async () => {
  const result = await paymentService.process(order);
  expect(result.status).toBe('completed');
  // Failure: "Expected: 'completed', Received: 'pending'" - why pending?
  expect(result.transactionId).toBeDefined();
  // Failure: "Expected: defined, Received: undefined" - which transaction?
});
```

**Pytest:**
```python
def test_payment_processing():
    result = payment_service.process(order)
    assert result.status == "completed"
    # Failure: "assert 'pending' == 'completed'" - no context
    assert result.transaction_id is not None
    # Failure: "assert None is not None" - why missing?
```

**JUnit 5:**
```java
@Test
void processPayment() {
    PaymentResult result = paymentService.process(order);
    assertEquals("completed", result.getStatus());
    // Failure: "expected: <completed> but was: <pending>" - no context
    assertNotNull(result.getTransactionId());
    // Failure: "expected: not <null> but was: <null>" - why?
}
```

**Mocha + Chai:**
```javascript
it('processes payment', async () => {
  const result = await paymentService.process(order);
  expect(result.status).to.equal('completed');
  // Failure: "expected 'pending' to equal 'completed'" - no context
  expect(result.transactionId).to.exist;
  // Failure: "expected undefined to exist" - which transaction?
});
```

**RSpec:**
```ruby
it 'processes payment' do
  result = payment_service.process(order)
  expect(result.status).to eq('completed')
  # Failure: "expected: 'completed' got: 'pending'" - no context
  expect(result.transaction_id).not_to be_nil
  # Failure: "expected: not nil got: nil" - why?
end
```

### ✅ CORRECT: Descriptive Failure Messages

**Jest:**
```typescript
test('processes payment for valid order', async () => {
  const order = { id: 'ORD-123', amount: 99.99, currency: 'USD' };
  const result = await paymentService.process(order);

  expect(result.status).toBe('completed',
    `Payment for order ${order.id} should complete successfully, ` +
    `but got status: ${result.status}. Check payment gateway logs.`
  );

  expect(result.transactionId).toBeDefined(
    `Transaction ID should be assigned after successful payment processing ` +
    `for order ${order.id}`
  );

  expect(result.amount).toBe(order.amount,
    `Processed amount should match order amount. ` +
    `Expected ${order.amount}, got ${result.amount}`
  );
});

// Note: Jest doesn't support custom messages in all matchers directly
// For better messages, use conditional checks with explicit messages:
test('processes payment with explicit messages', async () => {
  const order = { id: 'ORD-123', amount: 99.99, currency: 'USD' };
  const result = await paymentService.process(order);

  if (result.status !== 'completed') {
    throw new Error(
      `Payment for order ${order.id} should complete successfully, ` +
      `but got status: ${result.status}. Check payment gateway logs.`
    );
  }

  expect(result.status).toBe('completed');
});
```

**Pytest:**
```python
def test_payment_processing():
    order = {"id": "ORD-123", "amount": 99.99, "currency": "USD"}
    result = payment_service.process(order)

    assert result.status == "completed", (
        f"Payment for order {order['id']} should complete successfully, "
        f"but got status: {result.status}. Check payment gateway logs."
    )

    assert result.transaction_id is not None, (
        f"Transaction ID should be assigned after successful payment processing "
        f"for order {order['id']}"
    )

    assert result.amount == order["amount"], (
        f"Processed amount should match order amount. "
        f"Expected {order['amount']}, got {result.amount}"
    )
```

**JUnit 5:**
```java
@Test
void processPaymentForValidOrder() {
    Order order = new Order("ORD-123", 99.99, "USD");
    PaymentResult result = paymentService.process(order);

    assertEquals("completed", result.getStatus(),
        () -> "Payment for order " + order.getId() + " should complete successfully, " +
              "but got status: " + result.getStatus() + ". Check payment gateway logs.");

    assertNotNull(result.getTransactionId(),
        () -> "Transaction ID should be assigned after successful payment processing " +
              "for order " + order.getId());

    assertEquals(order.getAmount(), result.getAmount(),
        () -> "Processed amount should match order amount. " +
              "Expected " + order.getAmount() + ", got " + result.getAmount());
}
```

**Mocha + Chai:**
```javascript
describe('Payment processing', () => {
  it('processes payment for valid order', async () => {
    const order = { id: 'ORD-123', amount: 99.99, currency: 'USD' };
    const result = await paymentService.process(order);

    // Chai doesn't support custom messages on all matchers
    // Use manual checks or assertion libraries that do
    if (result.status !== 'completed') {
      throw new Error(
        `Payment for order ${order.id} should complete successfully, ` +
        `but got status: ${result.status}. Check payment gateway logs.`
      );
    }

    if (!result.transactionId) {
      throw new Error(
        `Transaction ID should be assigned after successful payment processing ` +
        `for order ${order.id}`
      );
    }

    expect(result.status).to.equal('completed');
    expect(result.transactionId).to.exist;
    expect(result.amount).to.equal(order.amount);
  });
});
```

**RSpec:**
```ruby
describe 'Payment processing' do
  it 'processes payment for valid order' do
    order = { id: 'ORD-123', amount: 99.99, currency: 'USD' }
    result = payment_service.process(order)

    expect(result.status).to(
      eq('completed'),
      "Payment for order #{order[:id]} should complete successfully, " \
      "but got status: #{result.status}. Check payment gateway logs."
    )

    expect(result.transaction_id).not_to(
      be_nil,
      "Transaction ID should be assigned after successful payment processing " \
      "for order #{order[:id]}"
    )

    expect(result.amount).to(
      eq(order[:amount]),
      "Processed amount should match order amount. " \
      "Expected #{order[:amount]}, got #{result.amount}"
    )
  end
end
```

### Custom Message Syntax by Framework

**Jest:**
- Limited built-in support for custom messages
- Use conditional checks with explicit `throw new Error(message)`
- Or wrap assertions in try-catch with custom error handling

**Pytest:**
```python
assert condition, "custom message"
assert x == y, f"Expected {y}, got {x}"
```

**JUnit 5:**
```java
// String message
assertEquals(expected, actual, "message");

// Lazy message (only computed on failure)
assertEquals(expected, actual, () -> "expensive " + computation());
```

**Mocha + Chai:**
- Limited support in Chai matchers
- Use manual checks with custom errors
- Or use assertion libraries with better message support

**RSpec:**
```ruby
expect(actual).to eq(expected), "custom message"
# Or with block syntax:
expect(actual).to(eq(expected), "custom message")
```

---

## Rule 3: One Logical Assertion Per Test

**Statement**: Each test should verify one specific behavior or outcome. Avoid testing multiple unrelated things in a single test (Assertion Roulette).

### Why This Matters

When a test has multiple assertions and fails, you face several problems:

1. **Which assertion failed?** The first? The last? Somewhere in the middle?
2. **What about the others?** If assertion 2 fails, assertions 3-5 never run. Are they also broken?
3. **What broke the code?** Multiple assertions test different behaviors. Which behavior regressed?

**xUnit Test Patterns**: "Tests with multiple assertions are hard to understand and diagnose. When they fail, you must hunt through the test to find which assertion failed."

### The Exception: Multiple Assertions Testing the Same Concept

It's acceptable to have multiple assertions when they all verify the same logical concept. For example, testing that an API response has the correct status AND the correct body structure is one logical assertion: "the API returns a valid success response."

### ❌ WRONG: Multiple Unrelated Assertions (Assertion Roulette)

**Jest:**
```typescript
// ❌ WRONG: Testing multiple unrelated user properties
test('user profile is valid', () => {
  const user = getUserProfile(1);

  expect(user.id).toBe(1);                    // Assertion 1: ID
  expect(user.name).toBe('John Doe');         // Assertion 2: Name
  expect(user.email).toContain('@');          // Assertion 3: Email format
  expect(user.age).toBeGreaterThan(18);       // Assertion 4: Age validation
  expect(user.roles).toContain('admin');      // Assertion 5: Role membership
  expect(user.createdAt).toBeInstanceOf(Date);// Assertion 6: Date type

  // If assertion 3 fails, you don't know if assertions 4-6 would pass
  // Which behavior regressed: ID assignment, name fetching, email format,
  // age validation, role management, or date handling?
});
```

**Pytest:**
```python
# ❌ WRONG: Testing multiple unrelated user properties
def test_user_profile_valid():
    user = get_user_profile(1)

    assert user["id"] == 1                    # Assertion 1
    assert user["name"] == "John Doe"         # Assertion 2
    assert "@" in user["email"]               # Assertion 3
    assert user["age"] > 18                   # Assertion 4
    assert "admin" in user["roles"]           # Assertion 5
    assert isinstance(user["created_at"], datetime)  # Assertion 6

    # Same problem: which specific behavior broke?
```

**JUnit 5:**
```java
// ❌ WRONG: Testing multiple unrelated user properties
@Test
void userProfileIsValid() {
    User user = userService.getProfile(1);

    assertEquals(1, user.getId());                    // Assertion 1
    assertEquals("John Doe", user.getName());         // Assertion 2
    assertTrue(user.getEmail().contains("@"));        // Assertion 3
    assertTrue(user.getAge() > 18);                   // Assertion 4
    assertTrue(user.getRoles().contains("admin"));    // Assertion 5
    assertTrue(user.getCreatedAt() instanceof Date);  // Assertion 6

    // Same problems: unclear which behavior broke
}
```

**Mocha + Chai:**
```javascript
// ❌ WRONG: Testing multiple unrelated user properties
it('validates user profile', () => {
  const user = getUserProfile(1);

  expect(user.id).to.equal(1);
  expect(user.name).to.equal('John Doe');
  expect(user.email).to.include('@');
  expect(user.age).to.be.above(18);
  expect(user.roles).to.include('admin');
  expect(user.createdAt).to.be.instanceOf(Date);

  // Difficult to diagnose which specific aspect failed
});
```

**RSpec:**
```ruby
# ❌ WRONG: Testing multiple unrelated user properties
it 'validates user profile' do
  user = get_user_profile(1)

  expect(user[:id]).to eq(1)
  expect(user[:name]).to eq('John Doe')
  expect(user[:email]).to include('@')
  expect(user[:age]).to be > 18
  expect(user[:roles]).to include('admin')
  expect(user[:created_at]).to be_a(Time)

  # Same diagnostic difficulties
end
```

### ✅ CORRECT: Separate Tests for Each Behavior

**Jest:**
```typescript
describe('User Profile', () => {
  // Each test verifies ONE behavior

  test('assigns correct user ID', () => {
    const user = getUserProfile(1);
    expect(user.id).toBe(1);
  });

  test('fetches user name', () => {
    const user = getUserProfile(1);
    expect(user.name).toBe('John Doe');
  });

  test('validates email format', () => {
    const user = getUserProfile(1);
    expect(user.email).toContain('@');
    expect(user.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });

  test('enforces age requirement', () => {
    const user = getUserProfile(1);
    expect(user.age).toBeGreaterThan(18);
  });

  test('assigns admin role', () => {
    const user = getUserProfile(1);
    expect(user.roles).toContain('admin');
  });

  test('records creation timestamp', () => {
    const user = getUserProfile(1);
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.createdAt.getTime()).toBeLessThanOrEqual(Date.now());
  });
});
```

**Pytest:**
```python
class TestUserProfile:
    """Each test verifies ONE behavior"""

    def test_assigns_correct_user_id(self):
        user = get_user_profile(1)
        assert user["id"] == 1

    def test_fetches_user_name(self):
        user = get_user_profile(1)
        assert user["name"] == "John Doe"

    def test_validates_email_format(self):
        user = get_user_profile(1)
        assert "@" in user["email"]
        assert re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", user["email"])

    def test_enforces_age_requirement(self):
        user = get_user_profile(1)
        assert user["age"] > 18

    def test_assigns_admin_role(self):
        user = get_user_profile(1)
        assert "admin" in user["roles"]

    def test_records_creation_timestamp(self):
        user = get_user_profile(1)
        assert isinstance(user["created_at"], datetime)
        assert user["created_at"] <= datetime.now()
```

**JUnit 5:**
```java
@DisplayName("User Profile Tests")
class UserProfileTest {
    // Each test verifies ONE behavior

    @Test
    @DisplayName("assigns correct user ID")
    void assignsCorrectUserId() {
        User user = userService.getProfile(1);
        assertEquals(1, user.getId());
    }

    @Test
    @DisplayName("fetches user name")
    void fetchesUserName() {
        User user = userService.getProfile(1);
        assertEquals("John Doe", user.getName());
    }

    @Test
    @DisplayName("validates email format")
    void validatesEmailFormat() {
        User user = userService.getProfile(1);
        assertTrue(user.getEmail().contains("@"));
        assertTrue(user.getEmail().matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"));
    }

    @Test
    @DisplayName("enforces age requirement")
    void enforcesAgeRequirement() {
        User user = userService.getProfile(1);
        assertTrue(user.getAge() > 18);
    }

    @Test
    @DisplayName("assigns admin role")
    void assignsAdminRole() {
        User user = userService.getProfile(1);
        assertTrue(user.getRoles().contains("admin"));
    }

    @Test
    @DisplayName("records creation timestamp")
    void recordsCreationTimestamp() {
        User user = userService.getProfile(1);
        assertInstanceOf(Date.class, user.getCreatedAt());
        assertTrue(user.getCreatedAt().getTime() <= System.currentTimeMillis());
    }
}
```

**Mocha + Chai:**
```javascript
describe('User Profile', () => {
  // Each test verifies ONE behavior

  it('assigns correct user ID', () => {
    const user = getUserProfile(1);
    expect(user.id).to.equal(1);
  });

  it('fetches user name', () => {
    const user = getUserProfile(1);
    expect(user.name).to.equal('John Doe');
  });

  it('validates email format', () => {
    const user = getUserProfile(1);
    expect(user.email).to.include('@');
    expect(user.email).to.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });

  it('enforces age requirement', () => {
    const user = getUserProfile(1);
    expect(user.age).to.be.above(18);
  });

  it('assigns admin role', () => {
    const user = getUserProfile(1);
    expect(user.roles).to.include('admin');
  });

  it('records creation timestamp', () => {
    const user = getUserProfile(1);
    expect(user.createdAt).to.be.instanceOf(Date);
    expect(user.createdAt.getTime()).to.be.at.most(Date.now());
  });
});
```

**RSpec:**
```ruby
describe 'User Profile' do
  # Each test verifies ONE behavior

  it 'assigns correct user ID' do
    user = get_user_profile(1)
    expect(user[:id]).to eq(1)
  end

  it 'fetches user name' do
    user = get_user_profile(1)
    expect(user[:name]).to eq('John Doe')
  end

  it 'validates email format' do
    user = get_user_profile(1)
    expect(user[:email]).to include('@')
    expect(user[:email]).to match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
  end

  it 'enforces age requirement' do
    user = get_user_profile(1)
    expect(user[:age]).to be > 18
  end

  it 'assigns admin role' do
    user = get_user_profile(1)
    expect(user[:roles]).to include('admin')
  end

  it 'records creation timestamp' do
    user = get_user_profile(1)
    expect(user[:created_at]).to be_a(Time)
    expect(user[:created_at]).to be <= Time.now
  end
end
```

### ✅ ACCEPTABLE: Multiple Assertions for the Same Concept

When multiple assertions verify the same logical outcome, it's acceptable to group them:

**Jest:**
```typescript
test('API returns valid success response', async () => {
  const response = await api.createUser({ name: 'John', email: 'john@example.com' });

  // All these assertions verify "valid success response" - one concept
  expect(response.status).toBe(200);
  expect(response.data).toHaveProperty('id');
  expect(response.data.name).toBe('John');
  expect(response.data.email).toBe('john@example.com');
});
```

**JUnit 5 with assertAll:**
```java
@Test
void apiReturnsValidSuccessResponse() {
    Response response = api.createUser(new User("John", "john@example.com"));

    // assertAll reports ALL failures, not just the first
    assertAll("valid success response",
        () -> assertEquals(200, response.getStatus()),
        () -> assertNotNull(response.getData().getId()),
        () -> assertEquals("John", response.getData().getName()),
        () -> assertEquals("john@example.com", response.getData().getEmail())
    );
}
```

---

## Rule 4: Assert on Behavior, Not Implementation

**Statement**: Test what the code does (its observable behavior), not how it does it (its internal implementation).

### Why This Matters

Tests coupled to implementation details break during refactoring even when behavior hasn't changed. This creates a maintenance nightmare where every refactoring requires updating dozens of tests, discouraging code improvements.

**Key principle**: Users and callers don't care about internal implementation—they care about behavior. Your tests should mirror this perspective.

### ❌ WRONG: Testing Implementation Details

**Jest:**
```typescript
// ❌ WRONG: Testing internal private state
class ShoppingCart {
  private items: Item[] = [];

  addItem(item: Item) {
    this.items.push(item);
  }

  getTotalPrice(): number {
    return this.items.reduce((sum, item) => sum + item.price, 0);
  }
}

test('adds item to internal array', () => {
  const cart = new ShoppingCart();
  cart.addItem({ id: 1, name: 'Laptop', price: 999 });

  // ❌ WRONG: Accessing private implementation
  expect((cart as any).items).toHaveLength(1);
  expect((cart as any).items[0].name).toBe('Laptop');

  // This test breaks if we change from array to Map, even though behavior is same
});
```

**Pytest:**
```python
# ❌ WRONG: Testing private methods
class ShoppingCart:
    def __init__(self):
        self._items = []

    def add_item(self, item):
        self._validate_item(item)  # Private method
        self._items.append(item)

    def _validate_item(self, item):
        if item["price"] < 0:
            raise ValueError("Invalid price")

def test_validates_item_price():
    cart = ShoppingCart()
    item = {"id": 1, "name": "Laptop", "price": -100}

    # ❌ WRONG: Testing private method directly
    with pytest.raises(ValueError):
        cart._validate_item(item)

    # This test is coupled to implementation
```

**JUnit 5:**
```java
// ❌ WRONG: Testing internal method calls
class UserService {
    private UserRepository repository;
    private EmailService emailService;

    public User createUser(String name, String email) {
        User user = buildUser(name, email);  // Private method
        repository.save(user);
        sendNotification(user);  // Private method
        return user;
    }

    private User buildUser(String name, String email) { /* ... */ }
    private void sendNotification(User user) { /* ... */ }
}

@Test
void createsUserWithCorrectSteps() {
    UserService service = spy(new UserService(repository, emailService));

    // ❌ WRONG: Verifying private method calls
    service.createUser("John", "john@example.com");

    verify(service).buildUser("John", "john@example.com");  // Internal implementation
    verify(service).sendNotification(any(User.class));      // Internal implementation

    // Breaks if we refactor method names or combine steps
}
```

**Mocha + Chai:**
```javascript
// ❌ WRONG: Testing internal state
describe('ShoppingCart', () => {
  it('stores items in internal array', () => {
    const cart = new ShoppingCart();
    cart.addItem({ id: 1, name: 'Laptop', price: 999 });

    // ❌ WRONG: Accessing private property
    expect(cart._items).to.have.lengthOf(1);
    expect(cart._items[0].name).to.equal('Laptop');
  });
});
```

**RSpec:**
```ruby
# ❌ WRONG: Testing private methods
class ShoppingCart
  def add_item(item)
    validate_item(item)
    @items << item
  end

  private

  def validate_item(item)
    raise ArgumentError, "Invalid price" if item[:price] < 0
  end
end

describe ShoppingCart do
  it 'validates item price' do
    cart = ShoppingCart.new
    item = { id: 1, name: 'Laptop', price: -100 }

    # ❌ WRONG: Calling private method
    expect { cart.send(:validate_item, item) }.to raise_error(ArgumentError)
  end
end
```

### ✅ CORRECT: Testing Public Behavior

**Jest:**
```typescript
// ✅ CORRECT: Testing observable behavior
test('calculates correct total price', () => {
  const cart = new ShoppingCart();
  cart.addItem({ id: 1, name: 'Laptop', price: 999 });
  cart.addItem({ id: 2, name: 'Mouse', price: 29 });

  // Test public API and observable behavior
  expect(cart.getTotalPrice()).toBe(1028);

  // This test survives refactoring of internal structure
});

test('handles multiple items correctly', () => {
  const cart = new ShoppingCart();
  cart.addItem({ id: 1, name: 'Laptop', price: 999 });
  cart.addItem({ id: 2, name: 'Mouse', price: 29 });

  // Test behavior through public methods
  expect(cart.getItemCount()).toBe(2);
  expect(cart.getTotalPrice()).toBe(1028);
});
```

**Pytest:**
```python
# ✅ CORRECT: Testing through public API
def test_rejects_invalid_items():
    cart = ShoppingCart()
    invalid_item = {"id": 1, "name": "Laptop", "price": -100}

    # Test validation indirectly through public API
    with pytest.raises(ValueError, match="Invalid price"):
        cart.add_item(invalid_item)

    # Test passes whether validation is in private method, inline, or separate class

def test_calculates_total_price():
    cart = ShoppingCart()
    cart.add_item({"id": 1, "name": "Laptop", "price": 999})
    cart.add_item({"id": 2, "name": "Mouse", "price": 29})

    # Test observable behavior
    assert cart.get_total_price() == 1028
```

**JUnit 5:**
```java
// ✅ CORRECT: Testing observable outcomes
@Test
void createsUserSuccessfully() {
    when(repository.save(any(User.class)))
        .thenAnswer(i -> i.getArgument(0));

    User result = userService.createUser("John", "john@example.com");

    // Assert on observable behavior
    assertNotNull(result);
    assertEquals("John", result.getName());
    assertEquals("john@example.com", result.getEmail());

    // Verify interactions at boundaries, not internal methods
    verify(repository).save(any(User.class));
    verify(emailService).sendWelcomeEmail("john@example.com");
}

@Test
void throwsExceptionForInvalidEmail() {
    // Test behavior: what happens with invalid input?
    assertThrows(ValidationException.class, () -> {
        userService.createUser("John", "invalid-email");
    });

    // Verify side effects didn't happen
    verify(repository, never()).save(any(User.class));
}
```

**Mocha + Chai:**
```javascript
describe('ShoppingCart', () => {
  it('calculates correct total price', () => {
    const cart = new ShoppingCart();
    cart.addItem({ id: 1, name: 'Laptop', price: 999 });
    cart.addItem({ id: 2, name: 'Mouse', price: 29 });

    // Test public behavior
    expect(cart.getTotalPrice()).to.equal(1028);
  });

  it('handles multiple items correctly', () => {
    const cart = new ShoppingCart();
    cart.addItem({ id: 1, name: 'Laptop', price: 999 });
    cart.addItem({ id: 2, name: 'Mouse', price: 29 });

    expect(cart.getItemCount()).to.equal(2);
  });
});
```

**RSpec:**
```ruby
describe ShoppingCart do
  it 'rejects invalid items' do
    cart = ShoppingCart.new
    invalid_item = { id: 1, name: 'Laptop', price: -100 }

    # Test through public API
    expect { cart.add_item(invalid_item) }.to raise_error(ArgumentError, /Invalid price/)
  end

  it 'calculates total price correctly' do
    cart = ShoppingCart.new
    cart.add_item(id: 1, name: 'Laptop', price: 999)
    cart.add_item(id: 2, name: 'Mouse', price: 29)

    # Test observable behavior
    expect(cart.get_total_price).to eq(1028)
  end
end
```

---

## Rule 5: Don't Assert on Mocked Values

**Statement**: Never mock a return value and then assert that same value is returned. This creates circular logic that always passes and tests nothing.

### Why This Matters

When you mock a function to return value X, then assert the result is X, you're testing your mock, not your code. The test will pass even if the actual implementation is completely broken.

**Anti-pattern name**: "Testing the Mock" or "Circular Mocking"

### ❌ WRONG: Asserting on Mocked Return Values

**Jest:**
```typescript
// ❌ WRONG: Testing the mock, not the code
test('fetches user data', async () => {
  const mockUser = { id: 1, name: 'John' };

  // Mock returns mockUser
  jest.spyOn(api, 'fetchUser').mockResolvedValue(mockUser);

  const result = await userService.getUser(1);

  // ❌ WRONG: Of course result === mockUser, we just mocked it!
  expect(result).toEqual(mockUser);
  expect(result.name).toBe('John');

  // This test passes even if getUser is completely broken:
  // async getUser(id) { return null; }  // Still passes!
});
```

**Pytest:**
```python
# ❌ WRONG: Asserting on mock return value
def test_fetches_user_data(mocker):
    mock_user = {"id": 1, "name": "John"}

    # Mock returns mock_user
    mocker.patch('api.fetch_user', return_value=mock_user)

    result = user_service.get_user(1)

    # ❌ WRONG: Of course result == mock_user!
    assert result == mock_user
    assert result["name"] == "John"

    # Passes even if get_user is: def get_user(id): return None
```

**JUnit 5:**
```java
// ❌ WRONG: Testing mock return values
@Test
void fetchesUserData() {
    User mockUser = new User(1, "John");

    // Mock returns mockUser
    when(apiClient.fetchUser(1)).thenReturn(mockUser);

    User result = userService.getUser(1);

    // ❌ WRONG: Circular logic
    assertEquals(mockUser, result);
    assertEquals("John", result.getName());

    // Passes even if getUser is: public User getUser(int id) { return null; }
}
```

**Mocha + Chai:**
```javascript
// ❌ WRONG: Testing the mock
it('fetches user data', async () => {
  const mockUser = { id: 1, name: 'John' };

  // Stub returns mockUser
  sinon.stub(api, 'fetchUser').resolves(mockUser);

  const result = await userService.getUser(1);

  // ❌ WRONG: Circular assertion
  expect(result).to.deep.equal(mockUser);
  expect(result.name).to.equal('John');
});
```

**RSpec:**
```ruby
# ❌ WRONG: Asserting on mocked value
it 'fetches user data' do
  mock_user = { id: 1, name: 'John' }

  # Mock returns mock_user
  allow(api).to receive(:fetch_user).and_return(mock_user)

  result = user_service.get_user(1)

  # ❌ WRONG: Of course result == mock_user!
  expect(result).to eq(mock_user)
  expect(result[:name]).to eq('John')
end
```

### ✅ CORRECT: Assert on Real Behavior

**Jest:**
```typescript
// ✅ CORRECT: Assert on behavior, verify interactions
test('fetches user and transforms data', async () => {
  const apiResponse = { id: 1, full_name: 'John Doe', email_address: 'john@example.com' };
  jest.spyOn(api, 'fetchUser').mockResolvedValue(apiResponse);

  const result = await userService.getUser(1);

  // ✅ CORRECT: Assert on transformation behavior
  expect(result.name).toBe('John Doe');  // Service extracts name
  expect(result.email).toBe('john@example.com');  // Service extracts email
  expect(result.displayName).toBe('John D.');  // Service computes display name

  // ✅ CORRECT: Verify the mock was called correctly
  expect(api.fetchUser).toHaveBeenCalledWith(1);
});

// ✅ CORRECT: Test real logic with test data
test('calculates user age', () => {
  const user = { id: 1, birthDate: new Date('1990-01-01') };

  // Don't mock getCurrentAge—test the real calculation
  const age = userService.getCurrentAge(user);

  // Assert on actual computed value
  const expectedAge = new Date().getFullYear() - 1990;
  expect(age).toBe(expectedAge);
});
```

**Pytest:**
```python
# ✅ CORRECT: Test real behavior
def test_fetches_and_transforms_user(mocker):
    api_response = {"id": 1, "full_name": "John Doe", "email_address": "john@example.com"}
    mocker.patch('api.fetch_user', return_value=api_response)

    result = user_service.get_user(1)

    # ✅ CORRECT: Assert on transformation
    assert result["name"] == "John Doe"
    assert result["email"] == "john@example.com"
    assert result["display_name"] == "John D."

    # ✅ CORRECT: Verify interaction
    api.fetch_user.assert_called_once_with(1)

# ✅ CORRECT: Test real calculation
def test_calculates_user_age():
    user = {"id": 1, "birth_date": date(1990, 1, 1)}

    # Test real logic, don't mock
    age = user_service.get_current_age(user)

    expected_age = date.today().year - 1990
    assert age == expected_age
```

**JUnit 5:**
```java
// ✅ CORRECT: Test behavior and transformations
@Test
void fetchesAndTransformsUser() {
    ApiUser apiResponse = new ApiUser(1, "John Doe", "john@example.com");
    when(apiClient.fetchUser(1)).thenReturn(apiResponse);

    User result = userService.getUser(1);

    // ✅ CORRECT: Assert on service's transformation
    assertEquals("John Doe", result.getName());
    assertEquals("john@example.com", result.getEmail());
    assertEquals("John D.", result.getDisplayName());

    // ✅ CORRECT: Verify interaction
    verify(apiClient).fetchUser(1);
}

// ✅ CORRECT: Test real calculation
@Test
void calculatesUserAge() {
    User user = new User(1, "John", LocalDate.of(1990, 1, 1));

    // Don't mock age calculation—test it
    int age = userService.getCurrentAge(user);

    int expectedAge = LocalDate.now().getYear() - 1990;
    assertEquals(expectedAge, age);
}
```

**Mocha + Chai:**
```javascript
// ✅ CORRECT: Test transformations
it('fetches and transforms user data', async () => {
  const apiResponse = { id: 1, full_name: 'John Doe', email_address: 'john@example.com' };
  sinon.stub(api, 'fetchUser').resolves(apiResponse);

  const result = await userService.getUser(1);

  // ✅ CORRECT: Assert on transformation behavior
  expect(result.name).to.equal('John Doe');
  expect(result.email).to.equal('john@example.com');
  expect(result.displayName).to.equal('John D.');

  expect(api.fetchUser).to.have.been.calledWith(1);
});

// ✅ CORRECT: Test real calculation
it('calculates user age', () => {
  const user = { id: 1, birthDate: new Date('1990-01-01') };

  const age = userService.getCurrentAge(user);

  const expectedAge = new Date().getFullYear() - 1990;
  expect(age).to.equal(expectedAge);
});
```

**RSpec:**
```ruby
# ✅ CORRECT: Test transformations
it 'fetches and transforms user data' do
  api_response = { id: 1, full_name: 'John Doe', email_address: 'john@example.com' }
  allow(api).to receive(:fetch_user).and_return(api_response)

  result = user_service.get_user(1)

  # ✅ CORRECT: Assert on service behavior
  expect(result[:name]).to eq('John Doe')
  expect(result[:email]).to eq('john@example.com')
  expect(result[:display_name]).to eq('John D.')

  expect(api).to have_received(:fetch_user).with(1)
end

# ✅ CORRECT: Test real calculation
it 'calculates user age' do
  user = { id: 1, birth_date: Date.new(1990, 1, 1) }

  age = user_service.get_current_age(user)

  expected_age = Date.today.year - 1990
  expect(age).to eq(expected_age)
end
```

---

## Rule 6: Use Assertion Libraries Effectively

**Statement**: Learn your framework's assertion library deeply and use the right matcher for each situation.

### Why This Matters

Modern assertion libraries provide dozens of specialized matchers. Using the right matcher gives you:
- Better failure messages
- More expressive tests
- Cleaner test code
- Framework-specific optimizations

### Framework-Specific Matcher Guide

#### Jest Matchers

**Common Matchers:**
```typescript
// Equality
expect(value).toBe(42);                    // === equality
expect(value).toEqual({ id: 1 });          // Deep equality
expect(value).toStrictEqual({ id: 1 });    // Strict deep equality (checks undefined)

// Truthiness
expect(value).toBeTruthy();                // Boolean true context
expect(value).toBeFalsy();                 // Boolean false context
expect(value).toBeNull();                  // Exactly null
expect(value).toBeUndefined();             // Exactly undefined
expect(value).toBeDefined();               // Not undefined

// Numbers
expect(value).toBeGreaterThan(10);
expect(value).toBeLessThan(100);
expect(value).toBeGreaterThanOrEqual(10);
expect(value).toBeLessThanOrEqual(100);
expect(0.1 + 0.2).toBeCloseTo(0.3);        // Floating point comparison

// Strings
expect('testing').toMatch(/test/);         // Regex match
expect('hello world').toContain('world');  // Substring

// Arrays/Iterables
expect([1, 2, 3]).toContain(2);
expect([{ id: 1 }]).toContainEqual({ id: 1 });
expect(array).toHaveLength(3);

// Objects
expect(obj).toHaveProperty('name');
expect(obj).toHaveProperty('user.email', 'john@example.com');
expect(obj).toMatchObject({ name: 'John' }); // Partial match

// Exceptions
expect(() => fn()).toThrow();
expect(() => fn()).toThrow(Error);
expect(() => fn()).toThrow('error message');

// Async
await expect(promise).resolves.toBe(value);
await expect(promise).rejects.toThrow();

// Mocks/Spies
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledTimes(2);
expect(mockFn).toHaveBeenCalledWith(arg1, arg2);
expect(mockFn).toHaveBeenLastCalledWith(arg);
```

#### Pytest Assertions

**Common Patterns:**
```python
# Basic assertions (pytest introspection provides great messages)
assert x == y
assert x != y
assert x > y
assert x < y
assert x >= y
assert x <= y

# Truthiness
assert x
assert not x
assert x is None
assert x is not None

# Membership
assert item in collection
assert item not in collection

# String matching
assert "substring" in string
assert string.startswith("prefix")
assert string.endswith("suffix")

# Type checking
assert isinstance(obj, ClassName)

# Floating point comparison
from pytest import approx
assert 0.1 + 0.2 == approx(0.3)
assert [0.1, 0.2] == approx([0.1, 0.2])

# Exceptions
with pytest.raises(ValueError):
    function_that_raises()

with pytest.raises(ValueError, match=r"regex pattern"):
    function_that_raises()

# Warnings
with pytest.warns(UserWarning):
    function_that_warns()

# Custom messages
assert condition, "Custom failure message"
assert x == y, f"Expected {y}, got {x}"
```

#### JUnit 5 Assertions

**Common Assertions:**
```java
// Equality
assertEquals(expected, actual);
assertEquals(expected, actual, "message");
assertNotEquals(first, second);

// Identity (same object)
assertSame(expected, actual);
assertNotSame(first, second);

// Boolean
assertTrue(condition);
assertTrue(condition, "message");
assertFalse(condition);

// Null checks
assertNull(object);
assertNotNull(object);

// Arrays
assertArrayEquals(expectedArray, actualArray);

// Exceptions
assertThrows(ExceptionType.class, () -> {
    codeUnderTest();
});

Exception ex = assertThrows(ExceptionType.class, () -> code());
assertEquals("expected message", ex.getMessage());

// Timeouts
assertTimeout(Duration.ofSeconds(1), () -> {
    // Code that should complete within 1 second
});

// Grouped assertions (all execute, all failures reported)
assertAll("user profile",
    () -> assertEquals("John", user.getName()),
    () -> assertTrue(user.getAge() > 18),
    () -> assertNotNull(user.getEmail())
);

// Iterables
assertIterableEquals(expectedList, actualList);

// Lines (comparing multi-line strings)
assertLinesMatch(expectedLines, actualLines);

// Lazy messages (only computed on failure)
assertEquals(expected, actual, () -> "expensive " + computation());
```

#### Mocha + Chai Matchers

**Common Chains:**
```javascript
// Equality
expect(value).to.equal(42);                // === equality
expect(value).to.deep.equal({ id: 1 });    // Deep equality
expect(value).to.eql({ id: 1 });           // Deep equality (alias)

// Truthiness
expect(value).to.be.true;
expect(value).to.be.false;
expect(value).to.be.null;
expect(value).to.be.undefined;
expect(value).to.exist;                    // Not null/undefined

// Comparison
expect(value).to.be.above(10);
expect(value).to.be.below(100);
expect(value).to.be.at.least(10);
expect(value).to.be.at.most(100);
expect(value).to.be.within(10, 100);

// Types
expect(value).to.be.a('string');
expect(value).to.be.an('object');
expect(value).to.be.instanceof(ClassName);

// Strings
expect('testing').to.match(/test/);
expect('hello').to.have.string('ell');
expect('hello').to.include('ell');

// Arrays/Objects
expect(array).to.include(2);
expect(array).to.have.lengthOf(3);
expect(array).to.have.length.above(2);
expect(obj).to.have.property('name');
expect(obj).to.have.property('name', 'John');
expect(obj).to.have.all.keys('id', 'name');
expect(obj).to.include.keys('id', 'name');

// Deep membership
expect([{ id: 1 }]).to.deep.include({ id: 1 });

// Exceptions
expect(() => fn()).to.throw();
expect(() => fn()).to.throw(Error);
expect(() => fn()).to.throw(/error/);

// Negation
expect(value).to.not.equal(42);

// Chaining
expect(array).to.be.an('array').that.includes(2);
```

#### RSpec Matchers

**Common Matchers:**
```ruby
# Equality
expect(value).to eq(expected)              # ==
expect(value).to eql(expected)             # Value equality
expect(value).to equal(expected)           # Object identity (same object)

# Comparison
expect(value).to be > 10
expect(value).to be < 100
expect(value).to be >= 10
expect(value).to be <= 100
expect(value).to be_between(10, 100)

# Truthiness
expect(value).to be_truthy
expect(value).to be_falsy
expect(value).to be_nil
expect(value).to be(true)                  # Exactly true
expect(value).to be(false)                 # Exactly false

# Type/Class
expect(obj).to be_a(ClassName)
expect(obj).to be_an_instance_of(ClassName)
expect(obj).to be_kind_of(ParentClass)

# Predicates (any method ending in ?)
expect(array).to be_empty                  # array.empty?
expect(user).to be_valid                   # user.valid?
expect(user).to be_admin                   # user.admin?

# Collections
expect(array).to include(item)
expect(array).to contain_exactly(1, 2, 3)  # Any order
expect(array).to match_array([1, 2, 3])    # Any order
expect(hash).to have_key(:name)
expect(hash).to have_value('John')

# Strings
expect(string).to match(/regex/)
expect(string).to start_with('prefix')
expect(string).to end_with('suffix')
expect(string).to include('substring')

# Exceptions
expect { code }.to raise_error
expect { code }.to raise_error(ErrorType)
expect { code }.to raise_error(ErrorType, /message/)
expect { code }.to raise_error(ErrorType, 'exact message')

# Change
expect { code }.to change { counter }.by(1)
expect { code }.to change { counter }.from(0).to(1)
expect { code }.to change(User, :count).by(1)

# Output
expect { puts "hello" }.to output("hello\n").to_stdout
expect { warn "warning" }.to output(/warning/).to_stderr

# Negation
expect(value).not_to eq(other)
```

---

## Sources

### Testing Fundamentals
- [Test Driven Development - Martin Fowler's Bliki](https://martinfowler.com/bliki/TestDrivenDevelopment.html)
- [xUnit Test Patterns - Gerard Meszaros](http://xunitpatterns.com/)
- [Arrange-Act-Assert: A Pattern for Writing Good Tests - Automation Panda](https://automationpanda.com/2020/07/07/arrange-act-assert-a-pattern-for-writing-good-tests/)

### Anti-Patterns
- [Software Testing Anti-patterns - Codepipes Blog](https://blog.codepipes.com/testing/software-testing-antipatterns.html)
- [Software Unit Test Smells - testsmells.org](https://testsmells.org/pages/testsmells.html)
- [Assertion Roulette - testsmells.org](https://testsmells.org/pages/testsmellexamples/assertion-roulette/index.html)
- [Unit Testing Anti-Patterns, Full List - Yegor256](https://www.yegor256.com/2018/12/11/unit-testing-anti-patterns.html)
- [Obscure Test - XUnitPatterns.com](http://xunitpatterns.com/Obscure%20Test.html)

### Google Testing Practices
- [Unit Testing - Software Engineering at Google](https://abseil.io/resources/swe-book/html/ch12.html)
- [Google Testing Blog](https://testing.googleblog.com/)
- [Test Behavior, Not Implementation - Google Testing Blog](https://testing.googleblog.com/2013/08/testing-on-toilet-test-behavior-not.html)

### Framework Documentation
- [Jest Expect API](https://jestjs.io/docs/expect)
- [Pytest: How to use fixtures](https://docs.pytest.org/en/stable/how-to/fixtures.html)
- [JUnit 5 User Guide - Assertions](https://junit.org/junit5/docs/current/user-guide/#writing-tests-assertions)
- [Chai Assertion Library](https://www.chaijs.com/api/bdd/)
- [RSpec Expectations](https://rspec.info/features/3-12/rspec-expectations/)
