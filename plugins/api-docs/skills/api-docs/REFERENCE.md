# API Documentation Reference

Comprehensive checklists, standards, and best practices for API documentation.

## Pre-Documentation Checklist

Before starting API documentation, ensure you have:

- [ ] Access to OpenAPI/Swagger specification (or ability to create one)
- [ ] Working API endpoints to test
- [ ] API key or authentication credentials for testing
- [ ] Access to source code or technical specifications
- [ ] Contact with API developers for clarifications
- [ ] List of supported programming languages for code examples
- [ ] Documentation platform/tool decided (Swagger UI, Redoc, Readme.io, etc.)
- [ ] Style guide and terminology glossary (or authority to create one)

## API Reference Documentation Checklist

For each endpoint, verify:

### Endpoint Basics
- [ ] Full URL path with base URL
- [ ] HTTP method (GET, POST, PUT, DELETE, PATCH)
- [ ] Endpoint description (1-2 sentences)
- [ ] Authentication requirements specified
- [ ] Required scopes/permissions listed

### Request Documentation
- [ ] All path parameters documented (type, description, example)
- [ ] All query parameters documented (type, required/optional, default, constraints)
- [ ] All request headers documented (especially custom headers)
- [ ] Request body schema documented (for POST/PUT/PATCH)
- [ ] Request content type specified (application/json, multipart/form-data, etc.)
- [ ] Field validation rules documented (min/max, regex, enum values)
- [ ] Example request provided

### Response Documentation
- [ ] Success response status code (200, 201, 204)
- [ ] Success response schema documented
- [ ] Success response example provided
- [ ] All possible error status codes listed (400, 401, 403, 404, 409, 429, 500)
- [ ] Error response schema documented
- [ ] Error response examples for each error type
- [ ] Response headers documented (if any)

### Code Examples
- [ ] cURL example provided and tested
- [ ] Python example provided and tested
- [ ] JavaScript/Node.js example provided and tested
- [ ] At least one additional language (Java, Go, Ruby, PHP)
- [ ] Examples show authentication
- [ ] Examples show error handling
- [ ] Examples are copy-paste ready

### Additional Details
- [ ] Rate limiting documented (requests per minute/hour)
- [ ] Pagination explained (if applicable)
- [ ] Filtering options documented (if applicable)
- [ ] Sorting options documented (if applicable)
- [ ] Idempotency behavior explained (for POST/PUT/DELETE)
- [ ] Webhooks documented (if related)

## OpenAPI Specification Checklist

Verify your OpenAPI spec includes:

### Info Section
- [ ] API title
- [ ] API version (semantic versioning)
- [ ] Description
- [ ] Contact information (email, URL)
- [ ] License information
- [ ] Terms of service URL (if applicable)

### Servers
- [ ] Production server URL
- [ ] Sandbox/staging server URL (if applicable)
- [ ] Server descriptions
- [ ] Server variables (if applicable)

### Security
- [ ] All security schemes defined (apiKey, http, oauth2, openIdConnect)
- [ ] Security requirements specified globally or per-operation
- [ ] OAuth2 flows documented (if applicable)
- [ ] Scopes defined and described

### Paths
- [ ] All endpoints documented
- [ ] OperationId for each operation (unique, descriptive)
- [ ] Tags for logical grouping
- [ ] Summary (short) and description (detailed) for each operation
- [ ] Parameters defined with schema, description, required, example
- [ ] Request body documented with content types
- [ ] All responses documented (success + errors)
- [ ] Example requests and responses

### Components
- [ ] Reusable schemas defined (use $ref to avoid duplication)
- [ ] All object properties have descriptions
- [ ] Required fields marked correctly
- [ ] Field types accurate (string, integer, boolean, array, object)
- [ ] Enums defined for fixed values
- [ ] Examples provided for schemas
- [ ] Format specified where applicable (email, uri, date-time, uuid)

### Quality
- [ ] No broken $ref references
- [ ] Consistent naming conventions (camelCase or snake_case)
- [ ] No typos in descriptions
- [ ] Validate spec using Swagger Editor or openapi-validator
- [ ] Spec version is OpenAPI 3.0+ (not Swagger 2.0)

## Authentication Documentation Checklist

- [ ] All supported authentication methods listed
- [ ] Step-by-step instructions for each auth method
- [ ] Code examples showing authentication
- [ ] Token/key formats explained (e.g., Bearer token, API key prefix)
- [ ] Token/key location specified (header, query param, cookie)
- [ ] Token expiration explained
- [ ] Token refresh process documented (if applicable)
- [ ] OAuth2 flows documented with diagrams (if applicable)
- [ ] Scopes and permissions explained clearly
- [ ] Authentication errors documented with examples
- [ ] Security best practices included (HTTPS, secure storage, rotation)
- [ ] Troubleshooting section for common auth issues

## Quick Start Guide Checklist

- [ ] Clear goal stated upfront ("Make your first API request in 10 minutes")
- [ ] Prerequisites listed (API key, tools, accounts)
- [ ] Time estimate provided
- [ ] Step-by-step instructions (numbered)
- [ ] Copy-paste ready commands/code
- [ ] Expected output shown for each step
- [ ] Success criteria clear ("You should see...")
- [ ] Troubleshooting for common issues
- [ ] Next steps / where to go after quick start
- [ ] Tested end-to-end by someone unfamiliar with the API

## SDK Documentation Checklist

### Installation
- [ ] Package manager installation command (pip, npm, gem, composer, etc.)
- [ ] Minimum language/runtime version specified
- [ ] Dependencies listed (if any)
- [ ] Installation verification step

### Getting Started
- [ ] SDK initialization code
- [ ] Authentication/configuration
- [ ] Simplest possible example ("Hello World")
- [ ] Expected output shown

### Core Usage
- [ ] Common operations documented (CRUD)
- [ ] Code examples for each operation
- [ ] Parameter descriptions
- [ ] Return types documented
- [ ] Error handling examples

### Advanced Features
- [ ] Async/await patterns (if applicable)
- [ ] Pagination examples
- [ ] Batch operations (if applicable)
- [ ] Webhooks integration (if applicable)
- [ ] Custom configuration options
- [ ] Timeout and retry handling

### Reference
- [ ] Link to auto-generated API reference (if available)
- [ ] All public methods documented
- [ ] Method signatures clear
- [ ] Parameter types and descriptions
- [ ] Return types documented

## Code Example Standards

Every code example must:

- [ ] **Be complete**: Include all imports, initialization, error handling
- [ ] **Be tested**: Actually run the code to verify it works
- [ ] **Be idiomatic**: Follow language conventions and best practices
- [ ] **Be realistic**: Use practical scenarios, not contrived examples
- [ ] **Be copy-paste ready**: Developers can copy and run with minimal changes
- [ ] **Handle errors**: Show proper error handling patterns
- [ ] **Include comments**: Explain complex or important logic
- [ ] **Use syntax highlighting**: Format code with proper highlighting
- [ ] **Replace placeholders**: Clearly mark `YOUR_API_KEY`, `user_id`, etc.
- [ ] **Show output**: Display expected response or result

### Code Example Template

```language
// Brief description of what this example does

// Imports
import library

// Configuration
const API_KEY = 'YOUR_API_KEY'
const BASE_URL = 'https://api.example.com/v1'

// Main logic
async function exampleOperation() {
  try {
    // Step 1: Explanation
    const result = await apiCall({
      param: 'value'
    })

    // Step 2: Handle success
    console.log('Success:', result)
    return result

  } catch (error) {
    // Handle errors appropriately
    if (error.code === 'specific_error') {
      console.error('Specific error occurred:', error.message)
    } else {
      console.error('Unexpected error:', error)
    }
    throw error
  }
}

// Execute
exampleOperation()

// Expected output:
// Success: { id: 'abc123', ... }
```

## Release Notes Checklist (Developer-Focused)

- [ ] Version number (semantic versioning: MAJOR.MINOR.PATCH)
- [ ] Release date
- [ ] Summary of changes (2-3 sentences)
- [ ] **Breaking Changes** section (if any)
  - [ ] What changed
  - [ ] Why it changed
  - [ ] Migration guide
  - [ ] Before/after code examples
- [ ] **New Features** section
  - [ ] New endpoints added
  - [ ] New parameters/fields
  - [ ] Code examples
- [ ] **Improvements** section
  - [ ] Performance improvements
  - [ ] Enhanced functionality
- [ ] **Bug Fixes** section
  - [ ] What was fixed
  - [ ] Impact of bug
- [ ] **Deprecations** section (if any)
  - [ ] What's deprecated
  - [ ] When it will be removed
  - [ ] Replacement/alternative
- [ ] **Security** section (if applicable)
  - [ ] Security fixes (without revealing vulnerabilities)

## API Documentation Quality Rubric

### Excellent (5/5)
- Complete endpoint documentation with all parameters, responses, errors
- Code examples in 4+ languages, all tested and working
- Interactive API explorer (Swagger UI, Postman)
- Quick start guide under 10 minutes
- Comprehensive authentication guide
- Advanced tutorials for common use cases
- Troubleshooting section
- Up-to-date with latest API version
- Search functionality works perfectly
- Clear, consistent terminology

### Good (4/5)
- Most endpoints documented thoroughly
- Code examples in 3 languages, tested
- Basic API reference available
- Quick start guide exists
- Authentication explained
- Some tutorials available
- Updated within last month
- Search mostly works
- Generally consistent terminology

### Adequate (3/5)
- Main endpoints documented
- Code examples in 2 languages
- Reference documentation exists but incomplete
- Authentication covered
- Updated within last quarter
- Some inconsistencies in terminology

### Needs Improvement (2/5)
- Many endpoints missing documentation
- Few code examples, not all tested
- Authentication unclear
- Out of date (6+ months)
- Significant inconsistencies
- Hard to navigate

### Poor (1/5)
- Minimal documentation
- Few or no code examples
- Missing critical information
- Very out of date (1+ years)
- Broken links, formatting issues
- Confusing or misleading

## Common API Documentation Mistakes

### ❌ Don't Do This

**1. Untested Code Examples**
```python
# This doesn't actually work!
response = api.call(endpoint)  # What endpoint? What API?
print(response.result)  # 'result' might not exist
```

**2. Incomplete Error Documentation**
```markdown
## Errors
The API may return errors. Handle them appropriately.
```

**3. No Authentication Examples**
```markdown
## Authentication
Use an API key.
```

**4. Vague Descriptions**
```markdown
## GET /users
Gets users.
```

**5. Missing Required Fields**
```json
{
  "name": "John Doe"
  // Missing: What other fields are required?
}
```

### ✅ Do This Instead

**1. Tested, Complete Code Examples**
```python
import requests

# Authenticate and get user
url = "https://api.example.com/v1/users/me"
headers = {"Authorization": "Bearer YOUR_API_KEY"}

response = requests.get(url, headers=headers)

if response.status_code == 200:
    user = response.json()
    print(f"User ID: {user['id']}, Name: {user['name']}")
else:
    print(f"Error: {response.status_code} - {response.text}")
```

**2. Complete Error Documentation**
```markdown
## Error Responses

### 400 Bad Request - Invalid Email
**Cause:** Email format is invalid
**Response:**
```json
{
  "error": {
    "code": "invalid_email",
    "message": "The email address format is invalid"
  }
}
```
**Resolution:** Provide a valid email address in format user@domain.com
```

**3. Detailed Authentication**
```markdown
## Authentication

Include your API key in the Authorization header:

```http
Authorization: Bearer YOUR_API_KEY
```

**Example:**
```bash
curl https://api.example.com/v1/users \
  -H "Authorization: Bearer sk_live_abc123"
```

Get your API key: [Dashboard > API Keys](https://example.com/dashboard/api-keys)
```

**4. Descriptive Documentation**
```markdown
## GET /users

Retrieves a paginated list of all users in your organization. Results are sorted by creation date (newest first). Use query parameters to filter by role, status, or search by name/email.
```

**5. Complete Schema**
```json
{
  "email": "user@example.com",    // Required: Valid email address
  "name": "John Doe",              // Required: Full name (2-100 chars)
  "role": "member",                // Optional: admin, member, or guest (default: member)
  "metadata": {                    // Optional: Custom key-value pairs
    "department": "engineering"
  }
}
```

## Version Management

### Semantic Versioning for APIs

**Format:** MAJOR.MINOR.PATCH (e.g., 2.1.3)

- **MAJOR**: Breaking changes (increment when backwards compatibility breaks)
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes (backwards compatible)

### When to Version

**Requires new MAJOR version (breaking changes):**
- Removing an endpoint
- Removing a field from response
- Changing a field type
- Making optional parameter required
- Changing authentication method
- Changing error response format

**Requires new MINOR version:**
- Adding new endpoint
- Adding new optional parameter
- Adding new field to response
- Adding new error code
- Expanding enum values

**Requires PATCH version:**
- Bug fixes
- Performance improvements
- Documentation updates
- Internal refactoring

### API Versioning Strategies

**1. URL Path Versioning (Recommended)**
```
https://api.example.com/v1/users
https://api.example.com/v2/users
```

**2. Header Versioning**
```http
API-Version: 2
```

**3. Query Parameter Versioning**
```
https://api.example.com/users?version=2
```

## Style Guide Standards

### Naming Conventions

**Endpoints:**
- Use plural nouns: `/users` not `/user`
- Use kebab-case: `/user-profiles` not `/user_profiles` or `/userProfiles`
- Use hierarchical structure: `/users/{id}/orders`

**Fields:**
- Use snake_case for JSON: `created_at`, `user_id`, `email_address`
- Or camelCase if that's your standard: `createdAt`, `userId`, `emailAddress`
- **Be consistent** across entire API

**Error Codes:**
- Use snake_case: `invalid_email`, `rate_limit_exceeded`
- Be specific: `email_already_exists` not `duplicate_entry`
- Be actionable: Name should suggest solution

### Writing Style

- Use active voice: "Returns user data" not "User data is returned"
- Be concise: Remove unnecessary words
- Be specific: "Maximum 100 characters" not "short string"
- Use present tense: "Creates a user" not "Will create a user"
- Avoid jargon: Explain technical terms
- Use consistent terminology: Pick one term and stick with it

### Example Consistency

**Good (Consistent):**
```markdown
## POST /users
Creates a new user

## GET /users/{id}
Retrieves a user

## PUT /users/{id}
Updates a user

## DELETE /users/{id}
Deletes a user
```

**Bad (Inconsistent):**
```markdown
## POST /users
This endpoint will create a new user in the system

## GET /users/{id}
Gets user

## PUT /users/{id}
Use this to modify user information

## DELETE /users/{id}
Removes the specified user
```

## Tools and Resources

### Documentation Platforms
- **Swagger UI**: Interactive API explorer from OpenAPI spec
- **Redoc**: Clean, responsive API documentation from OpenAPI
- **Readme.io**: Developer hub with guides, reference, and API explorer
- **Postman**: API documentation with testing capabilities
- **GitBook**: Documentation platform for guides and references
- **Docusaurus**: Static site generator for documentation

### OpenAPI Tools
- **Swagger Editor**: Edit and validate OpenAPI specs
- **openapi-generator**: Generate SDK code from OpenAPI spec
- **Redocly CLI**: Lint, bundle, and preview OpenAPI specs
- **Spectral**: OpenAPI linter with customizable rules

### Testing Tools
- **Postman**: API testing and documentation
- **Insomnia**: REST and GraphQL client
- **HTTPie**: User-friendly CLI HTTP client
- **curl**: Universal command-line HTTP tool

### Validation
- **OpenAPI Validator**: Validate OpenAPI specifications
- **JSON Schema Validator**: Validate JSON schemas
- **Markdown Linters**: Check documentation formatting

## Additional Resources

- [OpenAPI Specification 3.0](https://swagger.io/specification/)
- [API Design Patterns](https://microservice-api-patterns.org/)
- [REST API Best Practices](https://restfulapi.net/)
- [HTTP Status Codes](https://httpstatuses.com/)
- [JSON Schema Specification](https://json-schema.org/)

---

**Remember:** Great API documentation is:
1. **Accurate** - Matches actual API behavior
2. **Complete** - Covers all endpoints, parameters, and errors
3. **Clear** - Easy to understand and follow
4. **Current** - Always up-to-date
5. **Practical** - Includes working code examples
