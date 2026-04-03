# Coverage Setup Investigation

## Purpose

Discover project's test coverage configuration, tools, thresholds, and enforcement mechanisms. This ensures new tests match coverage standards and properly integrate with existing measurement infrastructure.

## Why This Matters

**Coverage requirements vary by project**:
- Threshold levels → Determines acceptable test coverage percentage
- Tool configuration → Affects how coverage is measured and reported
- CI enforcement → Impacts whether low coverage blocks merges
- File exclusions → Prevents measuring generated or third-party code

**Misconfigured coverage causes problems**:
- Tests pass locally but fail in CI due to coverage drops
- Coverage reports show incorrect metrics
- Developers waste time investigating false coverage failures
- New code doesn't meet project standards

**Evidence-based configuration**:
- Don't assume 80% coverage is standard
- Discover what THIS project actually enforces
- Follow existing tool configuration and thresholds
- Match CI integration patterns

## Investigation Protocols

---

### Protocol 1: Coverage Tool Detection (JavaScript/TypeScript)

**Objective**: Determine which coverage tool is configured (Jest, Istanbul/nyc, c8, Vitest)

**Tool**: Read → `package.json`, `jest.config.js`, `jest.config.ts`, `vitest.config.ts`, `.nycrc`, `.nycrc.json`

**Search Strategy**:
1. Check `package.json` scripts for coverage commands
2. Read Jest/Vitest configuration for coverage settings
3. Look for Istanbul/nyc configuration files
4. Identify coverage reporters and output formats

**Extract**:
- Coverage tool name and version
- Coverage command script
- Configuration file location
- Enabled reporters (text, html, lcov, json)
- Coverage directory output path

**Error Handling**:
- If no coverage configuration found → Report: "No coverage configuration detected. Project may not use test coverage."
- If multiple tools configured → Report findings and identify which is active
- If configuration file missing but script exists → Tool may use defaults

**Decision Tree**:
```
Coverage tool?
├─ Jest Coverage (coverage via Jest)
│   ├─ Detection:
│   │   ├─ package.json: "test:coverage": "jest --coverage"
│   │   ├─ jest.config.js: coverageThreshold settings
│   │   └─ Dependencies: @jest/core or jest
│   │
│   ├─ Configuration locations:
│   │   ├─ jest.config.js
│   │   ├─ jest.config.ts
│   │   ├─ package.json: "jest" key
│   │   └─ jest.config.json
│   │
│   ├─ Key settings:
│   │   ├─ collectCoverage: Enable/disable collection
│   │   ├─ collectCoverageFrom: Files to include
│   │   ├─ coverageDirectory: Output location
│   │   ├─ coverageReporters: Report formats
│   │   └─ coverageThreshold: Minimum percentages
│   │
│   └─ Extract pattern:
│       Read jest.config.js → Extract all coverage* keys
│
├─ Vitest Coverage
│   ├─ Detection:
│   │   ├─ package.json: "test:coverage": "vitest --coverage"
│   │   ├─ vitest.config.ts: coverage settings
│   │   └─ Dependencies: @vitest/coverage-v8 or @vitest/coverage-istanbul
│   │
│   ├─ Configuration:
│   │   ├─ vitest.config.ts: test.coverage object
│   │   ├─ Provider: 'v8' or 'istanbul'
│   │   └─ Reporters, thresholds, include/exclude
│   │
│   └─ Extract pattern:
│       Read vitest.config.ts → Extract test.coverage object
│
├─ Istanbul/nyc (standalone)
│   ├─ Detection:
│   │   ├─ package.json: "nyc" or "istanbul" in scripts
│   │   ├─ .nycrc or .nycrc.json exists
│   │   └─ Dependencies: nyc or istanbul
│   │
│   ├─ Configuration locations:
│   │   ├─ .nycrc (JSON format)
│   │   ├─ .nycrc.json
│   │   ├─ package.json: "nyc" key
│   │   └─ nyc.config.js
│   │
│   ├─ Key settings:
│   │   ├─ include: Files to cover
│   │   ├─ exclude: Files to ignore
│   │   ├─ reporter: Output formats
│   │   ├─ lines/statements/functions/branches: Thresholds
│   │   └─ check-coverage: Enable threshold checks
│   │
│   └─ Extract pattern:
│       Read .nycrc → Extract all threshold and reporter settings
│
└─ c8 (V8 coverage)
    ├─ Detection:
    │   ├─ package.json: "c8" in scripts
    │   ├─ .c8rc.json exists
    │   └─ Dependencies: c8
    │
    ├─ Configuration:
    │   ├─ .c8rc.json
    │   ├─ package.json: "c8" key
    │   └─ Command-line flags
    │
    └─ Extract pattern:
        Read .c8rc.json → Extract reporter and threshold settings
```

**Verification**:
```bash
# Check package.json for coverage scripts
grep -E "(coverage|test.*--coverage)" package.json

# Find Jest configuration
find . -name "jest.config.*" -o -name ".jestrc*" | head -5

# Find nyc/Istanbul configuration
find . -name ".nycrc*" -o -name "nyc.config.*" | head -5

# Find Vitest configuration
find . -name "vitest.config.*" | head -5

# Check for c8 configuration
find . -name ".c8rc*" | head -5
```

**Example Output** (Jest):
```javascript
// jest.config.js
module.exports = {
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.test.{js,jsx,ts,tsx}',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/index.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
}

Decision: Jest coverage configured
Coverage command: npm run test:coverage
Output directory: coverage/
Reporters: text, lcov, html
Global thresholds: 80% for all metrics
```

**Example Output** (Vitest):
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/*.config.*', '**/dist/**'],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 85,
        statements: 85
      }
    }
  }
})

Decision: Vitest coverage with V8 provider
Coverage command: vitest --coverage
Reporters: text, json, html
Global thresholds: 85% for all metrics
```

---

### Protocol 2: Coverage Tool Detection (Python)

**Objective**: Determine if using coverage.py, pytest-cov, or other Python coverage tools

**Tool**: Read → `pyproject.toml`, `.coveragerc`, `setup.cfg`, `tox.ini`

**Search Strategy**:
1. Check for [tool.coverage] section in pyproject.toml
2. Look for .coveragerc configuration file
3. Check setup.cfg for [coverage:*] sections
4. Examine pytest configuration for coverage settings

**Extract**:
- Coverage tool (coverage.py, pytest-cov)
- Source paths to measure
- Omit patterns (excluded files)
- Minimum coverage percentages
- Report formats

**Error Handling**:
- If no Python configuration found → Skip this protocol
- If pytest-cov found but no coverage.py config → May use defaults
- If multiple config files exist → Identify which takes precedence

**Decision Tree**:
```
Python coverage tool?
├─ pytest-cov (pytest plugin)
│   ├─ Detection:
│   │   ├─ pytest.ini or pyproject.toml: --cov flags
│   │   ├─ Dependencies: pytest-cov
│   │   └─ Commands: pytest --cov=src
│   │
│   ├─ Configuration:
│   │   ├─ pytest.ini: [pytest] addopts = --cov=src --cov-report=html
│   │   ├─ pyproject.toml: [tool.pytest.ini_options]
│   │   └─ Uses coverage.py underneath
│   │
│   └─ Extract pattern:
│       Read pyproject.toml → Extract tool.pytest.ini_options.addopts
│       Parse --cov and --cov-report flags
│
├─ coverage.py (direct)
│   ├─ Detection:
│   │   ├─ .coveragerc exists
│   │   ├─ pyproject.toml: [tool.coverage.*]
│   │   ├─ setup.cfg: [coverage:*]
│   │   └─ Dependencies: coverage
│   │
│   ├─ Configuration structure:
│   │   ├─ [run]: Source paths, omit patterns
│   │   ├─ [report]: Report settings, fail_under threshold
│   │   ├─ [html]: HTML report settings
│   │   └─ [xml]: XML report settings
│   │
│   ├─ Key settings:
│   │   ├─ source: Directories to measure
│   │   ├─ omit: Files/patterns to exclude
│   │   ├─ fail_under: Minimum coverage percentage
│   │   ├─ show_missing: Show uncovered lines
│   │   └─ precision: Decimal places in percentages
│   │
│   └─ Extract pattern:
│       Read .coveragerc or pyproject.toml [tool.coverage.*]
│       Extract all sections and key settings
│
└─ No Python coverage
    └─ Skip this protocol if not a Python project
```

**Verification**:
```bash
# Check for coverage.py configuration
find . -name ".coveragerc" -o -name "setup.cfg" | head -5

# Check pyproject.toml for coverage settings
grep -A 10 "\[tool.coverage" pyproject.toml 2>/dev/null

# Check for pytest-cov in dependencies
grep -E "(pytest-cov|coverage)" requirements.txt pyproject.toml setup.py 2>/dev/null

# Check pytest configuration for coverage flags
grep -E "(--cov|addopts)" pytest.ini pyproject.toml setup.cfg 2>/dev/null
```

**Example Output** (coverage.py via pyproject.toml):
```toml
# pyproject.toml
[tool.coverage.run]
source = ["src"]
omit = [
    "*/tests/*",
    "*/test_*.py",
    "*/__pycache__/*",
    "*/site-packages/*"
]
branch = true

[tool.coverage.report]
precision = 2
show_missing = true
fail_under = 90.0
exclude_lines = [
    "pragma: no cover",
    "def __repr__",
    "raise AssertionError",
    "raise NotImplementedError"
]

[tool.coverage.html]
directory = "htmlcov"

Decision: coverage.py configured
Coverage command: coverage run -m pytest && coverage report
Source directory: src/
Omit patterns: tests, __pycache__, site-packages
Minimum threshold: 90.0%
Branch coverage: enabled
Report formats: terminal (with missing lines), html
```

**Example Output** (.coveragerc):
```ini
# .coveragerc
[run]
source = myapp
omit =
    */tests/*
    */migrations/*
    */venv/*

[report]
fail_under = 85
precision = 2
skip_covered = False
show_missing = True

[html]
directory = coverage_html_report

Decision: coverage.py via .coveragerc
Source: myapp/
Minimum threshold: 85%
HTML report directory: coverage_html_report/
Shows missing line numbers in report
```

---

### Protocol 3: Coverage Tool Detection (Java)

**Objective**: Determine if using JaCoCo, Cobertura, or other Java coverage tools

**Tool**: Read → `pom.xml`, `build.gradle`, `build.gradle.kts`

**Search Strategy**:
1. Search pom.xml for jacoco-maven-plugin
2. Search build.gradle for jacoco plugin
3. Look for coverage rules and thresholds
4. Identify report output locations

**Extract**:
- Coverage tool (JaCoCo, Cobertura)
- Execution goals/tasks
- Coverage rules (line, branch, class minimums)
- Report formats (XML, HTML, CSV)
- Exclusion patterns

**Error Handling**:
- If no Java build files found → Skip this protocol
- If plugin configured but no rules → May use defaults (0% threshold)
- If both Maven and Gradle exist → Identify which is primary build tool

**Decision Tree**:
```
Java coverage tool?
├─ JaCoCo (Maven)
│   ├─ Detection:
│   │   ├─ pom.xml: <artifactId>jacoco-maven-plugin</artifactId>
│   │   ├─ Plugin goals: prepare-agent, report, check
│   │   └─ Standard Maven plugin
│   │
│   ├─ Configuration structure:
│   │   ├─ <execution>: When to run (test phase, verify phase)
│   │   ├─ <goals>: prepare-agent, report, check
│   │   ├─ <rules>: Coverage thresholds
│   │   └─ <excludes>: Classes/packages to skip
│   │
│   ├─ Coverage rules:
│   │   ├─ element: BUNDLE, PACKAGE, CLASS, METHOD
│   │   ├─ counter: LINE, BRANCH, INSTRUCTION, COMPLEXITY
│   │   ├─ value: COVEREDRATIO, MISSEDCOUNT
│   │   └─ minimum/maximum: Threshold values
│   │
│   └─ Extract pattern:
│       Read pom.xml → Find jacoco-maven-plugin
│       Extract <rules> section → Parse threshold requirements
│       Extract <configuration><excludes> → Note exclusion patterns
│
├─ JaCoCo (Gradle)
│   ├─ Detection:
│   │   ├─ build.gradle: apply plugin: 'jacoco' or id 'jacoco'
│   │   ├─ jacocoTestReport task configured
│   │   └─ jacocoTestCoverageVerification task for thresholds
│   │
│   ├─ Configuration structure:
│   │   ├─ jacoco { toolVersion = '0.8.x' }
│   │   ├─ jacocoTestReport { reports { xml, html, csv } }
│   │   ├─ jacocoTestCoverageVerification { violationRules { rule {} } }
│   │   └─ classDirectories exclusion patterns
│   │
│   ├─ Coverage rules:
│   │   ├─ element: LINE, BRANCH, INSTRUCTION, CLASS, METHOD
│   │   ├─ minimum: Threshold (0.0 to 1.0)
│   │   └─ excludes: Package/class patterns
│   │
│   └─ Extract pattern:
│       Read build.gradle → Find jacoco plugin
│       Extract violationRules → Parse minimum thresholds
│       Extract classDirectories.excludes → Note exclusions
│
└─ Cobertura (legacy)
    ├─ Detection:
    │   ├─ pom.xml: cobertura-maven-plugin
    │   └─ Less common in modern projects
    │
    └─ Note: JaCoCo is the modern standard for Java coverage
```

**Verification**:
```bash
# Find Maven pom.xml
find . -name "pom.xml" | head -5

# Find Gradle build files
find . -name "build.gradle*" | head -5

# Search for JaCoCo in Maven
grep -A 20 "jacoco-maven-plugin" pom.xml 2>/dev/null

# Search for JaCoCo in Gradle
grep -A 30 "jacoco" build.gradle build.gradle.kts 2>/dev/null
```

**Example Output** (JaCoCo with Maven):
```xml
<!-- pom.xml -->
<build>
  <plugins>
    <plugin>
      <groupId>org.jacoco</groupId>
      <artifactId>jacoco-maven-plugin</artifactId>
      <version>0.8.11</version>
      <executions>
        <execution>
          <id>prepare-agent</id>
          <goals>
            <goal>prepare-agent</goal>
          </goals>
        </execution>
        <execution>
          <id>report</id>
          <phase>test</phase>
          <goals>
            <goal>report</goal>
          </goals>
        </execution>
        <execution>
          <id>check</id>
          <phase>verify</phase>
          <goals>
            <goal>check</goal>
          </goals>
          <configuration>
            <rules>
              <rule>
                <element>BUNDLE</element>
                <limits>
                  <limit>
                    <counter>LINE</counter>
                    <value>COVEREDRATIO</value>
                    <minimum>0.80</minimum>
                  </limit>
                  <limit>
                    <counter>BRANCH</counter>
                    <value>COVEREDRATIO</value>
                    <minimum>0.75</minimum>
                  </limit>
                </limits>
              </rule>
            </rules>
            <excludes>
              <exclude>**/config/**</exclude>
              <exclude>**/dto/**</exclude>
            </excludes>
          </configuration>
        </execution>
      </executions>
    </plugin>
  </plugins>
</build>

Decision: JaCoCo (Maven) configured
Coverage command: mvn verify
Report location: target/site/jacoco/
Thresholds:
  - Line coverage: 80%
  - Branch coverage: 75%
Exclusions: config/**, dto/**
Enforcement: verify phase (blocks build on failure)
```

**Example Output** (JaCoCo with Gradle):
```groovy
// build.gradle
plugins {
    id 'jacoco'
}

jacoco {
    toolVersion = "0.8.11"
}

jacocoTestReport {
    reports {
        xml.enabled true
        html.enabled true
        csv.enabled false
    }
}

jacocoTestCoverageVerification {
    violationRules {
        rule {
            limit {
                minimum = 0.85
            }
        }
        rule {
            element = 'CLASS'
            includes = ['com.example.core.*']
            limit {
                counter = 'LINE'
                value = 'COVEREDRATIO'
                minimum = 0.90
            }
        }
    }
}

test.finalizedBy jacocoTestReport
check.dependsOn jacocoTestCoverageVerification

Decision: JaCoCo (Gradle) configured
Coverage command: ./gradlew test jacocoTestReport
Report location: build/reports/jacoco/test/html/
Thresholds:
  - Global minimum: 85%
  - Core classes line coverage: 90%
Report formats: XML, HTML
Enforcement: check task (blocks build on failure)
```

---

### Protocol 4: Coverage Thresholds Extraction

**Objective**: Extract all minimum coverage requirements (global, per-file, per-type)

**Tool**: Read configuration files identified in Protocols 1-3

**Search Strategy**:
1. Locate threshold configuration sections
2. Extract percentage requirements for each metric
3. Identify if thresholds are global, per-file, or per-directory
4. Note which metrics are enforced (line, branch, function, statement)

**Extract**:
- Global coverage minimums
- Per-file or per-directory thresholds
- Coverage metric types (lines, branches, functions, statements)
- Strictness level (what percentage is required)

**Decision Tree**:
```
Coverage threshold strictness?
├─ Strict (≥90%)
│   ├─ Characteristics:
│   │   ├─ High-quality codebase expectations
│   │   ├─ Critical or financial systems
│   │   ├─ Strong testing culture
│   │   └─ New code must be well-tested
│   │
│   ├─ Implications:
│   │   ├─ All new code needs thorough tests
│   │   ├─ Edge cases must be covered
│   │   ├─ PR reviews will check coverage closely
│   │   └─ Coverage drops block merges
│   │
│   └─ Example configuration:
│       Jest: coverageThreshold.global: { lines: 90, branches: 90 }
│       Python: fail_under = 95.0
│       JaCoCo: <minimum>0.90</minimum>
│
├─ Moderate (70-89%)
│   ├─ Characteristics:
│   │   ├─ Balanced approach to testing
│   │   ├─ Standard enterprise application
│   │   ├─ Testing encouraged but pragmatic
│   │   └─ Focus on critical paths
│   │
│   ├─ Implications:
│   │   ├─ Core logic must be tested
│   │   ├─ Some edge cases may be skipped
│   │   ├─ Coverage important but not blocking
│   │   └─ Reasonable test expectations
│   │
│   └─ Example configuration:
│       Jest: coverageThreshold.global: { lines: 80, branches: 75 }
│       Python: fail_under = 80.0
│       JaCoCo: <minimum>0.80</minimum>
│
├─ Lenient (<70%)
│   ├─ Characteristics:
│   │   ├─ Legacy codebase
│   │   ├─ Testing being introduced gradually
│   │   ├─ Prototype or early-stage project
│   │   └─ Coverage tracked but not strictly enforced
│   │
│   ├─ Implications:
│   │   ├─ Basic test coverage expected
│   │   ├─ Focus on happy paths
│   │   ├─ Improvement over time expected
│   │   └─ Coverage more informational
│   │
│   └─ Example configuration:
│       Jest: coverageThreshold.global: { lines: 60 }
│       Python: fail_under = 65.0
│       JaCoCo: <minimum>0.50</minimum>
│
└─ No thresholds configured
    ├─ Characteristics:
    │   ├─ Coverage collected but not enforced
    │   ├─ Information only
    │   └─ Team reviews coverage manually
    │
    └─ Implications:
        ├─ Tests recommended but optional
        ├─ Coverage reports for visibility
        └─ No automated enforcement

Coverage metrics enforced?
├─ All four metrics (comprehensive)
│   ├─ Lines: Executed lines of code
│   ├─ Branches: Decision paths (if/else, switch, ternary)
│   ├─ Functions: Functions/methods called
│   └─ Statements: Individual statements executed
│
├─ Lines and branches (common)
│   ├─ Lines: Most straightforward metric
│   ├─ Branches: Ensures conditional logic tested
│   └─ Often sufficient for good coverage
│
├─ Lines only (minimal)
│   ├─ Simplest metric
│   └─ May miss untested conditionals
│
└─ Custom combinations
    └─ Project-specific requirements

Threshold scope?
├─ Global thresholds
│   ├─ Apply to entire project
│   ├─ Average coverage must meet minimum
│   └─ Most common configuration
│
├─ Per-file thresholds
│   ├─ Each file must meet minimum
│   ├─ Prevents low-coverage files
│   └─ Stricter enforcement
│
├─ Per-directory thresholds
│   ├─ Different thresholds for different areas
│   ├─ Example: src/ at 90%, scripts/ at 50%
│   └─ Flexible approach
│
└─ Mixed (global + specific overrides)
    ├─ Global baseline
    ├─ Higher thresholds for critical paths
    └─ Lower thresholds for UI/config
```

**Verification**:
```bash
# JavaScript: Extract Jest thresholds
grep -A 10 "coverageThreshold" jest.config.js jest.config.ts 2>/dev/null

# Python: Extract coverage.py thresholds
grep "fail_under" .coveragerc pyproject.toml setup.cfg 2>/dev/null

# Java: Extract JaCoCo thresholds
grep -A 5 "<minimum>" pom.xml 2>/dev/null
grep "minimum =" build.gradle build.gradle.kts 2>/dev/null
```

**Example Output** (Comprehensive thresholds):
```javascript
// jest.config.js
coverageThreshold: {
  global: {
    branches: 85,
    functions: 85,
    lines: 90,
    statements: 90
  },
  './src/core/**/*.ts': {
    branches: 95,
    functions: 95,
    lines: 95,
    statements: 95
  },
  './src/utils/**/*.ts': {
    branches: 80,
    functions: 80,
    lines: 85,
    statements: 85
  }
}

Analysis:
Project strictness: Strict (90% global lines)
Metrics enforced: All four (branches, functions, lines, statements)
Scope: Global + per-directory overrides

Thresholds by area:
  Global (all code):
    - Lines: 90%
    - Statements: 90%
    - Branches: 85%
    - Functions: 85%

  Core module (src/core/**):
    - All metrics: 95% (critical code)

  Utilities (src/utils/**):
    - Lines: 85%
    - Statements: 85%
    - Branches: 80%
    - Functions: 80%

Implications for new tests:
  - Core functionality requires 95% coverage
  - Standard code requires 90% line coverage
  - All conditionals must be tested (85% branches)
  - Every function should have tests (85% coverage)
```

---

### Protocol 5: Coverage CI Integration

**Objective**: Detect if coverage is enforced in CI/CD pipelines

**Tool**: Read → `.github/workflows/*.yml`, `.gitlab-ci.yml`, `Jenkinsfile`, `.circleci/config.yml`, `azure-pipelines.yml`

**Search Strategy**:
1. Search CI configuration files for coverage commands
2. Look for coverage threshold checks
3. Identify coverage reporting/upload steps
4. Determine if coverage failures block builds

**Extract**:
- CI platform (GitHub Actions, GitLab CI, Jenkins, etc.)
- Coverage job/step configuration
- Whether coverage failures fail the build
- Coverage report upload destinations (Codecov, Coveralls, SonarQube)
- PR comment integration for coverage reports

**Error Handling**:
- If no CI files found → Report: "No CI configuration detected. Coverage may only run locally."
- If CI exists but no coverage step → Report: "CI configured but coverage not enforced"
- If multiple CI platforms configured → Identify all coverage enforcement points

**Decision Tree**:
```
CI coverage enforcement?
├─ Blocking (coverage failure fails build)
│   ├─ Detection:
│   │   ├─ Coverage command without "|| true" or "continue-on-error"
│   │   ├─ Explicit threshold check fails build
│   │   └─ SonarQube quality gate configured
│   │
│   ├─ Characteristics:
│   │   ├─ PR cannot merge if coverage drops
│   │   ├─ Strong enforcement of standards
│   │   └─ Coverage is critical quality metric
│   │
│   └─ Example GitHub Actions:
│       - name: Test with coverage
│         run: npm run test:coverage
│       # No continue-on-error, will fail on threshold violation
│
├─ Non-blocking (informational only)
│   ├─ Detection:
│   │   ├─ continue-on-error: true
│   │   ├─ || true after coverage command
│   │   └─ Coverage runs but doesn't gate builds
│   │
│   ├─ Characteristics:
│   │   ├─ Coverage collected for visibility
│   │   ├─ Team monitors but doesn't block
│   │   └─ Gradual improvement approach
│   │
│   └─ Example GitHub Actions:
│       - name: Test with coverage
│         run: npm run test:coverage
│         continue-on-error: true
│
├─ Reported (uploaded to coverage service)
│   ├─ Services:
│   │   ├─ Codecov: Upload with codecov/codecov-action
│   │   ├─ Coveralls: Upload with coverallsapp/github-action
│   │   ├─ Code Climate: Upload with paambaati/codeclimate-action
│   │   └─ SonarQube: Coverage included in analysis
│   │
│   ├─ Characteristics:
│   │   ├─ Historical coverage tracking
│   │   ├─ PR comments with coverage diff
│   │   ├─ Service may enforce thresholds
│   │   └─ Visibility for team
│   │
│   └─ Example integrations below
│
└─ Not in CI
    └─ Coverage runs locally only
```

**Verification**:
```bash
# Find CI configuration files
find .github/workflows -name "*.yml" -o -name "*.yaml" 2>/dev/null
find . -name ".gitlab-ci.yml" -o -name "Jenkinsfile" -o -name ".circleci" 2>/dev/null

# Search for coverage commands in GitHub Actions
grep -r "coverage" .github/workflows/ 2>/dev/null

# Search for coverage in GitLab CI
grep "coverage" .gitlab-ci.yml 2>/dev/null

# Look for coverage upload actions
grep -E "(codecov|coveralls|codeclimate|sonar)" .github/workflows/*.yml 2>/dev/null
```

**Example Output** (GitHub Actions with Codecov):
```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run tests with coverage
        run: npm run test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          flags: unittests
          fail_ci_if_error: true

      - name: Check coverage thresholds
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "Coverage $COVERAGE% is below threshold 80%"
            exit 1
          fi

Analysis:
CI Platform: GitHub Actions
Trigger: Push and Pull Request

Coverage enforcement:
  - Test coverage command: npm run test:coverage (blocking)
  - Codecov upload: Enabled with fail_ci_if_error: true (blocking)
  - Manual threshold check: 80% line coverage minimum (blocking)

Implications:
  - Coverage must pass all thresholds or build fails
  - PRs cannot merge with coverage failures
  - Codecov will comment on PRs with coverage diff
  - Historical coverage tracked on Codecov dashboard
  - Three enforcement points (local threshold + Codecov + manual check)

Coverage artifacts:
  - lcov.info uploaded to Codecov
  - coverage-summary.json used for threshold check
```

**Example Output** (GitLab CI with coverage reporting):
```yaml
# .gitlab-ci.yml
stages:
  - test
  - report

test:
  stage: test
  script:
    - pip install -r requirements.txt
    - coverage run -m pytest
    - coverage report
    - coverage xml
  coverage: '/(?i)total.*? (100(?:\.0+)?\%|[1-9]?\d(?:\.\d+)?\%)$/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage.xml

quality:
  stage: report
  image: sonarsource/sonar-scanner-cli:latest
  script:
    - sonar-scanner
      -Dsonar.projectKey=myproject
      -Dsonar.python.coverage.reportPaths=coverage.xml
  only:
    - merge_requests
    - main

Analysis:
CI Platform: GitLab CI
Stages: test, report

Coverage enforcement:
  - Test stage runs coverage (blocking if tests fail)
  - Coverage regex extracts percentage for GitLab UI
  - Coverage XML artifact uploaded
  - SonarQube analysis in quality stage

Coverage reporting:
  - GitLab native coverage visualization
  - Cobertura format coverage report
  - SonarQube integration for quality gates

Implications:
  - Tests must pass (blocking)
  - Coverage visible in GitLab merge request UI
  - SonarQube may enforce additional quality gates
  - Coverage trends tracked in GitLab
```

**Example Output** (No CI coverage):
```
Analysis:
CI Platform: GitHub Actions
CI file: .github/workflows/test.yml

Test job found:
  - name: Test
    run: npm test

Coverage configuration:
  - Local coverage configured (jest.config.js has thresholds)
  - No coverage command in CI
  - No coverage upload or reporting

Implications:
  - Coverage only runs locally
  - CI does not enforce coverage thresholds
  - Developers responsible for checking coverage
  - No automated coverage enforcement on PRs

Recommendation:
  Consider adding coverage enforcement to CI:
    - Add: npm run test:coverage
    - Upload to coverage service (Codecov/Coveralls)
    - Enable PR coverage comments
```

---

## Investigation Checklist

After completing coverage setup investigation, verify:

- [ ] Coverage tool identified (Jest, Vitest, coverage.py, JaCoCo, etc.)
- [ ] Configuration file location documented
- [ ] Coverage thresholds extracted (global and per-directory)
- [ ] Coverage metrics identified (lines, branches, functions, statements)
- [ ] Exclusion patterns noted (test files, generated code, etc.)
- [ ] Report formats documented (text, HTML, XML, lcov)
- [ ] CI integration status determined (blocking, non-blocking, or absent)
- [ ] Coverage service integration identified (Codecov, Coveralls, SonarQube)
- [ ] Project strictness level assessed (strict, moderate, lenient)

## Coverage Configuration Priority

When coverage configuration conflicts or is unclear:

1. **CI configuration** (highest priority) - Enforced on all PRs
2. **Local configuration thresholds** - Developers see locally
3. **Coverage service settings** - May override local thresholds
4. **Build tool defaults** - Used when not explicitly configured
5. **No enforcement** - Coverage collected but informational only

## Common Coverage Configurations

### Modern JavaScript/TypeScript (Jest)
```javascript
// jest.config.js
module.exports = {
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.test.{js,jsx,ts,tsx}',
    '!src/**/__tests__/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 85,
      statements: 85
    }
  },
  coverageReporters: ['text', 'lcov', 'html']
}
```

### Python with pytest-cov
```toml
# pyproject.toml
[tool.coverage.run]
source = ["src"]
omit = ["*/tests/*", "*/__pycache__/*"]
branch = true

[tool.coverage.report]
fail_under = 90.0
show_missing = true
exclude_lines = ["pragma: no cover", "def __repr__"]

[tool.pytest.ini_options]
addopts = "--cov=src --cov-report=html --cov-report=term-missing"
```

### Java with JaCoCo (Gradle)
```groovy
// build.gradle
jacoco {
    toolVersion = "0.8.11"
}

jacocoTestCoverageVerification {
    violationRules {
        rule {
            limit {
                counter = 'LINE'
                value = 'COVEREDRATIO'
                minimum = 0.80
            }
        }
        rule {
            limit {
                counter = 'BRANCH'
                value = 'COVEREDRATIO'
                minimum = 0.75
            }
        }
    }
}
```

## Integration with Other Protocols

**Before running tests**:
1. Run coverage setup investigation to understand requirements
2. Configure test environment to generate coverage reports
3. Ensure coverage output format matches CI expectations

**Coverage investigation informs**:
- Test execution commands (with or without coverage flags)
- Minimum test coverage requirements for new code
- Coverage report locations for verification
- CI pipeline behavior on coverage failures

This investigation ensures new tests properly integrate with existing coverage infrastructure and meet project quality standards.
