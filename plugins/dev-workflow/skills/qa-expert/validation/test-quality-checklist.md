# Test Quality Validation Checklist

**Purpose**: Comprehensive post-generation checklist to catch the Top 10 testing anti-patterns and ensure test quality across all major frameworks (Jest, Pytest, JUnit, Mocha, RSpec).

**When to use**: After generating or modifying tests, run through this checklist to ensure code quality, correctness, and adherence to testing best practices.

**How to use**:
1. Review each category sequentially
2. Run automated checks where provided
3. Manually verify items that require code inspection
4. Fix any issues found before submitting for review

---

## Quick Validation Script

Run all automated checks at once:

```bash
# Test structure checks
grep -r "test1\|test2\|testUser" tests/ || echo "✅ No generic test names"
grep -rE "expect\(\)$|assert$" tests/ || echo "✅ No assertion-free tests"

# Async checks
grep -r "sleep(" tests/ || echo "✅ No fixed sleeps found"
grep -r "setTimeout.*1000" tests/ || echo "✅ No fixed timeouts"

# Mock checks
grep -r "mock.*mock.*mock" tests/ || echo "✅ Not over-mocking"

# Coverage check (framework-specific)
# Jest: npm test -- --coverage
# Pytest: pytest --cov
# JUnit: mvn test jacoco:report
```

---

## 1. Test Structure (7 items)

**Quick Check**: Visual inspection + grep for test organization patterns

Tests must follow AAA pattern, have clear names, and be properly isolated.

### [ ] Tests follow AAA pattern (Arrange-Act-Assert)

**What to check**: Each test has three distinct phases: setup, execution, verification

**Why it matters**: AAA pattern makes tests readable and maintainable. Without it, tests become obscure and hard to debug.

**Check**:
```bash
# Manual review: Look for clear separation
# Automated: Check for comments marking sections
grep -r "// Arrange\|// Act\|// Assert\|# Arrange\|# Act\|# Assert" tests/
```

Manual review: Ensure each test has distinct Arrange, Act, Assert phases

**Fix**:
```javascript
// ❌ WRONG: Mixed concerns, unclear structure
test('user creation', () => {
  const user = createUser('John', 'john@example.com');
  expect(user.name).toBe('John');
  const saved = saveUser(user);
  expect(saved.id).toBeDefined();
});

// ✅ CORRECT: Clear AAA structure
test('should create user with valid email', () => {
  // Arrange
  const name = 'John';
  const email = 'john@example.com';

  // Act
  const user = createUser(name, email);

  // Assert
  expect(user.name).toBe(name);
  expect(user.email).toBe(email);
});
```

---

### [ ] Test names describe behavior ("should X when Y")

**What to check**: Test names explain what behavior is being tested, not just function names

**Why it matters**: Clear test names serve as documentation and make failures obvious

**Check**:
```bash
# Look for generic names
grep -rE "test1|test2|testUser|testFunction|def test_[a-z]+\(\)" tests/

# Look for good patterns
grep -rE "should|when|given|it\(.*when.*\)" tests/
```

Manual review: Read test names - do they describe expected behavior?

**Fix**:
```python
# ❌ WRONG: Generic, uninformative names
def test_user():
    user = create_user("John", "john@example.com")
    assert user

def test_user_2():
    user = create_user("", "john@example.com")
    assert not user

# ✅ CORRECT: Descriptive behavior names
def test_should_create_user_with_valid_email():
    user = create_user("John", "john@example.com")
    assert user.email == "john@example.com"

def test_should_reject_user_with_empty_name():
    with pytest.raises(ValueError):
        create_user("", "john@example.com")
```

---

### [ ] Tests are isolated and independent

**What to check**: Tests don't share mutable state, can run in any order, don't depend on each other

**Why it matters**: Test interdependence causes flaky tests and makes debugging impossible

**Check**:
```bash
# Look for shared mutable state
grep -r "global \|static.*=\|class.*:\s*data\s*=" tests/

# Check for test execution order dependencies
# Run tests in reverse order or random order
# Jest: npm test -- --randomize
# Pytest: pytest --random-order
```

Manual review: Can tests run independently? Is state cleaned up?

**Fix**:
```java
// ❌ WRONG: Shared mutable state
public class UserServiceTest {
    private static List<User> users = new ArrayList<>(); // Shared across tests!

    @Test
    public void test1() {
        users.add(new User("John"));
        assertEquals(1, users.size());
    }

    @Test
    public void test2() {
        // Assumes test1 ran first!
        assertEquals(1, users.size());
    }
}

// ✅ CORRECT: Isolated state
public class UserServiceTest {
    private List<User> users;

    @BeforeEach
    public void setUp() {
        users = new ArrayList<>(); // Fresh state per test
    }

    @Test
    public void shouldStartWithEmptyList() {
        assertEquals(0, users.size());
    }

    @Test
    public void shouldAddUserToList() {
        users.add(new User("John"));
        assertEquals(1, users.size());
    }
}
```

---

### [ ] One logical assertion per test (avoid Assertion Roulette)

**What to check**: Each test verifies one concept (may have multiple assertions for same concept)

**Why it matters**: Multiple unrelated assertions make failure diagnosis difficult

**Check**:
```bash
# Count assertions per test (rough heuristic)
grep -A 20 "test\|def test_\|@Test" tests/ | grep -c "expect\|assert"
```

Manual review: Are all assertions testing the same logical concept?

**Fix**:
```typescript
// ❌ WRONG: Multiple unrelated assertions (Assertion Roulette)
test('user operations', () => {
  const user = createUser('John', 'john@example.com');
  expect(user.name).toBe('John'); // Testing creation

  const updated = updateUser(user, { age: 30 });
  expect(updated.age).toBe(30); // Testing update

  const deleted = deleteUser(user.id);
  expect(deleted).toBe(true); // Testing deletion
  // Which assertion failed? Hard to know!
});

// ✅ CORRECT: One concept per test
test('should create user with correct name', () => {
  const user = createUser('John', 'john@example.com');
  expect(user.name).toBe('John');
  expect(user.email).toBe('john@example.com'); // Same concept: creation
});

test('should update user age', () => {
  const user = createUser('John', 'john@example.com');
  const updated = updateUser(user, { age: 30 });
  expect(updated.age).toBe(30);
});

test('should delete user successfully', () => {
  const user = createUser('John', 'john@example.com');
  const deleted = deleteUser(user.id);
  expect(deleted).toBe(true);
});
```

---

### [ ] Tests have minimal setup complexity (avoid Mystery Guest)

**What to check**: Test setup is explicit and visible, not hidden in distant fixture files

**Why it matters**: Hidden dependencies make tests hard to understand and maintain

**Check**:
```bash
# Look for excessive fixture usage
grep -r "@pytest.fixture\|beforeAll\|@BeforeAll" tests/ | wc -l

# Check fixture complexity
find tests/ -name "fixtures.py" -o -name "conftest.py" | xargs wc -l
```

Manual review: Is it clear what data the test uses? Can you understand the test without reading fixture files?

**Fix**:
```ruby
# ❌ WRONG: Mystery Guest - unclear where data comes from
describe UserController do
  # Hidden in spec_helper.rb: let(:user) { ... }
  # Hidden in factories.rb: FactoryBot.define :user do ...

  it "should display user profile" do
    get :show, id: user.id # Where did 'user' come from?
    expect(response).to be_success
  end
end

# ✅ CORRECT: Explicit setup, clear data source
describe UserController do
  it "should display user profile for authenticated user" do
    # Arrange: Explicit user creation
    user = User.create!(
      name: "John Doe",
      email: "john@example.com",
      role: "member"
    )

    # Act
    get :show, id: user.id

    # Assert
    expect(response).to be_success
    expect(response.body).to include("John Doe")
  end
end
```

---

### [ ] Each test is fast (unit <100ms, integration <1s, E2E <30s)

**What to check**: Test execution time meets category targets

**Why it matters**: Slow tests hurt developer productivity and CI/CD pipelines

**Check**:
```bash
# Jest: npm test -- --verbose (shows timing)
# Pytest: pytest --durations=10 (shows slowest 10)
# JUnit: Check surefire reports in target/surefire-reports/

# Find slow tests
# Jest: Look for tests >100ms in output
# Pytest: pytest --durations=0 | grep -E "[0-9]+\.[0-9]+s" | awk '$1 > 0.1'
```

Manual review: Are there database calls, file I/O, or network requests that could be mocked?

**Fix**:
```python
# ❌ WRONG: Slow test due to real database
def test_user_creation():
    # Arrange: Real PostgreSQL connection (SLOW!)
    db = connect_to_production_db()

    # Act: Insert into real database (SLOW!)
    user_id = db.execute("INSERT INTO users ...")

    # Assert
    user = db.execute("SELECT * FROM users WHERE id = ?", user_id)
    assert user['name'] == 'John'

# ✅ CORRECT: Fast test with in-memory or mocked database
def test_user_creation(mocker):
    # Arrange: Mock database (FAST!)
    mock_db = mocker.Mock()
    mock_db.execute.return_value = {'id': 1, 'name': 'John'}

    # Act
    user = create_user(mock_db, name='John')

    # Assert
    assert user['name'] == 'John'
    mock_db.execute.assert_called_once()
```

---

### [ ] Tests use setup/teardown hooks appropriately

**What to check**: beforeEach/setUp for per-test setup, afterEach/tearDown for cleanup

**Why it matters**: Proper cleanup prevents test pollution and resource leaks

**Check**:
```bash
# Check for cleanup patterns
grep -r "beforeEach\|afterEach\|setUp\|tearDown\|@BeforeEach\|@AfterEach" tests/

# Look for resource leaks (unclosed connections, files)
grep -r "open(\|connect(\|createConnection(" tests/ | grep -v "close\|disconnect"
```

Manual review: Are resources (files, connections, mocks) cleaned up after each test?

**Fix**:
```javascript
// ❌ WRONG: No cleanup, resources leak
describe('File operations', () => {
  test('should read file', () => {
    const file = fs.openSync('test.txt', 'r');
    const content = fs.readFileSync(file);
    expect(content).toBeDefined();
    // No cleanup! File handle leaks
  });
});

// ✅ CORRECT: Proper cleanup in afterEach
describe('File operations', () => {
  let fileHandle;

  afterEach(() => {
    if (fileHandle) {
      fs.closeSync(fileHandle);
      fileHandle = null;
    }
  });

  test('should read file', () => {
    fileHandle = fs.openSync('test.txt', 'r');
    const content = fs.readFileSync(fileHandle);
    expect(content).toBeDefined();
  });
});
```

---

## 2. Assertions (6 items)

**Quick Check**: `grep -r "assertTrue\|assert true\|expect(true)" tests/`

Assertions must be specific, meaningful, and test behavior not implementation.

### [ ] Assertions are specific (not generic assertTrue/toBe(true))

**What to check**: Using specific matchers like toEqual, toContain, toBeGreaterThan

**Why it matters**: Specific assertions provide better failure messages

**Check**:
```bash
# Look for generic assertions
grep -rE "assertTrue\(|assert\s+True|expect\(true\)|toBe\(true\)" tests/

# Look for good specific assertions
grep -rE "toEqual|toContain|toBeGreaterThan|assertEquals|assertThat" tests/
```

**Fix**:
```java
// ❌ WRONG: Generic assertion, poor failure message
@Test
public void testUserAge() {
    User user = new User("John", 25);
    assertTrue(user.getAge() > 18); // Fails: "expected true but was false"
}

// ✅ CORRECT: Specific assertion, clear failure message
@Test
public void shouldHaveAgeGreaterThan18() {
    User user = new User("John", 25);
    assertThat(user.getAge()).isGreaterThan(18); // Fails: "expected >18 but was 16"
}
```

---

### [ ] Failure messages are meaningful

**What to check**: Custom error messages explain what went wrong

**Why it matters**: Good messages speed up debugging

**Check**:
Manual review: Do assertions include descriptive failure messages where frameworks support it?

**Fix**:
```python
# ❌ WRONG: No context in failure
assert user.age > 18

# ✅ CORRECT: Clear failure message
assert user.age > 18, f"User {user.name} must be adult, got age {user.age}"
```

---

### [ ] Assertions test behavior, not implementation

**What to check**: Testing public API and outcomes, not internal methods

**Why it matters**: Implementation-focused tests break during refactoring

**Check**:
Manual review: Are you asserting on private methods or internal state?

**Fix**:
```typescript
// ❌ WRONG: Testing implementation details
test('user service', () => {
  const service = new UserService();
  service.createUser('John', 'john@example.com');

  // Testing internal implementation
  expect(service.validateEmail).toHaveBeenCalled();
  expect(service.userCache.size).toBe(1);
});

// ✅ CORRECT: Testing public behavior
test('should create user with valid email', () => {
  const service = new UserService();
  const user = service.createUser('John', 'john@example.com');

  // Testing public API result
  expect(user.name).toBe('John');
  expect(user.email).toBe('john@example.com');
  expect(service.getUser(user.id)).toEqual(user);
});
```

---

### [ ] No assertions on mocked values (circular logic)

**What to check**: Not asserting that mock returns what you told it to return

**Why it matters**: Tests pass but don't actually verify anything

**Check**:
```bash
# Look for mock setup followed by assertion on same value
grep -A 5 "mockReturnValue\|thenReturn\|side_effect" tests/ | grep "expect\|assert"
```

**Fix**:
```javascript
// ❌ WRONG: Circular logic - testing the mock, not the code
test('user service', () => {
  const mockDb = { getUser: jest.fn().mockReturnValue({ name: 'John' }) };
  const service = new UserService(mockDb);

  const user = service.getUser(1);
  expect(user.name).toBe('John'); // Testing what mock returns!
});

// ✅ CORRECT: Test actual business logic
test('should transform user data correctly', () => {
  const mockDb = { getUser: jest.fn().mockReturnValue({
    first_name: 'John',
    last_name: 'Doe'
  }) };
  const service = new UserService(mockDb);

  const user = service.getUser(1);
  // Testing transformation logic, not mock
  expect(user.fullName).toBe('John Doe'); // Code combines first + last
});
```

---

### [ ] Using framework-appropriate matchers

**What to check**: Using idiomatic matchers for each framework

**Why it matters**: Framework matchers provide better error messages and readability

**Check**:
Manual review: Are you using Jest matchers in Jest, Chai in Mocha, RSpec matchers in RSpec?

**Fix**:
```ruby
# ❌ WRONG: Not using RSpec matchers
describe User do
  it "should have valid email" do
    user = User.new(email: "john@example.com")
    # Using raw == comparison instead of RSpec matcher
    if user.email == "john@example.com"
      # test passes
    else
      fail "Email mismatch"
    end
  end
end

# ✅ CORRECT: Using RSpec matchers
describe User do
  it "should have valid email" do
    user = User.new(email: "john@example.com")
    expect(user.email).to eq("john@example.com")
  end
end
```

---

### [ ] Edge cases are covered

**What to check**: Tests for null, empty, boundary values, error cases

**Why it matters**: Most bugs occur at edge cases

**Check**:
```bash
# Look for edge case tests
grep -rE "null|empty|zero|negative|boundary|min|max|overflow" tests/

# Look for error case tests
grep -rE "throws|raises|rejects|error|exception" tests/
```

**Fix**:
```python
# ❌ WRONG: Only happy path tested
def test_divide():
    assert divide(10, 2) == 5

# ✅ CORRECT: Edge cases covered
def test_divide_positive_numbers():
    assert divide(10, 2) == 5

def test_divide_by_zero_raises_error():
    with pytest.raises(ZeroDivisionError):
        divide(10, 0)

def test_divide_negative_numbers():
    assert divide(-10, 2) == -5

def test_divide_floats():
    assert divide(10.5, 2) == 5.25
```

---

## 3. Mocks and Test Doubles (6 items)

**Quick Check**: `grep -r "mock\|stub\|spy" tests/ | wc -l`

Mocks must be used appropriately, not excessively.

### [ ] Using correct test double type (mock vs stub vs spy vs fake)

**What to check**: Dummies for parameters, fakes for complex implementations, stubs for queries, spies for recording, mocks for behavior verification

**Why it matters**: Wrong test double type leads to over-specification or insufficient verification

**Check**:
Manual review: Are you using mocks when stubs would suffice? Using stubs when you need to verify behavior?

**Fix**:
```typescript
// ❌ WRONG: Using mock when stub is sufficient
test('user display name', () => {
  const mockRepo = {
    getUser: jest.fn().mockReturnValue({ name: 'John' })
  };
  const service = new UserService(mockRepo);

  const displayName = service.getDisplayName(1);

  expect(displayName).toBe('John');
  expect(mockRepo.getUser).toHaveBeenCalled(); // Unnecessary verification
});

// ✅ CORRECT: Using stub for query (state verification)
test('user display name', () => {
  const stubRepo = {
    getUser: () => ({ name: 'John' }) // Simple stub, no mock
  };
  const service = new UserService(stubRepo);

  const displayName = service.getDisplayName(1);

  expect(displayName).toBe('John'); // Only verify result
});

// ✅ CORRECT: Using mock for command (behavior verification)
test('user creation notifies email service', () => {
  const mockEmailService = {
    sendWelcomeEmail: jest.fn()
  };
  const service = new UserService(null, mockEmailService);

  service.createUser('John', 'john@example.com');

  // Verify side effect occurred
  expect(mockEmailService.sendWelcomeEmail).toHaveBeenCalledWith('john@example.com');
});
```

---

### [ ] Not mocking what you don't own

**What to check**: Not directly mocking third-party libraries; instead wrap them in adapters

**Why it matters**: Mocking external APIs creates coupling to implementation details you don't control

**Check**:
```bash
# Look for direct mocking of third-party libraries
grep -rE "jest.mock\('axios'|jest.mock\('express'|mock.*requests|mock.*boto3" tests/
```

**Fix**:
```python
# ❌ WRONG: Directly mocking third-party library
import requests
from unittest.mock import patch

def test_fetch_user(mocker):
    # Mocking library we don't own
    mocker.patch('requests.get', return_value=MockResponse({'name': 'John'}))
    user = fetch_user(1)
    assert user['name'] == 'John'

# ✅ CORRECT: Create adapter, mock your adapter
class HttpClient:
    def get(self, url):
        return requests.get(url)

def test_fetch_user(mocker):
    # Mock our adapter
    mock_client = mocker.Mock(spec=HttpClient)
    mock_client.get.return_value = {'name': 'John'}

    user = fetch_user(1, client=mock_client)
    assert user['name'] == 'John'
```

---

### [ ] Mocking at the right level (boundaries, not internals)

**What to check**: Mocking external boundaries (API, database, filesystem), not internal methods

**Why it matters**: Mocking internals makes tests brittle and couples them to implementation

**Check**:
Manual review: Are you mocking private methods? Internal helper functions?

**Fix**:
```java
// ❌ WRONG: Mocking internal private method
@Test
public void testUserService() {
    UserService service = Mockito.spy(new UserService());
    when(service.validateEmail(anyString())).thenReturn(true); // Mocking private!

    User user = service.createUser("John", "john@example.com");
    assertNotNull(user);
}

// ✅ CORRECT: Mocking external boundary
@Test
public void testUserService() {
    UserRepository mockRepo = mock(UserRepository.class);
    EmailService mockEmail = mock(EmailService.class);
    when(mockRepo.save(any())).thenReturn(new User(1, "John", "john@example.com"));

    UserService service = new UserService(mockRepo, mockEmail);
    User user = service.createUser("John", "john@example.com");

    assertNotNull(user);
    verify(mockRepo).save(any(User.class));
}
```

---

### [ ] Mock expectations are meaningful

**What to check**: Verifying with specific arguments, not just "was called"

**Why it matters**: Vague verification misses bugs

**Check**:
```bash
# Look for vague verifications
grep -rE "toHaveBeenCalled\(\)|assert_called\(\)|verify\([^)]+\)\s*$" tests/
```

**Fix**:
```javascript
// ❌ WRONG: Vague verification
test('user creation', () => {
  const mockRepo = { save: jest.fn() };
  const service = new UserService(mockRepo);

  service.createUser('John', 'john@example.com');

  expect(mockRepo.save).toHaveBeenCalled(); // Called with what?
});

// ✅ CORRECT: Specific verification
test('user creation', () => {
  const mockRepo = { save: jest.fn() };
  const service = new UserService(mockRepo);

  service.createUser('John', 'john@example.com');

  expect(mockRepo.save).toHaveBeenCalledWith({
    name: 'John',
    email: 'john@example.com'
  });
});
```

---

### [ ] Mocks are cleaned up after tests

**What to check**: Mocks are reset/restored in afterEach/tearDown

**Why it matters**: Mock pollution causes test interdependence

**Check**:
```bash
# Check for cleanup
grep -r "afterEach\|tearDown" tests/ | grep -E "restore|reset|clear"
```

**Fix**:
```javascript
// ❌ WRONG: No cleanup, mocks pollute subsequent tests
describe('User service', () => {
  test('test 1', () => {
    jest.spyOn(UserRepo, 'findById').mockReturnValue(user);
    // No cleanup!
  });

  test('test 2', () => {
    // Still mocked from test 1!
    const user = UserRepo.findById(1);
  });
});

// ✅ CORRECT: Cleanup in afterEach
describe('User service', () => {
  afterEach(() => {
    jest.restoreAllMocks(); // Clean up all mocks
  });

  test('test 1', () => {
    jest.spyOn(UserRepo, 'findById').mockReturnValue(user);
  });

  test('test 2', () => {
    // Clean slate
    const user = UserRepo.findById(1);
  });
});
```

---

### [ ] Not over-mocking (avoid testing mocks instead of behavior)

**What to check**: Mocking only external dependencies, not everything

**Why it matters**: Over-mocking leads to tests that pass but don't verify real behavior

**Check**:
```bash
# Count mock density (rough heuristic)
# High mock usage may indicate over-mocking
grep -r "mock\|stub" tests/ | wc -l
```

**Fix**:
```python
# ❌ WRONG: Over-mocking (London School extreme)
def test_user_creation(mocker):
    mock_validator = mocker.Mock()
    mock_hasher = mocker.Mock()
    mock_repo = mocker.Mock()
    mock_email = mocker.Mock()
    mock_logger = mocker.Mock()

    # Testing mocks, not real logic!
    service = UserService(mock_validator, mock_hasher, mock_repo, mock_email, mock_logger)
    service.create_user("John", "john@example.com")

    mock_validator.validate.assert_called()
    mock_hasher.hash.assert_called()
    # etc... testing mocks, not behavior

# ✅ CORRECT: Mock only boundaries
def test_user_creation(mocker):
    # Only mock external boundary (database)
    mock_repo = mocker.Mock()

    service = UserService(repo=mock_repo)
    user = service.create_user("John", "john@example.com")

    # Test real behavior
    assert user.name == "John"
    assert user.email == "john@example.com"
    # Verify database interaction
    mock_repo.save.assert_called_once()
```

---

## 4. Test Data (5 items)

**Quick Check**: `grep -rE "42|123|\"test\"|'test'" tests/`

Test data must be meaningful and intention-revealing.

### [ ] No magic numbers/strings

**What to check**: Named constants instead of arbitrary values

**Why it matters**: Magic values make tests hard to understand

**Check**:
```bash
# Look for magic numbers
grep -rE "\s+42\s+|\s+123\s+|\s+999\s+" tests/

# Look for magic strings
grep -rE "\"test\"|'test'|\"foo\"|'foo'" tests/
```

**Fix**:
```ruby
# ❌ WRONG: Magic numbers and strings
describe User do
  it "validates age" do
    user = User.new(age: 42) # Why 42?
    expect(user).to be_valid
  end
end

# ✅ CORRECT: Named constants
describe User do
  VALID_ADULT_AGE = 25

  it "should accept valid adult age" do
    user = User.new(age: VALID_ADULT_AGE)
    expect(user).to be_valid
  end
end
```

---

### [ ] Test data is intention-revealing

**What to check**: Variable names explain what the data represents

**Why it matters**: Clear names serve as documentation

**Check**:
Manual review: Are variable names like user1, user2, data1?

**Fix**:
```java
// ❌ WRONG: Unclear names
User user1 = new User("John", "john@example.com");
User user2 = new User("Jane", "jane@example.com");
User user3 = new User("Bob", "bob@example.com");

// ✅ CORRECT: Intention-revealing names
User activeUser = new User("John", "john@example.com", Status.ACTIVE);
User suspendedUser = new User("Jane", "jane@example.com", Status.SUSPENDED);
User adminUser = new User("Bob", "bob@example.com", Role.ADMIN);
```

---

### [ ] Using fixtures/factories appropriately

**What to check**: Fixtures for shared setup, factories for test-specific data

**Why it matters**: Proper data management improves maintainability

**Check**:
```bash
# Look for fixture usage
grep -r "@pytest.fixture\|FactoryBot\|factory_boy" tests/

# Check fixture complexity
find tests/ -name "factories.py" -o -name "factories.rb" | xargs wc -l
```

**Fix**:
```python
# ❌ WRONG: Fixture file with too many unrelated objects (General Fixture)
# conftest.py
@pytest.fixture
def user():
    return User(name="John", email="john@example.com")

@pytest.fixture
def product():
    return Product(name="Widget", price=99.99)

@pytest.fixture
def order():
    return Order(items=[], total=0)
# Too many unrelated fixtures!

# ✅ CORRECT: Focused factories, test-specific data
# test_user.py
def test_user_creation():
    # Build exactly what this test needs
    user = UserFactory.build(name="John", email="john@example.com")
    assert user.is_valid()

def test_admin_user_permissions():
    # Different data for different test
    admin = UserFactory.build(role="admin")
    assert admin.can_delete_users()
```

---

### [ ] Test data is close to test

**What to check**: Data defined in or near the test, not in distant fixture files

**Why it matters**: Local data is easier to understand and maintain

**Check**:
Manual review: Can you understand the test without reading fixture files?

**Fix**:
```typescript
// ❌ WRONG: Data hidden in distant fixture file
// fixtures/users.ts (100 lines away)
export const testUser = {
  id: 1,
  name: "John Doe",
  email: "john@example.com",
  role: "admin",
  createdAt: "2023-01-01",
  // 20 more fields...
};

// user.test.ts
import { testUser } from './fixtures/users';

test('user display', () => {
  const display = formatUser(testUser); // What's in testUser?
  expect(display).toContain('John');
});

// ✅ CORRECT: Data defined locally in test
test('should format user display name', () => {
  // Minimal, relevant data right here
  const user = {
    name: "John Doe",
    email: "john@example.com"
  };

  const display = formatUser(user);
  expect(display).toBe("John Doe (john@example.com)");
});
```

---

### [ ] Parametrized tests for data variations

**What to check**: Using framework parametrization features for multiple inputs

**Why it matters**: DRY principle, clear test coverage of edge cases

**Check**:
```bash
# Look for parametrized tests
grep -rE "@pytest.mark.parametrize|test.each|@ParameterizedTest|@CsvSource" tests/
```

**Fix**:
```python
# ❌ WRONG: Copy-paste for different inputs
def test_add_positive_numbers():
    assert add(2, 3) == 5

def test_add_negative_numbers():
    assert add(-2, -3) == -5

def test_add_zero():
    assert add(0, 5) == 5

# ✅ CORRECT: Parametrized test
@pytest.mark.parametrize("a, b, expected", [
    (2, 3, 5),
    (-2, -3, -5),
    (0, 5, 5),
    (10, -5, 5),
])
def test_add(a, b, expected):
    assert add(a, b) == expected
```

---

## 5. Async Testing (6 items)

**Quick Check**: `grep -r "async\|await\|Promise" tests/`

Async tests must properly handle promises and avoid race conditions.

### [ ] Promises are returned/awaited

**What to check**: async tests use await, or return promises

**Why it matters**: Unhandled promises cause tests to pass incorrectly

**Check**:
```bash
# Look for async tests without await
grep -A 10 "test.*async\|it.*async" tests/ | grep -v "await"

# Look for promise-returning tests
grep -rE "test.*=>\s*{.*return.*\.(then|catch)" tests/
```

**Fix**:
```javascript
// ❌ WRONG: Promise not returned or awaited
test('fetch user', () => {
  fetchUser(1); // Returns promise but not handled!
  // Test ends immediately, before promise resolves
});

// ✅ CORRECT: await the promise
test('fetch user', async () => {
  const user = await fetchUser(1);
  expect(user.name).toBe('John');
});

// ✅ ALSO CORRECT: return the promise
test('fetch user', () => {
  return fetchUser(1).then(user => {
    expect(user.name).toBe('John');
  });
});
```

---

### [ ] No fixed timeouts (avoid Sleeping Snail anti-pattern)

**What to check**: Using condition-based waiting, not sleep/setTimeout

**Why it matters**: Fixed timeouts are flaky and slow

**Check**:
```bash
# Look for fixed timeouts
grep -rE "sleep\(|setTimeout.*[0-9]+|time.sleep|Thread.sleep" tests/
```

**Fix**:
```python
# ❌ WRONG: Fixed sleep (Sleeping Snail)
async def test_async_operation():
    start_async_task()
    await asyncio.sleep(1)  # Arbitrary wait
    assert task_is_complete()

# ✅ CORRECT: Condition-based waiting
async def test_async_operation():
    start_async_task()
    # Wait for condition, with timeout
    await wait_for(lambda: task_is_complete(), timeout=5)
    assert task_is_complete()
```

---

### [ ] Promise rejections handled explicitly

**What to check**: Using try/catch or .catch() or expect().rejects

**Why it matters**: Unhandled rejections cause cryptic failures

**Check**:
```bash
# Look for error testing
grep -rE "rejects|raises|throws|assertThrows" tests/
```

**Fix**:
```typescript
// ❌ WRONG: Rejection not handled
test('invalid user', async () => {
  const user = await fetchUser(999); // Rejects but not caught!
  expect(user).toBeNull();
});

// ✅ CORRECT: Explicit rejection handling
test('should reject for invalid user ID', async () => {
  await expect(fetchUser(999)).rejects.toThrow('User not found');
});

// ✅ ALSO CORRECT: try/catch
test('should reject for invalid user ID', async () => {
  try {
    await fetchUser(999);
    fail('Should have thrown');
  } catch (error) {
    expect(error.message).toBe('User not found');
  }
});
```

---

### [ ] Both success and error paths tested

**What to check**: Tests for both resolved and rejected promises

**Why it matters**: Error paths often have bugs

**Check**:
Manual review: For each async operation, are there tests for both success and failure?

**Fix**:
```java
// ❌ WRONG: Only happy path
@Test
public void testFetchUser() throws Exception {
    CompletableFuture<User> future = userService.fetchUser(1);
    User user = future.get();
    assertEquals("John", user.getName());
}

// ✅ CORRECT: Both paths
@Test
public void shouldFetchUserSuccessfully() throws Exception {
    CompletableFuture<User> future = userService.fetchUser(1);
    User user = future.get();
    assertEquals("John", user.getName());
}

@Test
public void shouldHandleUserNotFound() {
    CompletableFuture<User> future = userService.fetchUser(999);
    assertThrows(ExecutionException.class, () -> future.get());
}
```

---

### [ ] No race conditions

**What to check**: Proper synchronization, awaiting all async operations

**Why it matters**: Race conditions cause flaky tests

**Check**:
Manual review: Are multiple async operations running concurrently without coordination?

**Fix**:
```python
# ❌ WRONG: Race condition
async def test_concurrent_updates():
    task1 = update_counter()  # Don't await!
    task2 = update_counter()  # Don't await!
    # Race condition: which completes first?
    assert counter == 2

# ✅ CORRECT: Proper synchronization
async def test_concurrent_updates():
    results = await asyncio.gather(
        update_counter(),
        update_counter()
    )
    assert counter == 2
```

---

### [ ] Appropriate timeouts set

**What to check**: Reasonable timeouts based on operation type

**Why it matters**: Too short = flaky, too long = slow CI

**Check**:
```bash
# Look for timeout configuration
grep -rE "timeout|setTimeout|jest.setTimeout" tests/
```

**Fix**:
```ruby
# ❌ WRONG: No timeout or unreasonable timeout
it "fetches user from API" do
  # No timeout - hangs forever if API down
  user = fetch_user_from_api(1)
  expect(user.name).to eq("John")
end

# ✅ CORRECT: Appropriate timeout
it "fetches user from API", timeout: 5 do # 5 seconds for API call
  user = fetch_user_from_api(1)
  expect(user.name).to eq("John")
end
```

---

## 6. Coverage and Quality (5 items)

**Quick Check**: Run coverage tool and inspect report

Coverage must be meaningful, not just high percentage.

### [ ] Meaningful coverage (not just 100% for sake of it)

**What to check**: Coverage targets business logic, not getters/setters

**Why it matters**: High coverage doesn't guarantee good tests

**Check**:
Manual review: Are you testing trivial code just for coverage?

**Fix**:
```java
// ❌ WRONG: Testing trivial code for coverage
@Test
public void testGetName() {
    User user = new User();
    user.setName("John");
    assertEquals("John", user.getName()); // Pointless test
}

@Test
public void testToString() {
    User user = new User("John", "john@example.com");
    assertTrue(user.toString().contains("John")); // Low value
}

// ✅ CORRECT: Testing business logic
@Test
public void shouldValidateEmailFormat() {
    User user = new User("John", "invalid-email");
    assertFalse(user.isValid()); // Tests real logic
}

@Test
public void shouldCalculateAgeCorrectly() {
    User user = new User("John", "john@example.com", LocalDate.of(1990, 1, 1));
    assertEquals(35, user.getAge()); // Tests calculation
}
```

---

### [ ] Branch coverage tracked, not just line coverage

**What to check**: Coverage config measures branch coverage

**Why it matters**: Branch coverage catches untested decision paths

**Check**:
```bash
# Jest: check jest.config.js for coverageThreshold.branches
# Pytest: check .coveragerc or pyproject.toml for branch = True
# JaCoCo: check pom.xml for BRANCH counter
grep -r "branch" jest.config.js .coveragerc pyproject.toml pom.xml
```

**Fix**:
```javascript
// jest.config.js

// ❌ WRONG: Only line coverage
module.exports = {
  collectCoverageFrom: ['src/**/*.js'],
  coverageThreshold: {
    global: {
      lines: 80,
    },
  },
};

// ✅ CORRECT: Branch and line coverage
module.exports = {
  collectCoverageFrom: ['src/**/*.js'],
  coverageThreshold: {
    global: {
      lines: 80,
      branches: 75, // Track branch coverage too!
      functions: 80,
      statements: 80,
    },
  },
};
```

---

### [ ] Tests would fail if code is broken

**What to check**: Tests have assertions that would catch bugs

**Why it matters**: Assertion-free tests are useless

**Check**:
```bash
# Look for tests without assertions
grep -A 20 "test\|it\|def test_" tests/ | grep -v "expect\|assert"
```

**Fix**:
```python
# ❌ WRONG: No assertions, test passes regardless
def test_user_creation():
    user = create_user("John", "john@example.com")
    # No assertion! Test always passes

# ✅ CORRECT: Assertions that would fail if broken
def test_user_creation():
    user = create_user("John", "john@example.com")
    assert user is not None
    assert user.name == "John"
    assert user.email == "john@example.com"
```

---

### [ ] Coverage excludes trivial code

**What to check**: Excluding getters, setters, toString, simple properties from coverage

**Why it matters**: Focus on testing meaningful code

**Check**:
```bash
# Check coverage exclusion configuration
grep -r "coveragePathIgnorePatterns\|omit\|exclude" jest.config.js .coveragerc pyproject.toml
```

**Fix**:
```python
# .coveragerc

# ❌ WRONG: No exclusions, inflated coverage from trivial code
[run]
source = src/

# ✅ CORRECT: Exclude trivial code
[run]
source = src/

[report]
exclude_lines =
    pragma: no cover
    def __repr__
    def __str__
    raise AssertionError
    raise NotImplementedError
    if __name__ == .__main__.:
```

---

### [ ] Critical code has high mutation score

**What to check**: Using mutation testing on critical business logic

**Why it matters**: Mutation testing finds weak tests that coverage misses

**Check**:
```bash
# Check for mutation testing tools
# Stryker (JS): npm test -- --mutate
# PIT (Java): mvn org.pitest:pitest-maven:mutationCoverage
# mutmut (Python): mutmut run
grep -r "stryker\|pitest\|mutmut" package.json pom.xml requirements.txt
```

**Fix**:
Manual setup: Add mutation testing to critical modules (payment processing, authentication, data validation)

Target mutation scores:
- Critical code (auth, payments): 80-90%
- Standard business logic: 60-70%
- Utilities: 70-80%

---

## 7. Framework-Specific Checks (per framework)

### Jest-Specific

#### [ ] Using correct Jest matchers

**Check**:
```bash
# Look for incorrect matcher usage
grep -rE "toBe\(\{|toBe\(\[" tests/ # Should use toEqual for objects/arrays
```

**Fix**:
```javascript
// ❌ WRONG: toBe for objects (reference equality)
expect(user).toBe({ name: 'John' }); // Always fails!

// ✅ CORRECT: toEqual for objects (deep equality)
expect(user).toEqual({ name: 'John' });
```

#### [ ] Mock cleanup in afterEach

**Check**:
```bash
grep -r "afterEach" tests/ | grep -c "jest.restoreAllMocks\|jest.clearAllMocks"
```

### Pytest-Specific

#### [ ] Using fixtures correctly

**Check**:
Manual review: Are fixtures scoped appropriately (function, module, session)?

**Fix**:
```python
# ❌ WRONG: Expensive fixture with function scope
@pytest.fixture
def database():
    db = create_database()  # Expensive!
    yield db
    db.close()

# ✅ CORRECT: Session-scoped for expensive setup
@pytest.fixture(scope="session")
def database():
    db = create_database()
    yield db
    db.close()
```

### JUnit-Specific

#### [ ] Using @DisplayName for readable test names

**Check**:
```bash
grep -c "@DisplayName" tests/**/*.java
```

### Mocha-Specific

#### [ ] Sinon stubs/spies restored

**Check**:
```bash
grep -r "afterEach" tests/ | grep -c "restore\|sandbox.restore"
```

### RSpec-Specific

#### [ ] Using let() vs instance variables correctly

**Check**:
Manual review: Are instance variables used when let() would be better?

---

## 8. CI/CD Integration (4 items)

### [ ] Tests pass in CI environment

**Check**:
```bash
# Run tests in CI mode
CI=true npm test
# Or check .github/workflows/, .gitlab-ci.yml
```

### [ ] Tests are deterministic (no flaky tests)

**Check**:
```bash
# Run tests multiple times
for i in {1..10}; do npm test; done
```

### [ ] Test execution is fast enough for CI

**Check**:
Manual review: Does test suite complete in < 10 minutes for commit stage?

### [ ] Coverage thresholds met

**Check**:
```bash
# Run coverage check
npm test -- --coverage
# Check if it meets configured thresholds
```

---

## Summary Checklist

- [ ] **Test Structure**: AAA pattern, clear names, isolation, minimal setup, fast execution
- [ ] **Assertions**: Specific matchers, meaningful messages, behavior not implementation
- [ ] **Mocks**: Correct type, not over-mocking, mocking boundaries, cleanup
- [ ] **Test Data**: No magic values, intention-revealing, appropriate fixtures
- [ ] **Async**: Promises handled, condition-based waiting, both paths tested
- [ ] **Coverage**: Meaningful coverage, branch coverage, mutation testing for critical code
- [ ] **Framework**: Using framework idiomatically
- [ ] **CI/CD**: Deterministic, fast, passing in CI

---

**After completing this checklist, your tests should be:**
- ✅ Reliable (deterministic, no flaky tests)
- ✅ Fast (appropriate execution time)
- ✅ Maintainable (clear, isolated, well-structured)
- ✅ Meaningful (testing behavior, catching real bugs)
- ✅ Ready for production (CI/CD integrated, coverage targets met)

**Sources**: xUnit Test Patterns (Gerard Meszaros), Google Testing Blog, "Software Engineering at Google", Martin Fowler testing articles, framework-specific documentation (Jest, Pytest, JUnit, Mocha, RSpec)
