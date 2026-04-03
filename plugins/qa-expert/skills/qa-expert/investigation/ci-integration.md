# CI/CD Test Integration Investigation

## Purpose

Detect how tests are run in CI/CD pipelines to ensure test implementation aligns with continuous integration requirements, parallelization strategies, and failure handling mechanisms.

## Why This Matters

**CI/CD test execution is critical**:
- Failed tests block deployments and merges
- CI environment differs from local (different OS, resources, services)
- Parallelization affects test design (isolation, data conflicts)
- Flaky tests waste developer time and CI resources

**Test failures impact velocity**:
- Broken CI pipeline blocks all team members
- Flaky tests cause false negatives (ignored failures)
- Missing dependencies cause cryptic CI failures
- Poor test selection wastes CI minutes/hours

**Integration patterns vary widely**:
- Different CI platforms (GitHub Actions, GitLab CI, Jenkins, CircleCI, Travis CI)
- Test execution strategies (all tests, selective, matrix parallel)
- Service dependencies (databases, Redis, message queues)
- Artifact handling (screenshots, logs, coverage reports)

## Investigation Protocols

---

### Protocol 1: CI Platform Detection

**Objective**: Determine which CI/CD platform is used and locate configuration files

**Tool**: Glob -> Search for CI config files in standard locations

**Search Patterns**:
1. `.github/workflows/*.yml` / `.github/workflows/*.yaml` - GitHub Actions
2. `.gitlab-ci.yml` - GitLab CI
3. `Jenkinsfile` - Jenkins
4. `.circleci/config.yml` - CircleCI
5. `.travis.yml` - Travis CI
6. `azure-pipelines.yml` - Azure Pipelines
7. `bitbucket-pipelines.yml` - Bitbucket Pipelines

**Error Handling**:
- If Glob finds no CI config files -> Check package.json scripts for CI-related commands, then report: "No CI configuration detected. Tests may run locally only."
- If multiple CI platforms found -> Report to user: "Multiple CI platforms detected (list them). Please specify which is primary."
- If config file exists but cannot be parsed -> Report: "CI config found but malformed at (location). Manual review needed."

**Extract**:
- CI platform name
- Configuration file path(s)
- Workflow/pipeline names
- Trigger conditions (push, PR, schedule)

**Decision Tree**:
```
CI configuration found?
├─ GitHub Actions (.github/workflows/*.yml)
│   ├─ Multiple workflow files possible
│   │   ├─ test.yml - Test execution
│   │   ├─ ci.yml - Full CI pipeline
│   │   ├─ pr.yml - Pull request checks
│   │   └─ deploy.yml - Deployment (may include tests)
│   │
│   ├─ Workflow structure
│   │   ├─ name: Workflow identifier
│   │   ├─ on: Trigger events (push, pull_request, schedule)
│   │   ├─ jobs: Individual job definitions
│   │   └─ steps: Executed actions/commands
│   │
│   └─ Common patterns
│       ├─ Matrix strategy for parallel execution
│       ├─ Service containers for dependencies
│       ├─ Caching for dependencies (node_modules, pip packages)
│       └─ Artifact upload for test results
│
├─ GitLab CI (.gitlab-ci.yml)
│   ├─ Single configuration file
│   │   ├─ stages: Pipeline stages (build, test, deploy)
│   │   ├─ jobs: Named jobs with scripts
│   │   ├─ services: Service dependencies
│   │   └─ artifacts: Output preservation
│   │
│   ├─ Job structure
│   │   ├─ stage: Which stage job belongs to
│   │   ├─ script: Commands to execute
│   │   ├─ before_script: Setup commands
│   │   └─ after_script: Cleanup commands
│   │
│   └─ Common patterns
│       ├─ parallel: keyword for parallel execution
│       ├─ services: for databases, Redis, etc.
│       ├─ cache: for dependency caching
│       └─ artifacts: for test reports
│
├─ Jenkins (Jenkinsfile)
│   ├─ Declarative or Scripted pipeline
│   │   ├─ agent: Where to run
│   │   ├─ stages: Pipeline stages
│   │   ├─ steps: Commands to execute
│   │   └─ post: Post-execution actions
│   │
│   ├─ Common patterns
│   │   ├─ parallel stages for concurrent execution
│   │   ├─ docker agent for containerized tests
│   │   ├─ archiveArtifacts for result preservation
│   │   └─ junit step for test result parsing
│   │
│   └─ Environment variables
│       ├─ WORKSPACE: Jenkins workspace directory
│       ├─ BUILD_NUMBER: Build identifier
│       └─ Custom environment setup
│
├─ CircleCI (.circleci/config.yml)
│   ├─ Configuration structure
│   │   ├─ version: Config version (2.1 recommended)
│   │   ├─ jobs: Job definitions
│   │   ├─ workflows: Job orchestration
│   │   └─ executors: Reusable execution environments
│   │
│   ├─ Common patterns
│   │   ├─ parallelism: for splitting tests
│   │   ├─ docker: service containers
│   │   ├─ store_artifacts: result preservation
│   │   └─ store_test_results: JUnit XML results
│   │
│   └─ Test splitting
│       ├─ circleci tests split for intelligent distribution
│       ├─ Timing-based splitting
│       └─ File-based splitting
│
└─ Travis CI (.travis.yml)
    ├─ Configuration structure
    │   ├─ language: Programming language
    │   ├─ script: Test commands
    │   ├─ services: Background services
    │   └─ matrix: Build matrix for parallel jobs
    │
    ├─ Common patterns
    │   ├─ matrix: for multiple versions/environments
    │   ├─ services: for databases (postgresql, mysql, redis)
    │   ├─ cache: for dependency caching
    │   └─ after_success: post-test actions
    │
    └─ Lifecycle hooks
        ├─ before_install: Pre-dependency setup
        ├─ install: Dependency installation
        ├─ before_script: Pre-test setup
        ├─ script: Test execution
        └─ after_script: Cleanup
```

**Verification**:
```bash
# Search for all CI configuration files
ls -la .github/workflows/*.yml .gitlab-ci.yml Jenkinsfile .circleci/config.yml .travis.yml azure-pipelines.yml bitbucket-pipelines.yml 2>/dev/null

# Count workflows/configs found
find .github/workflows -name "*.yml" -o -name "*.yaml" 2>/dev/null | wc -l

# Check for CI mentions in package.json
grep -E '"(test:ci|ci|test-ci)"' package.json
```

**Example Output**:
```
CI Platform: GitHub Actions
Configuration files:
  - .github/workflows/ci.yml (main CI pipeline)
  - .github/workflows/test.yml (test-only workflow)
  - .github/workflows/pr-checks.yml (pull request validation)

Primary test workflow: .github/workflows/ci.yml
Trigger: push to main, pull requests to main

Decision: Investigate GitHub Actions workflows for test execution patterns
```

---

### Protocol 2: Test Execution Strategy

**Objective**: Understand how tests are executed in CI (all tests, selective, parallel, matrix)

**Tool**: Read -> CI configuration files (from Protocol 1)

**Extract**:
- Test commands executed
- Parallelization strategy (matrix, parallel jobs, test splitting)
- Test selection logic (changed files only, specific test suites)
- Test frameworks detected in commands
- Node/runtime versions tested

**Decision Tree**:
```
Test execution strategy?
├─ Sequential (all tests in single job)
│   ├─ Pattern: Single script command runs all tests
│   │   ├─ GitHub Actions: run: npm test
│   │   ├─ GitLab CI: script: pytest
│   │   └─ Simple, but slow for large suites
│   │
│   ├─ Benefits
│   │   ├─ Simple configuration
│   │   ├─ Easy to debug
│   │   └─ No test isolation issues
│   │
│   └─ Drawbacks
│       ├─ Long CI execution time
│       ├─ Slow feedback for developers
│       └─ Resource inefficient
│
├─ Matrix parallelization
│   ├─ GitHub Actions matrix strategy
│   │   ├─ Pattern:
│   │   │   strategy:
│   │   │     matrix:
│   │   │       node-version: [18, 20, 22]
│   │   │       os: [ubuntu-latest, windows-latest]
│   │   │
│   │   ├─ Creates: N x M jobs (node versions x OS)
│   │   ├─ Use: Testing multiple environments
│   │   └─ Example: 3 Node versions x 2 OS = 6 parallel jobs
│   │
│   ├─ GitLab CI parallel keyword
│   │   ├─ Pattern:
│   │   │   test:
│   │   │     parallel: 5
│   │   │     script: npm test -- --shard=${CI_NODE_INDEX}/${CI_NODE_TOTAL}
│   │   │
│   │   ├─ Creates: N identical jobs with different indices
│   │   ├─ Use: Splitting tests across runners
│   │   └─ Example: 5 parallel jobs, each runs 1/5 of tests
│   │
│   └─ CircleCI parallelism
│       ├─ Pattern:
│       │   parallelism: 10
│       │   steps:
│       │     - run: circleci tests split | xargs pytest
│       │
│       ├─ Intelligent test splitting by timing data
│       ├─ Use: Optimal test distribution
│       └─ Example: 10 containers, tests distributed by execution time
│
├─ Test splitting by type/suite
│   ├─ Separate jobs for different test types
│   │   ├─ unit-tests: Fast, isolated tests
│   │   ├─ integration-tests: Tests with external dependencies
│   │   ├─ e2e-tests: Full application tests
│   │   └─ visual-regression-tests: Screenshot comparison
│   │
│   ├─ Pattern:
│   │   jobs:
│   │     unit:
│   │       run: npm run test:unit
│   │     integration:
│   │       run: npm run test:integration
│   │     e2e:
│   │       run: npm run test:e2e
│   │
│   ├─ Benefits
│   │   ├─ Clear separation of concerns
│   │   ├─ Can skip slow tests on draft PRs
│   │   ├─ Different resource allocation per type
│   │   └─ Parallel execution of different types
│   │
│   └─ Configuration
│       ├─ Different timeout limits per type
│       ├─ Different service dependencies per type
│       └─ Different failure handling per type
│
├─ Selective test execution (changed files only)
│   ├─ Pattern: Only run tests affected by changes
│   │   ├─ Git diff-based selection
│   │   │   ├─ git diff --name-only HEAD^
│   │   │   ├─ Map changed files to test files
│   │   │   └─ Run: Only tests for changed modules
│   │   │
│   │   ├─ Jest --onlyChanged
│   │   │   ├─ npm test -- --onlyChanged
│   │   │   ├─ Uses git to find changed files
│   │   │   └─ Runs tests related to changes
│   │   │
│   │   └─ Nx affected:test (monorepos)
│   │       ├─ nx affected:test --base=main
│   │       ├─ Dependency graph analysis
│   │       └─ Runs tests for affected projects
│   │
│   ├─ Benefits
│   │   ├─ Much faster for small changes
│   │   ├─ Quick feedback in PRs
│   │   └─ Reduced CI resource usage
│   │
│   └─ Considerations
│       ├─ Must still run full suite on main branch
│       ├─ Dependency detection must be accurate
│       └─ Shared code changes trigger many tests
│
└─ Hybrid approach
    ├─ Selective on PR, full on main/merge
    │   ├─ Pull request: Changed files only
    │   ├─ Main branch: All tests
    │   └─ Schedule: Full suite nightly
    │
    ├─ Fast tests always, slow tests conditional
    │   ├─ Unit tests: Always run all
    │   ├─ Integration: Run if backend changed
    │   ├─ E2E: Run on main or manual trigger
    │   └─ Visual regression: Nightly or release
    │
    └─ Pattern:
        if: github.event_name == 'pull_request'
        run: npm test -- --onlyChanged

        if: github.ref == 'refs/heads/main'
        run: npm test
```

**Verification**:
```bash
# Check for matrix strategy (GitHub Actions)
grep -A 10 "strategy:" .github/workflows/*.yml

# Check for parallel keyword (GitLab CI)
grep -A 5 "parallel:" .gitlab-ci.yml

# Check for test splitting
grep -E "(split|shard|--onlyChanged|affected)" .github/workflows/*.yml .gitlab-ci.yml .circleci/config.yml

# Check for test type separation
grep -E "(test:unit|test:integration|test:e2e)" .github/workflows/*.yml
```

**Example Output - GitHub Actions Matrix**:
```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm test
```

**Example Output - GitLab CI Parallel**:
```yaml
# .gitlab-ci.yml
test:
  stage: test
  parallel: 4
  script:
    - npm ci
    - npm test -- --shard=${CI_NODE_INDEX}/${CI_NODE_TOTAL}
```

**Example Output - Analysis**:
```
Test Execution Strategy: Matrix parallelization

GitHub Actions configuration:
  - Matrix dimensions: node-version [18, 20, 22]
  - Total parallel jobs: 3
  - Command: npm test (runs all tests in each environment)
  - No test splitting within jobs

Decision: Tests run in parallel across Node versions
  - Each job runs full test suite
  - 3x parallelization for different Node versions
  - No selective test execution detected
  - Full test suite runs on every push and PR
```

---

### Protocol 3: Test Environment Setup

**Objective**: Detect test environment configuration including service dependencies, Docker usage, and test containers

**Tool**: Read -> CI configuration files (from Protocol 1)

**Extract**:
- Service containers (PostgreSQL, MySQL, Redis, MongoDB, Elasticsearch)
- Docker/Docker Compose usage
- Environment variables for test configuration
- Database initialization scripts
- Test data setup

**Decision Tree**:
```
Test environment setup?
├─ Service containers (CI-managed)
│   ├─ GitHub Actions services
│   │   ├─ Pattern:
│   │   │   services:
│   │   │     postgres:
│   │   │       image: postgres:15
│   │   │       env:
│   │   │         POSTGRES_PASSWORD: postgres
│   │   │       ports:
│   │   │         - 5432:5432
│   │   │       options: >-
│   │   │         --health-cmd pg_isready
│   │   │         --health-interval 10s
│   │   │
│   │   ├─ Available via: localhost:5432
│   │   ├─ Common services: postgres, mysql, redis, mongo
│   │   └─ Health checks ensure service ready before tests
│   │
│   ├─ GitLab CI services
│   │   ├─ Pattern:
│   │   │   test:
│   │   │     services:
│   │   │       - postgres:15
│   │   │       - redis:alpine
│   │   │     variables:
│   │   │       POSTGRES_DB: test_db
│   │   │       POSTGRES_USER: test_user
│   │   │
│   │   ├─ Available via: service hostname (e.g., postgres)
│   │   ├─ Automatic network linking
│   │   └─ Variables configure services
│   │
│   └─ CircleCI Docker containers
│       ├─ Pattern:
│       │   docker:
│       │     - image: cimg/node:20.0
│       │     - image: cimg/postgres:15.0
│       │       environment:
│       │         POSTGRES_USER: test_user
│       │         POSTGRES_DB: test_db
│       │
│       ├─ Primary container + service containers
│       ├─ Available via: localhost
│       └─ Environment variables in service definition
│
├─ Docker Compose for services
│   ├─ Pattern: docker-compose.test.yml file
│   │   ├─ services:
│   │   │     postgres:
│   │   │       image: postgres:15
│   │   │     redis:
│   │   │       image: redis:alpine
│   │   │     app:
│   │   │       build: .
│   │   │       depends_on: [postgres, redis]
│   │   │
│   │   └─ CI command:
│   │       docker-compose -f docker-compose.test.yml up -d
│   │       npm test
│   │       docker-compose down
│   │
│   ├─ Benefits
│   │   ├─ Matches local development environment
│   │   ├─ Complex multi-service setups
│   │   ├─ Network configuration control
│   │   └─ Volume mounting for test data
│   │
│   └─ Considerations
│       ├─ Slower startup than CI services
│       ├─ Requires Docker Compose installed
│       └─ Resource intensive
│
├─ Testcontainers (programmatic containers)
│   ├─ Pattern: Tests start containers in code
│   │   ├─ import { PostgreSqlContainer } from '@testcontainers/postgresql'
│   │   │
│   │   │   const container = await new PostgreSqlContainer().start()
│   │   │   const connectionString = container.getConnectionString()
│   │   │
│   │   ├─ Container lifecycle managed by test framework
│   │   ├─ Automatic cleanup after tests
│   │   └─ Language-specific libraries (JS, Python, Java, etc.)
│   │
│   ├─ CI requirements
│   │   ├─ Docker daemon available
│   │   ├─ Sufficient permissions
│   │   ├─ Network access for image pulls
│   │   └─ Resource limits consideration
│   │
│   └─ Detection in CI
│       ├─ No explicit service configuration in CI files
│       ├─ Check package.json: @testcontainers/* dependencies
│       ├─ Tests themselves start containers
│       └─ CI must have Docker socket access
│
├─ In-memory/embedded services
│   ├─ SQLite in-memory
│   │   ├─ Pattern: DATABASE_URL=:memory:
│   │   ├─ No external service needed
│   │   └─ Fast, but may not match production DB
│   │
│   ├─ Embedded Redis (redis-memory-server)
│   │   ├─ Pattern: npm package starts embedded Redis
│   │   ├─ No external service needed
│   │   └─ Good for unit/integration tests
│   │
│   └─ H2 Database (Java)
│       ├─ In-memory JVM database
│       ├─ Fast startup, no external dependencies
│       └─ Limited SQL compatibility
│
└─ Mock services (no real dependencies)
    ├─ Pattern: All external services mocked
    │   ├─ MSW (Mock Service Worker) for HTTP
    │   ├─ Jest mocks for database calls
    │   └─ Nock for HTTP interception
    │
    ├─ Benefits
    │   ├─ No service dependencies needed
    │   ├─ Very fast test execution
    │   ├─ Complete control over responses
    │   └─ No network issues
    │
    └─ Drawbacks
        ├─ May not catch integration issues
        ├─ Mock maintenance overhead
        └─ Less confidence in real behavior
```

**Verification**:
```bash
# Check for service containers (GitHub Actions)
grep -A 10 "services:" .github/workflows/*.yml

# Check for service containers (GitLab CI)
grep -A 5 "services:" .gitlab-ci.yml

# Check for Docker Compose usage
ls docker-compose.test.yml docker-compose.ci.yml 2>/dev/null
grep "docker-compose" .github/workflows/*.yml .gitlab-ci.yml

# Check for Testcontainers
grep "@testcontainers" package.json

# Check for environment variables
grep -E "DATABASE_URL|REDIS_URL|POSTGRES_" .github/workflows/*.yml .gitlab-ci.yml
```

**Example Output - GitHub Actions with Services**:
```yaml
# .github/workflows/ci.yml
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_pass
          POSTGRES_DB: test_db
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s

    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test
        env:
          DATABASE_URL: postgresql://test_user:test_pass@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379
```

**Example Output - Analysis**:
```
Test Environment: Service containers (GitHub Actions)

Services detected:
  - PostgreSQL 15
    - Port: 5432
    - Credentials: test_user/test_pass
    - Database: test_db
    - Health check: pg_isready (10s interval)

  - Redis (alpine)
    - Port: 6379
    - Health check: redis-cli ping (10s interval)

Environment variables:
  - DATABASE_URL: postgresql://test_user:test_pass@localhost:5432/test_db
  - REDIS_URL: redis://localhost:6379

Decision: Tests require PostgreSQL and Redis
  - Services started before tests run
  - Health checks ensure services ready
  - Tests connect via localhost
  - Standard test credentials used
```

---

### Protocol 4: Test Failure Handling

**Objective**: Understand what happens when tests fail, including retry logic, failure artifacts, and notifications

**Tool**: Read -> CI configuration files (from Protocol 1)

**Extract**:
- Retry configuration for flaky tests
- Artifact upload (screenshots, logs, videos, reports)
- Test result reporting (JUnit XML, coverage reports)
- Failure notifications (Slack, email, GitHub comments)
- Continue-on-error settings

**Decision Tree**:
```
Test failure handling?
├─ Retry logic (flaky test mitigation)
│   ├─ GitHub Actions retry action
│   │   ├─ Pattern:
│   │   │   - uses: nick-fields/retry@v2
│   │   │     with:
│   │   │       timeout_minutes: 10
│   │   │       max_attempts: 3
│   │   │       command: npm test
│   │   │
│   │   ├─ Retries entire job or specific step
│   │   ├─ Use: When flaky tests are known issue
│   │   └─ Warning: Can hide real failures
│   │
│   ├─ Test framework retry (Jest, Pytest)
│   │   ├─ Jest:
│   │   │   jest --testRetries=2
│   │   │   (retries only failed tests)
│   │   │
│   │   ├─ Pytest:
│   │   │   pytest --reruns 3 --reruns-delay 1
│   │   │   (pytest-rerunfailures plugin)
│   │   │
│   │   ├─ Playwright:
│   │   │   playwright test --retries=2
│   │   │   (built-in retry for E2E)
│   │   │
│   │   └─ More granular than job-level retry
│   │
│   └─ Retry strategy considerations
│       ├─ How many retries? (usually 1-3)
│       ├─ Delay between retries?
│       ├─ Retry all tests or only failed?
│       └─ Report flaky tests separately?
│
├─ Failure artifacts (debugging evidence)
│   ├─ GitHub Actions artifacts
│   │   ├─ Pattern:
│   │   │   - uses: actions/upload-artifact@v4
│   │   │     if: failure()
│   │   │     with:
│   │   │       name: test-results
│   │   │       path: |
│   │   │         test-results/
│   │   │         screenshots/
│   │   │         coverage/
│   │   │       retention-days: 30
│   │   │
│   │   ├─ Conditional upload: if: failure() or always()
│   │   ├─ Multiple paths supported
│   │   ├─ Compression automatic
│   │   └─ Downloadable from Actions UI
│   │
│   ├─ GitLab CI artifacts
│   │   ├─ Pattern:
│   │   │   artifacts:
│   │   │     when: on_failure
│   │   │     paths:
│   │   │       - test-results/
│   │   │       - screenshots/
│   │   │     expire_in: 1 week
│   │   │
│   │   ├─ when: on_success, on_failure, always
│   │   ├─ Expire after specified duration
│   │   └─ Browseable in GitLab UI
│   │
│   ├─ CircleCI artifacts
│   │   ├─ Pattern:
│   │   │   - store_artifacts:
│   │   │       path: test-results
│   │   │   - store_test_results:
│   │   │       path: test-results
│   │   │
│   │   ├─ store_artifacts: General files (screenshots, logs)
│   │   ├─ store_test_results: Test result XML
│   │   └─ Different retention policies
│   │
│   └─ Common artifacts
│       ├─ Screenshots (E2E test failures)
│       ├─ Videos (Playwright/Cypress recordings)
│       ├─ Logs (application, test framework)
│       ├─ Coverage reports (HTML, lcov)
│       ├─ JUnit XML (test results)
│       └─ Memory dumps (for debugging crashes)
│
├─ Test result reporting
│   ├─ JUnit XML format (universal)
│   │   ├─ Pattern: Generate XML report file
│   │   │   Jest: --reporters=default --reporters=jest-junit
│   │   │   Pytest: --junit-xml=test-results/junit.xml
│   │   │   PHPUnit: --log-junit test-results/junit.xml
│   │   │
│   │   ├─ CI platforms parse JUnit XML
│   │   ├─ Shows test counts, durations, failures
│   │   └─ Test trend analysis over time
│   │
│   ├─ GitHub Actions test reporting
│   │   ├─ Pattern:
│   │   │   - uses: dorny/test-reporter@v1
│   │   │     if: always()
│   │   │     with:
│   │   │       name: Test Results
│   │   │       path: test-results/junit.xml
│   │   │       reporter: jest-junit
│   │   │
│   │   ├─ Creates annotations on PR
│   │   ├─ Shows failed test details
│   │   └─ Links to specific failures
│   │
│   ├─ Coverage reporting
│   │   ├─ Upload to Codecov
│   │   │   - uses: codecov/codecov-action@v3
│   │   │     with:
│   │   │       files: coverage/lcov.info
│   │   │
│   │   ├─ Upload to Coveralls
│   │   │   - uses: coverallsapp/github-action@v2
│   │   │     with:
│   │   │       github-token: ${{ secrets.GITHUB_TOKEN }}
│   │   │
│   │   └─ Shows coverage trends, PR diffs
│   │
│   └─ Custom reporting dashboards
│       ├─ Allure reports
│       ├─ Mochawesome (Mocha/Cypress)
│       └─ Custom HTML reports
│
├─ Failure notifications
│   ├─ Slack notifications
│   │   ├─ Pattern:
│   │   │   - uses: 8398a7/action-slack@v3
│   │   │     if: failure()
│   │   │     with:
│   │   │       status: ${{ job.status }}
│   │   │       text: 'Tests failed on ${{ github.ref }}'
│   │   │       webhook_url: ${{ secrets.SLACK_WEBHOOK }}
│   │   │
│   │   ├─ Conditional: only on failure
│   │   ├─ Include: Branch, commit, author
│   │   └─ Link to CI run
│   │
│   ├─ GitHub PR comments
│   │   ├─ Pattern: Comment with test results
│   │   ├─ Show: Failed test names, error messages
│   │   └─ Update existing comment (avoid spam)
│   │
│   └─ Email notifications
│       ├─ Built-in CI platform emails
│       ├─ Usually configurable per user
│       └─ Can be disabled for noisy projects
│
└─ Continue-on-error (non-blocking tests)
    ├─ GitHub Actions: continue-on-error: true
    │   ├─ Pattern:
    │   │   - name: E2E Tests (Flaky)
    │   │     run: npm run test:e2e
    │   │     continue-on-error: true
    │   │
    │   ├─ Job marked as success even if step fails
    │   ├─ Use: For known flaky tests being fixed
    │   └─ Warning: Can hide important failures
    │
    ├─ GitLab CI: allow_failure: true
    │   ├─ Pattern:
    │   │   e2e-tests:
    │   │     script: npm run test:e2e
    │   │     allow_failure: true
    │   │
    │   └─ Pipeline succeeds even if job fails
    │
    └─ When to use
        ├─ Experimental test suites
        ├─ Performance tests (informational)
        ├─ Optional checks (linting warnings)
        └─ Deprecated tests being phased out
```

**Verification**:
```bash
# Check for retry logic
grep -E "(retry|reruns|testRetries)" .github/workflows/*.yml .gitlab-ci.yml package.json

# Check for artifact upload
grep -A 5 "upload-artifact\|store_artifacts\|artifacts:" .github/workflows/*.yml .gitlab-ci.yml .circleci/config.yml

# Check for test reporting
grep -E "(junit|test-results|coverage|codecov|coveralls)" .github/workflows/*.yml .gitlab-ci.yml

# Check for notifications
grep -E "(slack|email|notify)" .github/workflows/*.yml .gitlab-ci.yml

# Check for continue-on-error
grep "continue-on-error\|allow_failure" .github/workflows/*.yml .gitlab-ci.yml
```

**Example Output - GitHub Actions with Artifacts and Reporting**:
```yaml
# .github/workflows/ci.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci

      - name: Run tests
        run: npm test -- --coverage --reporters=default --reporters=jest-junit
        env:
          JEST_JUNIT_OUTPUT_DIR: test-results

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: test-results/
          retention-days: 30

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        if: always()
        with:
          files: coverage/lcov.info
          fail_ci_if_error: true

      - name: Comment PR with test results
        uses: dorny/test-reporter@v1
        if: always()
        with:
          name: Test Results
          path: test-results/junit.xml
          reporter: jest-junit
```

**Example Output - Analysis**:
```
Test Failure Handling:

Retry logic:
  - No automatic retry detected
  - Tests run once per CI execution

Failure artifacts:
  - Test results: test-results/ (JUnit XML)
  - Retention: 30 days
  - Upload condition: always() (success or failure)
  - Coverage: Uploaded to Codecov

Test reporting:
  - Format: JUnit XML (jest-junit reporter)
  - Location: test-results/junit.xml
  - PR annotations: dorny/test-reporter action
  - Coverage reporting: Codecov integration
  - Fail CI if coverage upload fails

Notifications:
  - No Slack/email notifications detected
  - PR comments via test-reporter action

Decision:
  - Implement JUnit XML output for test results
  - Save artifacts in test-results/ directory
  - No retry needed (tests are stable)
  - Coverage must be generated in lcov format
```

---

### Protocol 5: Test Performance Monitoring

**Objective**: Detect test suite performance tracking, execution time monitoring, and flaky test detection

**Tool**: Read -> CI configuration files, package.json scripts

**Extract**:
- Test execution time reporting
- Test result trends over time
- Flaky test detection tools
- Performance regression checks
- Test splitting optimization

**Decision Tree**:
```
Test performance monitoring?
├─ Execution time tracking
│   ├─ Built-in CI timing
│   │   ├─ All CI platforms track job/step duration
│   │   ├─ GitHub Actions: Visible in workflow run UI
│   │   ├─ GitLab CI: Shown in pipeline view
│   │   └─ Limited historical analysis
│   │
│   ├─ Test framework timing
│   │   ├─ Jest: --verbose shows individual test times
│   │   │   {
│   │   │     "jest": {
│   │   │       "slowTestThreshold": 5000
│   │   │     }
│   │   │   }
│   │   │
│   │   ├─ Pytest: --durations=10 shows slowest tests
│   │   │   pytest --durations=10 --durations-min=1.0
│   │   │
│   │   └─ Playwright: Built-in reporter shows timing
│   │       reporter: [['html'], ['json', { outputFile: 'results.json' }]]
│   │
│   └─ Custom timing reports
│       ├─ Parse test output for timing data
│       ├─ Generate timing charts/graphs
│       └─ Compare against previous runs
│
├─ Test result trends
│   ├─ GitHub Actions insights
│   │   ├─ Built-in: Workflow run history
│   │   ├─ Shows: Success rate, duration trends
│   │   ├─ Limited to workflow level
│   │   └─ No per-test granularity
│   │
│   ├─ Test reporting services
│   │   ├─ BuildPulse
│   │   │   ├─ Tracks test results over time
│   │   │   ├─ Identifies flaky tests automatically
│   │   │   ├─ Pattern:
│   │   │   │   - uses: buildpulse/buildpulse-action@v0.11.0
│   │   │   │     with:
│   │   │   │       account: ${{ secrets.BUILDPULSE_ACCOUNT }}
│   │   │   │       repository: ${{ secrets.BUILDPULSE_REPO }}
│   │   │   │       path: test-results/junit.xml
│   │   │   └─ Provides: Flaky test dashboard, trends
│   │   │
│   │   ├─ TestRail
│   │   │   ├─ Test case management
│   │   │   ├─ Historical test result tracking
│   │   │   └─ Manual + automated test integration
│   │   │
│   │   ├─ ReportPortal
│   │   │   ├─ Open-source test reporting
│   │   │   ├─ ML-based failure analysis
│   │   │   └─ Trend visualization
│   │   │
│   │   └─ Allure TestOps
│   │       ├─ Commercial Allure service
│   │       ├─ Test result analytics
│   │       └─ Flaky test detection
│   │
│   └─ Custom dashboards
│       ├─ Store test results in database
│       ├─ Grafana/Kibana visualization
│       └─ Custom queries and alerts
│
├─ Flaky test detection
│   ├─ Automatic flake detection
│   │   ├─ Pattern: Test passes and fails on same code
│   │   ├─ BuildPulse: ML-based flake detection
│   │   ├─ TestRail: Manual marking + statistics
│   │   └─ Custom: Track pass/fail patterns
│   │
│   ├─ Quarantine strategies
│   │   ├─ Jest: test.failing() marks known failures
│   │   │   test.failing('flaky test', () => { ... })
│   │   │
│   │   ├─ Pytest: @pytest.mark.flaky
│   │   │   @pytest.mark.flaky(reruns=3)
│   │   │   def test_flaky_feature():
│   │   │
│   │   ├─ Separate CI job for flaky tests
│   │   │   - continue-on-error: true
│   │   │   - Run flaky tests separately
│   │   │   - Don't block pipeline
│   │   │
│   │   └─ Skip entirely until fixed
│   │       test.skip('flaky, see issue #123')
│   │
│   └─ Reporting flaky tests
│       ├─ Separate flaky test report
│       ├─ GitHub issue creation for flakes
│       └─ Weekly flaky test summary
│
├─ Performance regression checks
│   ├─ Test suite duration limits
│   │   ├─ Pattern: Fail if tests take too long
│   │   │   - name: Run tests
│   │   │     run: timeout 10m npm test
│   │   │     # Fails if exceeds 10 minutes
│   │   │
│   │   ├─ Detects: Accidentally slow tests added
│   │   └─ Alert: Team to investigate slowdown
│   │
│   ├─ Individual test timeouts
│   │   ├─ Jest: testTimeout option
│   │   │   jest.setTimeout(5000)  // 5 second max per test
│   │   │
│   │   ├─ Pytest: @pytest.mark.timeout
│   │   │   @pytest.mark.timeout(5)
│   │   │   def test_should_be_fast():
│   │   │
│   │   └─ Prevents: Hanging tests blocking CI
│   │
│   ├─ Performance benchmarks
│   │   ├─ Load test benchmarks in CI
│   │   ├─ Compare against baseline
│   │   └─ Fail if performance degrades X%
│   │
│   └─ Resource usage monitoring
│       ├─ Memory usage limits
│       ├─ CPU usage tracking
│       └─ Alert on resource spikes
│
└─ Test splitting optimization
    ├─ CircleCI timing-based splitting
    │   ├─ Pattern:
    │   │   - run:
    │   │       name: Run tests
    │   │       command: |
    │   │         circleci tests glob "src/**/*.test.js" \
    │   │           | circleci tests split --split-by=timings \
    │   │           | xargs npm test --
    │   │
    │   ├─ Uses: Historical timing data
    │   ├─ Distributes: Tests evenly by execution time
    │   └─ Result: Balanced parallel execution
    │
    ├─ Jest shard splitting
    │   ├─ Pattern: --shard=1/4 (run 1 of 4 shards)
    │   │   npm test -- --shard=1/4
    │   │   npm test -- --shard=2/4
    │   │   npm test -- --shard=3/4
    │   │   npm test -- --shard=4/4
    │   │
    │   ├─ Distributes: Tests by file hash
    │   ├─ Deterministic: Same files in same shard
    │   └─ Limitation: Not balanced by execution time
    │
    └─ Manual test grouping
        ├─ Group tests by expected duration
        ├─ Fast: Unit tests (2-3 minutes)
        ├─ Medium: Integration tests (5-10 minutes)
        ├─ Slow: E2E tests (15-30 minutes)
        └─ Run groups in parallel
```

**Verification**:
```bash
# Check for timing configuration
grep -E "(timeout|duration|slowTestThreshold)" .github/workflows/*.yml .gitlab-ci.yml jest.config.js pytest.ini

# Check for test reporting services
grep -E "(buildpulse|allure|reportportal)" .github/workflows/*.yml package.json

# Check for test splitting
grep -E "(shard|split|timings)" .github/workflows/*.yml .gitlab-ci.yml .circleci/config.yml

# Check for flaky test marking
grep -r "flaky\|failing\|skip" src/__tests__ --include="*.test.*"

# Check for performance monitoring
grep -E "(benchmark|performance|memory)" .github/workflows/*.yml
```

**Example Output - CircleCI with Timing-Based Splitting**:
```yaml
# .circleci/config.yml
version: 2.1
jobs:
  test:
    parallelism: 4
    docker:
      - image: cimg/node:20.0
    steps:
      - checkout
      - run: npm ci
      - run:
          name: Run tests
          command: |
            TESTFILES=$(circleci tests glob "src/**/*.test.js" | circleci tests split --split-by=timings)
            npm test -- --findRelatedTests $TESTFILES
      - store_test_results:
          path: test-results
```

**Example Output - Analysis**:
```
Test Performance Monitoring:

Execution time tracking:
  - CircleCI built-in timing: Yes
  - Historical timing data: Used for test splitting
  - Per-test timing: Jest verbose mode (not in CI)

Test splitting:
  - Method: CircleCI timing-based split
  - Parallelism: 4 containers
  - Distribution: Balanced by historical execution time
  - Pattern: circleci tests split --split-by=timings

Test result trends:
  - Platform: CircleCI Insights (built-in)
  - Granularity: Job level
  - No external reporting service detected

Flaky test detection:
  - No automatic detection
  - No quarantine strategy
  - Manual identification required

Performance regression checks:
  - No explicit timeout limits
  - No benchmark tests detected
  - No performance monitoring

Decision:
  - Tests are optimally distributed across 4 parallel containers
  - CircleCI uses historical data for balanced splitting
  - Consider adding flaky test detection (BuildPulse)
  - Consider adding test suite timeout limits
```

---

## Investigation Checklist

After completing CI/CD test integration investigation, verify:

- [ ] CI platform identified and configuration files located
- [ ] Test execution strategy understood (parallel, sequential, selective)
- [ ] Test environment setup documented (services, containers, variables)
- [ ] Test failure handling analyzed (retries, artifacts, reporting)
- [ ] Test performance monitoring assessed (timing, trends, flaky tests)
- [ ] Service dependencies identified and configuration extracted
- [ ] Artifact upload patterns documented
- [ ] Test splitting strategy understood (if applicable)
- [ ] Retry logic documented (if configured)
- [ ] Test reporting integrations noted (coverage, results, dashboards)

## CI Integration Quick Reference

### Common CI Test Commands
```bash
# GitHub Actions
npm test
npm run test:ci
npm test -- --coverage --maxWorkers=2

# GitLab CI
npm ci && npm test
pytest --junit-xml=results.xml

# CircleCI
npm test -- $(circleci tests glob "src/**/*.test.js" | circleci tests split)
```

### Common Service Configurations
```yaml
# PostgreSQL
postgres:
  image: postgres:15
  env:
    POSTGRES_PASSWORD: postgres
  ports:
    - 5432:5432

# Redis
redis:
  image: redis:alpine
  ports:
    - 6379:6379

# MySQL
mysql:
  image: mysql:8
  env:
    MYSQL_ROOT_PASSWORD: root
  ports:
    - 3306:3306
```

### Must-Check Configurations
```
1. Test execution command
   - What command runs tests?
   - Are there multiple test types?

2. Service dependencies
   - Database required?
   - Redis/cache required?
   - External services mocked?

3. Failure artifacts
   - Are test results saved?
   - Are screenshots captured?
   - How long are artifacts retained?

4. Test distribution
   - Parallel execution?
   - Matrix strategy?
   - Test splitting?
```

## Integration with Other Protocols

**After CI/CD integration investigation**:
1. Ensure tests run successfully in detected CI environment
2. Match local test commands to CI test commands
3. Use same service versions locally as in CI
4. Generate same artifact formats (JUnit XML, coverage)

**CI/CD integration informs**:
- Test isolation requirements (for parallel execution)
- Service dependency setup in tests
- Test timeout configurations
- Artifact generation and output paths
- Environment variable usage for configuration

This investigation ensures test implementation aligns with CI/CD requirements, reducing "works locally, fails in CI" issues and optimizing test execution performance.
