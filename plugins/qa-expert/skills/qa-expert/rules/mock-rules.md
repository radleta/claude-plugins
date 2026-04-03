# Mock and Test Double Rules

Test doubles are objects that stand in for real dependencies during testing. Understanding the taxonomy of test doubles - and when to use each type - is crucial for writing effective, maintainable tests. These patterns come from Gerard Meszaros's authoritative work "xUnit Test Patterns" and Martin Fowler's seminal article "Mocks Aren't Stubs."

## The Problem: Testing with External Dependencies

Real systems have dependencies on databases, APIs, file systems, and other services. Testing with real dependencies causes problems:
- **Slow**: Network calls and database queries take time
- **Unreliable**: External services may be down or slow
- **Complex Setup**: Real dependencies require extensive configuration
- **Side Effects**: Tests may modify shared state or data

**Key insight**: Test doubles replace real dependencies with controlled, predictable alternatives that make tests fast, reliable, and isolated.

---

## Test Doubles Taxonomy

Gerard Meszaros identified five types of test doubles. Each serves a different purpose and has different characteristics.

### 1. Dummy Objects

**Definition**: Objects passed around but never actually used. They exist only to fill parameter lists.

**When to Use**: When a method signature requires parameters that your test doesn't actually need or use.

**Characteristics**:
- Simplest form of test double
- Methods are never called
- Can throw exceptions if accidentally used
- No behavior implementation needed

**Example (Java)**:
```java
public class DummyCustomer implements Customer {
    @Override
    public String getName() {
        throw new UnsupportedOperationException("Dummy should never be called");
    }

    @Override
    public String getEmail() {
        throw new UnsupportedOperationException("Dummy should never be called");
    }
}

@Test
public void testOrderCreation() {
    // Customer is required but never used in this test
    Customer dummy = new DummyCustomer();
    List<Item> items = Arrays.asList(new Item("Widget", 10.00));

    Order order = new Order(dummy, items);

    assertEquals(10.00, order.getTotal());
}
```

**Example (TypeScript/Jest)**:
```typescript
interface Customer {
    getName(): string;
    getEmail(): string;
}

test('order creation calculates total correctly', () => {
    // Customer is required but never used
    const dummyCustomer: Customer = {} as Customer;
    const items = [{ name: 'Widget', price: 10.00 }];

    const order = new Order(dummyCustomer, items);

    expect(order.getTotal()).toBe(10.00);
});
```

---

### 2. Fake Objects

**Definition**: Objects with working implementations that take shortcuts unsuitable for production (e.g., in-memory database instead of real database).

**When to Use**: When you need real behavior but production implementation is too slow or complex for testing.

**Characteristics**:
- Has actual working implementation
- Simplified compared to production version
- Maintains state and logic
- Fast and lightweight
- Self-contained (no external dependencies)

**Example (Python - In-Memory Repository)**:
```python
class FakeUserRepository:
    """Fake repository that stores users in memory instead of database"""

    def __init__(self):
        self._users = {}
        self._next_id = 1

    def save(self, user):
        if user.id is None:
            user.id = self._next_id
            self._next_id += 1
        self._users[user.id] = user
        return user

    def find_by_id(self, user_id):
        return self._users.get(user_id)

    def find_by_email(self, email):
        return next((u for u in self._users.values() if u.email == email), None)

    def delete(self, user_id):
        if user_id in self._users:
            del self._users[user_id]

def test_user_service():
    # Use fake repository instead of real database
    fake_repo = FakeUserRepository()
    service = UserService(fake_repo)

    user = service.create_user("alice@example.com", "Alice")

    assert user.id is not None
    assert service.get_user(user.id).email == "alice@example.com"
```

**Example (JavaScript - Fake API Client)**:
```javascript
class FakeApiClient {
    constructor() {
        this.data = {
            users: [
                { id: 1, name: 'Alice' },
                { id: 2, name: 'Bob' }
            ]
        };
    }

    async getUser(id) {
        // Simulate async but return immediately
        const user = this.data.users.find(u => u.id === id);
        return Promise.resolve(user);
    }

    async createUser(user) {
        const newUser = {
            id: this.data.users.length + 1,
            ...user
        };
        this.data.users.push(newUser);
        return Promise.resolve(newUser);
    }
}

test('user service fetches user by id', async () => {
    const fakeClient = new FakeApiClient();
    const service = new UserService(fakeClient);

    const user = await service.getUserById(1);

    expect(user.name).toBe('Alice');
});
```

---

### 3. Stub Objects

**Definition**: Objects that provide canned (pre-programmed) responses to calls made during the test. They don't respond to anything outside what's programmed for the test.

**When to Use**: When you need to control what a dependency returns without caring about how many times it's called or in what order.

**Characteristics**:
- Provides pre-determined responses
- No logic beyond returning values
- Used for **state verification** (check results, not interactions)
- Typically used for queries (methods that return data)
- Doesn't care about call count or order

**Example (Java/Mockito)**:
```java
public class WeatherServiceStub implements WeatherService {
    private final Temperature cannedResponse;

    public WeatherServiceStub(Temperature response) {
        this.cannedResponse = response;
    }

    @Override
    public Temperature getTemperature(String city) {
        return cannedResponse;  // Always returns same value
    }
}

@Test
public void testTemperatureDisplay() {
    // Stub always returns 72 degrees
    WeatherService stub = new WeatherServiceStub(new Temperature(72));
    TemperatureDisplay display = new TemperatureDisplay(stub);

    String output = display.getCurrentTemperature("Boston");

    assertEquals("Temperature: 72°F", output);
}
```

**Example (TypeScript/Jest)**:
```typescript
interface PaymentGateway {
    processPayment(amount: number): PaymentResult;
}

test('order processes payment successfully', () => {
    // Stub returns canned success response
    const stubGateway: PaymentGateway = {
        processPayment: jest.fn().mockReturnValue({
            success: true,
            transactionId: 'TXN-123'
        })
    };

    const order = new Order(stubGateway);
    const result = order.checkout(100);

    expect(result.success).toBe(true);
    expect(result.transactionId).toBe('TXN-123');
});
```

**Example (Python/pytest)**:
```python
def test_notification_sent_on_payment():
    # Stub returns success for any payment
    payment_stub = Mock(spec=PaymentService)
    payment_stub.process_payment.return_value = PaymentResult(success=True)

    notifier = PaymentNotifier(payment_stub)
    result = notifier.process_and_notify(100, "alice@example.com")

    assert result.notification_sent is True
```

---

### 4. Spy Objects

**Definition**: Stubs that also record information about how they were called (which methods, how many times, with what arguments).

**When to Use**: When you need to verify a method was called AND check the results (hybrid of state and behavior verification).

**Characteristics**:
- Records method calls and arguments
- Can provide canned responses (like stub)
- Used for **indirect output verification**
- Verifies interactions AFTER execution
- Useful for testing side effects

**Example (Java/Mockito)**:
```java
public class EmailServiceSpy implements EmailService {
    private int messagesSent = 0;
    private List<Message> sentMessages = new ArrayList<>();

    @Override
    public void send(Message message) {
        messagesSent++;
        sentMessages.add(message);
    }

    public int getMessagesSent() {
        return messagesSent;
    }

    public List<Message> getSentMessages() {
        return sentMessages;
    }
}

@Test
public void testOrderConfirmationEmailSent() {
    EmailServiceSpy spy = new EmailServiceSpy();
    OrderService service = new OrderService(spy);

    service.placeOrder(new Order("alice@example.com", items));

    // Verify email was sent (behavior verification)
    assertEquals(1, spy.getMessagesSent());
    // Check email contents (state verification)
    Message sent = spy.getSentMessages().get(0);
    assertEquals("alice@example.com", sent.getRecipient());
    assertTrue(sent.getSubject().contains("Order Confirmation"));
}
```

**Example (TypeScript/Jest)**:
```typescript
test('analytics service tracks page view', () => {
    const analyticsspy = {
        trackEvent: jest.fn(),
        trackPageView: jest.fn()
    };

    const app = new Application(analyticsSign);
    app.navigateToPage('/products');

    // Spy recorded the call
    expect(analyticsSign.trackPageView).toHaveBeenCalledTimes(1);
    expect(analyticsSign.trackPageView).toHaveBeenCalledWith('/products');
});
```

**Example (Python/unittest.mock)**:
```python
from unittest.mock import Mock

def test_cache_is_cleared_after_update():
    cache_spy = Mock()
    user_service = UserService(cache=cache_spy)

    user_service.update_user(user_id=1, name="Alice")

    # Verify cache.clear() was called
    cache_spy.clear.assert_called_once()
```

---

### 5. Mock Objects

**Definition**: Objects pre-programmed with expectations which form a specification of the calls they are expected to receive. They verify behavior during test execution.

**When to Use**: When you need to verify that specific methods are called with specific arguments in a specific order or number of times.

**Characteristics**:
- Expectations set upfront before execution
- Used for **behavior verification** (not state verification)
- Verifies interactions are correct
- Typically used for commands (methods that change state)
- Fails test if expectations aren't met
- More rigid than stubs

**Example (Java/Mockito)**:
```java
@Test
public void testUserDeletionRemovesFromCache() {
    // Create mock with expectations
    Cache mockCache = mock(Cache.class);
    UserService service = new UserService(mockCache);

    // Execute
    service.deleteUser(123);

    // Verify expectations
    verify(mockCache).remove("user:123");
    verify(mockCache, never()).clear(); // Should NOT clear entire cache
}

@Test
public void testPaymentProcessingCallsGateway() {
    PaymentGateway mockGateway = mock(PaymentGateway.class);
    when(mockGateway.charge(100.0, "card-123")).thenReturn(new Result(true));

    PaymentService service = new PaymentService(mockGateway);
    service.processPayment(100.0, "card-123");

    // Verify the gateway was called with exact parameters
    verify(mockGateway).charge(100.0, "card-123");
}
```

**Example (TypeScript/Jest)**:
```typescript
test('order service saves order to database', () => {
    const mockRepository = {
        save: jest.fn().mockResolvedValue({ id: 1 }),
        findById: jest.fn()
    };

    const service = new OrderService(mockRepository);
    await service.createOrder({ items: [...] });

    // Verify save was called with correct data
    expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
            items: expect.any(Array),
            createdAt: expect.any(Date)
        })
    );
});
```

**Example (Python/unittest.mock)**:
```python
from unittest.mock import Mock, call

def test_batch_processor_processes_all_items():
    mock_processor = Mock()
    batch = BatchProcessor(mock_processor)

    items = [1, 2, 3]
    batch.process_all(items)

    # Verify processor was called for each item in order
    expected_calls = [call.process(1), call.process(2), call.process(3)]
    mock_processor.assert_has_calls(expected_calls, any_order=False)
```

---

## Rule 1: Understand Mock vs Stub Distinction

**Statement**: Use stubs for queries (state verification) and mocks for commands (behavior verification).

### Why This Matters

Martin Fowler's article "Mocks Aren't Stubs" clarifies a critical distinction:
- **Stubs** help tests run by providing pre-programmed responses
- **Mocks** are used to verify behavior - that the correct interactions occurred

Confusing these leads to brittle tests that break on refactoring, even when behavior is correct.

### State Verification vs Behavior Verification

**State Verification**: Check the state of the system after execution
**Behavior Verification**: Verify the system interacted correctly with dependencies

### ❌ WRONG: Mocking Everything (Over-Specification)

```typescript
test('user service gets user name', () => {
    const mockRepo = {
        findById: jest.fn().mockReturnValue({ id: 1, name: 'Alice' })
    };

    const service = new UserService(mockRepo);
    const name = service.getUserName(1);

    // WRONG: Testing mock interaction instead of actual behavior
    expect(mockRepo.findById).toHaveBeenCalledWith(1);
    expect(mockRepo.findById).toHaveBeenCalledTimes(1);
    expect(name).toBe('Alice');
}
```

**What's wrong**: This test is over-specified. We're testing HOW the service gets the name (by calling findById once with id 1) rather than testing THAT it returns the correct name. If we refactor to cache results, this test breaks even though behavior is correct.

### ✅ CORRECT: Stub for Query, Verify State

```typescript
test('user service gets user name', () => {
    // Stub provides data without verification expectations
    const stubRepo = {
        findById: jest.fn().mockReturnValue({ id: 1, name: 'Alice' })
    };

    const service = new UserService(stubRepo);
    const name = service.getUserName(1);

    // CORRECT: Only verify the result, not how it was obtained
    expect(name).toBe('Alice');
}
```

**Why this works**: Test focuses on the outcome (correct name returned) rather than implementation details. Service can be refactored without breaking tests.

### ✅ CORRECT: Mock for Command, Verify Behavior

```typescript
test('order service saves order to database', () => {
    // Mock with behavior verification for command
    const mockRepo = {
        save: jest.fn().mockResolvedValue({ id: 1 })
    };

    const service = new OrderService(mockRepo);
    await service.createOrder({ items: [...] });

    // CORRECT: Verify save was called (command has side effect)
    expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
            items: expect.any(Array),
            status: 'pending'
        })
    );
}
```

**Why this works**: Saving is a command (side effect). We MUST verify it was called with correct data because there's no other way to verify the behavior without checking the database.

### Classical vs London School TDD

**Classical School (Detroit/Chicago)**:
- Prefer real objects where possible
- Replace only **shared dependencies** (database, file system, network)
- Use stubs for dependencies
- Focus on state verification
- Tests are less brittle to refactoring

**London School (Mockist)**:
- Mock all collaborators
- Use mocks for all dependencies
- Focus on behavior verification
- Forces thinking about interactions
- Tests can be more brittle

**Recommendation**: Prefer Classical approach. Mock only at system boundaries (external services, databases, file system). Use stubs for queries, mocks only when you need to verify commands.

---

## Rule 2: Don't Mock What You Don't Own

**Statement**: Never mock third-party libraries or frameworks directly. Create an adapter/wrapper and mock your adapter instead.

### Why This Matters

Mocking code you don't own creates several problems:
- **Brittle Tests**: Library updates break your tests
- **Wrong Assumptions**: You may mock behavior incorrectly
- **Coupling**: Tests become coupled to library implementation
- **Difficult Refactoring**: Switching libraries requires changing all tests

This principle comes from Steve Freeman and Nat Pryce's "Growing Object-Oriented Software, Guided by Tests."

### ❌ WRONG: Mocking Third-Party Library Directly

```python
# WRONG: Mocking requests library directly
def test_fetch_user_data():
    with patch('requests.get') as mock_get:
        mock_get.return_value.json.return_value = {'name': 'Alice'}
        mock_get.return_value.status_code = 200

        service = UserService()
        user = service.fetch_user(1)

        assert user['name'] == 'Alice'
        mock_get.assert_called_with('https://api.example.com/users/1')
```

**What's wrong**:
- Tests coupled to requests library implementation
- If we switch to httpx, all tests break
- We're testing implementation detail (HTTP library) not business logic
- Have to mock complex third-party behavior (.json(), .status_code)

### ❌ WRONG: Mocking AWS SDK Directly

```typescript
// WRONG: Mocking AWS SDK directly
test('uploads file to S3', async () => {
    const mockS3 = {
        putObject: jest.fn().mockReturnValue({
            promise: jest.fn().mockResolvedValue({ ETag: 'abc123' })
        })
    };

    const uploader = new FileUploader(mockS3);
    await uploader.upload('file.txt', 'content');

    expect(mockS3.putObject).toHaveBeenCalledWith({
        Bucket: 'my-bucket',
        Key: 'file.txt',
        Body: 'content'
    });
});
```

**What's wrong**: Tests are coupled to AWS SDK structure (promise() method, ETag response, putObject parameters). If AWS updates their SDK, tests break.

### ✅ CORRECT: Create Adapter, Mock Your Adapter

```python
# CORRECT: Create adapter for HTTP client
class HttpClient:
    """Adapter wrapping requests library"""

    def get_json(self, url):
        response = requests.get(url)
        response.raise_for_status()
        return response.json()

class UserService:
    def __init__(self, http_client: HttpClient):
        self.http_client = http_client

    def fetch_user(self, user_id):
        url = f'https://api.example.com/users/{user_id}'
        return self.http_client.get_json(url)

def test_fetch_user_data():
    # Mock OUR adapter, not requests
    mock_client = Mock(spec=HttpClient)
    mock_client.get_json.return_value = {'name': 'Alice'}

    service = UserService(mock_client)
    user = service.fetch_user(1)

    assert user['name'] == 'Alice'
    mock_client.get_json.assert_called_with('https://api.example.com/users/1')
```

**Why this works**:
- Tests mock our interface, not third-party library
- Can switch HTTP libraries without changing tests
- Adapter is simple and can be tested separately
- Tests focus on business logic, not HTTP details

### ✅ CORRECT: Storage Adapter Pattern

```typescript
// CORRECT: Create storage adapter
interface StorageClient {
    upload(key: string, content: string): Promise<string>;
    download(key: string): Promise<string>;
}

class S3StorageClient implements StorageClient {
    constructor(private s3: AWS.S3) {}

    async upload(key: string, content: string): Promise<string> {
        const result = await this.s3.putObject({
            Bucket: process.env.BUCKET_NAME,
            Key: key,
            Body: content
        }).promise();
        return result.ETag;
    }

    async download(key: string): Promise<string> {
        const result = await this.s3.getObject({
            Bucket: process.env.BUCKET_NAME,
            Key: key
        }).promise();
        return result.Body.toString();
    }
}

test('file uploader uploads to storage', async () => {
    // Mock OUR interface, not AWS SDK
    const mockStorage: StorageClient = {
        upload: jest.fn().mockResolvedValue('etag-123'),
        download: jest.fn()
    };

    const uploader = new FileUploader(mockStorage);
    const etag = await uploader.upload('file.txt', 'content');

    expect(etag).toBe('etag-123');
    expect(mockStorage.upload).toHaveBeenCalledWith('file.txt', 'content');
});
```

**Why this works**:
- StorageClient is our interface, we control it
- Can switch from S3 to GCS without changing tests
- S3StorageClient can be tested separately with integration tests
- Tests focus on file uploader logic, not AWS SDK details

---

## Rule 3: Mock at the Right Level

**Statement**: Mock external boundaries (API calls, database, file system), not low-level implementation details.

### Why This Matters

Mocking too low in the system creates brittle tests that break with every refactoring. Mock at architectural boundaries where your system interacts with the outside world.

### ❌ WRONG: Mocking Internal Implementation Details

```typescript
// WRONG: Mocking internal helper method
class OrderService {
    calculateDiscount(order: Order): number {
        // Complex discount logic
    }

    calculateTotal(order: Order): number {
        const subtotal = order.items.reduce((sum, item) => sum + item.price, 0);
        const discount = this.calculateDiscount(order);
        return subtotal - discount;
    }
}

test('order total includes discount', () => {
    const service = new OrderService();
    // WRONG: Spying on internal method
    jest.spyOn(service, 'calculateDiscount').mockReturnValue(10);

    const order = { items: [{ price: 100 }] };
    const total = service.calculateTotal(order);

    expect(total).toBe(90);
});
```

**What's wrong**: Test is coupled to internal implementation (calculateDiscount method). If we inline the discount calculation or extract it to a separate class, test breaks even though behavior is unchanged.

### ❌ WRONG: Mocking Private Methods

```java
// WRONG: Mocking private methods
public class ReportGenerator {
    private List<Data> fetchDataFromDatabase() {
        // Database query
    }

    public Report generateReport() {
        List<Data> data = fetchDataFromDatabase();
        return processData(data);
    }
}

@Test
public void testGenerateReport() {
    ReportGenerator generator = spy(new ReportGenerator());
    // WRONG: Mocking private method
    doReturn(testData).when(generator).fetchDataFromDatabase();

    Report report = generator.generateReport();
    assertEquals(expectedReport, report);
}
```

**What's wrong**: Tests shouldn't know about private methods. This couples tests to implementation, making refactoring impossible.

### ✅ CORRECT: Mock External Boundaries

```typescript
// CORRECT: Mock at repository boundary
interface OrderRepository {
    findById(id: string): Promise<Order>;
    save(order: Order): Promise<void>;
}

class OrderService {
    constructor(private repository: OrderRepository) {}

    async calculateTotal(orderId: string): Promise<number> {
        const order = await this.repository.findById(orderId);
        const subtotal = order.items.reduce((sum, item) => sum + item.price, 0);
        const discount = this.calculateDiscount(order);
        return subtotal - discount;
    }

    private calculateDiscount(order: Order): number {
        // Complex discount logic
        if (order.items.length > 5) return 10;
        return 0;
    }
}

test('order total includes discount for large orders', async () => {
    // Mock external dependency (repository), not internal methods
    const mockRepo: OrderRepository = {
        findById: jest.fn().mockResolvedValue({
            id: '1',
            items: [
                { price: 10 }, { price: 10 }, { price: 10 },
                { price: 10 }, { price: 10 }, { price: 10 }
            ]
        }),
        save: jest.fn()
    };

    const service = new OrderService(mockRepo);
    const total = await service.calculateTotal('1');

    // Verify behavior, not implementation
    expect(total).toBe(50); // 60 - 10 discount
});
```

**Why this works**:
- Mocks external boundary (repository/database)
- Internal logic (calculateDiscount) tested through public interface
- Can refactor discount calculation without breaking test
- Test focuses on behavior from user's perspective

### ✅ CORRECT: Mock HTTP Client, Not Business Logic

```python
# CORRECT: Mock HTTP client adapter, test business logic
class ApiClient:
    """External boundary - HTTP calls"""
    def get(self, url):
        response = requests.get(url)
        response.raise_for_status()
        return response.json()

class WeatherService:
    def __init__(self, api_client: ApiClient):
        self.api_client = api_client

    def get_temperature_recommendation(self, city):
        """Business logic - NOT mocked"""
        data = self.api_client.get(f'/weather/{city}')
        temp = data['temperature']

        if temp > 80:
            return "It's hot! Stay hydrated."
        elif temp < 40:
            return "It's cold! Bundle up."
        else:
            return "Nice weather!"

def test_hot_weather_recommendation():
    # Mock external boundary only
    mock_client = Mock(spec=ApiClient)
    mock_client.get.return_value = {'temperature': 85}

    service = WeatherService(mock_client)
    recommendation = service.get_temperature_recommendation('Boston')

    # Business logic tested without mocking
    assert recommendation == "It's hot! Stay hydrated."
```

**Why this works**:
- Mocks external HTTP calls (architectural boundary)
- Business logic (temperature recommendations) tested normally
- Can refactor business logic freely
- Clear separation between external and internal

---

## Rule 4: Verify Mock Expectations Are Meaningful

**Statement**: When verifying mock calls, always check arguments and context, not just that the method was called.

### Why This Matters

Verifying that a method was called is useless if it was called with wrong arguments. Weak assertions give false confidence that code is working correctly.

### ❌ WRONG: Verify Call Without Checking Arguments

```typescript
test('user service notifies admin', async () => {
    const mockNotifier = {
        notify: jest.fn()
    };

    const service = new UserService(mockNotifier);
    await service.suspendUser(123, "spam");

    // WRONG: Only checks method was called, not HOW
    expect(mockNotifier.notify).toHaveBeenCalled();
});
```

**What's wrong**: Test passes even if notify() was called with wrong arguments, wrong recipient, or wrong message. We're not actually verifying the behavior.

### ❌ WRONG: Vague Matchers

```python
def test_logger_logs_error():
    mock_logger = Mock()
    service = UserService(mock_logger)

    service.delete_user(999)  # Non-existent user

    # WRONG: Too vague, any log call passes
    mock_logger.log.assert_called()
```

**What's wrong**: Test passes if logger logs anything at all, even "Debug: starting deletion". Not verifying error was actually logged.

### ✅ CORRECT: Verify Arguments and Context

```typescript
test('user service notifies admin with correct details', async () => {
    const mockNotifier = {
        notify: jest.fn()
    };

    const service = new UserService(mockNotifier);
    await service.suspendUser(123, "spam");

    // CORRECT: Verify arguments and context
    expect(mockNotifier.notify).toHaveBeenCalledWith(
        'admin@example.com',
        'User Suspended',
        expect.stringContaining('User 123'),
        expect.stringContaining('spam')
    );
});
```

**Why this works**: Verifies notification goes to admin with correct subject and message content. Test catches bugs where wrong recipient or message is used.

### ✅ CORRECT: Specific Matchers

```python
def test_logger_logs_error_with_correct_level():
    mock_logger = Mock()
    service = UserService(mock_logger)

    service.delete_user(999)  # Non-existent user

    # CORRECT: Verify log level and message content
    mock_logger.log.assert_called_with(
        level='ERROR',
        message=ANY,  # Can be flexible where needed
        user_id=999
    )
    # Further verify message content
    call_args = mock_logger.log.call_args
    assert 'not found' in call_args.kwargs['message'].lower()
```

**Why this works**: Verifies error was logged with correct severity and meaningful message. Test catches bugs where wrong log level is used.

### ✅ CORRECT: Verify Order and Count

```java
@Test
public void testTransactionCommitsAndCloses() {
    Transaction mockTx = mock(Transaction.class);
    DatabaseService service = new DatabaseService(mockTx);

    service.performUpdate();

    // Verify order matters: commit before close
    InOrder inOrder = inOrder(mockTx);
    inOrder.verify(mockTx).commit();
    inOrder.verify(mockTx).close();

    // Verify commit called exactly once (not twice)
    verify(mockTx, times(1)).commit();
}
```

**Why this works**: Verifies transaction is committed before closing and committed exactly once. Catches bugs where operations happen in wrong order or multiple times.

---

## Rule 5: Clean Up Mocks After Tests

**Statement**: Reset mocks after each test to prevent mock pollution between tests.

### Why This Matters

Mocks maintain state (call history, configured returns). If not reset between tests, one test's mock configuration or call history can affect subsequent tests, causing:
- Tests that pass/fail based on execution order
- False positives (test passes for wrong reason)
- False negatives (test fails due to previous test)

### ❌ WRONG: Shared Mock Without Cleanup

```typescript
// WRONG: Mock shared across tests without reset
describe('UserService', () => {
    const mockRepository = {
        findById: jest.fn(),
        save: jest.fn()
    };
    const service = new UserService(mockRepository);

    test('finds user by id', async () => {
        mockRepository.findById.mockResolvedValue({ id: 1, name: 'Alice' });
        const user = await service.getUser(1);
        expect(user.name).toBe('Alice');
    });

    test('counts repository calls', async () => {
        await service.getUser(2);
        // WRONG: This includes calls from previous test!
        expect(mockRepository.findById).toHaveBeenCalledTimes(1);
    });
});
```

**What breaks**: Second test sees calls from first test. Call count is 2, not 1. Test fails or passes for wrong reason depending on test order.

### ❌ WRONG: Global Mock State

```python
# WRONG: Patching at module level without cleanup
@patch('requests.get')
class TestUserService:
    def test_fetch_user(self, mock_get):
        mock_get.return_value.json.return_value = {'name': 'Alice'}
        service = UserService()
        user = service.fetch_user(1)
        assert user['name'] == 'Alice'

    def test_fetch_user_not_found(self, mock_get):
        # Previous test's return_value may still be set
        mock_get.return_value.status_code = 404
        service = UserService()
        with pytest.raises(UserNotFound):
            service.fetch_user(999)
```

**What breaks**: Mock state may leak between tests. json.return_value from first test might still be set in second test.

### ✅ CORRECT: Jest afterEach Cleanup

```typescript
describe('UserService', () => {
    let mockRepository: OrderRepository;
    let service: UserService;

    beforeEach(() => {
        // Fresh mocks for each test
        mockRepository = {
            findById: jest.fn(),
            save: jest.fn()
        };
        service = new UserService(mockRepository);
    });

    afterEach(() => {
        // Clear all mock state
        jest.clearAllMocks();
    });

    test('finds user by id', async () => {
        mockRepository.findById.mockResolvedValue({ id: 1, name: 'Alice' });
        const user = await service.getUser(1);
        expect(user.name).toBe('Alice');
    });

    test('counts repository calls correctly', async () => {
        mockRepository.findById.mockResolvedValue({ id: 2, name: 'Bob' });
        await service.getUser(2);
        // Correct: Only sees calls from THIS test
        expect(mockRepository.findById).toHaveBeenCalledTimes(1);
    });
});
```

**Why this works**:
- `beforeEach` creates fresh mocks for each test
- `afterEach` clears all mock state
- Tests are isolated and order-independent

### ✅ CORRECT: Pytest Fixture Cleanup

```python
import pytest
from unittest.mock import Mock

@pytest.fixture
def mock_repository():
    """Fixture provides fresh mock for each test"""
    return Mock(spec=UserRepository)

@pytest.fixture
def user_service(mock_repository):
    """Fixture provides fresh service with fresh mock"""
    return UserService(mock_repository)

def test_fetch_user(user_service, mock_repository):
    mock_repository.find_by_id.return_value = User(id=1, name='Alice')
    user = user_service.get_user(1)
    assert user.name == 'Alice'

def test_fetch_user_not_found(user_service, mock_repository):
    mock_repository.find_by_id.return_value = None
    with pytest.raises(UserNotFound):
        user_service.get_user(999)
    # No pollution from previous test
```

**Why this works**: Pytest fixtures create fresh mocks for each test automatically. No manual cleanup needed.

### ✅ CORRECT: Mockito Auto-Cleanup

```java
@ExtendWith(MockitoExtension.class)
public class UserServiceTest {
    @Mock
    private UserRepository mockRepository;

    @InjectMocks
    private UserService service;

    // Mockito automatically resets mocks after each test

    @Test
    public void testFindUser() {
        when(mockRepository.findById(1L)).thenReturn(Optional.of(testUser));
        User user = service.getUser(1L);
        assertEquals("Alice", user.getName());
    }

    @Test
    public void testRepositoryCallCount() {
        when(mockRepository.findById(2L)).thenReturn(Optional.of(testUser));
        service.getUser(2L);
        // Clean: Only sees calls from this test
        verify(mockRepository, times(1)).findById(2L);
    }
}
```

**Why this works**: `@ExtendWith(MockitoExtension.class)` automatically resets mocks after each test. Modern Mockito handles cleanup.

---

## Framework-Specific Syntax Reference

### Jest (JavaScript/TypeScript)

```typescript
// Creating mocks
const mockFn = jest.fn();
const mockFn = jest.fn().mockReturnValue(42);
const mockFn = jest.fn().mockResolvedValue({ data: 'async result' });
const mockObj = { method: jest.fn() };

// Spying on existing objects
const spy = jest.spyOn(object, 'method');
jest.spyOn(console, 'log').mockImplementation(() => {});

// Mocking modules
jest.mock('./userService');
jest.mock('./api', () => ({
    fetchUser: jest.fn().mockResolvedValue({ name: 'Alice' })
}));

// Assertions
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledTimes(2);
expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
expect(mockFn).toHaveBeenLastCalledWith('arg');

// Cleanup
jest.clearAllMocks();  // Clear call history
jest.resetAllMocks();  // Clear calls and implementations
mockFn.mockClear();    // Clear specific mock
```

### Pytest with unittest.mock

```python
from unittest.mock import Mock, patch, MagicMock, call

# Creating mocks
mock_obj = Mock()
mock_obj = Mock(spec=SomeClass)
mock_obj = Mock(return_value=42)
mock_obj.method.return_value = 'result'

# Patching
with patch('module.ClassName') as mock:
    mock.return_value.method.return_value = 'result'

@patch('module.function')
def test_something(mock_function):
    mock_function.return_value = 'result'

# Assertions
mock_obj.method.assert_called()
mock_obj.method.assert_called_once()
mock_obj.method.assert_called_with('arg1', 'arg2')
mock_obj.method.assert_called_once_with('arg')
mock_obj.method.assert_has_calls([call(1), call(2)])

# Inspection
assert mock_obj.method.call_count == 2
assert mock_obj.method.called
args, kwargs = mock_obj.method.call_args
```

### Mockito (Java)

```java
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

// Creating mocks
UserRepository mock = mock(UserRepository.class);
UserRepository mock = mock(UserRepository.class, RETURNS_DEEP_STUBS);

// Stubbing
when(mock.findById(1)).thenReturn(user);
when(mock.findById(anyLong())).thenReturn(user);
when(mock.save(any(User.class))).thenReturn(savedUser);
doThrow(new RuntimeException()).when(mock).delete(1);

// Verification
verify(mock).findById(1);
verify(mock, times(2)).findById(anyLong());
verify(mock, never()).delete(any());
verify(mock, atLeastOnce()).save(any(User.class));

// Order verification
InOrder inOrder = inOrder(mock1, mock2);
inOrder.verify(mock1).method1();
inOrder.verify(mock2).method2();

// Argument capture
ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
verify(mock).save(captor.capture());
User captured = captor.getValue();
```

### Sinon.js (Mocha/Chai)

```javascript
const sinon = require('sinon');

// Stubs
const stub = sinon.stub();
const stub = sinon.stub().returns(42);
const stub = sinon.stub(object, 'method');
stub.withArgs('arg').returns('result');

// Spies
const spy = sinon.spy();
const spy = sinon.spy(object, 'method');
assert(spy.called);
assert(spy.calledOnce);
assert(spy.calledWith('arg'));

// Mocks
const mock = sinon.mock(object);
mock.expects('method').once().withArgs('arg').returns('result');
mock.verify();  // Verify expectations
mock.restore();

// Fake timers
const clock = sinon.useFakeTimers();
clock.tick(1000);
clock.restore();
```

### RSpec (Ruby)

```ruby
# Doubles
user = double('User')
user = double('User', name: 'Alice', email: 'alice@example.com')

# Stubs
allow(user).to receive(:name).and_return('Alice')
allow(user).to receive(:save).and_return(true)

# Mocks (expectations)
expect(user).to receive(:save).once
expect(user).to receive(:update).with(name: 'Alice')

# Spies
allow(mailer).to receive(:send_email)
mailer.send_email('test@example.com')
expect(mailer).to have_received(:send_email).with('test@example.com')

# Argument matchers
expect(user).to receive(:update).with(hash_including(name: 'Alice'))
expect(service).to receive(:process).with(kind_of(Array))
```

---

## Common Anti-Patterns and Remediation

### Anti-Pattern 1: Testing Mocks Instead of Behavior

**Problem**: Tests verify mock interactions but don't test actual functionality.

```typescript
// BAD
test('processes order', () => {
    const mockValidator = { validate: jest.fn().mockReturnValue(true) };
    const mockPayment = { charge: jest.fn().mockReturnValue(true) };
    const mockInventory = { reserve: jest.fn().mockReturnValue(true) };

    const service = new OrderService(mockValidator, mockPayment, mockInventory);
    service.processOrder(order);

    expect(mockValidator.validate).toHaveBeenCalled();
    expect(mockPayment.charge).toHaveBeenCalled();
    expect(mockInventory.reserve).toHaveBeenCalled();
    // NOT testing that order was actually processed!
}

// GOOD
test('processes order successfully', () => {
    const mockPayment = { charge: jest.fn().mockReturnValue({ success: true, txId: '123' }) };
    const mockInventory = { reserve: jest.fn().mockReturnValue(true) };

    const service = new OrderService(mockPayment, mockInventory);
    const result = service.processOrder(order);

    expect(result.success).toBe(true);
    expect(result.transactionId).toBe('123');
    // Verify critical commands were executed
    expect(mockPayment.charge).toHaveBeenCalledWith(order.total, order.paymentMethod);
});
```

### Anti-Pattern 2: Mocking Everything (London School Overuse)

**Problem**: Every dependency is mocked, creating brittle tests.

```typescript
// BAD: Too many mocks
test('calculates shipping cost', () => {
    const mockAddressValidator = { validate: jest.fn() };
    const mockDistanceCalculator = { calculate: jest.fn() };
    const mockRateService = { getRate: jest.fn() };
    const mockTaxCalculator = { calculate: jest.fn() };

    // Test becomes about orchestration, not behavior
});

// GOOD: Use real objects where possible
test('calculates shipping cost', () => {
    const mockRateService = { getRate: jest.fn().mockReturnValue(10.00) };

    // Real objects for logic without external dependencies
    const addressValidator = new AddressValidator();
    const distanceCalculator = new DistanceCalculator();
    const shippingCalculator = new ShippingCalculator(
        addressValidator,
        distanceCalculator,
        mockRateService
    );

    const cost = shippingCalculator.calculate(address, destination);

    expect(cost).toBe(10.00);
});
```

### Anti-Pattern 3: Incomplete Stub Setup

**Problem**: Stub doesn't handle all code paths, causing unexpected undefined returns.

```python
# BAD: Incomplete stub
def test_user_service():
    mock_repo = Mock()
    mock_repo.find_by_id.return_value = User(id=1, name='Alice')

    service = UserService(mock_repo)
    # Calls both find_by_id and find_by_email
    result = service.get_user_by_id_or_email(1, 'alice@example.com')

    # Test fails because find_by_email returns Mock(), not User
    assert result.name == 'Alice'

# GOOD: Complete stub setup
def test_user_service():
    user = User(id=1, name='Alice', email='alice@example.com')
    mock_repo = Mock(spec=UserRepository)
    mock_repo.find_by_id.return_value = user
    mock_repo.find_by_email.return_value = user

    service = UserService(mock_repo)
    result = service.get_user_by_id_or_email(1, 'alice@example.com')

    assert result.name == 'Alice'
```

---

## Agent Checklist: Mock and Test Double Rules

Before submitting code with test doubles, verify:

**Test Double Selection**:
- [ ] Dummy used only for filling parameter lists
- [ ] Fake provides working simplified implementation
- [ ] Stub used for queries (state verification)
- [ ] Spy used when need both behavior and state verification
- [ ] Mock used for commands (behavior verification)

**Mock vs Stub Usage**:
- [ ] Stubs used for queries, verify state not calls
- [ ] Mocks used for commands, verify behavior
- [ ] Not over-specifying with mocks where stubs would work
- [ ] Following Classical approach: mock at boundaries

**Ownership and Boundaries**:
- [ ] Not mocking third-party libraries directly
- [ ] Created adapters for external dependencies
- [ ] Mocking at architectural boundaries (DB, API, file system)
- [ ] Not mocking internal implementation details

**Verification Quality**:
- [ ] Mock assertions check arguments, not just call count
- [ ] Using specific matchers where appropriate
- [ ] Verifying order of calls when order matters
- [ ] Verifying call count when count matters

**Test Hygiene**:
- [ ] Mocks reset after each test (afterEach/fixture)
- [ ] No mock state pollution between tests
- [ ] Tests can run in any order
- [ ] Mock cleanup automated with test framework

**Framework Usage**:
- [ ] Using framework correctly (Jest/Mockito/pytest/etc)
- [ ] Following framework best practices
- [ ] Using appropriate matchers and assertions

---

## Summary

Test doubles are essential for fast, reliable, isolated tests. Success requires:

1. **Understand the taxonomy**: Use the right double for the job (Dummy, Fake, Stub, Spy, Mock)
2. **Prefer stubs over mocks**: Mock only when verifying commands (behavior), stub for queries (state)
3. **Don't mock what you don't own**: Create adapters for third-party libraries
4. **Mock at the right level**: Mock external boundaries, not internal implementation
5. **Verify meaningfully**: Check arguments and context, not just that methods were called
6. **Clean up after tests**: Reset mocks to prevent pollution between tests

These principles, from Gerard Meszaros's "xUnit Test Patterns" and Martin Fowler's "Mocks Aren't Stubs," ensure your tests are maintainable, reliable, and focused on behavior rather than implementation.

---

## Sources

- **xUnit Test Patterns: Refactoring Test Code** - Gerard Meszaros (definitive reference for test double taxonomy)
- **Mocks Aren't Stubs** - Martin Fowler (https://martinfowler.com/articles/mocksArentStubs.html)
- **Test Double** - Martin Fowler's Bliki (https://martinfowler.com/bliki/TestDouble.html)
- **Growing Object-Oriented Software, Guided by Tests** - Steve Freeman & Nat Pryce (don't mock what you don't own)
- **Test-Driven Development: By Example** - Kent Beck (Classical TDD approach)
