# Test Double Selection Decision Tree

## When to Use This Tree

Use this tree when you need to decide **which type of test double** to use when testing code that has dependencies. This is one of the most fundamental testing decisions, and choosing the wrong type of test double leads to brittle tests, over-mocking, and tests that don't actually verify behavior.

## The Core Question

**"What kind of test double do I need for this dependency?"**

---

## The Decision Tree

```
Start: Why do you need a test double?

├─ Just need to fill a parameter (object is never actually used)?
│   └─ → Dummy Object
│       Example: Customer parameter required but test doesn't use it
│
├─ Need a working implementation (simplified/in-memory version)?
│   │
│   ├─ Real implementation too slow (database, filesystem, external API)?
│   │   └─ → Fake
│   │       Example: In-memory database, fake HTTP client
│   │
│   └─ Real implementation has side effects (emails, payments)?
│       └─ → Fake
│           Example: Fake email service that doesn't send real emails
│
├─ Need to return canned/predetermined responses?
│   │
│   ├─ Do you need to verify the dependency was called correctly?
│   │   │
│   │   ├─ Yes, verify calls (how many times, with what arguments)?
│   │   │   └─ → Spy
│   │   │       Records calls AND returns values
│   │   │       Example: Verify email.send() was called with correct message
│   │   │
│   │   └─ No, just need return values?
│   │       └─ → Stub
│   │           State verification only
│   │           Example: Return fixed temperature from weather service
│   │
│   └─ Simple query dependency (getter, read-only)?
│       └─ → Stub
│           Example: getUserById() always returns test user
│
└─ Need to set expectations and verify behavior?
    │
    ├─ Testing command methods (void methods, state changes)?
    │   └─ → Mock
    │       Behavior verification with expectations
    │       Example: Verify repository.save() called with correct entity
    │
    ├─ Complex interaction sequence (order matters)?
    │   └─ → Mock
    │       Can verify call order and sequence
    │       Example: Verify login() called before getUserData()
    │
    └─ Need to fail test if dependency NOT called?
        └─ → Mock
            Mock fails if expectations aren't met
            Example: Must call logger.logError() on exception
```

---

## Code Examples for Each Test Double

### Solution 1: Dummy Object

**When:** Object is required by API but never actually used in the test

**Characteristics:**
- Passed around but never accessed
- Usually just to fill parameter lists
- Simplest test double type
- Methods throw exceptions if accidentally called

**Java Example:**
```java
// ✅ Perfect when parameter is required but not used
public class OrderProcessorTest {
    @Test
    public void testProcessOrder_ValidatesItems() {
        // Customer is required parameter but never accessed in this test
        Customer dummyCustomer = null; // Simplest dummy

        List<Item> items = Arrays.asList(new Item("widget", 10.0));
        Order order = new Order(dummyCustomer, items);

        assertTrue(order.hasValidItems());
    }
}

// More explicit dummy
public class DummyCustomer implements Customer {
    @Override
    public String getId() {
        throw new UnsupportedOperationException("Dummy - should never be called");
    }

    @Override
    public String getName() {
        throw new UnsupportedOperationException("Dummy - should never be called");
    }
}
```

**TypeScript Example:**
```typescript
// ✅ Dummy logger that's required but not used
describe('UserValidator', () => {
    it('validates email format', () => {
        const dummyLogger = {} as Logger; // Never called
        const validator = new UserValidator(dummyLogger);

        const result = validator.isValidEmail('test@example.com');

        expect(result).toBe(true);
    });
});
```

**Use for:** Required parameters, interface implementations that won't be called, satisfying constructors

---

### Solution 2: Fake

**When:** Need working implementation but real one is too slow or has side effects

**Characteristics:**
- Has working implementation (not just canned responses)
- Takes shortcuts unsuitable for production
- Usually simpler than real implementation
- Maintains state internally

**Java Example - In-Memory Database:**
```java
// ✅ Fake repository using in-memory storage
public class FakeUserRepository implements UserRepository {
    private Map<String, User> users = new HashMap<>();
    private AtomicLong idCounter = new AtomicLong(1);

    @Override
    public User save(User user) {
        if (user.getId() == null) {
            user.setId(String.valueOf(idCounter.getAndIncrement()));
        }
        users.put(user.getId(), user);
        return user;
    }

    @Override
    public Optional<User> findById(String id) {
        return Optional.ofNullable(users.get(id));
    }

    @Override
    public List<User> findAll() {
        return new ArrayList<>(users.values());
    }

    @Override
    public void delete(String id) {
        users.remove(id);
    }
}

// Test using fake
@Test
public void testUserService_CreatesAndRetrievesUser() {
    UserRepository fakeRepo = new FakeUserRepository();
    UserService service = new UserService(fakeRepo);

    User created = service.createUser("Alice", "alice@example.com");
    User retrieved = service.getUserById(created.getId());

    assertEquals("Alice", retrieved.getName());
}
```

**TypeScript Example - Fake HTTP Client:**
```typescript
// ✅ Fake API client with in-memory responses
class FakeApiClient implements ApiClient {
    private responses: Map<string, any> = new Map();

    // Configure what to return for each endpoint
    setResponse(url: string, data: any): void {
        this.responses.set(url, data);
    }

    async get(url: string): Promise<any> {
        if (this.responses.has(url)) {
            return this.responses.get(url);
        }
        throw new Error(`No fake response configured for: ${url}`);
    }

    async post(url: string, body: any): Promise<any> {
        // Simplified implementation
        return { success: true, data: body };
    }
}

// Test using fake
describe('WeatherService', () => {
    it('fetches weather data', async () => {
        const fakeClient = new FakeApiClient();
        fakeClient.setResponse('/api/weather', { temp: 72, condition: 'sunny' });

        const service = new WeatherService(fakeClient);
        const weather = await service.getCurrentWeather();

        expect(weather.temp).toBe(72);
        expect(weather.condition).toBe('sunny');
    });
});
```

**Python Example - Fake Email Service:**
```python
# ✅ Fake email service that records emails instead of sending
class FakeEmailService(EmailService):
    def __init__(self):
        self.sent_emails = []

    def send(self, to: str, subject: str, body: str) -> bool:
        # Don't actually send, just record
        self.sent_emails.append({
            'to': to,
            'subject': subject,
            'body': body
        })
        return True

    def get_sent_count(self) -> int:
        return len(self.sent_emails)

# Test using fake
def test_user_registration_sends_welcome_email():
    fake_email = FakeEmailService()
    service = UserRegistrationService(fake_email)

    service.register_user('alice@example.com', 'password123')

    assert fake_email.get_sent_count() == 1
    assert fake_email.sent_emails[0]['to'] == 'alice@example.com'
    assert 'Welcome' in fake_email.sent_emails[0]['subject']
```

**Use for:** Database access, file system operations, external APIs, email/SMS services, payment gateways

---

### Solution 3: Stub

**When:** Need to return predetermined responses; testing queries (state verification)

**Characteristics:**
- Provides canned answers to calls
- No call verification (unlike spy/mock)
- Simple and focused
- Used for queries/getters

**Java Example - Mockito Stub:**
```java
// ✅ Stub for query methods
public class ProductServiceTest {
    @Test
    public void testCalculateDiscount_PremiumUser() {
        // Create stub that returns predetermined value
        UserRepository stubRepo = mock(UserRepository.class);
        when(stubRepo.getUserTier("user123")).thenReturn(UserTier.PREMIUM);

        ProductService service = new ProductService(stubRepo);

        // Act
        double discount = service.calculateDiscount("user123", 100.0);

        // Assert state (NOT verifying repository was called)
        assertEquals(20.0, discount); // 20% discount for premium
    }
}
```

**TypeScript Example - Sinon Stub:**
```typescript
// ✅ Stub for API responses
import sinon from 'sinon';

describe('PriceCalculator', () => {
    it('applies exchange rate to price', () => {
        // Create stub that returns fixed exchange rate
        const stubRateService = {
            getExchangeRate: sinon.stub().returns(1.2)
        };

        const calculator = new PriceCalculator(stubRateService);

        const priceInEuros = calculator.convertToEuros(100); // USD to EUR

        expect(priceInEuros).toBe(120); // 100 * 1.2
        // No verification - just checking the calculation result
    });
});
```

**Python Example - pytest-mock Stub:**
```python
# ✅ Stub for configuration values
def test_process_payment_uses_correct_api_key(mocker):
    # Stub returns fixed value
    stub_config = mocker.Mock()
    stub_config.get_api_key.return_value = 'test-key-123'

    processor = PaymentProcessor(stub_config)

    # We're testing the payment logic, not verifying config was called
    result = processor.process_payment(100.0)

    assert result.api_key_used == 'test-key-123'
```

**Manual Stub Example:**
```typescript
// ✅ Simple hand-written stub
class StubWeatherService implements WeatherService {
    getTemperature(): number {
        return 72; // Always return same value
    }

    getCondition(): string {
        return 'sunny';
    }
}

describe('ClothingRecommender', () => {
    it('recommends shorts when temperature is 72', () => {
        const stubWeather = new StubWeatherService();
        const recommender = new ClothingRecommender(stubWeather);

        const clothing = recommender.recommend();

        expect(clothing).toContain('shorts');
    });
});
```

**Use for:** Configuration values, API responses, database queries, time/date values, file contents

---

### Solution 4: Spy

**When:** Need to return values AND verify calls (records interactions)

**Characteristics:**
- Combination of stub + call recording
- Returns canned responses like stub
- Records how it was called (arguments, call count)
- Use when you care BOTH about return value AND verification

**Java Example - Mockito Spy:**
```java
// ✅ Spy on real object
public class NotificationServiceTest {
    @Test
    public void testSendOrderConfirmation_CallsEmailService() {
        EmailService emailService = new EmailService();
        EmailService spyEmail = spy(emailService);

        NotificationService notifier = new NotificationService(spyEmail);

        // Act
        notifier.sendOrderConfirmation("order123", "customer@example.com");

        // Verify it was called (spy recorded the call)
        verify(spyEmail).send(
            eq("customer@example.com"),
            eq("Order Confirmation"),
            contains("order123")
        );
    }
}
```

**TypeScript Example - Jest Spy:**
```typescript
// ✅ Spy to verify calls
describe('Logger', () => {
    it('formats and writes log messages', () => {
        const fileWriter = {
            write: jest.fn() // Creates a spy
        };

        const logger = new Logger(fileWriter);

        logger.log('error', 'Database connection failed');

        // Verify the spy was called correctly
        expect(fileWriter.write).toHaveBeenCalledTimes(1);
        expect(fileWriter.write).toHaveBeenCalledWith(
            expect.stringContaining('[ERROR]')
        );
        expect(fileWriter.write).toHaveBeenCalledWith(
            expect.stringContaining('Database connection failed')
        );
    });
});
```

**TypeScript Example - Sinon Spy:**
```typescript
// ✅ Spy on existing method
import sinon from 'sinon';

describe('CacheService', () => {
    it('calls repository only when cache misses', async () => {
        const repository = {
            findUser: sinon.spy(async (id: string) => ({ id, name: 'Alice' }))
        };

        const cache = new CacheService(repository);

        // First call - cache miss, should call repository
        await cache.getUser('user1');
        expect(repository.findUser.callCount).toBe(1);

        // Second call - cache hit, should NOT call repository again
        await cache.getUser('user1');
        expect(repository.findUser.callCount).toBe(1); // Still 1

        // Different user - cache miss, should call repository
        await cache.getUser('user2');
        expect(repository.findUser.callCount).toBe(2);
    });
});
```

**Python Example - unittest.mock Spy:**
```python
# ✅ Spy to track calls
from unittest.mock import Mock

def test_audit_logger_records_user_actions():
    # Create spy that also returns a value
    spy_storage = Mock()
    spy_storage.save.return_value = True

    logger = AuditLogger(spy_storage)

    # Act
    logger.log_action('user123', 'LOGIN', {'ip': '192.168.1.1'})

    # Verify spy recorded the call
    spy_storage.save.assert_called_once()
    call_args = spy_storage.save.call_args[0][0]
    assert call_args['user_id'] == 'user123'
    assert call_args['action'] == 'LOGIN'
```

**Use for:** Callbacks, event handlers, logging, audit trails, cache invalidation

---

### Solution 5: Mock

**When:** Need to set expectations and verify behavior (command methods)

**Characteristics:**
- Pre-programmed with expectations
- Behavior verification (not just state)
- Fails test if expectations not met
- Verifies interactions happened correctly
- Use for commands (void methods, state changes)

**Java Example - Mockito Mock:**
```java
// ✅ Mock with behavior verification
public class OrderServiceTest {
    @Test
    public void testPlaceOrder_SavesToRepository() {
        // Create mock with expectations
        OrderRepository mockRepo = mock(OrderRepository.class);
        PaymentGateway mockGateway = mock(PaymentGateway.class);

        when(mockGateway.charge(anyDouble())).thenReturn(new PaymentResult(true));

        OrderService service = new OrderService(mockRepo, mockGateway);
        Order order = new Order("item", 100.0);

        // Act
        service.placeOrder(order);

        // Verify behavior (mock checks expectations)
        verify(mockRepo).save(order); // MUST be called
        verify(mockGateway).charge(100.0); // MUST be called with exact amount
    }

    @Test
    public void testCancelOrder_DoesNotChargePayment() {
        OrderRepository mockRepo = mock(OrderRepository.class);
        PaymentGateway mockGateway = mock(PaymentGateway.class);

        OrderService service = new OrderService(mockRepo, mockGateway);
        Order order = new Order("item", 100.0);

        service.cancelOrder(order);

        // Verify payment was NEVER called
        verify(mockGateway, never()).charge(anyDouble());
    }
}
```

**TypeScript Example - Jest Mock:**
```typescript
// ✅ Mock for command verification
describe('UserService', () => {
    it('publishes event after creating user', async () => {
        const mockEventBus = {
            publish: jest.fn()
        };

        const service = new UserService(mockEventBus);

        await service.createUser('alice@example.com');

        // Verify the command was executed
        expect(mockEventBus.publish).toHaveBeenCalledWith(
            'user.created',
            expect.objectContaining({
                email: 'alice@example.com'
            })
        );
    });

    it('calls dependencies in correct order', async () => {
        const mockDb = {
            save: jest.fn().mockResolvedValue({ id: '123' })
        };
        const mockCache = {
            invalidate: jest.fn()
        };

        const service = new UserService(mockDb, mockCache);

        await service.updateUser('123', { name: 'Bob' });

        // Verify call order
        expect(mockDb.save).toHaveBeenCalled();
        expect(mockCache.invalidate).toHaveBeenCalledAfter(mockDb.save);
    });
});
```

**Python Example - unittest.mock Mock:**
```python
# ✅ Mock with strict expectations
from unittest.mock import Mock, call

def test_batch_processor_processes_all_items():
    mock_processor = Mock()
    batch_service = BatchService(mock_processor)

    items = ['item1', 'item2', 'item3']

    batch_service.process_batch(items)

    # Verify mock was called exactly 3 times
    assert mock_processor.process.call_count == 3

    # Verify exact call sequence
    mock_processor.process.assert_has_calls([
        call('item1'),
        call('item2'),
        call('item3')
    ])

def test_error_handler_logs_and_notifies():
    mock_logger = Mock()
    mock_notifier = Mock()

    handler = ErrorHandler(mock_logger, mock_notifier)

    handler.handle_error(Exception('Database connection failed'))

    # Both commands MUST be called
    mock_logger.log_error.assert_called_once()
    mock_notifier.send_alert.assert_called_once()
```

**Use for:** Repository saves, event publishing, API calls, notifications, state mutations

---

## Mock vs Stub: The Critical Distinction

### State Verification (Stubs)

**Philosophy:** Test the END RESULT, not how you got there

```typescript
// ✅ Stub - State Verification
describe('DiscountCalculator', () => {
    it('applies correct discount for premium users', () => {
        // Stub provides canned answer
        const stubUserService = {
            isPremium: () => true
        };

        const calculator = new DiscountCalculator(stubUserService);

        // Assert RESULT (state), not interactions
        expect(calculator.getDiscount(100)).toBe(20);
    });
});
```

**Use stubs for:**
- Query methods (getters, finders)
- Read-only operations
- Configuration values
- When you care about the RESULT

### Behavior Verification (Mocks)

**Philosophy:** Test that the RIGHT ACTIONS were taken

```typescript
// ✅ Mock - Behavior Verification
describe('OrderProcessor', () => {
    it('sends confirmation email after order', () => {
        // Mock with expectations
        const mockEmailer = {
            sendEmail: jest.fn()
        };

        const processor = new OrderProcessor(mockEmailer);
        processor.processOrder({ id: '123', email: 'customer@example.com' });

        // Assert BEHAVIOR (interaction happened)
        expect(mockEmailer.sendEmail).toHaveBeenCalledWith(
            'customer@example.com',
            expect.stringContaining('Order 123')
        );
    });
});
```

**Use mocks for:**
- Command methods (setters, mutations)
- Void methods
- Side effects (send email, log message)
- When you care about the ACTION

### Quick Reference

| Type | What to Test | Example |
|------|--------------|---------|
| **Stub** | State / Result | `expect(result).toBe(expected)` |
| **Mock** | Behavior / Interaction | `verify(mock).method()` |
| **Stub** | Query methods | `getUser()`, `calculatePrice()` |
| **Mock** | Command methods | `saveUser()`, `sendEmail()` |
| **Stub** | What data was returned | "Did I get the right discount?" |
| **Mock** | What actions were taken | "Did it save to the database?" |

---

## Classical vs London School TDD

### Classical (Detroit) School: Prefer Stubs + State Verification

**Philosophy:**
- Test observable behavior
- Only mock shared dependencies (database, external services)
- Avoid mocking private dependencies
- Tests are resilient to refactoring

**Example:**
```typescript
// ✅ Classical approach
describe('ShoppingCart (Classical)', () => {
    it('calculates total correctly', () => {
        // Use REAL objects where possible
        const cart = new ShoppingCart();
        const item1 = new Item('widget', 10);
        const item2 = new Item('gadget', 20);

        cart.addItem(item1);
        cart.addItem(item2);

        // Test state/result
        expect(cart.getTotal()).toBe(30);
    });
});
```

**Benefits:**
- Tests don't break when refactoring internals
- Tests are clearer and easier to understand
- Less test setup code
- More confidence in integrated behavior

---

### London (Mockist) School: Prefer Mocks + Behavior Verification

**Philosophy:**
- Test object interactions
- Mock all dependencies
- Focus on behavior and collaboration
- Outside-in development

**Example:**
```typescript
// ✅ London approach
describe('OrderService (London)', () => {
    it('processes order correctly', () => {
        // Mock ALL collaborators
        const mockRepo = mock<OrderRepository>();
        const mockPayment = mock<PaymentService>();
        const mockEmail = mock<EmailService>();

        when(mockPayment.charge(anything())).thenResolve({ success: true });

        const service = new OrderService(mockRepo, mockPayment, mockEmail);
        const order = new Order('item', 100);

        service.placeOrder(order);

        // Verify ALL interactions
        verify(mockPayment.charge(100)).once();
        verify(mockRepo.save(order)).once();
        verify(mockEmail.sendConfirmation(anything())).once();
    });
});
```

**Benefits:**
- Forces thinking about object design
- Catches integration issues early
- Tests are more isolated
- Failures pinpoint exact location

**Trade-offs:**
- Tests coupled to implementation
- Refactoring breaks tests
- More setup code
- Higher maintenance cost

---

## Anti-Patterns: Common Mistakes

### Anti-Pattern 1: Mocking Everything (London School Overuse)

❌ **Wrong:**
```typescript
// Mocking trivial value objects
const mockPrice = mock<Price>();
when(mockPrice.getValue()).thenReturn(10);

const mockItem = mock<Item>();
when(mockItem.getPrice()).thenReturn(mockPrice);

const mockCart = mock<ShoppingCart>();
when(mockCart.getItems()).thenReturn([mockItem]);
```

✅ **Right:**
```typescript
// Use REAL objects for value types
const cart = new ShoppingCart();
cart.addItem(new Item('widget', 10));
expect(cart.getTotal()).toBe(10);
```

**Why it's wrong:** Over-mocking creates brittle tests that break on every refactoring. Use real objects for value types and simple logic.

---

### Anti-Pattern 2: Mocking What You Don't Own

❌ **Wrong:**
```typescript
// Mocking third-party library
const mockAxios = mock<AxiosInstance>();
when(mockAxios.get('/api/users')).thenResolve({ data: [...] });

const service = new UserService(mockAxios);
```

✅ **Right:**
```typescript
// Create adapter interface, mock YOUR interface
interface HttpClient {
    get<T>(url: string): Promise<T>;
}

class AxiosAdapter implements HttpClient {
    async get<T>(url: string): Promise<T> {
        return (await axios.get(url)).data;
    }
}

// Test with YOUR interface
const mockClient = mock<HttpClient>();
when(mockClient.get('/api/users')).thenResolve([...]);

const service = new UserService(mockClient);
```

**Why it's wrong:** Mocking external libraries couples tests to implementation details. Create your own interface and mock that.

---

### Anti-Pattern 3: Complex Mock Setup

❌ **Wrong:**
```typescript
// 50 lines of mock setup
const mockRepo = mock<UserRepository>();
when(mockRepo.findById('1')).thenResolve(user1);
when(mockRepo.findById('2')).thenResolve(user2);
when(mockRepo.findByEmail('a@test.com')).thenResolve(user1);
when(mockRepo.findByEmail('b@test.com')).thenResolve(user2);
// ... 40 more lines ...

// Actual test lost in noise
service.doSomething();
verify(mockRepo.save(anything()));
```

✅ **Right:**
```typescript
// Use fake instead of complex mock
const fakeRepo = new FakeUserRepository();
fakeRepo.addUser(user1);
fakeRepo.addUser(user2);

// Clear, simple test
service.doSomething();
expect(fakeRepo.getSavedUsers()).toContain(expectedUser);
```

**Why it's wrong:** If mock setup is complex, you probably need a Fake instead. Fakes are easier to read and maintain.

---

### Anti-Pattern 4: Testing Mocks Instead of Behavior

❌ **Wrong:**
```typescript
// Testing that mock returns what you told it to return
it('gets user from repository', () => {
    const mockRepo = mock<UserRepository>();
    when(mockRepo.getUser('123')).thenReturn(testUser);

    const service = new UserService(mockRepo);
    const result = service.getUser('123');

    expect(result).toBe(testUser); // Useless test!
});
```

✅ **Right:**
```typescript
// Test actual business logic
it('enriches user with profile data', () => {
    const stubRepo = mock<UserRepository>();
    when(stubRepo.getUser('123')).thenReturn({ id: '123', name: 'Alice' });

    const service = new UserService(stubRepo);
    const result = service.getUserWithProfile('123');

    expect(result.profile).toBeDefined();
    expect(result.profile.displayName).toBe('Alice');
});
```

**Why it's wrong:** Tests should verify YOUR code's behavior, not the mock framework's ability to return values.

---

### Anti-Pattern 5: Using Stubs for Commands

❌ **Wrong:**
```typescript
// Stub for command method (no verification)
it('saves user to database', () => {
    const stubRepo = {
        save: () => {} // No verification!
    };

    const service = new UserService(stubRepo);
    service.createUser('Alice');

    // No way to verify save was actually called
});
```

✅ **Right:**
```typescript
// Mock for command verification
it('saves user to database', () => {
    const mockRepo = {
        save: jest.fn()
    };

    const service = new UserService(mockRepo);
    service.createUser('Alice');

    expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Alice' })
    );
});
```

**Why it's wrong:** Command methods MUST be verified. Use mocks/spies for commands, not stubs.

---

## Test Double Selection Criteria

### Use Dummy when:
- ✅ Parameter is required but never accessed
- ✅ Interface needs implementation but methods won't be called
- ✅ Simplest possible placeholder
- ❌ DON'T use if the object will be accessed

### Use Fake when:
- ✅ Real implementation is too slow (database, filesystem, network)
- ✅ Real implementation has side effects (email, payment)
- ✅ Need working implementation with state
- ✅ Multiple tests need consistent behavior
- ❌ DON'T use if simple stub would suffice

### Use Stub when:
- ✅ Testing query methods (getters, finders)
- ✅ Need predetermined return values
- ✅ State verification (test the result)
- ✅ Don't care if dependency was called
- ❌ DON'T use for command methods (use mock instead)

### Use Spy when:
- ✅ Need both return value AND call verification
- ✅ Want to verify callbacks were called
- ✅ Need to check call count or arguments
- ✅ Partial verification (some methods real, some spied)
- ❌ DON'! use if you only need return values (use stub)

### Use Mock when:
- ✅ Testing command methods (save, send, delete)
- ✅ Behavior verification (verify interactions)
- ✅ Need to set expectations (test fails if not met)
- ✅ Verifying call order matters
- ✅ Must ensure method was (or wasn't) called
- ❌ DON'T use for query methods (use stub instead)
- ❌ DON'T mock everything (use real objects when possible)

---

## Quick Decision Matrix

| Scenario | Test Double | Verification Type |
|----------|-------------|-------------------|
| Repository.save(user) | Mock | Behavior - verify it was called |
| Repository.findById(id) | Stub | State - check returned user |
| EmailService.send(msg) | Mock or Spy | Behavior - verify email sent |
| ConfigService.getApiKey() | Stub | State - use returned value |
| Database queries | Fake | State - query fake database |
| Required but unused parameter | Dummy | None |
| Logger.log(message) | Mock or Spy | Behavior - verify logged |
| WeatherService.getTemp() | Stub | State - use temperature |
| EventBus.publish(event) | Mock | Behavior - verify published |
| Cache.get(key) | Stub or Fake | State - use cached value |

---

## Authoritative Sources

This decision tree is based on:

1. **Gerard Meszaros - "xUnit Test Patterns: Refactoring Test Code"**
   - Definitive taxonomy of test doubles
   - Original definitions of Dummy, Fake, Stub, Spy, Mock
   - [xunitpatterns.com](http://xunitpatterns.com/)

2. **Martin Fowler - "Mocks Aren't Stubs"**
   - Mock vs Stub distinction
   - State verification vs behavior verification
   - Classical vs London school TDD
   - [martinfowler.com/articles/mocksArentStubs.html](https://martinfowler.com/articles/mocksArentStubs.html)

3. **Martin Fowler - "Test Double"**
   - Generic term for all pretend objects
   - When to use each type
   - [martinfowler.com/bliki/TestDouble.html](https://martinfowler.com/bliki/TestDouble.html)

4. **Growing Object-Oriented Software Guided by Tests - Freeman & Pryce**
   - London school TDD approach
   - Mock objects for design discovery
   - Outside-in development

5. **Test-Driven Development: By Example - Kent Beck**
   - Classical school approach
   - Prefer real objects over mocks
   - Inside-out development

---

## See Also

- `@anti-patterns/over-mocking.md` - Dangers of excessive mocking
- `@anti-patterns/testing-mocks.md` - Testing the mock instead of behavior
- `@templates/fake-repository.java` - Example fake implementation
- `@decision-trees/tdd-approach.md` - Classical vs London TDD workflows
