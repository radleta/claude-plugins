# Testing Framework Selection Decision Tree

## When to Use This Tree

Use this tree when you need to **choose a testing framework** for a new project or evaluate whether your current testing framework is the right choice. This is a foundational architectural decision that affects developer productivity, test maintainability, and the overall quality of your test suite.

## The Core Question

**"Which testing framework should I use for my project?"**

---

## The Decision Tree

```
Start: What language/platform are you using?

├─ JavaScript/TypeScript?
│   │
│   ├─ What type of project?
│   │   │
│   │   ├─ React/Vue/Angular application?
│   │   │   │
│   │   │   ├─ Using Vite as build tool?
│   │   │   │   └─ → Vitest (native Vite integration, extremely fast)
│   │   │   │
│   │   │   └─ Using Create React App, Next.js, or Webpack?
│   │   │       └─ → Jest (zero-config, snapshot testing, React Testing Library integration)
│   │   │
│   │   ├─ Node.js backend/API?
│   │   │   │
│   │   │   ├─ Need maximum flexibility, minimal opinions?
│   │   │   │   └─ → Mocha + Chai + Sinon (choose your own adventure)
│   │   │   │
│   │   │   ├─ Want batteries-included, fast setup?
│   │   │   │   └─ → Jest (built-in mocking, parallel execution)
│   │   │   │
│   │   │   └─ Need extremely fast execution (Vite/ESM project)?
│   │   │       └─ → Vitest (ESM-first, compatible with Jest API)
│   │   │
│   │   └─ Library or package development?
│   │       │
│   │       ├─ Need flexibility for different consumers?
│   │       │   └─ → Mocha (minimal assumptions)
│   │       │
│   │       └─ Want comprehensive built-in tooling?
│   │           └─ → Jest (snapshot tests for API contracts)
│   │
│   └─ Have existing test suite?
│       │
│       ├─ Already using Jest?
│       │   └─ → Keep Jest (migration rarely worth it)
│       │
│       └─ Already using Mocha?
│           └─ → Keep Mocha OR migrate to Jest if need built-in features
│
├─ Python?
│   │
│   ├─ New project or can choose freely?
│   │   └─ → Pytest (de facto standard, powerful fixtures, minimal boilerplate)
│   │
│   ├─ Django project?
│   │   └─ → Pytest with pytest-django (better than unittest for Django)
│   │
│   ├─ Legacy project using unittest?
│   │   └─ → Keep unittest OR gradually migrate to Pytest (backward compatible)
│   │
│   └─ Need BDD-style testing?
│       └─ → Pytest with pytest-bdd plugin
│
├─ Java?
│   │
│   ├─ New project (Java 17+)?
│   │   └─ → JUnit 5 (Jupiter) + Mockito (modern, modular, extensible)
│   │
│   ├─ Spring/Spring Boot application?
│   │   └─ → JUnit 5 + Spring Test + Mockito (seamless Spring integration)
│   │
│   ├─ Android application?
│   │   └─ → JUnit 5 + Mockito + Espresso (standard Android stack)
│   │
│   ├─ Legacy project using JUnit 4?
│   │   └─ → Keep JUnit 4 OR migrate to JUnit 5 (vintage engine allows coexistence)
│   │
│   └─ Need BDD-style testing?
│       └─ → Cucumber + JUnit 5 (Gherkin syntax for behavior specs)
│
├─ Ruby?
│   │
│   ├─ Rails application?
│   │   └─ → RSpec (dominant in Rails ecosystem, excellent Rails integration)
│   │
│   ├─ Non-Rails Ruby project?
│   │   │
│   │   ├─ Want BDD-style, readable tests?
│   │   │   └─ → RSpec (expressive DSL, rich matchers)
│   │   │
│   │   └─ Prefer simpler, standard library approach?
│   │       └─ → Minitest (ships with Ruby, faster, less DSL)
│   │
│   └─ Legacy project with existing tests?
│       │
│       ├─ Using RSpec?
│       │   └─ → Keep RSpec (mature, well-supported)
│       │
│       └─ Using Minitest?
│           └─ → Keep Minitest (migration to RSpec rarely justified)
│
├─ C#/.NET?
│   │
│   ├─ Modern .NET (Core/5+)?
│   │   └─ → xUnit.net + Moq (modern, best practices baked in)
│   │
│   ├─ Enterprise .NET Framework project?
│   │   └─ → NUnit + Moq (mature, excellent Visual Studio integration)
│   │
│   └─ Legacy project using MSTest?
│       └─ → Keep MSTest OR migrate to xUnit for better features
│
└─ Go?
    │
    ├─ Standard library testing sufficient?
    │   └─ → Go's testing package (built-in, idiomatic, fast)
    │
    ├─ Need assertions and better output?
    │   └─ → Testify (assertions, mocks, suites - most popular)
    │
    └─ Need BDD-style testing?
        └─ → Ginkgo + Gomega (BDD framework + matcher library)
```

---

## Framework Comparison Table

| Framework | Language | Setup Complexity | Speed | Ecosystem | Built-in Mocking | Snapshot Testing | Parallel Execution | Learning Curve | npm/PyPI Downloads (2025) |
|-----------|----------|------------------|-------|-----------|------------------|------------------|-------------------|----------------|---------------------------|
| **Jest** | JS/TS | Zero-config | Fast | Excellent | Yes (jest.fn, jest.mock) | Yes | Yes (default) | Low | 54M/week |
| **Vitest** | JS/TS | Minimal (Vite projects) | Extremely Fast | Growing | Yes (compatible with Jest) | Yes | Yes | Low (if know Jest) | 8M/week |
| **Mocha** | JS/TS | Manual (need Chai+Sinon) | Fast | Mature | No (use Sinon) | No | Yes (with mocha-parallel-tests) | Medium | 7.4M/week |
| **Pytest** | Python | Minimal | Fast | Excellent | Via plugin (pytest-mock) | No (use pytest-snapshot) | Yes (pytest-xdist) | Low | 87.7M downloads |
| **JUnit 5** | Java | Minimal (Maven/Gradle) | Fast | Excellent | Via Mockito | No | Yes | Medium | De facto standard |
| **RSpec** | Ruby | Minimal (Gemfile) | Medium | Excellent | Yes (rspec-mocks) | No | Yes (parallel_tests gem) | Medium | Very popular in Rails |

---

## Code Examples: Same Test in Different Frameworks

Let's write the same user service test across different frameworks to see the differences:

### Test Scenario: User Service

We'll test a `UserService` that:
1. Fetches a user from a repository
2. Returns the user if found
3. Throws an error if not found

---

### Jest (JavaScript/TypeScript)

```typescript
// userService.test.ts
import { UserService } from './userService';
import { UserRepository } from './userRepository';

// Mock the repository module
jest.mock('./userRepository');

describe('UserService', () => {
  let userService: UserService;
  let mockRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    // Clear mocks between tests
    jest.clearAllMocks();

    // Create mocked repository instance
    mockRepository = new UserRepository() as jest.Mocked<UserRepository>;
    userService = new UserService(mockRepository);
  });

  describe('getUser', () => {
    it('returns user when found in repository', async () => {
      // Arrange
      const mockUser = { id: 1, name: 'John Doe', email: 'john@example.com' };
      mockRepository.findById.mockResolvedValue(mockUser);

      // Act
      const result = await userService.getUser(1);

      // Assert
      expect(result).toEqual(mockUser);
      expect(mockRepository.findById).toHaveBeenCalledWith(1);
      expect(mockRepository.findById).toHaveBeenCalledTimes(1);
    });

    it('throws error when user not found', async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(userService.getUser(999))
        .rejects
        .toThrow('User not found');
    });
  });
});
```

**Characteristics:**
- Zero-config, built-in mocking
- Clear assertion methods (toEqual, toHaveBeenCalledWith)
- Great async support with async/await

---

### Vitest (JavaScript/TypeScript)

```typescript
// userService.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserService } from './userService';
import { UserRepository } from './userRepository';

// Mock the repository module
vi.mock('./userRepository');

describe('UserService', () => {
  let userService: UserService;
  let mockRepository: vi.Mocked<UserRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepository = new UserRepository() as vi.Mocked<UserRepository>;
    userService = new UserService(mockRepository);
  });

  describe('getUser', () => {
    it('returns user when found in repository', async () => {
      // Arrange
      const mockUser = { id: 1, name: 'John Doe', email: 'john@example.com' };
      mockRepository.findById.mockResolvedValue(mockUser);

      // Act
      const result = await userService.getUser(1);

      // Assert
      expect(result).toEqual(mockUser);
      expect(mockRepository.findById).toHaveBeenCalledWith(1);
      expect(mockRepository.findById).toHaveBeenCalledTimes(1);
    });

    it('throws error when user not found', async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(userService.getUser(999))
        .rejects
        .toThrow('User not found');
    });
  });
});
```

**Characteristics:**
- Nearly identical to Jest (compatible API)
- Explicit imports from 'vitest' (no globals)
- Extremely fast with Vite/ESM projects

---

### Mocha + Chai + Sinon (JavaScript/Node.js)

```javascript
// userService.test.js
const { expect } = require('chai');
const sinon = require('sinon');
const { UserService } = require('./userService');
const { UserRepository } = require('./userRepository');

describe('UserService', () => {
  let userService;
  let sandbox;
  let mockRepository;

  beforeEach(() => {
    // Create sandbox for clean stub management
    sandbox = sinon.createSandbox();

    // Create stub repository
    mockRepository = {
      findById: sandbox.stub()
    };

    userService = new UserService(mockRepository);
  });

  afterEach(() => {
    // Restore all stubs
    sandbox.restore();
  });

  describe('getUser', () => {
    it('returns user when found in repository', async () => {
      // Arrange
      const mockUser = { id: 1, name: 'John Doe', email: 'john@example.com' };
      mockRepository.findById.resolves(mockUser);

      // Act
      const result = await userService.getUser(1);

      // Assert
      expect(result).to.deep.equal(mockUser);
      expect(mockRepository.findById).to.have.been.calledOnceWith(1);
    });

    it('throws error when user not found', async () => {
      // Arrange
      mockRepository.findById.resolves(null);

      // Act & Assert
      try {
        await userService.getUser(999);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.equal('User not found');
      }
    });
  });
});
```

**Characteristics:**
- More manual setup (need Chai and Sinon)
- Different assertion style (expect().to.equal)
- Sandbox pattern for mock management

---

### Pytest (Python)

```python
# test_user_service.py
import pytest
from unittest.mock import Mock
from user_service import UserService
from user_repository import UserRepository
from models import User

@pytest.fixture
def mock_repository():
    """Fixture providing mocked UserRepository"""
    return Mock(spec=UserRepository)

@pytest.fixture
def user_service(mock_repository):
    """Fixture providing UserService with mocked dependencies"""
    return UserService(repository=mock_repository)

class TestUserService:
    """Test suite for UserService"""

    def test_get_user_returns_user_when_found(self, user_service, mock_repository):
        # Arrange
        expected_user = User(id=1, name="John Doe", email="john@example.com")
        mock_repository.find_by_id.return_value = expected_user

        # Act
        result = user_service.get_user(1)

        # Assert
        assert result == expected_user
        mock_repository.find_by_id.assert_called_once_with(1)

    def test_get_user_raises_error_when_not_found(self, user_service, mock_repository):
        # Arrange
        mock_repository.find_by_id.return_value = None

        # Act & Assert
        with pytest.raises(UserNotFoundError, match="User not found"):
            user_service.get_user(999)
```

**Characteristics:**
- Fixture-based setup
- Native Python `assert` statement
- Clean, minimal syntax

---

### JUnit 5 + Mockito (Java)

```java
// UserServiceTest.java
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("User Service Tests")
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private UserService userService;

    @Nested
    @DisplayName("getUser method")
    class GetUser {

        @Test
        @DisplayName("should return user when found in repository")
        void shouldReturnUserWhenFound() {
            // Arrange
            User mockUser = new User(1L, "John Doe", "john@example.com");
            when(userRepository.findById(1L)).thenReturn(Optional.of(mockUser));

            // Act
            User result = userService.getUser(1L);

            // Assert
            assertAll("user retrieval",
                () -> assertNotNull(result),
                () -> assertEquals("John Doe", result.getName()),
                () -> assertEquals("john@example.com", result.getEmail())
            );
            verify(userRepository).findById(1L);
        }

        @Test
        @DisplayName("should throw exception when user not found")
        void shouldThrowExceptionWhenNotFound() {
            // Arrange
            when(userRepository.findById(999L)).thenReturn(Optional.empty());

            // Act & Assert
            UserNotFoundException exception = assertThrows(
                UserNotFoundException.class,
                () -> userService.getUser(999L)
            );
            assertEquals("User not found", exception.getMessage());
        }
    }
}
```

**Characteristics:**
- Annotation-based mocking (@Mock, @InjectMocks)
- Nested test classes for organization
- assertAll for grouped assertions

---

### RSpec (Ruby)

```ruby
# spec/services/user_service_spec.rb
require 'rails_helper'

RSpec.describe UserService do
  subject(:service) { described_class.new(repository: repository) }

  let(:repository) { instance_double(UserRepository) }

  describe '#get_user' do
    context 'when user is found in repository' do
      let(:user) { User.new(id: 1, name: 'John Doe', email: 'john@example.com') }

      before do
        allow(repository).to receive(:find_by_id).with(1).and_return(user)
      end

      it 'returns the user' do
        result = service.get_user(1)
        expect(result).to eq(user)
      end

      it 'calls repository with correct id' do
        service.get_user(1)
        expect(repository).to have_received(:find_by_id).with(1)
      end
    end

    context 'when user is not found' do
      before do
        allow(repository).to receive(:find_by_id).with(999).and_return(nil)
      end

      it 'raises UserNotFoundError' do
        expect { service.get_user(999) }
          .to raise_error(UserNotFoundError, /User not found/)
      end
    end
  end
end
```

**Characteristics:**
- BDD-style with describe/context/it
- let blocks for lazy-loaded test data
- Natural language assertions (to eq, to raise_error)

---

## Migration Considerations

### When to Switch Frameworks

**Consider switching if:**
- Current framework lacks critical features you need
- Framework is deprecated or unmaintained
- Team productivity significantly hindered by framework limitations
- Framework doesn't support new language features or tooling

**DON'T switch if:**
- "Just trying something new" (migration cost is high)
- Minor inconveniences that can be worked around
- Following hype without clear benefits
- Team unfamiliar with new framework

---

### Migration Strategies

#### Strategy 1: Gradual Migration (Recommended)

**For:** Jest ↔ Mocha, Pytest ↔ unittest, JUnit 4 → JUnit 5

```javascript
// Step 1: Start with new tests in new framework
// Keep existing tests in old framework

// Step 2: Migrate tests file-by-file during feature work
// When touching a test file, convert it

// Step 3: Set deadline for complete migration
// Dedicate sprint to finish remaining tests
```

**Benefits:**
- Lower risk (both frameworks coexist)
- Spread work over time
- Team learns gradually

---

#### Strategy 2: Test Suite Coexistence

**For:** JUnit 4 → JUnit 5 (vintage engine), Mocha + Jest

```java
// JUnit 5 supports JUnit 4 tests via vintage engine
// Add both dependencies to pom.xml/build.gradle

<dependency>
    <groupId>org.junit.jupiter</groupId>
    <artifactId>junit-jupiter</artifactId>
    <version>5.10.1</version>
</dependency>
<dependency>
    <groupId>org.junit.vintage</groupId>
    <artifactId>junit-vintage-engine</artifactId>
    <version>5.10.1</version>
</dependency>

// Write new tests with JUnit 5
// Old JUnit 4 tests continue working
```

**Benefits:**
- Zero downtime
- Migrate at your own pace
- No breaking changes

---

#### Strategy 3: Big Bang Migration (High Risk)

**For:** Small codebases only (<100 tests)

```bash
# Step 1: Create migration branch
git checkout -b migrate-to-jest

# Step 2: Convert all tests in one go
# Use codemods if available (e.g., jest-codemods for Mocha→Jest)

# Step 3: Fix all issues, ensure CI passes
# Step 4: Merge when complete
```

**Benefits:**
- Clean break, no mixed state
- Works for small projects

**Risks:**
- All tests broken during migration
- High risk of bugs
- Team productivity halted

---

## Antipatterns: Common Wrong Choices

### Antipattern 1: Choosing Framework Based on Hype

❌ **Wrong Decision Process:**
```
"I heard Vitest is the hot new thing, let's use it!"
*Ignores that project uses Webpack, not Vite*
*Team has 2 years of Jest experience*
```

✅ **Right Decision Process:**
```
"Our React project uses Create React App (Webpack-based).
Jest is already configured and team knows it well.
Vitest's main benefit is Vite integration, which we don't have.
Decision: Keep Jest."
```

**Why it's wrong:** New ≠ better for your context. Evaluate frameworks based on your needs, not popularity.

---

### Antipattern 2: Not Considering Team Expertise

❌ **Wrong:**
```
Team: "We've used Mocha for 3 years and are productive."
Tech lead: "Let's switch to Jest because it's more popular."
*Months of reduced productivity during learning curve*
```

✅ **Right:**
```
Team: "We've used Mocha for 3 years."
Tech lead: "Any pain points with Mocha?"
Team: "Not really, we're happy with it."
Decision: Keep Mocha. No change needed.
```

**Why it's wrong:** Retraining costs are real. Only migrate when benefits clearly outweigh costs.

---

### Antipattern 3: Framework Lock-in (Over-using Framework-Specific Features)

❌ **Wrong:**
```javascript
// Tightly coupled to Jest-specific features
test.each([
  [1, 2, 3],
  [2, 3, 5],
])('adds %i + %i to equal %i', (a, b, expected) => {
  expect(add(a, b)).toBe(expected);
});

// Using Jest snapshots everywhere
expect(component).toMatchSnapshot();
expect(apiResponse).toMatchSnapshot();
expect(errorMessage).toMatchSnapshot();
```

✅ **Right:**
```javascript
// Write tests that could work in multiple frameworks
describe('add function', () => {
  it('adds 1 + 2 to equal 3', () => {
    expect(add(1, 2)).toBe(3);
  });

  it('adds 2 + 3 to equal 5', () => {
    expect(add(2, 3)).toBe(5);
  });
});

// Use snapshots sparingly, prefer explicit assertions
expect(component.props.title).toBe('Hello World');
expect(apiResponse.status).toBe(200);
expect(errorMessage).toContain('not found');
```

**Why it's wrong:** Over-reliance on framework-specific features makes migration harder. Write portable tests when possible.

---

### Antipattern 4: Using Wrong Framework for Platform

❌ **Wrong:**
```
Python project → Using nose (deprecated since 2015)
Modern React app → Using Jasmine (outdated for React)
Java 17+ project → Using JUnit 4 (missing modern features)
```

✅ **Right:**
```
Python project → Pytest (current standard)
Modern React app → Jest or Vitest (built for modern JS)
Java 17+ project → JUnit 5 (modern, maintained)
```

**Why it's wrong:** Deprecated or outdated frameworks lack features, updates, and community support.

---

### Antipattern 5: Analysis Paralysis

❌ **Wrong:**
```
Developer: "Should we use Jest or Vitest? Let me research for 2 weeks..."
*Spends month evaluating every framework*
*Creates 50-page comparison document*
*Still hasn't written a single test*
```

✅ **Right:**
```
Developer: "We have a React + Webpack project. Jest is standard for this."
*Starts writing tests immediately*
*Can always refactor later if needed*
```

**Why it's wrong:** Perfect is the enemy of good. Choose a reasonable framework and start testing. You can always migrate later if truly needed.

---

## Decision Criteria Quick Reference

### Choose Jest When:

- ✅ React/Vue/Angular application (non-Vite)
- ✅ Want zero-config, batteries-included experience
- ✅ Need built-in snapshot testing
- ✅ Team is new to testing (low learning curve)
- ✅ Want parallel execution by default

### Choose Vitest When:

- ✅ Using Vite as build tool
- ✅ Need extremely fast test execution
- ✅ Want Jest-compatible API with better performance
- ✅ ESM-first project
- ✅ Team already knows Jest (easy migration)

### Choose Mocha When:

- ✅ Node.js backend/API
- ✅ Need maximum flexibility (choose your own assertions/mocks)
- ✅ Existing Mocha codebase
- ✅ Library development (minimal assumptions)
- ✅ Team comfortable with manual configuration

### Choose Pytest When:

- ✅ Any Python project (de facto standard)
- ✅ Want minimal boilerplate
- ✅ Need powerful fixture system
- ✅ Prefer native Python assert statement
- ✅ Want extensive plugin ecosystem

### Choose JUnit 5 When:

- ✅ Java project (Java 17+)
- ✅ Spring/Spring Boot application
- ✅ Need modern Java testing features
- ✅ Want parameterized tests out of the box
- ✅ Excellent IDE integration required

### Choose RSpec When:

- ✅ Rails application
- ✅ Ruby project where BDD approach fits
- ✅ Want expressive, readable test syntax
- ✅ Team values specification-style tests
- ✅ Need excellent Rails integration

---

## Framework Popularity & Ecosystem Health (2025)

### JavaScript/TypeScript

| Framework | Weekly Downloads | GitHub Stars | Maintenance | Community |
|-----------|------------------|--------------|-------------|-----------|
| Jest | 54M/week | 44k+ | Active | Excellent |
| Vitest | 8M/week | 11k+ | Very Active | Growing |
| Mocha | 7.4M/week | 22k+ | Maintenance Mode | Mature |

**Trend:** Jest remains dominant. Vitest rapidly growing in Vite ecosystem.

---

### Python

| Framework | Monthly Downloads | PyPI Rank | Maintenance | Community |
|-----------|-------------------|-----------|-------------|-----------|
| Pytest | 87.7M/month | Top 10 package | Very Active | Excellent |
| unittest | Built-in | N/A (stdlib) | Active | Good |

**Trend:** Pytest is overwhelming standard (90%+ of new projects).

---

### Java

| Framework | Usage | Maven Central | Maintenance | Community |
|-----------|-------|---------------|-------------|-----------|
| JUnit 5 | 80%+ of new projects | 10M+ downloads/month | Very Active | Excellent |
| JUnit 4 | Legacy projects | Still used | Maintenance | Declining |

**Trend:** JUnit 5 is standard for new projects. JUnit 4 legacy only.

---

### Ruby

| Framework | Usage in Rails | Gem Downloads | Maintenance | Community |
|-----------|----------------|---------------|-------------|-----------|
| RSpec | 70%+ of Rails apps | 300M+ total | Active | Excellent |
| Minitest | 30% of Rails apps | Built-in | Active | Good |

**Trend:** RSpec dominant in Rails. Minitest for simplicity advocates.

---

## Framework-Specific Resources

### Jest
- Official Docs: https://jestjs.io/
- Migration from Mocha: `jest-codemods` package
- React Testing Library: https://testing-library.com/react

### Vitest
- Official Docs: https://vitest.dev/
- Migration from Jest: 99% compatible, minimal changes
- Vite Integration: Built-in

### Mocha
- Official Docs: https://mochajs.org/
- Chai Assertions: https://www.chaijs.com/
- Sinon Mocks: https://sinonjs.org/

### Pytest
- Official Docs: https://docs.pytest.org/
- Plugin List: https://docs.pytest.org/en/latest/reference/plugin_list.html
- pytest-mock: Simpler mocking with pytest

### JUnit 5
- Official User Guide: https://junit.org/junit5/docs/current/user-guide/
- Migration from JUnit 4: https://junit.org/junit5/docs/current/user-guide/#migrating-from-junit4
- Mockito: https://site.mockito.org/

### RSpec
- Official Docs: https://rspec.info/
- Better Specs: https://www.betterspecs.org/
- RSpec Rails: https://github.com/rspec/rspec-rails

---

## See Also

- `@guides/testing-best-practices.md` - Universal testing principles
- `@examples/jest-setup.md` - Jest configuration examples
- `@examples/pytest-setup.md` - Pytest configuration examples
- `@decision-trees/mocking-strategies.md` - How to mock dependencies
