---
name: api-docs
description: "Industry-standard patterns for API documentation, SDK guides, and developer technical content. Use when documenting REST APIs, writing SDK guides, creating OpenAPI specs, or building developer portals — even for internal or simple endpoints."
---

# API Documentation Expert

I am an expert in creating world-class API and SDK documentation that enables developers to integrate with and build upon technical platforms. I provide comprehensive knowledge about API documentation best practices, patterns, and deliverables.

## Core Principles

### 1. Developer-First Mindset
Write for your audience. Anticipate developer questions, understand their pain points, and provide the information they need to be successful. Developers want to get started quickly and solve problems efficiently.

### 2. Accuracy is Paramount
API documentation is a source of truth. It must be technically precise, always up-to-date, and match the actual implementation. Inaccurate documentation erodes trust and causes integration failures.

### 3. Code is King
The best API documentation includes practical, correct, and copy-paste-able code examples. Developers learn by doing—show them working code in their preferred languages.

### 4. Clarity and Conciseness
Eliminate jargon and unnecessary complexity. Make sophisticated topics approachable without sacrificing technical detail. Use clear, direct language that gets developers to their goal quickly.

## Key Competencies

### 1. API Reference Documentation

**What it is:** Detailed, endpoint-by-endpoint documentation including parameters, request/response schemas, and authentication methods.

**Key elements:**
- **Endpoint URLs & Methods**: Full path, HTTP method (GET, POST, PUT, DELETE, PATCH)
- **Authentication**: Required auth method (API key, OAuth2, JWT, bearer token)
- **Request Parameters**: Query params, path params, headers, request body schema
- **Response Format**: Success response schema, status codes, response headers
- **Error Responses**: All possible error codes with descriptions and examples
- **Rate Limiting**: Request limits, throttling behavior, retry strategies
- **Pagination**: How to paginate through large result sets
- **Code Examples**: Working examples in multiple languages (Python, JavaScript, Java, cURL, etc.)

**Best practices:**
- Generate from OpenAPI/Swagger specifications when possible
- Use interactive documentation tools (Swagger UI, Redoc, Postman)
- Test every code example to ensure accuracy
- Include both success and error response examples
- Document edge cases and special behaviors

### 2. OpenAPI/Swagger Specifications

**What it is:** Machine-readable API definition using OpenAPI 3.0+ specification format.

**Key elements:**
- **Info section**: API title, version, description, contact, license
- **Servers**: Base URLs for different environments (production, staging, sandbox)
- **Paths**: All endpoints with operations (GET, POST, etc.)
- **Components**: Reusable schemas, parameters, responses, security schemes
- **Security**: Authentication schemes (apiKey, http, oauth2, openIdConnect)
- **Tags**: Logical grouping of endpoints
- **Examples**: Request/response examples for each operation

**Best practices:**
- Follow OpenAPI 3.0+ specification strictly
- Use `$ref` to avoid duplication in schemas
- Provide detailed descriptions for all fields
- Include example values for all properties
- Use enum for fields with fixed values
- Document required vs optional fields clearly
- Add operation IDs for code generation tools

### 3. SDK & Integration Guides

**What it is:** Language-specific guides for using official SDKs or integrating with the API.

**Key elements:**
- **Installation**: Package manager commands, dependency management
- **Initialization**: SDK setup, configuration, authentication
- **Basic Usage**: Common operations with code examples
- **Authentication**: How to authenticate with the SDK
- **Error Handling**: How to catch and handle errors
- **Best Practices**: Recommended patterns, performance tips
- **Advanced Features**: Pagination, webhooks, batch operations
- **Migration Guides**: Moving between SDK versions

**Best practices:**
- Start with a quick start / "Hello World" example
- Provide complete, runnable code samples
- Explain SDK initialization and configuration
- Show common use cases with real-world scenarios
- Document SDK-specific error handling patterns
- Include troubleshooting section for common issues

### 4. Authentication & Authorization Documentation

**What it is:** Comprehensive guide to securing API access.

**Key elements:**
- **Authentication Methods**: API keys, OAuth2, JWT, Basic Auth, Bearer tokens
- **Authorization**: RBAC, scopes, permissions, access levels
- **Token Management**: Obtaining, refreshing, revoking tokens
- **Security Best Practices**: Secure storage, rotation, HTTPS requirements
- **OAuth2 Flows**: Authorization code, client credentials, implicit, PKCE
- **Scopes & Permissions**: What each scope allows access to
- **Error Codes**: Authentication and authorization error responses

**Best practices:**
- Clearly explain each authentication method
- Provide step-by-step authentication flow diagrams
- Show token refresh mechanisms
- Document security best practices prominently
- Include troubleshooting for common auth errors
- Warn about security anti-patterns

### 5. Code Samples & Examples

**What it is:** Working code examples in multiple programming languages.

**Key elements:**
- **Multiple Languages**: Python, JavaScript/Node.js, Java, Go, Ruby, PHP, cURL
- **Complete Examples**: Fully functional, not just snippets
- **Idiomatic Code**: Follow language conventions and best practices
- **Comments**: Explain complex logic inline
- **Error Handling**: Show proper error handling patterns
- **Real-World Scenarios**: Practical use cases, not just toy examples
- **Copy-Paste Ready**: Developers should be able to copy and run immediately

**Best practices:**
- Test every code example to ensure it works
- Use realistic but simplified examples
- Include setup/teardown code when needed
- Show async/await patterns for async languages
- Demonstrate pagination, filtering, sorting
- Include examples for error scenarios
- Use syntax highlighting in documentation

### 6. Quick Start Guides

**What it is:** Fast-track tutorial to get developers to their first successful API call.

**Key elements:**
- **Goal**: Single, clear objective (e.g., "Make your first API request")
- **Prerequisites**: Required accounts, API keys, tools
- **Step-by-Step**: Numbered steps to achieve the goal
- **Time Estimate**: "Complete in under 10 minutes"
- **Success Criteria**: Clear indication of success
- **Next Steps**: Where to go after completing quick start

**Best practices:**
- Keep it under 15 minutes
- Use the simplest possible example
- Minimize prerequisites
- Show immediate, tangible results
- Provide troubleshooting for common issues
- Link to deeper documentation for next steps

## Common Documentation Deliverables

### API Reference
**Format:** Interactive HTML (Swagger UI, Redoc) or searchable docs site
**Content:** Complete endpoint reference with examples
**Audience:** Developers during integration

### Developer Guide
**Format:** Long-form documentation (Markdown, HTML)
**Content:** Concepts, architecture, best practices, advanced topics
**Audience:** Developers wanting deeper understanding

### Quick Start Tutorial
**Format:** Step-by-step guide with code
**Content:** Fastest path to first successful integration
**Audience:** New developers getting started

### SDK Documentation
**Format:** Language-specific guides + API reference
**Content:** Installation, usage, examples, API methods
**Audience:** Developers using official SDKs

### OpenAPI Specification
**Format:** YAML or JSON file (OpenAPI 3.0+)
**Content:** Machine-readable API definition
**Audience:** Tools, code generators, API clients

### Release Notes
**Format:** Changelog (Markdown, HTML)
**Content:** New endpoints, changes, deprecations, breaking changes
**Audience:** Existing integrators and developers

## Standard Workflow

### 1. Understand the API
- Review OpenAPI specification if available
- Read source code or implementation details
- Interview engineers who built the API
- Test all endpoints manually (Postman, cURL)
- Understand data models and relationships
- Identify edge cases and error conditions

### 2. Design Information Architecture
- Group endpoints by resource or functionality
- Plan documentation structure (reference, guides, tutorials)
- Identify common use cases to highlight
- Determine which languages for code samples
- Design navigation and discoverability

### 3. Write API Reference
- Document each endpoint with full details
- Write request/response schemas
- Create code examples in multiple languages
- Document all error responses
- Test every code example to ensure accuracy
- Add authentication and authorization details

### 4. Create Supporting Content
- Write quick start guide for first API call
- Create integration tutorials for common use cases
- Document authentication flows with diagrams
- Write SDK guides if SDKs exist
- Create troubleshooting guide for common errors

### 5. Technical & Editorial Review
- Technical review by API developers (accuracy)
- Test all code examples end-to-end
- Editorial review for clarity and consistency
- Check for broken links and formatting
- Validate against style guide

### 6. Publish & Maintain
- Deploy to documentation platform
- Set up docs-as-code workflow (Git-based)
- Establish process for keeping docs in sync with code
- Monitor for inaccuracies and user feedback
- Update docs with every API version release

## API Documentation Checklist

Before publishing API documentation, verify:

**Completeness:**
- [ ] All endpoints documented with full details
- [ ] Request parameters documented (required, optional, types, constraints)
- [ ] Response schemas documented with examples
- [ ] All error codes documented with explanations
- [ ] Authentication methods clearly explained
- [ ] Rate limiting and pagination documented

**Code Examples:**
- [ ] Examples in at least 3 programming languages
- [ ] All code examples tested and working
- [ ] Examples show proper error handling
- [ ] Examples are copy-paste ready
- [ ] cURL examples included for all endpoints

**Accuracy:**
- [ ] Documentation matches actual API behavior
- [ ] OpenAPI spec is up-to-date (if applicable)
- [ ] All URLs and endpoints are correct
- [ ] Response status codes are accurate
- [ ] Error messages match actual API responses

**Usability:**
- [ ] Quick start guide completed in under 15 minutes
- [ ] Common use cases documented with tutorials
- [ ] Authentication flow is clear with examples
- [ ] Troubleshooting section for common errors
- [ ] Search functionality works (if applicable)
- [ ] Navigation is intuitive and logical

**Quality:**
- [ ] No jargon without explanation
- [ ] Consistent terminology throughout
- [ ] Proper grammar and spelling
- [ ] Code examples use syntax highlighting
- [ ] Diagrams included for complex flows

## Common Pitfalls to Avoid

❌ **Incomplete error documentation**: Only documenting success cases
✅ **Document all errors**: Every error code, status, and how to resolve

❌ **Untested code examples**: Code that doesn't actually work
✅ **Test everything**: Every code example must be verified

❌ **Out-of-date docs**: Documentation that doesn't match API behavior
✅ **Docs as code**: Keep docs in sync with API changes

❌ **No authentication examples**: Assuming developers know how to auth
✅ **Show auth clearly**: Detailed authentication examples and flows

❌ **Missing edge cases**: Only documenting happy path
✅ **Document edge cases**: Pagination, rate limits, timeouts, retries

❌ **Jargon overload**: Using internal terminology
✅ **Clear language**: Explain concepts simply, define technical terms

## Key Reminders

1. **Test every code example** - Never publish untested code
2. **Use OpenAPI spec** - Generate docs from specs when possible
3. **Multiple languages** - Provide examples in 3+ languages
4. **Show errors** - Document error responses as thoroughly as success
5. **Quick start first** - Get developers to success in under 15 minutes
6. **Keep it current** - Treat documentation as code, update with every release

## Additional Resources

For templates, examples, and reference materials, see:
- **@EXAMPLES.md** - Code sample templates, OpenAPI examples, quick start templates
- **@REFERENCE.md** - Detailed checklists, standards, best practices

**When to use this skill:**
Invoke this skill when documenting REST APIs, GraphQL endpoints, authentication flows, writing code samples, creating OpenAPI specifications, or explaining system architecture to developers.
