# Detailed Checklists for Code-Change Skill

This document provides the complete, detailed checklists that will be included in the CHECKLISTS.md file of the code-change skill.

---

## 1. Pre-Change Investigation Checklist

**Purpose:** Understand the project context before making any changes

### Project Structure Investigation
- [ ] **Identify project type** - Is this a web app, library, API, CLI tool, etc.?
- [ ] **Detect primary language** - Python, JavaScript/TypeScript, Java, C#, Go, etc.
- [ ] **Identify framework** - React, Vue, Angular, Django, Express, Spring Boot, etc.
- [ ] **Locate configuration files** - package.json, requirements.txt, pom.xml, .csproj, go.mod
- [ ] **Check project version** - What version is the project currently at?

### Existing Patterns Analysis
- [ ] **Search for similar functionality** - Are there examples of this type of change in the codebase?
- [ ] **Review file organization** - Where do similar files live in the project structure?
- [ ] **Check naming conventions** - Files: kebab-case, PascalCase, snake_case?
- [ ] **Check naming conventions** - Functions: camelCase, snake_case, PascalCase?
- [ ] **Check naming conventions** - Variables: camelCase, snake_case, SCREAMING_SNAKE_CASE for constants?
- [ ] **Identify architectural patterns** - MVC, MVVM, layered architecture, microservices, etc.
- [ ] **Review state management** - Redux, Context API, Vuex, NgRx, etc. (if applicable)
- [ ] **Review API patterns** - REST, GraphQL, RPC, etc. (if applicable)

### Documentation Standards
- [ ] **Locate README** - Is there a README.md? What information does it contain?
- [ ] **Find CHANGELOG** - CHANGELOG.md, CHANGELOG.txt, or releases page? What format?
- [ ] **Check for CONTRIBUTING.md** - Are there contribution guidelines?
- [ ] **Locate documentation directory** - docs/, documentation/, wiki/?
- [ ] **Check inline comment patterns** - JSDoc, docstrings, Javadoc, XML docs?
- [ ] **Identify documentation generator** - Sphinx, JSDoc, TypeDoc, Javadoc, Docusaurus, etc.
- [ ] **Review existing documentation examples** - How are features documented?

### Testing Standards
- [ ] **Locate test directories** - test/, tests/, __tests__/, spec/, etc.?
- [ ] **Identify testing framework** - Jest, Mocha, Pytest, JUnit, NUnit, Go test, etc.
- [ ] **Check test file naming** - *.test.js, *.spec.ts, *_test.py, Test*.java?
- [ ] **Review test organization** - Mirrors src/ structure or separate organization?
- [ ] **Check test coverage config** - jest.config.js, .coveragerc, coverage thresholds?
- [ ] **Identify CI/CD testing** - GitHub Actions, GitLab CI, Jenkins, CircleCI workflows?
- [ ] **Review existing tests** - What do typical tests look like in this project?
- [ ] **Check mocking patterns** - How are dependencies mocked in tests?

### Code Style & Quality
- [ ] **Find linter config** - .eslintrc, .pylintrc, .rubocop.yml, etc.
- [ ] **Find formatter config** - .prettierrc, .editorconfig, black config, gofmt, etc.
- [ ] **Check for pre-commit hooks** - .git/hooks/, husky, pre-commit framework?
- [ ] **Review existing code style** - How is existing code formatted?
- [ ] **Check import organization** - Are imports grouped/ordered in a specific way?
- [ ] **Identify type checking** - TypeScript, mypy, Flow, PropTypes, etc.
- [ ] **Check for style guide docs** - STYLE.md, docs/style-guide.md, etc.

### Version Control Conventions
- [ ] **Review recent commits** - What format do commit messages follow?
- [ ] **Check for commit conventions** - Conventional Commits, issue-first, other?
- [ ] **Review branch naming** - feature/*, bugfix/*, hotfix/*, etc.?
- [ ] **Check PR templates** - .github/pull_request_template.md?
- [ ] **Review recent PRs** - What information do PR descriptions typically include?

---

## 2. Code Quality Checklist

**Purpose:** Ensure the code change meets quality standards

### Design Principles
- [ ] **DRY (Don't Repeat Yourself)** - Is there any unnecessary code duplication?
- [ ] **YAGNI (You Aren't Gonna Need It)** - Is this solving the actual problem without over-engineering?
- [ ] **KISS (Keep It Simple, Stupid)** - Is this the simplest solution that works?
- [ ] **Single Responsibility** - Does each function/class have one clear purpose?
- [ ] **Open/Closed Principle** - Can behavior be extended without modification?
- [ ] **Liskov Substitution** - Can subtypes substitute for their base types?
- [ ] **Interface Segregation** - Are interfaces/contracts minimal and focused?
- [ ] **Dependency Inversion** - Do modules depend on abstractions, not concretions?

### Naming & Readability
- [ ] **Variable names are descriptive** - No single letters (except loop counters in obvious contexts)
- [ ] **Function names are action-oriented** - Verbs for functions: `calculateTotal()`, `fetchUserData()`
- [ ] **Class names are noun-based** - `UserService`, `PaymentProcessor`, `DataValidator`
- [ ] **Constants are clear** - UPPER_SNAKE_CASE with descriptive names
- [ ] **Boolean naming is clear** - `isValid`, `hasPermission`, `canEdit` (avoid negatives like `notValid`)
- [ ] **Abbreviations avoided** - Use `configuration` not `cfg` (unless project convention)
- [ ] **Consistency with codebase** - Follows existing naming patterns in the project

### Code Structure
- [ ] **Functions are small** - Ideally < 50 lines, definitely < 100 lines
- [ ] **Functions do one thing** - Each function has a single, clear purpose
- [ ] **Proper abstraction levels** - Don't mix high-level and low-level operations in one function
- [ ] **Limited nesting** - Avoid deep nesting (> 3-4 levels), use early returns
- [ ] **Magic numbers eliminated** - Use named constants instead of hard-coded values
- [ ] **Proper separation of concerns** - Business logic, data access, presentation are separated
- [ ] **Cohesion is high** - Related code is grouped together
- [ ] **Coupling is low** - Modules/classes have minimal dependencies on each other

### Error Handling
- [ ] **Errors are handled appropriately** - No swallowed exceptions
- [ ] **Error messages are descriptive** - Include context about what went wrong
- [ ] **Proper exception types** - Use specific exceptions, not generic ones
- [ ] **Resource cleanup** - Using try/finally, context managers, defer, RAII, etc.
- [ ] **Graceful degradation** - Application doesn't crash on expected error cases
- [ ] **Logged appropriately** - Errors are logged with sufficient context
- [ ] **User-facing errors are friendly** - No technical stack traces to end users

### Security Considerations
- [ ] **Input validation** - All user input is validated before use
- [ ] **SQL injection prevented** - Using parameterized queries, ORMs correctly
- [ ] **XSS prevented** - Output is properly escaped/sanitized
- [ ] **Authentication checked** - Protected endpoints verify authentication
- [ ] **Authorization enforced** - Users can only access their permitted resources
- [ ] **Secrets not hardcoded** - API keys, passwords, etc. use environment variables/secrets management
- [ ] **Dependencies are safe** - No known vulnerabilities in dependencies
- [ ] **HTTPS enforced** - Sensitive data only transmitted over secure connections (if applicable)
- [ ] **Rate limiting considered** - APIs have rate limiting (if applicable)

### Performance Considerations
- [ ] **No obvious performance issues** - No unnecessary loops, redundant calculations
- [ ] **Database queries optimized** - Avoid N+1 queries, use appropriate indexes
- [ ] **Caching considered** - Expensive operations are cached when appropriate
- [ ] **Resource usage reasonable** - Memory leaks prevented, resources released
- [ ] **Async operations used appropriately** - Long-running operations don't block
- [ ] **Pagination implemented** - Large datasets use pagination/lazy loading
- [ ] **Bundle size considered** - Frontend code doesn't add excessive bundle weight (if applicable)

### Code Comments
- [ ] **Complex logic explained** - Non-obvious code has comments explaining WHY
- [ ] **Public APIs documented** - Functions/classes intended for use by others are documented
- [ ] **Output completeness verified** - Load the completeness-expert skill for banned patterns and cross-check protocol. No truncation patterns, no deferred work, no placeholder code.
- [ ] **Comments are current** - No outdated comments that don't match code
- [ ] **No commented-out code** - Removed, not commented (use version control instead)
- [ ] **Comments add value** - Don't state the obvious: `// increment i` is useless

### Code Style Compliance
- [ ] **Linter passes** - No linting errors
- [ ] **Formatter applied** - Code is properly formatted
- [ ] **Imports organized** - Following project conventions
- [ ] **No unused imports** - Removed dead imports
- [ ] **No unused variables** - Removed dead code
- [ ] **Type annotations added** - If using TypeScript, Python type hints, etc.
- [ ] **Follows project conventions** - Matches style of surrounding code

---

## 3. Testing Checklist

**Purpose:** Ensure comprehensive test coverage for the changes

### Unit Tests
- [ ] **New functions tested** - Every new function has unit tests
- [ ] **Modified functions tested** - Updated tests for modified functionality
- [ ] **Happy path tested** - Normal, expected inputs work correctly
- [ ] **Edge cases tested** - Boundary conditions handled correctly
- [ ] **Error cases tested** - Invalid inputs handled appropriately
- [ ] **Null/undefined handled** - Tests verify null/undefined scenarios (if applicable)
- [ ] **Empty collections handled** - Tests verify empty array/list behavior (if applicable)
- [ ] **Zero/negative numbers tested** - Numerical edge cases covered (if applicable)

### Test Quality
- [ ] **Tests are isolated** - Each test is independent, order doesn't matter
- [ ] **Tests are deterministic** - Same test always produces same result
- [ ] **Tests are fast** - Unit tests run in milliseconds, not seconds
- [ ] **Tests have clear names** - Test name describes what is being tested
- [ ] **One assertion per test** - Or at least, one logical concept per test
- [ ] **Assertions are specific** - Use specific matchers, not just `toBeTruthy()`
- [ ] **Mocks used appropriately** - External dependencies are mocked
- [ ] **Test data is clear** - Setup data is obvious and minimal

### Integration Tests
- [ ] **Component integration tested** - If multiple units work together, test the integration
- [ ] **API endpoints tested** - If changes affect APIs, test the endpoints (if applicable)
- [ ] **Database interactions tested** - If changes affect data layer, test with test DB (if applicable)
- [ ] **External services mocked** - Third-party APIs are mocked/stubbed in tests
- [ ] **Authentication flows tested** - Login, logout, permissions tested (if applicable)
- [ ] **Error handling integration** - End-to-end error flows tested

### Test Coverage
- [ ] **Coverage meets project standards** - Check project's coverage thresholds
- [ ] **New code is covered** - All new code paths have tests
- [ ] **Critical paths have high coverage** - Core business logic is thoroughly tested
- [ ] **Coverage report reviewed** - Actually look at what's covered/uncovered

### Testing Execution
- [ ] **All tests pass locally** - Full test suite runs successfully
- [ ] **No flaky tests** - Tests pass consistently (run 3+ times)
- [ ] **No skipped tests** - All tests are enabled and running
- [ ] **No warnings in test output** - Test runs cleanly
- [ ] **Tests run in CI** - CI pipeline includes test execution

### Test Documentation
- [ ] **Complex test scenarios explained** - Non-obvious test logic has comments
- [ ] **Test fixtures documented** - Shared test data is explained
- [ ] **Test utilities documented** - Helper functions have clear purpose

---

## 4. Documentation Checklist

**Purpose:** Keep all documentation current and accurate

### Inline Documentation
- [ ] **Public functions documented** - Exported/public APIs have docstrings/JSDoc/etc.
- [ ] **Parameters documented** - Each parameter's type, purpose, constraints
- [ ] **Return values documented** - What the function returns, including null/undefined cases
- [ ] **Exceptions documented** - What errors might be thrown and when
- [ ] **Complex logic commented** - Non-obvious code has explanatory comments
- [ ] **Examples included** - For non-trivial APIs, include usage examples in docstrings
- [ ] **Type annotations present** - TypeScript types, Python type hints, etc. (if applicable)

### README Updates
- [ ] **Setup instructions current** - If installation steps changed, README updated
- [ ] **Usage examples current** - If public API changed, examples updated
- [ ] **Configuration documented** - New config options added to README
- [ ] **Breaking changes noted** - If breaking changes, migration guide in README
- [ ] **Prerequisites updated** - If dependencies changed, prerequisites section updated
- [ ] **Troubleshooting updated** - Common issues documented (if applicable)
- [ ] **Screenshots/GIFs updated** - Visual documentation reflects current state (if applicable)

### API Documentation
- [ ] **New endpoints documented** - For APIs, new endpoints in documentation (if applicable)
- [ ] **Request/response formats** - Parameters, body, response structure documented
- [ ] **Authentication requirements** - What auth is needed for endpoints
- [ ] **Error responses documented** - What errors can be returned and why
- [ ] **Rate limits documented** - If rate limiting exists, document it
- [ ] **OpenAPI/Swagger updated** - API spec files are current (if applicable)

### Architectural Documentation
- [ ] **Architecture diagrams updated** - If structure changed significantly (if applicable)
- [ ] **Decision records added** - Document significant architectural decisions (ADR if used)
- [ ] **System overview current** - High-level docs reflect current architecture
- [ ] **Data models documented** - Database schema, data structures documented
- [ ] **Integration points documented** - External services, APIs documented

### Other Documentation
- [ ] **CONTRIBUTING.md updated** - If dev workflow changed (if applicable)
- [ ] **Migration guides added** - For breaking changes, how to migrate
- [ ] **Deprecation notices added** - If deprecating features, document timeline
- [ ] **Security docs updated** - If security model changed (if applicable)
- [ ] **Performance docs updated** - If performance characteristics changed (if applicable)

### Documentation Quality
- [ ] **Documentation builds/renders** - If using doc generator, it builds without errors
- [ ] **Links are valid** - No broken links in documentation
- [ ] **Code examples work** - Copy-pasteable code examples actually run
- [ ] **Documentation is clear** - Written for the target audience
- [ ] **Spelling/grammar checked** - Professional writing quality
- [ ] **Outdated docs removed** - Old, incorrect information deleted

---

## 5. CHANGELOG Checklist

**Purpose:** Maintain accurate version history for users

### CHANGELOG Location
- [ ] **CHANGELOG file exists** - CHANGELOG.md, CHANGELOG.txt, or releases page
- [ ] **Correct version section** - Entry added to appropriate version (Unreleased, next version, etc.)

### CHANGELOG Entry Content
- [ ] **Change type identified** - Is this Added, Changed, Fixed, Deprecated, Removed, or Security?
- [ ] **Description is user-focused** - Written for users, not developers
- [ ] **Description is clear** - What changed and what's the user impact?
- [ ] **Breaking changes highlighted** - BREAKING CHANGE label or section
- [ ] **Migration info provided** - For breaking changes, how to adapt
- [ ] **Issue/PR referenced** - Link to related issue or PR number

### CHANGELOG Entry Format Examples

**Added** - New features:
```
- Added dark mode toggle to user settings [#123]
- Added CSV export for transaction history [#456]
```

**Changed** - Changes to existing functionality:
```
- Changed API rate limit from 100 to 1000 requests per hour [#789]
- Improved performance of search results by 50% [#234]
```

**Fixed** - Bug fixes:
```
- Fixed crash when uploading files larger than 10MB [#567]
- Fixed incorrect calculation in tax estimation [#890]
```

**Deprecated** - Soon-to-be removed features:
```
- Deprecated /api/v1/users endpoint, use /api/v2/users instead [#123]
  (Will be removed in v3.0.0)
```

**Removed** - Removed features:
```
- Removed legacy authentication system (deprecated in v2.0.0) [#456]
```

**Security** - Security fixes:
```
- Fixed SQL injection vulnerability in search endpoint [CVE-2025-12345]
```

### CHANGELOG Format Compliance
- [ ] **Follows project format** - Keep a Changelog, Conventional, or custom format
- [ ] **Date added if applicable** - Some formats include dates: "## [1.2.3] - 2025-10-24"
- [ ] **Version number correct** - Follows semantic versioning if applicable
- [ ] **Grouped by type** - All Added together, all Fixed together, etc.

### CHANGELOG Completeness
- [ ] **All user-facing changes included** - Nothing significant missing
- [ ] **Internal changes excluded** - Refactorings, test changes typically not in CHANGELOG
- [ ] **Link to comparison** - Link to git diff/compare (if project uses this pattern)

---

## 6. Post-Change Validation Checklist

**Purpose:** Final checks before considering work complete

### Build & Compilation
- [ ] **Code compiles/builds** - No build errors
- [ ] **Build process completes** - Webpack, Maven, Make, etc. succeeds
- [ ] **No new build warnings** - Warning count hasn't increased
- [ ] **Dependencies resolve** - npm install, pip install, etc. works
- [ ] **Type checking passes** - TypeScript tsc, mypy, etc. passes (if applicable)

### Testing Validation
- [ ] **All tests pass** - Full test suite is green
- [ ] **Test coverage maintained** - Coverage didn't decrease
- [ ] **Integration tests pass** - Higher-level tests succeed
- [ ] **E2E tests pass** - If project has E2E tests, they pass (if applicable)
- [ ] **Performance tests pass** - If applicable, perf tests pass

### Code Quality Validation
- [ ] **Linter passes** - eslint, pylint, rubocop, etc. passes
- [ ] **Formatter applied** - prettier, black, gofmt, etc. applied
- [ ] **Type checker passes** - No type errors (if applicable)
- [ ] **Security scanner passes** - No new vulnerabilities (if run)
- [ ] **Code review checklist satisfied** - All quality checks met

### Documentation Validation
- [ ] **Documentation builds** - Docs generate without errors
- [ ] **Documentation renders correctly** - Check actual output
- [ ] **README still makes sense** - Read through README to verify
- [ ] **Examples still work** - Test any code examples provided
- [ ] **Links work** - No broken internal or external links

### Version Control Validation
- [ ] **Branch is up to date** - Merged latest from main/master
- [ ] **Conflicts resolved** - No merge conflicts
- [ ] **Commit message follows conventions** - Conventional Commits, etc.
- [ ] **No debug code** - console.log, print(), debugger statements removed
- [ ] **No sensitive data** - No API keys, passwords committed
- [ ] **Git hooks pass** - Pre-commit hooks succeed

### Change Scope Validation
- [ ] **Changes match intent** - Only changed what was needed
- [ ] **No unrelated changes** - No "while I'm here" additions
- [ ] **Change is focused** - PR is reviewable size (< 400 lines ideally)
- [ ] **Breaking changes justified** - If breaking, is it necessary?

### Final Checklist
- [ ] **Pre-change investigation** - Was project context researched?
- [ ] **Code quality checklist** - Did code meet quality standards?
- [ ] **Testing checklist** - Are tests comprehensive?
- [ ] **Documentation checklist** - Is documentation complete?
- [ ] **CHANGELOG checklist** - Is CHANGELOG updated?
- [ ] **Ready for review** - Is this ready for team review?

---

## Checklist Usage Notes

### How to Use These Checklists

1. **Pre-Change Investigation** - ALWAYS run this FIRST before making changes
2. **Code Quality** - Reference during and after coding
3. **Testing** - Use when writing tests
4. **Documentation** - Use when updating docs
5. **CHANGELOG** - Use when updating CHANGELOG
6. **Post-Change Validation** - Run LAST before submitting PR/review

### Customization

Projects may have specific requirements. The skill should:
- Use these as a baseline
- Adapt based on project investigation findings
- Add project-specific items when discovered
- Remove items that don't apply to the project type

### Judgment

Not every item applies to every change:
- Bug fix might not need CHANGELOG entry if very minor
- Internal refactoring might not need README updates
- Use professional judgment
- When in doubt, err on the side of completeness

---

**These checklists ensure every code change is high quality, well-tested, and properly documented.**
