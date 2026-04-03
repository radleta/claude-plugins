# Code Change Workflow Examples

This document provides workflow examples showing how to use the code-change skill for different types of changes. Examples are language-agnostic and focus on the investigation → implementation → validation process.

---

## Example 1: Feature Implementation

### Scenario
Adding user profile image upload functionality to an existing web application.

### Step 1: INVESTIGATE PROJECT

**Run Investigation Protocols:**

```
Protocol 1: Technology Stack Detection
→ Found: Web framework with backend API and frontend UI
→ Language: [Detected from package files]
→ Build system: [Detected from config files]

Protocol 2: Code Pattern Analysis
→ Found existing image upload in admin section
→ File organization: Feature-based structure
→ Naming convention: [Observed pattern]

Protocol 3: Documentation Standards
→ README: Has setup and API sections
→ CHANGELOG: Keep a Changelog format detected
→ Inline docs: [Doc style detected]

Protocol 4: Testing Standards
→ Test framework: [Detected]
→ Test location: Mirrors source structure
→ Coverage requirement: 80% (from config)

Protocol 5: Code Style
→ Linter: [Detected]
→ Formatter: [Detected]
→ Style: [Observed patterns]

Protocol 6: Version Control
→ Commit format: Conventional Commits
→ Branch naming: feature/*, bugfix/*
```

**Investigation Report:**
- Project uses feature-based organization
- Existing upload pattern found in admin module
- Follow discovered patterns for consistency
- Tests required with 80% coverage
- Documentation must be updated (README + CHANGELOG)

### Step 2: PLAN CHANGES

**Changes Needed:**
1. Backend: Add upload endpoint following existing pattern
2. Backend: Add validation (file type, size limits)
3. Frontend: Add upload component with preview
4. Tests: Unit tests for validation, upload handling
5. Tests: Integration tests for full flow
6. Docs: Update README with new endpoint
7. Docs: Add CHANGELOG entry

**Pattern Following:**
- Use same file structure as admin upload
- Match existing validation approach
- Follow component naming conventions
- Use same error handling patterns

### Step 3: IMPLEMENT CHANGES

**Using Code Quality Checklist:**

**Backend Changes:**
- [✓] Add upload endpoint
  - Follow REST naming from investigation
  - Use existing middleware pattern
  - Implement validation (file type, size)
  - Add error handling matching project style
  - Add inline documentation
  - No hardcoded values (use config)

**Frontend Changes:**
- [✓] Add upload component
  - Follow component structure from investigation
  - Match naming conventions
  - Add preview functionality
  - Handle loading and error states
  - Add user-friendly error messages

**Apply Quality Checklist:**
- [✓] DRY: Reuse existing upload utilities
- [✓] YAGNI: Only add requested functionality
- [✓] SOLID: Single responsibility per function
- [✓] Security: Validate file types, limit sizes
- [✓] Performance: Async operations, don't block
- [✓] Error handling: Descriptive messages
- [✓] Naming: Descriptive, follows conventions

### Step 4: CREATE/UPDATE TESTS

**Using Testing Checklist:**

**Unit Tests Written:**
- [✓] Validation logic tested
  - Valid file types accepted
  - Invalid file types rejected
  - Size limits enforced
  - Edge cases covered (empty, null, huge files)

- [✓] Upload handling tested
  - Successful upload path
  - Error scenarios
  - Storage integration
  - Response format

**Integration Tests Written:**
- [✓] End-to-end upload flow
- [✓] Authentication requirements
- [✓] Error response formats

**Test Execution:**
- [✓] All tests pass locally
- [✓] Coverage meets 80% requirement
- [✓] No flaky tests

### Step 5: UPDATE DOCUMENTATION

**Using Documentation Checklist:**

**README Updates:**
```markdown
### Profile Images
Users can upload profile images.

**Supported formats:** JPG, PNG, GIF
**Maximum size:** 5MB

**API Endpoint:**
POST /api/users/{id}/profile-image
```

**Inline Documentation:**
- [✓] Function docstrings added
- [✓] Parameters documented
- [✓] Return values documented
- [✓] Error conditions documented

**CHANGELOG Entry:**
```markdown
### [Unreleased]

#### Added
- User profile image upload functionality [#245]
- Image format and size validation
- Upload preview in profile editor
```

### Step 6: VALIDATE CHANGES

**Using Post-Change Validation Checklist:**

**Build & Compilation:**
- [✓] Code compiles/builds successfully
- [✓] No new warnings introduced

**Testing:**
- [✓] All tests pass (unit + integration)
- [✓] Coverage maintained at 80%

**Code Quality:**
- [✓] Linter passes
- [✓] Formatter applied
- [✓] No unused code

**Documentation:**
- [✓] README updated
- [✓] CHANGELOG updated
- [✓] Inline docs complete

**Version Control:**
- [✓] Commit message follows convention
- [✓] Branch up to date
- [✓] Ready for code review

**Commit Message:**
```
feat(profile): add user profile image upload

Implement profile image upload with format and size validation.
Includes preview functionality and comprehensive error handling.

- Add upload endpoint with validation
- Add upload component with preview
- Add comprehensive tests (80% coverage maintained)
- Update README and CHANGELOG

Refs: #245
```

---

## Example 2: Bug Fix

### Scenario
Application crashes when processing API responses with missing data fields.

### Investigation Summary
- Issue occurs in response processing layer
- Project uses null-safe patterns in other modules
- Tests exist but don't cover null scenarios
- Project follows issue-first commit format

### Workflow

**1. INVESTIGATE:**
- Located the problematic code
- Identified pattern used elsewhere for null safety
- Reviewed existing test structure

**2. PLAN:**
- Add null checks following project pattern
- Add logging for debugging
- Add tests for all null scenarios
- Update documentation if API contract unclear

**3. IMPLEMENT:**
- Add null checks at each level
- Use same error handling as similar code
- Add descriptive error messages
- Add inline comments explaining checks

**Code Quality Applied:**
- [✓] Defensive programming
- [✓] Consistent with existing code
- [✓] Proper error handling
- [✓] No silent failures
- [✓] Logging for troubleshooting

**4. TEST:**
- Test with null at each level
- Test with partial data
- Test with complete data (regression)
- Ensure error messages are helpful

**5. DOCUMENT:**
- Add inline comments explaining null checks
- Update CHANGELOG with fix

**6. VALIDATE:**
- All tests pass
- No new warnings
- Original issue resolved
- No regressions introduced

**CHANGELOG Entry:**
```markdown
### Fixed
- Fixed crash when processing API responses with missing data [#567]
```

**Commit Message:**
```
#567: Fix null pointer in API response processing

Add null checks at each level of response processing to prevent
crashes when API returns incomplete data.

Added comprehensive tests for null scenarios.
```

---

## Example 3: Refactoring

### Scenario
Refactoring service class to use dependency injection instead of singletons for better testability.

### Investigation Summary
- Other services already use dependency injection
- Project has dependency container pattern
- Tests use mocking framework

### Workflow

**1. INVESTIGATE:**
- Found existing DI pattern in similar services
- Reviewed dependency container usage
- Checked test mocking approach

**2. PLAN:**
- Convert singleton to constructor injection
- Match pattern from other services
- Update dependency container
- Update all tests to use mocks

**3. IMPLEMENT:**
- Refactor constructor to accept dependencies
- Remove singleton logic
- Add to dependency container
- Follow interface pattern from investigation

**Code Quality Applied:**
- [✓] Single Responsibility maintained
- [✓] Dependency Inversion principle applied
- [✓] Consistent with project architecture
- [✓] No behavior changes

**4. TEST:**
- Update all tests to use mocks
- Verify all tests still pass
- Confirm easier to test now
- No behavior changes

**5. DOCUMENT:**
- Update inline docs
- Add CHANGELOG entry
- No README changes (internal refactoring)

**6. VALIDATE:**
- All tests pass
- No behavior changes
- Code follows project patterns
- More maintainable

**CHANGELOG Entry:**
```markdown
### Changed
- Refactored UserService to use dependency injection [#789]
```

**Commit Message:**
```
refactor(services): migrate UserService to dependency injection

Replace singleton pattern with constructor injection following
established pattern in other services. Improves testability.

No behavior changes. All existing tests pass.

Refs: #789
```

---

## Example 4: Documentation Update

### Scenario
Previously internal API endpoints are now public and need documentation.

### Investigation Summary
- Project has API documentation in specific format
- Uses standard documentation tool
- Has examples for other endpoints

### Workflow

**1. INVESTIGATE:**
- Located API documentation files
- Reviewed format of existing endpoint docs
- Checked if documentation builds automatically

**2. PLAN:**
- Add endpoint documentation following format
- Include request/response examples
- Document authentication requirements
- Add usage examples to README

**3. IMPLEMENT:**
- Write endpoint documentation
- Follow format from investigation
- Add clear examples
- Include error scenarios

**Documentation Quality Applied:**
- [✓] Clear and user-focused
- [✓] Includes examples
- [✓] Documents errors
- [✓] Follows project format

**4. TEST:**
- Build documentation (verify no errors)
- Test code examples
- Verify links work

**5. DOCUMENT:**
- Add to main API documentation
- Update README with new endpoints
- Add CHANGELOG entry

**6. VALIDATE:**
- Documentation builds correctly
- Examples are accurate
- Links work
- Follows project standards

**CHANGELOG Entry:**
```markdown
### Added
- API documentation for analytics endpoints [#456]
```

---

## Example 5: Breaking Change

### Scenario
Changing API response format to include pagination metadata (breaks existing clients).

### Investigation Summary
- Project uses API versioning (v1, v2, etc.)
- Has migration guide template
- Deprecation policy: 6 months notice

### Workflow

**1. INVESTIGATE:**
- Reviewed API versioning strategy
- Found migration guide examples
- Checked deprecation policy

**2. PLAN:**
- Create new API version (v2)
- Keep v1 working (deprecated)
- Create migration guide
- Document breaking change clearly
- Set deprecation timeline

**3. IMPLEMENT:**
- Add v2 endpoint with new format
- Keep v1 endpoint (add deprecation warning)
- Follow versioning pattern from investigation

**4. TEST:**
- Test both v1 and v2
- Verify v1 still works
- Test new v2 functionality
- Test error scenarios

**5. DOCUMENT:**
- Create migration guide
- Update README with both versions
- Add BREAKING CHANGE to CHANGELOG
- Document deprecation timeline
- Provide migration examples

**6. VALIDATE:**
- Both versions work
- Migration guide is clear
- Breaking change is documented
- Deprecation timeline set

**CHANGELOG Entry:**
```markdown
### [2.0.0]

#### Changed
- **BREAKING:** API response format now includes pagination metadata [#123]
  - See Migration Guide for upgrade instructions

#### Deprecated
- API v1 will be removed in v3.0.0 (June 2026) [#123]
```

**Migration Guide:**
```markdown
## Migrating from v1 to v2

### Response Format Change

**Old (v1):** Returns array directly
**New (v2):** Returns object with data and pagination

### Migration Steps:
1. Update API base URL
2. Access response.data instead of response
3. Use response.pagination for pagination UI
```

---

## Example 6: Security Fix

### Scenario
Input validation vulnerability allows injection attacks.

### Investigation Summary
- Project has established input validation patterns
- Security team provided vulnerability details
- Has security section in CHANGELOG

### Workflow

**1. INVESTIGATE:**
- Reviewed existing validation patterns
- Located vulnerable code
- Identified secure alternative from codebase

**2. PLAN:**
- Replace unsafe input handling
- Use project's validation utilities
- Add tests for attack scenarios
- Document security fix

**3. IMPLEMENT:**
- Apply proper input validation
- Use parameterized queries/prepared statements
- Follow secure pattern from investigation
- Add security logging

**Security Quality Applied:**
- [✓] Input validation
- [✓] Use safe APIs
- [✓] No string concatenation for queries
- [✓] Proper escaping/encoding
- [✓] Security logging

**4. TEST:**
- Test with malicious input
- Test with special characters
- Test normal functionality
- Verify attack is prevented

**5. DOCUMENT:**
- Add security advisory (internal)
- Update CHANGELOG (Security section)
- Document CVE if assigned

**6. VALIDATE:**
- Vulnerability fixed
- No regressions
- Tests prevent future issues
- Security team notified

**CHANGELOG Entry:**
```markdown
### Security
- Fixed input validation vulnerability [CVE-2025-12345]
  - All users should upgrade immediately
```

**Commit Message:**
```
fix(security): prevent injection in search endpoint

SECURITY FIX: Replace unsafe input handling with proper validation.

Severity: HIGH
CVE: CVE-2025-12345

Added tests to verify malicious input is properly handled.
All users should upgrade immediately.
```

---

## Key Workflow Patterns

### Pattern 1: Investigation Always First
Every example starts with investigation:
- Understand the project context
- Find existing patterns
- Identify conventions to follow
- Locate similar code for reference

### Pattern 2: Checklist-Driven Development
Each phase uses relevant checklists:
- Code Quality checklist during implementation
- Testing checklist when writing tests
- Documentation checklist for docs
- Validation checklist before completion

### Pattern 3: Project-Aware Changes
Changes adapt to discovered patterns:
- Follow existing file organization
- Match naming conventions
- Use same testing approach
- Follow documentation format
- Use project's commit format

### Pattern 4: Nothing Forgotten
Comprehensive coverage ensures:
- Tests are written (not optional)
- Documentation is updated (always)
- CHANGELOG is maintained (every change)
- All quality checks pass (required)

### Pattern 5: Validation Before Completion
Final validation catches issues:
- Build/compile successful
- All tests pass
- Linter passes
- Documentation complete
- Ready for review

---

## Usage Notes

These examples demonstrate **the process and workflow**, not specific code implementations. The actual code will vary based on:

- **Language:** Python, JavaScript, Java, Go, Ruby, etc.
- **Framework:** React, Django, Spring, Rails, etc.
- **Project conventions:** Naming, structure, testing approach
- **Team standards:** Commit format, documentation style

**The investigation phase ensures you adapt to each project's specific requirements.**

### When Using These Examples

1. **Focus on the workflow** - Investigation → Plan → Implement → Test → Document → Validate
2. **Use the checklists** - They're the real value, not the code snippets
3. **Adapt to your project** - Investigation reveals what patterns to follow
4. **Nothing is optional** - Tests, docs, and CHANGELOG are always required

### Success Pattern

```
1. Run investigation protocols (understand context)
2. Plan following discovered patterns
3. Implement with quality checklist
4. Write comprehensive tests
5. Update all documentation
6. Validate everything passes
7. Commit with proper message
```

**Follow this pattern for every code change, regardless of language or framework.**
