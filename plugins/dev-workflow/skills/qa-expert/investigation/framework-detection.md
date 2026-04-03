# Framework Detection Protocol

## Purpose

Detect which testing framework(s) are in use across different programming languages. This determines test template selection, syntax patterns, configuration handling, and assertion styles for quality assurance tasks.

## Why This Matters

**Framework determines syntax and assertion style**:
- Jest → `expect().toBe()`, snapshot testing, mocks built-in
- Mocha → `chai.expect()`, requires separate assertion library
- Pytest → `assert` statements, fixture-based setup
- JUnit 5 → `@Test` annotations, `Assertions.assertEquals()`
- RSpec → `expect().to eq()`, behavior-driven syntax

**Configuration affects test execution**:
- Test file patterns (*.test.js vs *_test.py vs *Test.java)
- Test discovery rules
- Coverage reporting setup
- Plugin/extension availability

**Framework version impacts available features**:
- Jest 29 → Native ESM support, improved snapshots
- Pytest 7 → New plugin hooks, async improvements
- JUnit 5 → Lambda support, dynamic tests
- Mocha 10 → ESM support, parallel execution

## Investigation Protocols

---

### Protocol 1: JavaScript/TypeScript Framework Detection

**Objective**: Determine if Jest, Mocha, Vitest, or other JavaScript testing framework is in use

**Tool**: Read → `package.json`

**Extract**:
- `dependencies` or `devDependencies` containing test frameworks
- `scripts.test` command pattern (reveals framework usage)
- `scripts.coverage` command (indicates coverage tools)
- Framework-specific dependencies:
  - `jest`, `@jest/globals`, `jest-environment-*`
  - `mocha`, `chai`, `sinon` (Mocha ecosystem)
  - `vitest`, `@vitest/ui` (Vitest)
  - `@testing-library/react`, `@testing-library/jest-dom`
  - `ava`, `tape`, `jasmine`

**Error Handling**:
- If `package.json` doesn't exist → Report to user: "No package.json found. Is this a Node.js project?"
- If file exists but no test framework dependencies → Report to user: "No testing framework detected in dependencies. Tests may not be configured yet."
- If multiple frameworks found → Report to user: "Multiple frameworks detected (Jest + Mocha). Please clarify which is primary."

**Decision Tree**:
```
JavaScript/TypeScript framework?
├─ Jest (most common)
│   ├─ Version 29.x+
│   │   ├─ ✓ Native ESM support
│   │   ├─ ✓ Improved snapshot testing
│   │   ├─ ✓ Better TypeScript support
│   │   ├─ ✓ expect().toBe(), expect().toEqual()
│   │   ├─ ✓ Built-in mocks (jest.fn(), jest.mock())
│   │   ├─ ✓ Snapshot testing (toMatchSnapshot())
│   │   └─ File pattern: *.test.js, *.spec.js, __tests__/*.js
│   │
│   ├─ Version 27-28
│   │   ├─ ✓ Most features available
│   │   ├─ ⚠ ESM support requires config
│   │   └─ Note: Upgrade recommended for better ESM/TS
│   │
│   └─ Detection signals
│       ├─ Package: "jest" in devDependencies
│       ├─ Config: jest.config.js, jest.config.ts, package.json["jest"]
│       └─ Script: "test": "jest" in package.json
│
├─ Vitest (Vite ecosystem)
│   ├─ Version 1.x+
│   │   ├─ ✓ Jest-compatible API (expect syntax)
│   │   ├─ ✓ Native ESM, fast HMR
│   │   ├─ ✓ TypeScript out-of-the-box
│   │   ├─ ✓ Vite transformations in tests
│   │   ├─ ✓ expect().toBe(), vi.fn() (similar to Jest)
│   │   └─ File pattern: *.test.ts, *.spec.ts
│   │
│   └─ Detection signals
│       ├─ Package: "vitest" in devDependencies
│       ├─ Config: vitest.config.ts, vite.config.ts["test"]
│       └─ Script: "test": "vitest" in package.json
│
├─ Mocha (traditional choice)
│   ├─ Version 10.x+
│   │   ├─ ✓ ESM support
│   │   ├─ ✓ Parallel execution (--parallel)
│   │   ├─ ✗ No built-in assertions (needs Chai)
│   │   ├─ ✗ No built-in mocks (needs Sinon)
│   │   ├─ Syntax: describe(), it(), expect() [via Chai]
│   │   └─ File pattern: test/*.js, *.test.js
│   │
│   └─ Detection signals
│       ├─ Package: "mocha" in devDependencies
│       ├─ Usually with: "chai" (assertions), "sinon" (mocks)
│       ├─ Config: .mocharc.js, .mocharc.json
│       └─ Script: "test": "mocha" in package.json
│
├─ Other frameworks
│   ├─ Jasmine
│   │   ├─ Package: "jasmine" or "jasmine-core"
│   │   ├─ Syntax: describe(), it(), expect().toBe()
│   │   └─ Note: Often used with Angular
│   │
│   ├─ AVA
│   │   ├─ Package: "ava"
│   │   ├─ Syntax: test(), t.is(), t.deepEqual()
│   │   └─ Features: Concurrent by default, TypeScript support
│   │
│   └─ Tape
│       ├─ Package: "tape"
│       ├─ Syntax: test(), t.equal(), t.end()
│       └─ Features: Minimal, TAP output
│
└─ No framework detected
    ├─ Check: scripts.test for clues
    ├─ Fallback: Suggest Jest (most popular) or Vitest (for Vite projects)
    └─ Note: May need framework installation guidance
```

**Verification**:
```bash
# Check for test framework packages
grep -E '"(jest|vitest|mocha|chai|ava|jasmine)"' package.json

# Check test script
grep '"test":' package.json

# Check for config files
ls -la jest.config.* vitest.config.* .mocharc.* 2>/dev/null
```

**Example Output**:
```
Framework: Jest
Version: 29.3.1
Dependencies:
  - jest: 29.3.1
  - @testing-library/react: 13.4.0
  - @testing-library/jest-dom: 5.16.5

Configuration: jest.config.js found
Test script: "jest --coverage"

Decision: Use Jest 29 patterns
  - Syntax: expect().toBe(), expect().toEqual()
  - Mocks: jest.fn(), jest.mock()
  - File pattern: *.test.tsx, __tests__/*.tsx
  - ESM: Supported natively
```

---

### Protocol 2: Python Framework Detection

**Objective**: Determine if Pytest, unittest, or other Python testing framework is in use

**Tool**: Read → `requirements.txt`, `requirements-dev.txt`, `pyproject.toml`, `setup.py`

**Extract**:

**From requirements files**:
- `pytest`, `pytest-*` (plugins like pytest-cov, pytest-asyncio)
- `unittest` (built-in, may not be listed)
- `nose`, `nose2` (legacy frameworks)

**From pyproject.toml**:
- `[tool.pytest.ini_options]` section
- `[project.optional-dependencies]` with test dependencies
- `[build-system]` may include test requirements

**Error Handling**:
- If no dependency files exist → Report to user: "No Python dependency files found. Is this a Python project?"
- If files exist but no test framework → Report to user: "No test framework detected. May be using built-in unittest."
- If `pyproject.toml` is malformed → Report to user: "pyproject.toml parsing error. Using fallback detection."

**Decision Tree**:
```
Python testing framework?
├─ Pytest (modern standard)
│   ├─ Version 7.x+
│   │   ├─ ✓ assert statement rewriting
│   │   ├─ ✓ Fixtures for setup/teardown
│   │   ├─ ✓ Parametrized tests (@pytest.mark.parametrize)
│   │   ├─ ✓ Plugins ecosystem (pytest-cov, pytest-mock)
│   │   ├─ ✓ Async test support (pytest-asyncio)
│   │   ├─ Syntax: def test_*(): assert value == expected
│   │   └─ File pattern: test_*.py, *_test.py
│   │
│   ├─ Version 6.x
│   │   ├─ ✓ Most features available
│   │   ├─ Note: Upgrade for better async support
│   │   └─ Compatible with modern Python
│   │
│   └─ Detection signals
│       ├─ Package: pytest in requirements
│       ├─ Config: pytest.ini, pyproject.toml[tool.pytest]
│       ├─ Directory: tests/ with test_*.py files
│       └─ Plugins: pytest-cov, pytest-mock, pytest-django
│
├─ unittest (built-in, standard library)
│   ├─ Available in all Python versions
│   │   ├─ ✓ No installation required
│   │   ├─ ✓ TestCase classes with assertions
│   │   ├─ ✗ More verbose than Pytest
│   │   ├─ ✗ Setup via setUp()/tearDown() methods
│   │   ├─ Syntax: class TestCase(unittest.TestCase):
│   │   │           def test_method(self):
│   │   │               self.assertEqual(value, expected)
│   │   └─ File pattern: test*.py, *_test.py
│   │
│   └─ Detection signals
│       ├─ Package: Not in requirements (built-in)
│       ├─ Code: Files with "import unittest"
│       ├─ Pattern: Classes inheriting from unittest.TestCase
│       └─ Note: May be using pytest to run unittest tests
│
├─ nose/nose2 (legacy)
│   ├─ Version: nose (deprecated), nose2 (maintained)
│   │   ├─ ⚠ nose is deprecated, migrate to pytest
│   │   ├─ nose2: Modern rewrite, compatible
│   │   ├─ Syntax: Similar to unittest and pytest
│   │   └─ File pattern: test*.py
│   │
│   └─ Detection signals
│       ├─ Package: "nose" or "nose2" in requirements
│       ├─ Config: .noserc, nose2.cfg
│       └─ Recommendation: Migrate to pytest
│
├─ doctest (embedded in docstrings)
│   ├─ Built-in Python testing in docstrings
│   │   ├─ Syntax: >>> code in docstring
│   │   ├─ Use case: Documentation examples
│   │   └─ Often combined with unittest/pytest
│   │
│   └─ Detection signals
│       └─ Docstrings with >>> examples
│
└─ No explicit framework
    ├─ Fallback: Assume unittest (built-in)
    ├─ Check: Scan for test files to confirm
    └─ Recommend: Pytest for new projects
```

**Verification**:
```bash
# Check requirements files
grep -E "pytest|nose|unittest" requirements*.txt 2>/dev/null

# Check pyproject.toml
grep -A 5 "\[tool.pytest" pyproject.toml 2>/dev/null

# Check for test files and imports
find . -name "test_*.py" -o -name "*_test.py" | head -5
grep -r "import pytest\|import unittest" --include="*.py" | head -5
```

**Example Output**:
```
Framework: Pytest
Version: 7.4.2
Dependencies:
  - pytest: 7.4.2
  - pytest-cov: 4.1.0
  - pytest-asyncio: 0.21.1

Configuration: pyproject.toml [tool.pytest.ini_options]
  - testpaths = ["tests"]
  - python_files = "test_*.py"

Decision: Use Pytest patterns
  - Syntax: def test_function(): assert result == expected
  - Fixtures: @pytest.fixture for setup
  - Parametrize: @pytest.mark.parametrize for data-driven tests
  - File pattern: tests/test_*.py
```

---

### Protocol 3: Java Framework Detection

**Objective**: Determine if JUnit 5, JUnit 4, TestNG, or other Java testing framework is in use

**Tool**: Read → `pom.xml` (Maven) or `build.gradle` / `build.gradle.kts` (Gradle)

**Extract**:

**Maven (pom.xml)**:
- `<dependency>` entries for test frameworks
- `<artifactId>` containing: junit-jupiter, junit, testng
- `<scope>test</scope>` dependencies
- Maven Surefire/Failsafe plugin configuration

**Gradle (build.gradle)**:
- `testImplementation` or `testCompile` dependencies
- `useJUnitPlatform()` in test block (JUnit 5)
- `test { useTestNG() }` (TestNG)

**Error Handling**:
- If neither Maven nor Gradle files exist → Report to user: "No Maven or Gradle build files found. Is this a Java project?"
- If files exist but no test dependencies → Report to user: "No test framework detected in build configuration."
- If both JUnit 4 and 5 detected → Report to user: "Both JUnit 4 and 5 detected. Project may be migrating. Verify which to use."

**Decision Tree**:
```
Java testing framework?
├─ JUnit 5 (Jupiter) - Modern standard
│   ├─ Version 5.9.x+
│   │   ├─ ✓ @Test annotation (org.junit.jupiter.api)
│   │   ├─ ✓ Assertions.assertEquals(), assertThrows()
│   │   ├─ ✓ @BeforeEach, @AfterEach, @BeforeAll, @AfterAll
│   │   ├─ ✓ @ParameterizedTest with @ValueSource, @CsvSource
│   │   ├─ ✓ @Nested test classes
│   │   ├─ ✓ @DisplayName for readable test names
│   │   ├─ ✓ Assumptions, conditional test execution
│   │   └─ File pattern: *Test.java, *Tests.java in src/test/java
│   │
│   ├─ Detection signals (Maven)
│   │   ├─ Dependency: junit-jupiter-api (5.x.x)
│   │   ├─ Dependency: junit-jupiter-engine (runtime)
│   │   ├─ Optional: junit-jupiter-params (parameterized tests)
│   │   └─ Plugin: maven-surefire-plugin (runs tests)
│   │
│   ├─ Detection signals (Gradle)
│   │   ├─ Dependency: testImplementation 'org.junit.jupiter:junit-jupiter'
│   │   ├─ Test config: test { useJUnitPlatform() }
│   │   └─ Note: useJUnitPlatform() is required for JUnit 5
│   │
│   └─ Import patterns
│       ├─ import org.junit.jupiter.api.Test;
│       ├─ import org.junit.jupiter.api.Assertions.*;
│       └─ import org.junit.jupiter.params.ParameterizedTest;
│
├─ JUnit 4 (Legacy, still common)
│   ├─ Version 4.13.x
│   │   ├─ ✓ @Test annotation (org.junit)
│   │   ├─ ✓ Assert.assertEquals(), Assert.assertNotNull()
│   │   ├─ ✓ @Before, @After, @BeforeClass, @AfterClass
│   │   ├─ ✓ @Ignore to skip tests
│   │   ├─ ✗ No @ParameterizedTest (needs separate runner)
│   │   ├─ ✗ Less flexible than JUnit 5
│   │   └─ File pattern: *Test.java in src/test/java
│   │
│   ├─ Detection signals (Maven)
│   │   ├─ Dependency: junit:junit:4.x
│   │   └─ Note: Single junit artifact (not jupiter)
│   │
│   ├─ Detection signals (Gradle)
│   │   ├─ Dependency: testImplementation 'junit:junit:4.x'
│   │   └─ No useJUnitPlatform() in test block
│   │
│   └─ Import patterns
│       ├─ import org.junit.Test;
│       ├─ import org.junit.Assert.*;
│       └─ import org.junit.Before;
│
├─ TestNG (Alternative to JUnit)
│   ├─ Version 7.x+
│   │   ├─ ✓ @Test annotation (org.testng.annotations)
│   │   ├─ ✓ Assert.assertEquals() (org.testng.Assert)
│   │   ├─ ✓ @BeforeMethod, @AfterMethod, @BeforeClass, @AfterClass
│   │   ├─ ✓ @DataProvider for parameterized tests
│   │   ├─ ✓ Groups and dependencies (@Test(groups=...))
│   │   ├─ ✓ XML suite configuration (testng.xml)
│   │   └─ File pattern: *Test.java, TestNG suite XML
│   │
│   ├─ Detection signals (Maven)
│   │   ├─ Dependency: testng (org.testng:testng)
│   │   └─ Config: testng.xml in test resources
│   │
│   ├─ Detection signals (Gradle)
│   │   ├─ Dependency: testImplementation 'org.testng:testng'
│   │   └─ Test config: test { useTestNG() }
│   │
│   └─ Import patterns
│       ├─ import org.testng.annotations.Test;
│       ├─ import org.testng.Assert.*;
│       └─ import org.testng.annotations.DataProvider;
│
├─ Vintage (JUnit 4 running on JUnit 5 platform)
│   ├─ Migration scenario
│   │   ├─ Uses: junit-vintage-engine
│   │   ├─ Purpose: Run JUnit 4 tests on JUnit 5 platform
│   │   ├─ Strategy: Gradual migration path
│   │   └─ Note: Both JUnit 4 and 5 dependencies present
│   │
│   └─ Detection signals
│       ├─ Dependencies: junit-jupiter AND junit-vintage-engine
│       └─ Mixed imports in codebase
│
└─ No framework detected
    ├─ Check: src/test/java directory exists?
    ├─ Fallback: Recommend JUnit 5 (modern standard)
    └─ Note: May need dependency addition guidance
```

**Verification**:
```bash
# Maven project
grep -A 3 "<artifactId>junit" pom.xml 2>/dev/null
grep -A 3 "<artifactId>testng" pom.xml 2>/dev/null

# Gradle project
grep "junit\|testng" build.gradle* 2>/dev/null
grep "useJUnitPlatform\|useTestNG" build.gradle* 2>/dev/null

# Check test files for imports
find src/test/java -name "*.java" -exec grep -l "import org.junit" {} \; | head -5
```

**Example Output**:
```
Framework: JUnit 5 (Jupiter)
Version: 5.9.3
Build Tool: Maven
Dependencies:
  - junit-jupiter-api: 5.9.3
  - junit-jupiter-engine: 5.9.3
  - junit-jupiter-params: 5.9.3

Configuration: pom.xml with maven-surefire-plugin
Test directory: src/test/java

Decision: Use JUnit 5 patterns
  - Annotations: @Test, @BeforeEach, @AfterEach
  - Assertions: Assertions.assertEquals(), assertThrows()
  - Parameterized: @ParameterizedTest with @ValueSource
  - File pattern: *Test.java
  - Package: org.junit.jupiter.api
```

---

### Protocol 4: Ruby Framework Detection

**Objective**: Determine if RSpec, Minitest, or other Ruby testing framework is in use

**Tool**: Read → `Gemfile`, `Gemfile.lock`, `.rspec`

**Extract**:

**From Gemfile**:
- `gem 'rspec'`, `gem 'rspec-rails'` (RSpec)
- `gem 'minitest'` (may be implicit with Rails)
- `gem 'capybara'` (integration testing)
- `gem 'factory_bot'`, `gem 'faker'` (test data)

**From Gemfile.lock**:
- Actual installed versions of test frameworks

**Error Handling**:
- If `Gemfile` doesn't exist → Report to user: "No Gemfile found. Is this a Ruby project?"
- If no test gems found → Report to user: "No test framework gems detected. May be using standard library."
- If both RSpec and Minitest found → Report to user: "Both RSpec and Minitest detected. Clarify which is primary."

**Decision Tree**:
```
Ruby testing framework?
├─ RSpec (behavior-driven development)
│   ├─ Version 3.x+
│   │   ├─ ✓ describe/context blocks
│   │   ├─ ✓ it/specify for examples
│   │   ├─ ✓ expect().to eq(), expect().to be_*
│   │   ├─ ✓ let/let! for lazy/eager setup
│   │   ├─ ✓ before/after hooks
│   │   ├─ ✓ Matchers (eq, be, include, have_attributes)
│   │   ├─ ✓ Mocks/stubs built-in
│   │   └─ File pattern: spec/*_spec.rb
│   │
│   ├─ RSpec Rails integration
│   │   ├─ Gem: rspec-rails
│   │   ├─ Features: Model/controller/request specs
│   │   ├─ Helpers: Rails-specific matchers
│   │   └─ Config: spec/rails_helper.rb, spec/spec_helper.rb
│   │
│   ├─ Detection signals
│   │   ├─ Gem: rspec, rspec-core, rspec-expectations, rspec-mocks
│   │   ├─ Config: .rspec file (--require spec_helper)
│   │   ├─ Directory: spec/ with *_spec.rb files
│   │   └─ Helper: spec/spec_helper.rb
│   │
│   └─ Syntax example
│       ├─ describe MyClass do
│       ├─   it "does something" do
│       ├─     expect(result).to eq(expected)
│       └─   end
│           end
│
├─ Minitest (Rails default, standard library)
│   ├─ Version 5.x+
│   │   ├─ ✓ Test::Unit style (class-based)
│   │   ├─ ✓ Spec style (describe/it blocks)
│   │   ├─ ✓ assert_equal, assert_nil, refute_*
│   │   ├─ ✓ setup/teardown hooks
│   │   ├─ ✗ Less expressive matchers than RSpec
│   │   ├─ Faster execution than RSpec
│   │   └─ File pattern: test/*_test.rb
│   │
│   ├─ Test::Unit style (classic)
│   │   ├─ class MyTest < Minitest::Test
│   │   ├─   def test_something
│   │   ├─     assert_equal expected, actual
│   │   └─   end
│           end
│   │
│   ├─ Spec style (BDD-like)
│   │   ├─ describe MyClass do
│   │   ├─   it "does something" do
│   │   ├─     _(result).must_equal expected
│   │   └─   end
│           end
│   │
│   └─ Detection signals
│       ├─ Gem: minitest (or implicit with Ruby)
│       ├─ Directory: test/ with *_test.rb files
│       ├─ Helper: test/test_helper.rb
│       └─ Note: Default in Rails, may not be in Gemfile
│
├─ Test::Unit (legacy, pre-Minitest)
│   ├─ Now deprecated in favor of Minitest
│   │   ├─ Similar syntax to Minitest
│   │   ├─ class MyTest < Test::Unit::TestCase
│   │   └─ Recommendation: Migrate to Minitest or RSpec
│   │
│   └─ Detection signals
│       └─ Very old Ruby/Rails projects
│
├─ Cucumber (BDD, often with RSpec)
│   ├─ Purpose: Acceptance testing with Gherkin syntax
│   │   ├─ Given/When/Then scenarios
│   │   ├─ Feature files (*.feature)
│   │   ├─ Often combined with RSpec/Minitest
│   │   └─ File pattern: features/*.feature
│   │
│   └─ Detection signals
│       ├─ Gem: cucumber, cucumber-rails
│       └─ Directory: features/
│
└─ No framework detected
    ├─ Check: Rails project may use Minitest by default
    ├─ Fallback: Recommend RSpec (popular) or Minitest (simpler)
    └─ Note: May need gem installation guidance
```

**Verification**:
```bash
# Check Gemfile for test frameworks
grep -E "gem ['\"]rspec|gem ['\"]minitest|gem ['\"]cucumber" Gemfile 2>/dev/null

# Check for config files
ls -la .rspec spec/spec_helper.rb test/test_helper.rb 2>/dev/null

# Check directory structure
ls -d spec/ test/ features/ 2>/dev/null

# Check for test files
find spec -name "*_spec.rb" 2>/dev/null | head -5
find test -name "*_test.rb" 2>/dev/null | head -5
```

**Example Output**:
```
Framework: RSpec
Version: 3.12.0
Gems:
  - rspec: 3.12.0
  - rspec-rails: 6.0.1
  - capybara: 3.39.0
  - factory_bot_rails: 6.2.0

Configuration: .rspec, spec/spec_helper.rb, spec/rails_helper.rb
Test directory: spec/

Decision: Use RSpec patterns
  - Structure: describe/context blocks
  - Examples: it "description" do ... end
  - Expectations: expect().to eq(), expect().to be_truthy
  - Setup: let(:user) { create(:user) }
  - File pattern: spec/**/*_spec.rb
  - Rails: Use request/model/system specs
```

---

### Protocol 5: Configuration File Detection

**Objective**: Find and analyze testing framework configuration files across all languages

**Tool**: Glob → Framework-specific config file patterns

**Search Patterns**:

**JavaScript/TypeScript**:
- `jest.config.*` (js, ts, mjs, cjs, json)
- `vitest.config.*` (ts, js)
- `.mocharc.*` (js, json, yaml)
- `karma.conf.js`

**Python**:
- `pytest.ini`
- `pyproject.toml` (check [tool.pytest.ini_options])
- `setup.cfg` (check [tool:pytest])
- `tox.ini` (multi-environment testing)

**Java**:
- `pom.xml` (Maven Surefire/Failsafe plugin config)
- `build.gradle` / `build.gradle.kts` (test block config)

**Ruby**:
- `.rspec` (RSpec options)
- `spec/spec_helper.rb` (RSpec config)
- `test/test_helper.rb` (Minitest config)

**Cross-language**:
- `.coveragerc`, `coverage.xml` (coverage config)
- `codecov.yml`, `.codecov.yml` (Codecov integration)

**Error Handling**:
- If Glob finds no config files → Report: "No test configuration files found. Using framework defaults."
- If multiple conflicting configs → Report: "Multiple config files for same framework detected. Verify which is active."
- If config file is malformed → Report: "Config file parse error. Some settings may not apply."

**Extract**:

**Jest Configuration (jest.config.js)**:
```javascript
module.exports = {
  testEnvironment: 'jsdom',           // Browser-like vs node
  testMatch: ['**/*.test.js'],        // Test file patterns
  collectCoverageFrom: ['src/**/*.js'],
  setupFilesAfterEnv: ['<rootDir>/setupTests.js'],
  moduleNameMapper: {                 // Path aliases
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  transform: {
    '^.+\\.tsx?$': 'ts-jest'          // TypeScript support
  }
}
```

**Key settings**:
- `testEnvironment`: jsdom (browser) vs node
- `testMatch`: File patterns to include
- `setupFilesAfterEnv`: Setup files (e.g., @testing-library/jest-dom)
- `moduleNameMapper`: Import path aliases
- `transform`: File transformation (TypeScript, etc.)

**Pytest Configuration (pyproject.toml)**:
```toml
[tool.pytest.ini_options]
testpaths = ["tests"]                # Test directories
python_files = ["test_*.py"]         # File patterns
python_classes = ["Test*"]           # Class patterns
python_functions = ["test_*"]        # Function patterns
addopts = [
  "--cov=src",                       # Coverage for src/
  "--cov-report=html",               # HTML coverage report
  "--verbose"
]
markers = [
  "slow: marks tests as slow",      # Custom markers
  "integration: integration tests"
]
```

**Key settings**:
- `testpaths`: Where to search for tests
- `python_files/classes/functions`: Discovery patterns
- `addopts`: Default command-line options
- `markers`: Custom test markers

**JUnit Configuration (pom.xml Maven)**:
```xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-surefire-plugin</artifactId>
  <version>3.0.0</version>
  <configuration>
    <includes>
      <include>**/*Test.java</include>  <!-- File patterns -->
    </includes>
    <excludes>
      <exclude>**/*IntegrationTest.java</exclude>
    </excludes>
    <parallel>methods</parallel>        <!-- Parallel execution -->
    <threadCount>4</threadCount>
  </configuration>
</plugin>
```

**Key settings**:
- `includes/excludes`: Test file patterns
- `parallel`: Parallel execution mode
- `threadCount`: Number of parallel threads

**RSpec Configuration (.rspec)**:
```
--require spec_helper
--color
--format documentation
--warnings
```

**Key settings**:
- `--require`: Files to require before specs
- `--format`: Output format (documentation, progress, etc.)
- `--color`: Colored output
- `--warnings`: Show Ruby warnings

**Decision Tree for Configuration**:
```
Configuration file found?
├─ YES
│   ├─ Parse successfully?
│   │   ├─ YES
│   │   │   ├─ Extract key settings
│   │   │   ├─ Note custom configurations
│   │   │   ├─ Identify test file patterns
│   │   │   ├─ Check coverage settings
│   │   │   └─ Note any custom setup files
│   │   │
│   │   └─ NO (parse error)
│   │       ├─ Report error to user
│   │       ├─ Fall back to framework defaults
│   │       └─ Recommend fixing configuration
│   │
│   └─ Multiple configs for same framework
│       ├─ Check which is active (framework precedence)
│       ├─ Warn user about potential conflicts
│       └─ Use higher-priority config
│
└─ NO
    ├─ Framework uses defaults
    ├─ Note: Recommend creating config for clarity
    └─ Proceed with framework-standard patterns
```

**Verification**:
```bash
# Search for all common config files
ls -la jest.config.* vitest.config.* .mocharc.* 2>/dev/null
ls -la pytest.ini pyproject.toml setup.cfg tox.ini 2>/dev/null
ls -la .rspec spec/spec_helper.rb test/test_helper.rb 2>/dev/null
ls -la pom.xml build.gradle* 2>/dev/null

# Check for coverage config
ls -la .coveragerc coverage.xml codecov.yml .codecov.yml 2>/dev/null
```

**Example Output**:
```
Configuration files found:
  - jest.config.js
  - setupTests.js

Jest configuration:
  - testEnvironment: jsdom (DOM testing enabled)
  - testMatch: ["**/__tests__/**/*.ts", "**/*.test.ts"]
  - setupFilesAfterEnv: ["<rootDir>/setupTests.js"]
  - moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" }
  - transform: ts-jest for TypeScript
  - collectCoverageFrom: ["src/**/*.{ts,tsx}"]

Setup files:
  - setupTests.js imports @testing-library/jest-dom

Decision: Follow Jest configuration
  - Test files: *.test.ts in any directory
  - Use @/ path alias for imports
  - DOM matchers available (toBeInTheDocument, etc.)
  - TypeScript transformation configured
```

---

## Investigation Checklist

After completing framework detection investigation, verify:

- [ ] Programming language identified (JavaScript/Python/Java/Ruby)
- [ ] Testing framework detected and version noted
- [ ] Framework dependencies/packages documented
- [ ] Configuration files found and parsed
- [ ] Test file patterns identified (*.test.js, test_*.py, *Test.java, *_spec.rb)
- [ ] Test directory structure confirmed (tests/, spec/, src/test/java)
- [ ] Assertion style determined (expect vs assert vs Assert vs should)
- [ ] Mock/stub library identified (built-in vs separate)
- [ ] Coverage tools detected (if configured)
- [ ] Custom configuration noted (parallel execution, custom matchers, etc.)

## Common Scenarios

### Scenario 1: Modern JavaScript with Jest + React Testing Library
```
Language: JavaScript/TypeScript
Framework: Jest 29.3.1
Configuration: jest.config.js
Setup: setupTests.js with @testing-library/jest-dom
Test pattern: *.test.tsx
Directory: __tests__/ and co-located tests
Result: Use Jest + RTL patterns, DOM matchers available
```

### Scenario 2: Python with Pytest + Coverage
```
Language: Python
Framework: Pytest 7.4.2
Configuration: pyproject.toml [tool.pytest.ini_options]
Plugins: pytest-cov, pytest-asyncio
Test pattern: tests/test_*.py
Result: Use pytest fixtures, assert statements, async test support
```

### Scenario 3: Java with JUnit 5 + Maven
```
Language: Java
Framework: JUnit 5.9.3 (Jupiter)
Build tool: Maven
Configuration: pom.xml with maven-surefire-plugin
Test pattern: src/test/java/**/*Test.java
Result: Use JUnit 5 annotations, Assertions class, @ParameterizedTest
```

### Scenario 4: Ruby on Rails with RSpec
```
Language: Ruby
Framework: RSpec 3.12.0 + RSpec Rails 6.0.1
Configuration: .rspec, spec/spec_helper.rb, spec/rails_helper.rb
Test pattern: spec/**/*_spec.rb
Helpers: FactoryBot, Capybara
Result: Use RSpec BDD style, Rails-specific matchers, request/system specs
```

### Scenario 5: Mixed/Migration Scenario
```
Language: Java
Frameworks: JUnit 4 + JUnit 5 (with Vintage engine)
Status: Migration in progress
Configuration: Both junit:junit:4.13 and junit-jupiter + vintage-engine
Result: Support both @Test imports, recommend completing migration
```

## Integration with Other QA Protocols

**After framework detection**:
1. Use detected framework info to select appropriate test templates
2. Apply framework-specific assertion patterns in test generation
3. Configure test runners with detected configuration
4. Set up coverage reporting based on detected tools

**Framework detection informs**:
- Test file naming conventions (*.test.js vs test_*.py)
- Import statements (which testing libraries to use)
- Assertion syntax (expect().toBe() vs assert value == expected)
- Setup/teardown patterns (beforeEach vs @BeforeEach vs before hooks)
- Mock/stub approaches (jest.fn() vs unittest.mock vs Mockito)

## Error Recovery Patterns

### No Framework Detected
```
1. Check project language from file extensions
2. Search for any *test* or *spec* files
3. Examine imports in test files (if they exist)
4. Report findings to user: "Tests exist but no framework found in deps"
5. Recommend framework installation based on language
```

### Multiple Frameworks Detected
```
1. List all detected frameworks with versions
2. Check which has more test files (primary framework)
3. Ask user to clarify which is primary
4. Note if one is for unit tests, another for integration
5. Support both if intentional (e.g., Jest for unit, Cypress for E2E)
```

### Configuration Conflicts
```
1. Identify conflicting settings (e.g., multiple jest.config files)
2. Check framework's config precedence rules
3. Warn user about potential conflicts
4. Recommend consolidating to single config
5. Use highest-priority config until resolved
```

This framework detection protocol ensures accurate identification of testing infrastructure, enabling appropriate test template selection, syntax usage, and configuration handling across all major programming languages and testing frameworks.
