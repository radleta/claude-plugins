---
summary: Protocol for discovering project testing conventions, naming patterns, and assertion styles from existing tests — ensures new tests match established patterns.
tags: [qa-expert/investigation]
---

# Existing Test Patterns Investigation

## Purpose

Discover the project's testing conventions, patterns, and style by examining existing test files. This ensures new tests match established patterns rather than imposing external conventions.

## Why This Matters

**Teams have strong testing preferences**:
- Test file organization → Affects test discoverability and maintenance
- Naming conventions → Impacts readability and test reports
- Assertion styles → Determines test clarity and failure messages
- Mock patterns → Influences test isolation and reliability

**Mismatched test patterns cause friction**:
- New tests look inconsistent
- Code reviews focus on style instead of test quality
- Developers must manually fix test formatting
- Test runners may fail to discover tests

**Evidence-based decisions**:
- Don't assume "testing best practices"
- Discover what THIS project actually does
- Follow majority patterns in existing tests
- Maintain team's testing culture

## Investigation Protocols

---

### Protocol 1: Test File Organization Detection

**Objective**: Understand how test files are organized and named in the project

**Tool**: Glob → Search for test file patterns across common locations

**Search Patterns**:
Test file naming conventions:
1. `**/*.test.js` / `**/*.test.ts` / `**/*.test.jsx` / `**/*.test.tsx` - Jest/Vitest style
2. `**/*.spec.js` / `**/*.spec.ts` / `**/*.spec.jsx` / `**/*.spec.tsx` - Jasmine/Mocha style
3. `**/test_*.py` - Python unittest style
4. `**/*Test.java` / `**/*Tests.java` - Java JUnit style
5. `**/*_spec.rb` - Ruby RSpec style
6. `**/*_test.go` - Go testing style

**Extract**:
- Dominant file naming pattern (`.test.` vs `.spec.` vs `_test` suffix)
- Test file locations (co-located vs separate test directory)
- Directory structure (mirrors source vs flat)
- Special test directories (`__tests__/`, `test/`, `tests/`, `spec/`)

**Error Handling**:
- If Glob finds 0 test files for all patterns → Report to user: "No test files found. Is this directory correct? Has testing been set up?"
- If only 1-2 test files found → Report: "Too few test files to establish pattern. Using project's testing framework defaults."
- If multiple naming patterns found (mixed .test and .spec) → Report findings and recommend standardizing

**Decision Tree**:
```
Test file naming?
├─ .test.* pattern (Jest/Vitest standard)
│   ├─ Examples: Button.test.tsx, utils.test.ts, api.test.js
│   ├─ Common in: Jest, Vitest, modern JavaScript/TypeScript
│   ├─ Benefits:
│   │   ├─ Clear, descriptive
│   │   ├─ Groups with .test extension in file explorers
│   │   └─ Standard in React and Node ecosystems
│   │
│   └─ Generate:
│       ComponentName.test.tsx
│       functionName.test.ts

├─ .spec.* pattern (Jasmine/Karma standard)
│   ├─ Examples: button.spec.ts, utils.spec.js, api.spec.ts
│   ├─ Common in: Angular, Jasmine, Karma, Mocha
│   ├─ Benefits:
│   │   ├─ Traditional "specification" naming
│   │   ├─ BDD-oriented projects
│   │   └─ Clear separation from implementation
│   │
│   └─ Generate:
│       component-name.spec.ts
│       function-name.spec.js

├─ test_* prefix (Python unittest)
│   ├─ Examples: test_user.py, test_api.py, test_utils.py
│   ├─ Common in: Python unittest, pytest
│   ├─ Benefits:
│   │   ├─ Python convention (PEP 8)
│   │   ├─ Auto-discovery by test runners
│   │   └─ Clear test identification
│   │
│   └─ Generate:
│       test_module_name.py

├─ *Test.java suffix (Java JUnit)
│   ├─ Examples: UserTest.java, ApiTest.java, UtilsTest.java
│   ├─ Common in: Java JUnit, TestNG
│   ├─ Benefits:
│   │   ├─ Java naming convention
│   │   ├─ Maven/Gradle test discovery
│   │   └─ Standard in Java ecosystem
│   │
│   └─ Generate:
│       ClassNameTest.java

└─ _test.go suffix (Go testing)
    ├─ Examples: user_test.go, api_test.go, utils_test.go
    ├─ Common in: Go standard testing
    ├─ Benefits:
    │   ├─ Go convention
    │   ├─ Must be in same package
    │   └─ go test auto-discovery
    │
    └─ Generate:
        package_name_test.go

Test file location?
├─ Co-located (next to source files)
│   ├─ Pattern: src/components/Button.tsx + Button.test.tsx
│   ├─ Benefits:
│   │   ├─ Easy to find related tests
│   │   ├─ Import paths are simple
│   │   └─ Clear 1:1 relationship
│   │
│   └─ Structure:
│       src/
│         components/
│           Button.tsx
│           Button.test.tsx

├─ Separate test directory (mirrors source)
│   ├─ Pattern: src/components/Button.tsx → test/components/Button.test.tsx
│   ├─ Benefits:
│   │   ├─ Clean separation of concerns
│   │   ├─ Source directory stays focused
│   │   └─ Traditional approach
│   │
│   └─ Structure:
│       src/
│         components/
│           Button.tsx
│       test/
│         components/
│           Button.test.tsx

├─ __tests__ directory (Jest convention)
│   ├─ Pattern: src/components/__tests__/Button.test.tsx
│   ├─ Benefits:
│   │   ├─ Jest auto-discovery
│   │   ├─ Co-located but separate
│   │   └─ Common in React projects
│   │
│   └─ Structure:
│       src/
│         components/
│           __tests__/
│             Button.test.tsx
│           Button.tsx

└─ Flat test directory
    ├─ Pattern: All tests in single test/ directory
    ├─ Benefits:
    │   ├─ Simple structure
    │   ├─ All tests in one place
    │   └─ Good for small projects
    │
    └─ Structure:
        src/
          components/
            Button.tsx
        test/
          Button.test.tsx
          utils.test.ts
```

**Verification**:
```bash
# Find all test files with .test.* pattern
find . -name "*.test.js" -o -name "*.test.ts" -o -name "*.test.jsx" -o -name "*.test.tsx" | head -20

# Find all test files with .spec.* pattern
find . -name "*.spec.js" -o -name "*.spec.ts" -o -name "*.spec.jsx" -o -name "*.spec.tsx" | head -20

# Count test files by pattern
echo "Test files (.test): $(find . -name "*.test.*" | wc -l)"
echo "Spec files (.spec): $(find . -name "*.spec.*" | wc -l)"

# Check for __tests__ directories
find . -type d -name "__tests__" | head -10

# Check for separate test directory
ls -d test/ tests/ spec/ 2>/dev/null
```

**Example Output**:
```
Test file patterns found:
  .test.* files: 47 matches
  .spec.* files: 2 matches

Naming pattern: .test.* (96% of test files)
Decision: Use .test.* suffix

Test locations:
  Co-located: 38 files (81%)
  __tests__ directory: 9 files (19%)

Organization: Mixed (mostly co-located, some use __tests__)
Recommendation: Co-locate new tests with source files
Pattern: ComponentName.test.tsx next to ComponentName.tsx
```

---

### Protocol 2: Test Naming Conventions Detection

**Objective**: Understand how tests are named and structured (describe blocks, test names)

**Tool**: Grep → Search for test structure patterns

**Search Patterns**:
1. `describe(` - BDD-style test suites (Jest, Mocha, Jasmine)
2. `it(` - BDD-style individual tests
3. `test(` - Jest/Vitest simple test function
4. `def test_` - Python unittest/pytest test functions
5. `@Test` - Java JUnit test annotation
6. `func Test` - Go test functions

**Extract**:
- Test suite naming (describe vs context)
- Individual test naming (it vs test)
- Naming style (descriptive sentences vs simple names)
- Nesting patterns (nested describe blocks)

**Error Handling**:
- If Grep finds 0 test patterns → Report to user: "No test functions found. Are tests written yet?"
- If too few examples (<5) → Fallback: Use testing framework's recommended style
- If multiple patterns equally common → Report findings and ask user preference

**Decision Tree**:
```
Test structure style?
├─ BDD Style (describe + it)
│   ├─ Pattern: describe('ComponentName', () => { it('should...', () => {}) })
│   ├─ Common in: Jest, Mocha, Jasmine, RSpec
│   ├─ Benefits:
│   │   ├─ Hierarchical organization
│   │   ├─ Natural language descriptions
│   │   ├─ Grouped related tests
│   │   └─ Better test reports
│   │
│   ├─ Naming conventions:
│   │   ├─ describe: Component/function name or "Feature description"
│   │   ├─ it: "should do something" or "does something"
│   │   └─ Nested describe for sub-features
│   │
│   └─ Generate:
│       describe('UserProfile', () => {
│         it('should render user name', () => {
│           // test code
│         })
│
│         it('should handle missing data', () => {
│           // test code
│         })
│       })

├─ Simple test() Functions (Jest/Vitest)
│   ├─ Pattern: test('description of behavior', () => {})
│   ├─ Common in: Jest, Vitest (flat structure)
│   ├─ Benefits:
│   │   ├─ Simpler, less nesting
│   │   ├─ Flat test organization
│   │   └─ Quick to write
│   │
│   ├─ Naming conventions:
│   │   ├─ Full description in test name
│   │   └─ "ComponentName: should do something" pattern
│   │
│   └─ Generate:
│       test('UserProfile renders user name', () => {
│         // test code
│       })
│
│       test('UserProfile handles missing data', () => {
│         // test code
│       })

├─ Python unittest Style
│   ├─ Pattern: class TestClassName(unittest.TestCase): def test_behavior(self):
│   ├─ Common in: Python unittest
│   ├─ Benefits:
│   │   ├─ Class-based organization
│   │   ├─ setUp and tearDown methods
│   │   └─ Standard Python testing
│   │
│   ├─ Naming conventions:
│   │   ├─ Class: TestClassName
│   │   ├─ Methods: test_specific_behavior
│   │   └─ Snake_case naming
│   │
│   └─ Generate:
│       class TestUserProfile(unittest.TestCase):
│           def test_renders_user_name(self):
│               # test code
│
│           def test_handles_missing_data(self):
│               # test code

├─ Python pytest Style
│   ├─ Pattern: def test_feature_behavior():
│   ├─ Common in: pytest
│   ├─ Benefits:
│   │   ├─ Simple function-based tests
│   │   ├─ No class boilerplate
│   │   └─ Fixtures for setup
│   │
│   ├─ Naming conventions:
│   │   ├─ test_ prefix required
│   │   └─ Descriptive snake_case names
│   │
│   └─ Generate:
│       def test_user_profile_renders_name():
│           # test code
│
│       def test_user_profile_handles_missing_data():
│           # test code

└─ Java JUnit Style
    ├─ Pattern: @Test public void testBehavior() {} or @Test void shouldBehavior() {}
    ├─ Common in: JUnit 4, JUnit 5
    ├─ Benefits:
    │   ├─ Annotation-based
    │   ├─ Clear test identification
    │   └─ Flexible naming
    │
    ├─ Naming conventions:
    │   ├─ JUnit 4: testMethodName or testMethodName_condition
    │   ├─ JUnit 5: shouldBehavior or camelCaseDescription
    │   └─ CamelCase naming
    │
    └─ Generate:
        @Test
        void shouldRenderUserName() {
            // test code
        }

        @Test
        void shouldHandleMissingData() {
            // test code
        }

Test naming style?
├─ "should" prefix (BDD style)
│   ├─ Example: it('should render correctly')
│   ├─ Benefits: Natural language, behavior-focused
│   └─ Common in BDD frameworks

├─ Behavior description (no "should")
│   ├─ Example: it('renders correctly')
│   ├─ Benefits: Concise, implied "it"
│   └─ Modern BDD style

└─ Full sentence in test()
    ├─ Example: test('UserProfile renders correctly')
    ├─ Benefits: Self-contained, no context needed
    └─ Common in flat test structures
```

**Verification**:
```bash
# Count describe blocks
grep -r "describe(" --include="*.test.js" --include="*.test.ts" --include="*.spec.js" --include="*.spec.ts" | wc -l

# Count it() test functions
grep -r "it(" --include="*.test.js" --include="*.test.ts" --include="*.spec.js" --include="*.spec.ts" | wc -l

# Count test() functions
grep -r "^[[:space:]]*test(" --include="*.test.js" --include="*.test.ts" | wc -l

# Sample test names to identify pattern
grep -r "it('should" --include="*.test.js" --include="*.test.ts" | head -5
grep -r "it('" --include="*.test.js" --include="*.test.ts" | head -10

# Check for nested describes
grep -r "describe.*describe" --include="*.test.ts" --include="*.test.js" -A 10 | head -20
```

**Example Output**:
```
Test structure patterns:
  describe() blocks: 42 matches
  it() functions: 156 matches
  test() functions: 8 matches

Structure: BDD style with describe + it (95% of tests)
Decision: Use describe + it pattern

Test naming patterns:
  "should" prefix: 89 matches (57%)
  No "should" prefix: 67 matches (43%)

Naming style: Mixed, slight preference for "should"
Recommendation: Use "should" prefix for consistency
Pattern: it('should render user name', () => {})

Nesting: 18 nested describe blocks found
Note: Project uses nested describes for sub-features
```

---

### Protocol 3: Assertion Style Detection

**Objective**: Determine which assertion library and style is used

**Tool**: Grep → Search for assertion patterns

**Search Patterns**:
1. `expect(` - Jest expect(), Chai expect(), Vitest expect()
2. `.toBe(` / `.toEqual(` - Jest/Vitest matchers
3. `assert.` - Node assert, Chai assert
4. `.should.` - Chai should style
5. `assertThat(` - Hamcrest/AssertJ style (Java)
6. `self.assertEqual(` - Python unittest
7. `assert ` - Python pytest / Go testing

**Extract**:
- Primary assertion library (Jest, Chai, unittest, etc.)
- Assertion style (expect vs assert vs should)
- Common matchers used
- Custom matcher definitions

**Error Handling**:
- If Grep finds 0 assertions → Report: "No assertions found. Are test files complete?"
- If multiple assertion styles found equally → Report findings and recommend standardizing on framework default
- If unknown assertion pattern → Ask user what testing framework is configured

**Decision Tree**:
```
Assertion library?
├─ Jest / Vitest expect()
│   ├─ Pattern: expect(value).toBe(expected)
│   ├─ Common matchers:
│   │   ├─ .toBe() - Strict equality (===)
│   │   ├─ .toEqual() - Deep equality
│   │   ├─ .toBeNull() / .toBeUndefined() / .toBeTruthy()
│   │   ├─ .toContain() - Array/string contains
│   │   ├─ .toHaveBeenCalled() - Mock assertions
│   │   ├─ .toThrow() - Exception testing
│   │   └─ .toMatchSnapshot() - Snapshot testing
│   │
│   ├─ React Testing Library specific:
│   │   ├─ expect(element).toBeInTheDocument()
│   │   ├─ expect(element).toHaveTextContent()
│   │   └─ expect(element).toHaveAttribute()
│   │
│   └─ Generate:
│       expect(result).toBe(5)
│       expect(user).toEqual({ name: 'John', age: 30 })
│       expect(mockFn).toHaveBeenCalledWith('arg')

├─ Chai expect()
│   ├─ Pattern: expect(value).to.equal(expected)
│   ├─ Common matchers:
│   │   ├─ .to.equal() - Deep equality
│   │   ├─ .to.be.null / .to.be.undefined
│   │   ├─ .to.include() - Contains
│   │   ├─ .to.throw() - Exception testing
│   │   └─ .to.have.property() - Object properties
│   │
│   ├─ Chainable language:
│   │   ├─ expect(x).to.be.a('string')
│   │   ├─ expect(arr).to.have.lengthOf(3)
│   │   └─ expect(obj).to.have.property('name').that.equals('John')
│   │
│   └─ Generate:
│       expect(result).to.equal(5)
│       expect(user).to.be.an('object')
│       expect(users).to.have.lengthOf(3)

├─ Chai should
│   ├─ Pattern: value.should.equal(expected)
│   ├─ Common matchers:
│   │   ├─ .should.equal()
│   │   ├─ .should.be.a()
│   │   ├─ .should.include()
│   │   └─ .should.have.property()
│   │
│   ├─ BDD-style assertions:
│   │   └─ Reads like natural language
│   │
│   └─ Generate:
│       result.should.equal(5)
│       user.should.be.an('object')
│       users.should.have.lengthOf(3)

├─ Node assert / Chai assert
│   ├─ Pattern: assert.equal(actual, expected)
│   ├─ Common functions:
│   │   ├─ assert.equal() / assert.strictEqual()
│   │   ├─ assert.deepEqual() / assert.deepStrictEqual()
│   │   ├─ assert.ok() - Truthy
│   │   ├─ assert.throws() - Exceptions
│   │   └─ assert.isNull() / assert.isDefined() (Chai)
│   │
│   └─ Generate:
│       assert.strictEqual(result, 5)
│       assert.deepEqual(user, { name: 'John' })
│       assert.ok(value)

├─ Python unittest assertions
│   ├─ Pattern: self.assertEqual(actual, expected)
│   ├─ Common methods:
│   │   ├─ self.assertEqual() - Equality
│   │   ├─ self.assertTrue() / self.assertFalse()
│   │   ├─ self.assertIsNone() / self.assertIsNotNone()
│   │   ├─ self.assertIn() - Contains
│   │   ├─ self.assertRaises() - Exceptions
│   │   └─ self.assertDictEqual() - Dict comparison
│   │
│   └─ Generate:
│       self.assertEqual(result, 5)
│       self.assertTrue(is_valid)
│       self.assertIn('item', items)

├─ Python pytest assertions
│   ├─ Pattern: assert value == expected
│   ├─ Features:
│   │   ├─ Plain Python assert statements
│   │   ├─ Introspection for detailed failure messages
│   │   ├─ pytest.raises() for exceptions
│   │   └─ pytest.approx() for floating point
│   │
│   └─ Generate:
│       assert result == 5
│       assert user['name'] == 'John'
│       with pytest.raises(ValueError):
│           function_that_raises()

└─ Java AssertJ / Hamcrest
    ├─ AssertJ pattern: assertThat(actual).isEqualTo(expected)
    ├─ Common matchers:
    │   ├─ .isEqualTo() / .isNotEqualTo()
    │   ├─ .isNull() / .isNotNull()
    │   ├─ .contains() / .containsExactly()
    │   ├─ .hasSize()
    │   └─ .isInstanceOf()
    │
    └─ Generate:
        assertThat(result).isEqualTo(5)
        assertThat(user.getName()).isEqualTo("John")
        assertThat(users).hasSize(3)
```

**Verification**:
```bash
# Count Jest/Vitest expect patterns
grep -r "expect(" --include="*.test.js" --include="*.test.ts" | wc -l
grep -r "\.toBe\|\.toEqual" --include="*.test.js" --include="*.test.ts" | wc -l

# Count Chai patterns
grep -r "\.to\.equal\|\.to\.be\." --include="*.test.js" --include="*.test.ts" | wc -l
grep -r "\.should\." --include="*.test.js" --include="*.test.ts" | wc -l

# Sample common matchers
grep -r "\.toBe\|\.toEqual\|\.toHaveBeenCalled" --include="*.test.ts" | head -10

# Check for React Testing Library matchers
grep -r "toBeInTheDocument\|toHaveTextContent" --include="*.test.tsx" | wc -l

# Python assertions
grep -r "self\.assert\|^[[:space:]]*assert " --include="test_*.py" | wc -l
```

**Example Output**:
```
Assertion patterns found:
  expect() calls: 312 matches
  .toBe() / .toEqual(): 156 matches
  .to.equal() (Chai): 0 matches
  .should. (Chai should): 0 matches

Assertion library: Jest expect()
Decision: Use Jest expect() matchers

Common matchers found:
  .toBe(): 89 times
  .toEqual(): 67 times
  .toHaveBeenCalled(): 45 times
  .toBeInTheDocument(): 34 times (React Testing Library)

Pattern: expect(value).toBe(expected) for primitives
        expect(object).toEqual(expected) for objects
        expect(mock).toHaveBeenCalledWith(args)
```

---

### Protocol 4: Mock/Stub Pattern Detection

**Objective**: Understand how the project uses mocks, stubs, and spies

**Tool**: Grep → Search for mocking patterns

**Search Patterns**:
1. `jest.mock(` - Jest module mocking
2. `jest.fn(` - Jest mock functions
3. `jest.spyOn(` - Jest spies
4. `vi.mock(` / `vi.fn(` - Vitest mocking
5. `sinon.stub(` / `sinon.spy(` - Sinon mocking
6. `unittest.mock` / `@patch` - Python unittest.mock
7. `@Mock` / `@Spy` - Mockito annotations (Java)
8. `allow(` / `.to receive(` - RSpec mocking

**Extract**:
- Mocking library used
- Mocking approach (heavy vs minimal)
- Module mocking patterns
- Manual mocks directory
- Mock data patterns

**Error Handling**:
- If Grep finds 0 mock patterns → Report: "No mocking found. Project may use real implementations or minimal mocking."
- If multiple mocking libraries found → Report findings and ask which is primary
- If manual mocks exist but auto-mocking not found → Note manual mock preference

**Decision Tree**:
```
Mocking library?
├─ Jest mocking
│   ├─ Module mocking:
│   │   ├─ jest.mock('module-name') - Auto-mock entire module
│   │   ├─ jest.mock('module', () => ({ ... })) - Manual mock implementation
│   │   └─ __mocks__/ directory - Manual mock files
│   │
│   ├─ Function mocking:
│   │   ├─ jest.fn() - Create mock function
│   │   ├─ jest.fn(implementation) - Mock with implementation
│   │   └─ mockFn.mockReturnValue() / mockImplementation()
│   │
│   ├─ Spying:
│   │   ├─ jest.spyOn(object, 'method') - Spy on existing method
│   │   └─ Restore: mockFn.mockRestore()
│   │
│   └─ Generate:
│       // Module mock
│       jest.mock('@/api/users', () => ({
│         fetchUser: jest.fn()
│       }))
│
│       // Function mock
│       const mockCallback = jest.fn()
│       mockCallback.mockReturnValue(42)
│
│       // Spy
│       const spy = jest.spyOn(console, 'log')
│       expect(spy).toHaveBeenCalled()

├─ Vitest mocking
│   ├─ Module mocking:
│   │   ├─ vi.mock('module-name') - Auto-mock module
│   │   ├─ vi.mock('module', () => ({ ... })) - Manual implementation
│   │   └─ Similar to Jest but using vi namespace
│   │
│   ├─ Function mocking:
│   │   ├─ vi.fn() - Create mock function
│   │   └─ vi.fn(implementation)
│   │
│   ├─ Spying:
│   │   └─ vi.spyOn(object, 'method')
│   │
│   └─ Generate:
│       vi.mock('@/api/users', () => ({
│         fetchUser: vi.fn()
│       }))
│
│       const mockFn = vi.fn().mockReturnValue(42)

├─ Sinon (with Mocha/Chai)
│   ├─ Stubs:
│   │   ├─ sinon.stub() - Create standalone stub
│   │   ├─ sinon.stub(object, 'method') - Stub method
│   │   └─ stub.returns() / stub.resolves()
│   │
│   ├─ Spies:
│   │   ├─ sinon.spy() - Create spy
│   │   ├─ spy.calledWith()
│   │   └─ Tracks calls without replacing
│   │
│   ├─ Mocks:
│   │   ├─ sinon.mock(object) - Create mock with expectations
│   │   └─ mock.expects('method').returns()
│   │
│   └─ Generate:
│       const stub = sinon.stub(api, 'fetchUser')
│       stub.resolves({ name: 'John' })
│
│       const spy = sinon.spy(console, 'log')
│       expect(spy.calledOnce).to.be.true

├─ Python unittest.mock
│   ├─ Patching:
│   │   ├─ @patch('module.function') - Decorator
│   │   ├─ with patch('module.function') - Context manager
│   │   └─ Replaces during test execution
│   │
│   ├─ Mock objects:
│   │   ├─ Mock() / MagicMock() - Create mock
│   │   ├─ mock.return_value = value
│   │   └─ mock.assert_called_with()
│   │
│   └─ Generate:
│       from unittest.mock import patch, MagicMock
│
│       @patch('myapp.api.fetch_user')
│       def test_user(mock_fetch):
│           mock_fetch.return_value = {'name': 'John'}
│           # test code
│           mock_fetch.assert_called_once()

├─ Python pytest with monkeypatch
│   ├─ Monkeypatch fixture:
│   │   ├─ monkeypatch.setattr() - Replace attribute
│   │   ├─ Automatic cleanup
│   │   └─ Simpler than unittest.mock for simple cases
│   │
│   └─ Generate:
│       def test_user(monkeypatch):
│           def mock_fetch(user_id):
│               return {'name': 'John'}
│
│           monkeypatch.setattr('myapp.api.fetch_user', mock_fetch)

└─ Mockito (Java)
    ├─ Annotations:
    │   ├─ @Mock - Create mock
    │   ├─ @Spy - Partial mock
    │   └─ @InjectMocks - Inject mocks
    │
    ├─ Stubbing:
    │   ├─ when(mock.method()).thenReturn(value)
    │   └─ doReturn(value).when(mock).method()
    │
    └─ Generate:
        @Mock
        private UserService userService;

        when(userService.findById(1)).thenReturn(user)
        verify(userService).findById(1)

Mocking approach?
├─ Heavy mocking
│   ├─ Most dependencies mocked
│   ├─ Isolated unit tests
│   └─ Fast but less integration coverage

├─ Minimal mocking
│   ├─ Only external dependencies mocked
│   ├─ More integration-style tests
│   └─ Slower but more realistic

└─ Selective mocking
    ├─ Mock by test type (unit vs integration)
    ├─ Balance between isolation and realism
    └─ Common in well-tested projects
```

**Verification**:
```bash
# Count Jest mocking patterns
grep -r "jest\.mock\|jest\.fn\|jest\.spyOn" --include="*.test.js" --include="*.test.ts" | wc -l

# Count Vitest mocking patterns
grep -r "vi\.mock\|vi\.fn\|vi\.spyOn" --include="*.test.js" --include="*.test.ts" | wc -l

# Count Sinon patterns
grep -r "sinon\.stub\|sinon\.spy\|sinon\.mock" --include="*.test.js" --include="*.spec.js" | wc -l

# Check for manual mocks directory
find . -type d -name "__mocks__" | head -5
ls __mocks__/ 2>/dev/null

# Sample mocking patterns
grep -r "jest\.mock(" --include="*.test.ts" -A 3 | head -20

# Python mocking
grep -r "@patch\|unittest\.mock\|monkeypatch" --include="test_*.py" | wc -l
```

**Example Output**:
```
Mocking patterns found:
  jest.mock(): 23 modules mocked
  jest.fn(): 89 mock functions created
  jest.spyOn(): 12 spies created
  vi.mock/vi.fn: 0 (not using Vitest)

Mocking library: Jest
Decision: Use Jest mocking utilities

Manual mocks: __mocks__/ directory found
  - __mocks__/axios.ts
  - __mocks__/@api/client.ts

Mocking approach: Selective
  - API clients always mocked
  - Internal services sometimes mocked
  - Pure functions rarely mocked

Common patterns:
  - jest.mock() for external modules (axios, APIs)
  - jest.fn() for callbacks and handlers
  - jest.spyOn() for observing real implementations
```

---

### Protocol 5: Test Data Pattern Detection

**Objective**: Understand how the project manages test data (fixtures, factories, builders)

**Tool**: Grep → Search for test data patterns

**Search Patterns**:
1. `beforeEach(` / `beforeAll(` - Setup patterns (Jest/Mocha)
2. `@BeforeEach` / `@BeforeAll` - JUnit setup
3. `setUp(` / `setUpClass(` - Python unittest
4. `let(` / `let!(` - RSpec lazy evaluation
5. `fixtures/` - Fixture directory
6. `factory` / `Factory` - Factory pattern
7. `Builder` pattern - Test data builders
8. Inline test data in test files

**Extract**:
- Test data strategy (fixtures vs inline vs factories)
- Setup/teardown patterns
- Shared test data location
- Test data generation libraries

**Error Handling**:
- If Grep finds no setup patterns → Project likely uses inline test data
- If multiple patterns found → Identify primary pattern by frequency
- If fixture files exist but no loading code found → Ask user how fixtures are used

**Decision Tree**:
```
Test data strategy?
├─ Inline test data
│   ├─ Pattern: Data created directly in test
│   ├─ Benefits:
│   │   ├─ Clear and explicit
│   │   ├─ Easy to understand
│   │   └─ No hidden state
│   │
│   ├─ Drawbacks:
│   │   ├─ Repetitive
│   │   └─ Harder to maintain
│   │
│   └─ Generate:
│       test('renders user profile', () => {
│         const user = {
│           id: 1,
│           name: 'John Doe',
│           email: 'john@example.com'
│         }
│         // test using user
│       })

├─ beforeEach setup (Jest/Mocha)
│   ├─ Pattern: Shared setup in beforeEach/beforeAll
│   ├─ Benefits:
│   │   ├─ DRY (don't repeat yourself)
│   │   ├─ Consistent test data
│   │   └─ Centralized setup
│   │
│   ├─ Drawbacks:
│   │   ├─ Hidden setup (less explicit)
│   │   └─ Can create coupling between tests
│   │
│   └─ Generate:
│       describe('UserProfile', () => {
│         let user
│
│         beforeEach(() => {
│           user = {
│             id: 1,
│             name: 'John Doe',
│             email: 'john@example.com'
│           }
│         })
│
│         test('renders user name', () => {
│           // test using user
│         })
│       })

├─ Fixture files
│   ├─ Pattern: JSON/YAML files with test data
│   ├─ Location: fixtures/ or __fixtures__/ directory
│   ├─ Benefits:
│   │   ├─ Reusable across tests
│   │   ├─ Large/complex data separated
│   │   └─ Easy to update
│   │
│   ├─ Loading:
│   │   ├─ import fixture from './fixtures/user.json'
│   │   ├─ JSON.parse(fs.readFileSync())
│   │   └─ Framework-specific loaders
│   │
│   └─ Generate:
│       // fixtures/user.json
│       {
│         "id": 1,
│         "name": "John Doe",
│         "email": "john@example.com"
│       }
│
│       // test file
│       import userFixture from './fixtures/user.json'
│
│       test('renders user', () => {
│         // test using userFixture
│       })

├─ Factory pattern
│   ├─ Pattern: Functions that create test data
│   ├─ Libraries:
│   │   ├─ fishery (TypeScript)
│   │   ├─ factory-bot (JavaScript)
│   │   ├─ factory_boy (Python)
│   │   └─ FactoryBot (Ruby)
│   │
│   ├─ Benefits:
│   │   ├─ Flexible test data creation
│   │   ├─ Override specific fields
│   │   ├─ Generate sequences
│   │   └─ Create relationships
│   │
│   └─ Generate:
│       // factories/userFactory.ts
│       import { Factory } from 'fishery'
│
│       export const userFactory = Factory.define<User>(({ sequence }) => ({
│         id: sequence,
│         name: 'John Doe',
│         email: `user${sequence}@example.com`
│       }))
│
│       // test file
│       import { userFactory } from './factories/userFactory'
│
│       test('renders user', () => {
│         const user = userFactory.build()
│         const admin = userFactory.build({ role: 'admin' })
│       })

├─ Builder pattern
│   ├─ Pattern: Fluent API for building test objects
│   ├─ Benefits:
│   │   ├─ Explicit and readable
│   │   ├─ Type-safe construction
│   │   └─ Easy to customize
│   │
│   └─ Generate:
│       class UserBuilder {
│         private data: Partial<User> = {
│           id: 1,
│           name: 'John Doe'
│         }
│
│         withName(name: string) {
│           this.data.name = name
│           return this
│         }
│
│         build(): User {
│           return this.data as User
│         }
│       }
│
│       test('renders user', () => {
│         const user = new UserBuilder()
│           .withName('Jane Doe')
│           .build()
│       })

├─ Python pytest fixtures
│   ├─ Pattern: @pytest.fixture decorated functions
│   ├─ Benefits:
│   │   ├─ Dependency injection
│   │   ├─ Automatic cleanup
│   │   ├─ Composable fixtures
│   │   └─ Scope control
│   │
│   └─ Generate:
│       @pytest.fixture
│       def user():
│           return {
│               'id': 1,
│               'name': 'John Doe',
│               'email': 'john@example.com'
│           }
│
│       def test_user_profile(user):
│           # test using user fixture
│           assert user['name'] == 'John Doe'

└─ Mock Service Worker (MSW) for API mocking
    ├─ Pattern: Intercept network requests
    ├─ Benefits:
    │   ├─ Realistic API responses
    │   ├─ Works at network level
    │   └─ Reusable handlers
    │
    └─ Generate:
        import { rest } from 'msw'
        import { setupServer } from 'msw/node'

        const server = setupServer(
          rest.get('/api/user/:id', (req, res, ctx) => {
            return res(ctx.json({
              id: 1,
              name: 'John Doe'
            }))
          })
        )

        beforeAll(() => server.listen())
        afterAll(() => server.close())
```

**Verification**:
```bash
# Check for setup patterns
grep -r "beforeEach\|beforeAll" --include="*.test.js" --include="*.test.ts" | wc -l

# Find fixture directories
find . -type d -name "fixtures" -o -name "__fixtures__" | head -10
ls fixtures/ __fixtures__/ 2>/dev/null | head -10

# Check for factory libraries
grep -r "fishery\|factory-bot\|Factory\.define" --include="*.ts" --include="*.js" | wc -l
find . -name "*factory.ts" -o -name "*Factory.ts" | head -10

# Check for builder pattern
grep -r "class.*Builder" --include="*.test.ts" --include="*.ts" | wc -l

# Python fixtures
grep -r "@pytest\.fixture" --include="test_*.py" --include="conftest.py" | wc -l

# MSW setup
grep -r "msw\|setupServer" --include="*.test.ts" --include="setup*.ts" | wc -l
```

**Example Output**:
```
Test data patterns found:

Setup patterns:
  beforeEach: 34 occurrences
  beforeAll: 8 occurrences
  Pattern: Common for shared setup

Fixtures:
  fixtures/ directory: Not found
  __fixtures__/ directory: Not found

Factories:
  Factory files: 12 found (factories/*.ts)
  Library: fishery (TypeScript factory library)
  Factories: userFactory, productFactory, orderFactory, etc.

Builder pattern: 0 occurrences

Decision: Use factory pattern for test data
Location: factories/ directory
Pattern: Export factories from factories/index.ts

Example:
  import { userFactory } from '@/factories'
  const user = userFactory.build({ name: 'Custom Name' })

API mocking:
  MSW (Mock Service Worker): Found in test setup
  Handlers: src/mocks/handlers.ts
  Server setup: src/setupTests.ts
```

---

## Investigation Checklist

After completing test patterns investigation, verify:

- [ ] Test file naming pattern identified (.test vs .spec vs test_ prefix)
- [ ] Test file organization understood (co-located vs separate vs __tests__)
- [ ] Test structure style determined (describe+it vs test() vs def test_)
- [ ] Test naming convention noted (should prefix, behavior description)
- [ ] Assertion library identified (Jest expect, Chai, unittest, pytest)
- [ ] Common matchers/assertions catalogued
- [ ] Mocking library and approach determined
- [ ] Mock patterns documented (module mocks, function mocks, spies)
- [ ] Test data strategy identified (inline, beforeEach, fixtures, factories)
- [ ] Setup/teardown patterns noted
- [ ] Evidence collected (file counts, pattern examples) for each decision

## Pattern Application Priority

When test patterns are unclear or conflict:

1. **Test framework configuration** (highest priority) - jest.config.js, vitest.config.ts, pytest.ini
2. **Linting rules** - ESLint test plugins, test-specific rules
3. **Majority pattern** (>70% usage) - Clear team preference
4. **Testing framework defaults** - Jest, pytest, JUnit best practices
5. **Modern testing best practices** - When no clear pattern exists

## Common Pattern Combinations

### Modern JavaScript/TypeScript (Jest + React Testing Library)
```typescript
// ComponentName.test.tsx (co-located with ComponentName.tsx)
import { render, screen } from '@testing-library/react'
import { userFactory } from '@/factories'
import { UserProfile } from './UserProfile'

describe('UserProfile', () => {
  it('should render user name', () => {
    const user = userFactory.build({ name: 'John Doe' })
    render(<UserProfile user={user} />)
    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })

  it('should handle missing user data', () => {
    render(<UserProfile user={null} />)
    expect(screen.getByText('No user data')).toBeInTheDocument()
  })
})
```

### Python with pytest
```python
# test_user_profile.py
import pytest
from myapp.user_profile import UserProfile

@pytest.fixture
def user():
    return {
        'id': 1,
        'name': 'John Doe',
        'email': 'john@example.com'
    }

def test_user_profile_renders_name(user):
    profile = UserProfile(user)
    assert profile.render_name() == 'John Doe'

def test_user_profile_handles_missing_data():
    profile = UserProfile(None)
    assert profile.render_name() == 'No user data'
```

### Java with JUnit 5 and Mockito
```java
// UserProfileTest.java (in test/ directory)
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import static org.assertj.core.api.Assertions.assertThat;

class UserProfileTest {
    @Mock
    private UserService userService;

    @Test
    void shouldRenderUserName() {
        User user = new User(1, "John Doe", "john@example.com");
        UserProfile profile = new UserProfile(user);

        assertThat(profile.getName()).isEqualTo("John Doe");
    }

    @Test
    void shouldHandleMissingData() {
        UserProfile profile = new UserProfile(null);

        assertThat(profile.getName()).isEqualTo("No user data");
    }
}
```

## Integration with Other Protocols

**After test patterns investigation**:
1. Apply discovered patterns when writing new tests
2. Match existing test structure and style
3. Use same assertion library and matchers
4. Follow mocking conventions
5. Continue to framework-specific protocols (React, API, etc.)

**Test patterns inform**:
- Test file naming and location
- Test structure and organization
- Assertion style and matchers
- Mock/stub approach
- Test data creation

This investigation ensures new tests are indistinguishable from existing tests, maintaining consistency and meeting team expectations.
