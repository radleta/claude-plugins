# API Documentation Examples

This document provides templates, examples, and patterns for creating excellent API documentation.

## Quick Start Template

```markdown
# Quick Start: Your First API Request

**Goal:** Make your first successful API call in under 10 minutes

**Prerequisites:**
- API key (get one at https://example.com/dashboard/api-keys)
- cURL or HTTP client installed

## Step 1: Get Your API Key

1. Log in to your dashboard at https://example.com/dashboard
2. Navigate to **Settings** > **API Keys**
3. Click **Create New Key**
4. Copy your API key (it starts with `sk_`)

⚠️ **Keep your API key secure!** Never commit it to version control.

## Step 2: Make Your First Request

```bash
curl https://api.example.com/v1/users/me \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Step 3: Verify Success

You should see a response like this:

```json
{
  "id": "user_123",
  "email": "you@example.com",
  "name": "Your Name",
  "created_at": "2024-01-15T10:30:00Z"
}
```

✅ **Success!** You've made your first API call.

## Next Steps

- **[Authentication Guide](./authentication.md)** - Learn about OAuth2 and JWT
- **[API Reference](./reference.md)** - Explore all available endpoints
- **[Tutorials](./tutorials/)** - Build common integrations
```

---

## API Endpoint Documentation Template

```markdown
## POST /v1/users

Create a new user account.

### Authentication

Requires a valid API key with `users:write` scope.

### Request

**Headers:**
```http
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY
```

**Body:**
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "role": "member",
  "metadata": {
    "department": "engineering"
  }
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Valid email address. Must be unique. |
| `name` | string | Yes | User's full name (2-100 characters) |
| `role` | string | No | User role: `admin`, `member`, or `guest`. Default: `member` |
| `metadata` | object | No | Custom key-value pairs for additional data |

### Response

**Success (201 Created):**
```json
{
  "id": "user_abc123",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "member",
  "metadata": {
    "department": "engineering"
  },
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

**Error (400 Bad Request):**
```json
{
  "error": {
    "code": "invalid_email",
    "message": "The provided email address is invalid",
    "details": {
      "field": "email",
      "value": "not-an-email"
    }
  }
}
```

**Error (409 Conflict):**
```json
{
  "error": {
    "code": "email_already_exists",
    "message": "A user with this email already exists",
    "details": {
      "field": "email"
    }
  }
}
```

### Code Examples

**cURL:**
```bash
curl -X POST https://api.example.com/v1/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "email": "user@example.com",
    "name": "John Doe",
    "role": "member"
  }'
```

**Python:**
```python
import requests

url = "https://api.example.com/v1/users"
headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
}
data = {
    "email": "user@example.com",
    "name": "John Doe",
    "role": "member"
}

response = requests.post(url, json=data, headers=headers)

if response.status_code == 201:
    user = response.json()
    print(f"Created user: {user['id']}")
else:
    error = response.json()
    print(f"Error: {error['error']['message']}")
```

**JavaScript (Node.js):**
```javascript
const fetch = require('node-fetch');

const url = 'https://api.example.com/v1/users';
const options = {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    name: 'John Doe',
    role: 'member'
  })
};

fetch(url, options)
  .then(response => response.json())
  .then(data => {
    if (data.id) {
      console.log(`Created user: ${data.id}`);
    } else {
      console.error(`Error: ${data.error.message}`);
    }
  })
  .catch(error => console.error('Request failed:', error));
```

### Rate Limiting

This endpoint is rate limited to **100 requests per minute** per API key.

When rate limit is exceeded, you'll receive a `429 Too Many Requests` response:

```json
{
  "error": {
    "code": "rate_limit_exceeded",
    "message": "Rate limit exceeded. Retry after 30 seconds.",
    "retry_after": 30
  }
}
```

The response includes a `Retry-After` header indicating when to retry.
```

---

## OpenAPI 3.0 Example

```yaml
openapi: 3.0.3
info:
  title: Example API
  description: API for managing users and resources
  version: 1.0.0
  contact:
    name: API Support
    email: api@example.com
    url: https://example.com/support
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: https://api.example.com/v1
    description: Production server
  - url: https://sandbox-api.example.com/v1
    description: Sandbox server for testing

security:
  - bearerAuth: []

paths:
  /users:
    post:
      summary: Create a user
      description: Creates a new user account with the specified details
      operationId: createUser
      tags:
        - Users
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateUserRequest'
            examples:
              basic:
                summary: Basic user creation
                value:
                  email: user@example.com
                  name: John Doe
                  role: member
      responses:
        '201':
          description: User created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '400':
          description: Invalid request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '401':
          description: Unauthorized - invalid or missing API key
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '409':
          description: Conflict - email already exists
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /users/{user_id}:
    get:
      summary: Get a user
      description: Retrieves details for a specific user by ID
      operationId: getUser
      tags:
        - Users
      parameters:
        - name: user_id
          in: path
          required: true
          description: The unique identifier for the user
          schema:
            type: string
            pattern: '^user_[a-zA-Z0-9]+$'
            example: user_abc123
      responses:
        '200':
          description: User retrieved successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '404':
          description: User not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: API Key
      description: API key authentication using Bearer scheme

  schemas:
    CreateUserRequest:
      type: object
      required:
        - email
        - name
      properties:
        email:
          type: string
          format: email
          description: Valid email address (must be unique)
          example: user@example.com
        name:
          type: string
          minLength: 2
          maxLength: 100
          description: User's full name
          example: John Doe
        role:
          type: string
          enum: [admin, member, guest]
          default: member
          description: User role determining access level
        metadata:
          type: object
          additionalProperties: true
          description: Custom key-value pairs for additional data
          example:
            department: engineering
            employee_id: "12345"

    User:
      type: object
      properties:
        id:
          type: string
          pattern: '^user_[a-zA-Z0-9]+$'
          description: Unique identifier for the user
          example: user_abc123
        email:
          type: string
          format: email
          example: user@example.com
        name:
          type: string
          example: John Doe
        role:
          type: string
          enum: [admin, member, guest]
          example: member
        metadata:
          type: object
          additionalProperties: true
          nullable: true
        created_at:
          type: string
          format: date-time
          description: ISO 8601 timestamp of creation
          example: "2024-01-15T10:30:00Z"
        updated_at:
          type: string
          format: date-time
          description: ISO 8601 timestamp of last update
          example: "2024-01-15T10:30:00Z"

    Error:
      type: object
      required:
        - error
      properties:
        error:
          type: object
          required:
            - code
            - message
          properties:
            code:
              type: string
              description: Machine-readable error code
              example: invalid_email
            message:
              type: string
              description: Human-readable error message
              example: The provided email address is invalid
            details:
              type: object
              description: Additional context about the error
              additionalProperties: true

tags:
  - name: Users
    description: User management endpoints
```

---

## Authentication Documentation Example

```markdown
# Authentication

The Example API uses API keys to authenticate requests. You can manage your API keys in the [Dashboard](https://example.com/dashboard/api-keys).

## API Key Authentication

Include your API key in the `Authorization` header using the Bearer scheme:

```http
Authorization: Bearer YOUR_API_KEY
```

**Example:**

```bash
curl https://api.example.com/v1/users/me \
  -H "Authorization: Bearer sk_test_abc123xyz"
```

## API Key Types

| Type | Prefix | Usage |
|------|--------|-------|
| **Test Key** | `sk_test_` | Sandbox environment only. No real data. |
| **Live Key** | `sk_live_` | Production environment. Real data and billing. |

⚠️ **Never use live keys in client-side code** or commit them to version control.

## Scopes and Permissions

API keys can be restricted to specific scopes:

| Scope | Description |
|-------|-------------|
| `users:read` | Read user data |
| `users:write` | Create and modify users |
| `resources:read` | Read resources |
| `resources:write` | Create and modify resources |
| `admin` | Full access to all endpoints |

## Authentication Errors

### 401 Unauthorized

**Missing API key:**
```json
{
  "error": {
    "code": "missing_authentication",
    "message": "No API key provided. Include Authorization header."
  }
}
```

**Invalid API key:**
```json
{
  "error": {
    "code": "invalid_api_key",
    "message": "The provided API key is invalid or has been revoked."
  }
}
```

### 403 Forbidden

**Insufficient permissions:**
```json
{
  "error": {
    "code": "insufficient_permissions",
    "message": "Your API key does not have the required scope: users:write"
  }
}
```

## Best Practices

✅ **DO:**
- Store API keys securely (environment variables, secrets manager)
- Use test keys during development
- Rotate keys regularly (every 90 days)
- Use restricted scopes (principle of least privilege)
- Regenerate keys immediately if compromised

❌ **DON'T:**
- Commit API keys to version control
- Use live keys in client-side JavaScript
- Share API keys between environments
- Log API keys in application logs
- Embed keys in mobile apps
```

---

## SDK Guide Example

```markdown
# Python SDK Guide

The Example Python SDK provides idiomatic access to the Example API.

## Installation

```bash
pip install example-api
```

**Requirements:** Python 3.7+

## Quick Start

```python
from example_api import ExampleClient

# Initialize the client
client = ExampleClient(api_key="YOUR_API_KEY")

# Create a user
user = client.users.create(
    email="user@example.com",
    name="John Doe",
    role="member"
)

print(f"Created user: {user.id}")
```

## Configuration

### Using Environment Variables

```python
import os
from example_api import ExampleClient

# Reads from EXAMPLE_API_KEY environment variable
client = ExampleClient()
```

### Custom Configuration

```python
from example_api import ExampleClient, Config

config = Config(
    api_key="YOUR_API_KEY",
    base_url="https://api.example.com/v1",
    timeout=30,
    max_retries=3
)

client = ExampleClient(config=config)
```

## Error Handling

```python
from example_api import ExampleClient, ExampleAPIError, RateLimitError

client = ExampleClient(api_key="YOUR_API_KEY")

try:
    user = client.users.create(
        email="user@example.com",
        name="John Doe"
    )
except RateLimitError as e:
    print(f"Rate limited. Retry after {e.retry_after} seconds")
except ExampleAPIError as e:
    print(f"API error: {e.code} - {e.message}")
    print(f"Status code: {e.status_code}")
```

## Common Operations

### Creating Resources

```python
# Create a user
user = client.users.create(
    email="user@example.com",
    name="John Doe",
    metadata={"department": "engineering"}
)

# Create a resource
resource = client.resources.create(
    name="My Resource",
    user_id=user.id
)
```

### Retrieving Resources

```python
# Get by ID
user = client.users.retrieve("user_abc123")

# Get current user
me = client.users.me()
```

### Updating Resources

```python
# Update user
user = client.users.update(
    "user_abc123",
    name="Jane Doe",
    metadata={"department": "product"}
)
```

### Deleting Resources

```python
# Delete user
client.users.delete("user_abc123")
```

### Listing Resources with Pagination

```python
# List all users (auto-pagination)
for user in client.users.list():
    print(user.email)

# Manual pagination
page = client.users.list(limit=10)
for user in page.data:
    print(user.email)

# Get next page
if page.has_more:
    next_page = client.users.list(
        limit=10,
        starting_after=page.data[-1].id
    )
```

## Advanced Features

### Async Support

```python
import asyncio
from example_api import AsyncExampleClient

async def main():
    client = AsyncExampleClient(api_key="YOUR_API_KEY")

    user = await client.users.create(
        email="user@example.com",
        name="John Doe"
    )

    print(f"Created user: {user.id}")

asyncio.run(main())
```

### Custom Headers

```python
client = ExampleClient(
    api_key="YOUR_API_KEY",
    default_headers={
        "X-Custom-Header": "value"
    }
)
```

### Timeouts and Retries

```python
from example_api import ExampleClient, Config

config = Config(
    api_key="YOUR_API_KEY",
    timeout=60,  # 60 second timeout
    max_retries=5,  # Retry up to 5 times
    retry_on=[429, 500, 502, 503, 504]  # Retry on these status codes
)

client = ExampleClient(config=config)
```

## Troubleshooting

### Import Errors

```bash
# Ensure SDK is installed
pip list | grep example-api

# Reinstall if needed
pip install --upgrade example-api
```

### Authentication Issues

```python
# Verify API key is set
import os
print(os.getenv("EXAMPLE_API_KEY"))

# Test authentication
client = ExampleClient(api_key="YOUR_API_KEY")
try:
    me = client.users.me()
    print("Authentication successful!")
except Exception as e:
    print(f"Authentication failed: {e}")
```

### Rate Limiting

```python
import time
from example_api import RateLimitError

try:
    user = client.users.create(email="user@example.com", name="John Doe")
except RateLimitError as e:
    print(f"Rate limited. Waiting {e.retry_after} seconds...")
    time.sleep(e.retry_after)
    user = client.users.create(email="user@example.com", name="John Doe")
```
```

---

## Error Response Documentation Pattern

Always document errors in this consistent format:

```markdown
## Error Responses

All errors follow a consistent JSON structure:

```json
{
  "error": {
    "code": "machine_readable_code",
    "message": "Human-readable error message",
    "details": {
      "field": "field_name",
      "additional": "context"
    }
  }
}
```

### Common Error Codes

| Status Code | Error Code | Description | Resolution |
|-------------|-----------|-------------|------------|
| 400 | `invalid_request` | Request validation failed | Check request format and required fields |
| 400 | `invalid_email` | Email address format is invalid | Provide a valid email address |
| 401 | `missing_authentication` | No API key provided | Include Authorization header |
| 401 | `invalid_api_key` | API key is invalid or revoked | Verify your API key |
| 403 | `insufficient_permissions` | API key lacks required scope | Use an API key with appropriate permissions |
| 404 | `resource_not_found` | Requested resource doesn't exist | Verify the resource ID |
| 409 | `email_already_exists` | Email is already in use | Use a different email address |
| 429 | `rate_limit_exceeded` | Too many requests | Wait and retry after delay specified in `Retry-After` header |
| 500 | `internal_server_error` | Server encountered an error | Retry the request; contact support if persists |
```

This format makes errors discoverable, understandable, and actionable.
