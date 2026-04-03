# TypeScript Examples & Walkthroughs

Real-world examples demonstrating TypeScript patterns, principles, and best practices.

## Example 1: Discriminated Union State Machine

**Scenario**: Model a data fetching state with type-safe transitions.

### Investigation

**What to discover**:
- Current state management approach (Redux, Zustand, useState, etc.)
- Error handling patterns in the project
- Async operation patterns

### Solution: Discriminated Union

**Type Definition**:
```typescript
type FetchState<T, E = Error> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: E };
```

**Why this works**:
- Each state is mutually exclusive
- `status` is the discriminant
- Type narrowing works automatically
- Invalid states impossible (can't have both data and error)

**Usage Pattern**:
```typescript
function handleFetchState<T>(state: FetchState<T>): string {
  switch (state.status) {
    case 'idle':
      return 'Ready to load';
    case 'loading':
      return 'Loading...';
    case 'success':
      return `Success: ${JSON.stringify(state.data)}`; // data is available here
    case 'error':
      return `Error: ${state.error.message}`; // error available here
    default:
      // Exhaustiveness check
      const _exhaustive: never = state;
      return _exhaustive;
  }
}
```

**Benefits**:
- Type-safe access to state-specific properties
- Exhaustive checking catches missing cases
- Refactoring is safe (add new state, compiler shows all places to update)
- Self-documenting code

---

## Example 2: Branded Types for Domain Safety

**Scenario**: Prevent mixing different ID types (UserId vs ProductId).

### Investigation

**What to discover**:
- How IDs are currently represented
- Where ID confusion could cause bugs
- Whether validation is already happening

### Solution: Branded Types

**Type Definition**:
```typescript
// Brand type helper
type Brand<K, T> = K & { __brand: T };

// Specific ID types
type UserId = Brand<string, 'UserId'>;
type ProductId = Brand<string, 'ProductId'>;
type OrderId = Brand<string, 'OrderId'>;
```

**Constructor Functions**:
```typescript
function createUserId(id: string): UserId {
  // Could add validation here
  if (!id || id.trim() === '') {
    throw new Error('Invalid UserId');
  }
  return id as UserId;
}

function createProductId(id: string): ProductId {
  if (!id || id.trim() === '') {
    throw new Error('Invalid ProductId');
  }
  return id as ProductId;
}
```

**Type Safety in Action**:
```typescript
function getUser(id: UserId): Promise<User> { /* ... */ }
function getProduct(id: ProductId): Promise<Product> { /* ... */ }

const userId = createUserId('user-123');
const productId = createProductId('prod-456');

getUser(userId); // ✓ OK
getUser(productId); // ✗ Type error: ProductId not assignable to UserId
```

**Benefits**:
- Compile-time prevention of ID confusion
- Zero runtime overhead (brands erased)
- Validation centralized in constructor
- Self-documenting function signatures

---

## Example 3: Result Type for Error Handling

**Scenario**: Make errors explicit in function signatures, avoid throwing exceptions.

### Investigation

**What to discover**:
- Current error handling strategy (try/catch, throwing, error codes)
- Whether async errors are handled consistently
- If error types need to be specific

### Solution: Result Type

**Type Definition**:
```typescript
type Success<T> = { ok: true; value: T };
type Failure<E> = { ok: false; error: E };
type Result<T, E = Error> = Success<T> | Failure<E>;
```

**Constructor Helpers**:
```typescript
function success<T>(value: T): Success<T> {
  return { ok: true, value };
}

function failure<E>(error: E): Failure<E> {
  return { ok: false, error };
}
```

**Usage Example**:
```typescript
function parseJSON(text: string): Result<unknown, SyntaxError> {
  try {
    return success(JSON.parse(text));
  } catch (error) {
    return failure(error as SyntaxError);
  }
}

// Explicit error handling
const result = parseJSON('{"valid": true}');
if (result.ok) {
  console.log('Parsed:', result.value);
} else {
  console.error('Parse error:', result.error);
}
```

**Advanced: Functional Methods**:
```typescript
function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  return result.ok ? success(fn(result.value)) : result;
}

function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  return result.ok ? fn(result.value) : result;
}

// Chaining operations
const finalResult = flatMap(
  parseJSON('{"userId": "123"}'),
  (data) => {
    const userId = (data as any).userId;
    return typeof userId === 'string'
      ? success(createUserId(userId))
      : failure(new Error('Invalid userId'));
  }
);
```

**Benefits**:
- Errors visible in type signatures
- Forces error handling
- No uncaught exceptions
- Composable error handling

---

## Example 4: Type-Safe API Client

**Scenario**: Build a type-safe HTTP client with full request/response typing.

### Investigation

**What to discover**:
- API schema (OpenAPI, GraphQL, custom)
- Current HTTP client (fetch, axios, etc.)
- Error handling approach
- Authentication patterns

### Solution: Type-Safe Client

**API Contract Types**:
```typescript
// Define all endpoints
type APIEndpoints = {
  'GET /users/:id': {
    params: { id: UserId };
    response: User;
  };
  'POST /users': {
    body: CreateUserRequest;
    response: User;
  };
  'GET /products': {
    query: { category?: string; limit?: number };
    response: Product[];
  };
};

// Extract method and path
type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';
type ExtractMethod<K extends keyof APIEndpoints> =
  K extends `${infer M extends Method} ${string}` ? M : never;
type ExtractPath<K extends keyof APIEndpoints> =
  K extends `${Method} ${infer P}` ? P : never;
```

**Type-Safe Client Implementation**:
```typescript
class APIClient {
  async request<K extends keyof APIEndpoints>(
    endpoint: K,
    options: {
      params?: APIEndpoints[K] extends { params: infer P } ? P : never;
      query?: APIEndpoints[K] extends { query: infer Q } ? Q : never;
      body?: APIEndpoints[K] extends { body: infer B } ? B : never;
    }
  ): Promise<Result<
    APIEndpoints[K]['response'],
    APIError
  >> {
    const method = ExtractMethod<K>;
    let path = ExtractPath<K>;

    // Replace params in path
    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        path = path.replace(`:${key}`, String(value));
      });
    }

    // Build URL with query params
    const url = new URL(path, this.baseURL);
    if (options.query) {
      Object.entries(options.query).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    // Make request
    try {
      const response = await fetch(url.toString(), {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      if (!response.ok) {
        return failure({ status: response.status, message: 'Request failed' });
      }

      const data = await response.json();
      return success(data);
    } catch (error) {
      return failure({ status: 0, message: String(error) });
    }
  }
}
```

**Type-Safe Usage**:
```typescript
const client = new APIClient('https://api.example.com');

// GET with params - TypeScript knows UserId is required
const userResult = await client.request('GET /users/:id', {
  params: { id: createUserId('123') }
});

// POST with body - TypeScript knows CreateUserRequest is required
const newUserResult = await client.request('POST /users', {
  body: { name: 'Alice', email: 'alice@example.com' }
});

// GET with query - TypeScript knows optional query params
const productsResult = await client.request('GET /products', {
  query: { category: 'electronics', limit: 10 }
});
```

**Benefits**:
- Autocomplete for endpoints
- Type-safe params, query, body
- Typed responses
- Refactoring catches breaking changes
- Single source of truth for API contract

---

## Example 5: Optimizing tsconfig.json for Monorepo

**Scenario**: Configure TypeScript for a monorepo with multiple packages.

### Investigation

**What to discover**:
- Monorepo structure (packages, apps, libs)
- Build tool (Turborepo, Nx, Lerna, pnpm workspaces)
- Shared code patterns
- Build time pain points

### Solution: Project References

**Root tsconfig.json**:
```json
{
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "incremental": true,
    "skipLibCheck": true
  },
  "files": [],
  "references": [
    { "path": "./packages/shared" },
    { "path": "./packages/api" },
    { "path": "./packages/web" }
  ]
}
```

**Package tsconfig.json (packages/shared/tsconfig.json)**:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

**Consumer Package (packages/api/tsconfig.json)**:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../shared" }
  ]
}
```

**Build Script**:
```json
{
  "scripts": {
    "build": "tsc --build",
    "build:watch": "tsc --build --watch",
    "clean": "tsc --build --clean"
  }
}
```

**Benefits**:
- Incremental builds (only rebuild changed packages)
- Proper dependency ordering
- Fast watch mode
- Better IDE performance
- Type-safe cross-package imports

**Performance Improvements**:
- First build: ~60s → 45s
- Incremental rebuild: ~20s → 3s
- Watch mode: instant for single package changes

---

## Example 6: Advanced Conditional Types

**Scenario**: Create a utility type that makes all nested properties optional.

### Investigation

**What to discover**:
- Are there existing utility types in the project?
- Is this for API responses, form state, or something else?
- Should arrays and primitives be handled specially?

### Solution: DeepPartial Utility

**Type Definition**:
```typescript
type DeepPartial<T> = T extends object
  ? T extends Array<infer U>
    ? Array<DeepPartial<U>>
    : { [P in keyof T]?: DeepPartial<T[P]> }
  : T;
```

**How It Works**:
1. If `T` is not an object, return `T` as-is (primitives)
2. If `T` is an array, recursively apply to array elements
3. If `T` is an object, make all properties optional and recursively apply

**Usage Example**:
```typescript
interface User {
  id: string;
  name: string;
  profile: {
    bio: string;
    avatar: string;
    social: {
      twitter: string;
      github: string;
    };
  };
  roles: string[];
}

// Deep partial for updates
type UserUpdate = DeepPartial<User>;

const update: UserUpdate = {
  profile: {
    social: {
      github: 'new-username' // Only update github, all other fields optional
    }
  }
};
```

**Benefits**:
- Reusable across all types
- Type-safe partial updates
- Works with nested objects
- Handles arrays correctly

---

## Example 7: Template Literal Types for Type-Safe Events

**Scenario**: Create type-safe event emitter with autocomplete.

### Investigation

**What to discover**:
- Existing event system (EventEmitter, custom, framework-specific)
- Event naming conventions
- Event payload patterns

### Solution: Type-Safe Event Emitter

**Type Definitions**:
```typescript
// Define all events and their payloads
interface EventMap {
  'user:created': { userId: UserId; timestamp: number };
  'user:updated': { userId: UserId; changes: Partial<User> };
  'user:deleted': { userId: UserId };
  'product:created': { productId: ProductId; name: string };
  'order:placed': { orderId: OrderId; total: number };
}

// Extract event names
type EventName = keyof EventMap;

// Type-safe event emitter
class TypedEventEmitter {
  private listeners = new Map<EventName, Array<(data: any) => void>>();

  on<K extends EventName>(
    event: K,
    handler: (data: EventMap[K]) => void
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }

  emit<K extends EventName>(
    event: K,
    data: EventMap[K]
  ): void {
    const handlers = this.listeners.get(event) || [];
    handlers.forEach(handler => handler(data));
  }
}
```

**Type-Safe Usage**:
```typescript
const emitter = new TypedEventEmitter();

// TypeScript provides autocomplete for event names
emitter.on('user:created', (data) => {
  // data is typed as { userId: UserId; timestamp: number }
  console.log(`User ${data.userId} created at ${data.timestamp}`);
});

// TypeScript ensures correct payload
emitter.emit('user:created', {
  userId: createUserId('123'),
  timestamp: Date.now()
}); // ✓ OK

emitter.emit('user:created', {
  userId: 'invalid' // ✗ Type error: string not assignable to UserId
});
```

**Advanced: Event Name Patterns**:
```typescript
// Generate event names from pattern
type UserEvent = `user:${string}`;
type ProductEvent = `product:${string}`;
type AllEvents = UserEvent | ProductEvent;

// Extract entity from event name
type ExtractEntity<T extends string> =
  T extends `${infer E}:${string}` ? E : never;

type Entity = ExtractEntity<AllEvents>; // 'user' | 'product'
```

**Benefits**:
- Full autocomplete for event names
- Type-safe payloads
- Refactor-safe (rename event, find all usages)
- Self-documenting event system

---

## Example 8: Complete Agent Workflow (End-to-End)

**User Request**: "Add type-safe state management for user authentication"

This example demonstrates the **complete agent workflow** using the typescript-expert skill from investigation through verification.

### Step 1: Investigation (REQUIRED FIRST STEP)

**Agent uses investigation protocols from @INVESTIGATION.md:**

#### Protocol 1: TypeScript Configuration Discovery
**Tool: Read** → `tsconfig.json`
```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext"
  }
}
```

**Extract**:
- `strict: true` ✓ → Generate strict-mode-compatible types
- `target: ES2022` → Modern TypeScript features available
- TypeScript version: 5.6 (from package.json check)

**Decision**: Use TypeScript 5.x features, strict mode enabled

#### Protocol 5: State Management Pattern Detection
**Tool: Grep** → Pattern: `status.*:.*['"]`, `isLoading.*boolean`

**Found in codebase**:
```typescript
// src/auth/types.ts (current state)
const isAuthenticated = false;
const isLoading = false;
const error = null;
```

**Analysis**: Project currently uses **boolean flags** for auth state
**Decision**: Recommend **discriminated union** to replace boolean flags

### Step 2: Pattern Detection

**Using @DETECTION.md signal → pattern mapping:**

**Signals Detected**:
- Keywords: "state management", "authentication", "user"
- Existing pattern: Multiple boolean flags (isAuthenticated, isLoading)
- Error handling: `error` variable present

**Pattern Mapping**:
```
State management keywords + boolean flags
→ Signal: State machine needed
→ Pattern: Discriminated Union (I1 from @PATTERNS.md)
```

**Detection Decision Tree** (from @DETECTION.md):
```
Is this a state machine scenario?
├─ Yes (multiple states: idle, loading, authenticated, error)
└─ Pattern: I1 - Discriminated Union
```

### Step 3: Code Generation

**Using template from @PATTERNS.md Pattern I1:**

**Template Selected**:
```typescript
type {{UnionName}} =
  | { {{discriminant}}: {{literal1}}; {{prop1}}: {{type1}} }
  | { {{discriminant}}: {{literal2}}; {{prop2}}: {{type2}} }
  | { {{discriminant}}: {{literal3}}; {{prop3}}: {{type3}} };
```

**Placeholder Resolution** (from @PATTERNS.md):
- `{{UnionName}}` → `AuthState` (domain: authentication)
- `{{discriminant}}` → `status` (project convention from investigation)
- States needed: idle, loading, authenticated, error

**Generated Code**:
```typescript
// src/auth/types.ts
type AuthState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'authenticated'; user: User; token: string }
  | { status: 'error'; error: Error };

// Type-safe state handler
function handleAuthState(state: AuthState): string {
  switch (state.status) {
    case 'idle':
      return 'Not authenticated';
    case 'loading':
      return 'Authenticating...';
    case 'authenticated':
      // user and token available here (type-narrowed)
      return `Welcome, ${state.user.name}`;
    case 'error':
      // error available here (type-narrowed)
      return `Auth failed: ${state.error.message}`;
    default:
      // Exhaustiveness check
      const _exhaustive: never = state;
      return _exhaustive;
  }
}
```

**Adaptation to Project** (from investigation):
- Used `status` discriminant (found in existing code patterns)
- Added `User` type reference (found in project)
- Included `token: string` (authentication requirement)
- Strict mode compatible (no `any` types)

### Step 4: Verification

**Using @CHECKLISTS.md verification protocol:**

#### Type Safety Checklist
- [x] No `any` types present
- [x] All union members mutually exclusive
- [x] Discriminant uses literal types (not `string`)
- [x] Exhaustiveness check with `never` type
- [x] State-specific properties accessible after narrowing

#### Type Architecture Checklist
- [x] Invalid states impossible (can't have both user and error)
- [x] API types exported correctly
- [x] Consistent with project patterns (status discriminant)
- [x] Domain types clearly named (AuthState, User)

#### Compiler Configuration Checklist
- [x] Compiles with strict mode
- [x] No type errors in switch cases
- [x] Exhaustive switch enforced by compiler

**Verification Command** (from @REFERENCE.md):
```bash
tsc --noEmit
```

**Result**: ✓ All checks pass, no type errors

### Step 5: Documentation

**Generated documentation** (following @PRINCIPLES.md Principle 11):

```typescript
/**
 * Represents the authentication state of the application.
 *
 * Uses a discriminated union to ensure type-safe state transitions
 * and prevent invalid state combinations.
 *
 * @example
 * ```typescript
 * const state: AuthState = { status: 'authenticated', user: currentUser, token: 'abc123' };
 * handleAuthState(state); // Type-safe access to user and token
 * ```
 */
type AuthState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'authenticated'; user: User; token: string }
  | { status: 'error'; error: Error };
```

### Benefits Achieved

**Type Safety**:
- Invalid states impossible (can't be loading AND authenticated)
- Exhaustive handling enforced by compiler
- Type narrowing gives access to state-specific properties

**Maintainability**:
- Adding new state requires updating all handlers (compiler enforces)
- Refactoring is safe (rename status, compiler shows all usages)
- Self-documenting (state machine visible in types)

**Project Integration**:
- Follows existing `status` discriminant pattern
- Compatible with strict mode configuration
- Uses existing `User` type from project
- Replaces error-prone boolean flag pattern

### Workflow Summary

1. **Investigate** → Discovered strict mode, TS 5.6, existing patterns
2. **Detect** → Identified discriminated union pattern from signals
3. **Generate** → Used template, adapted to project conventions
4. **Verify** → Ran comprehensive checklists, confirmed quality
5. **Document** → Added TSDoc comments for clarity

**Time**: ~15 minutes from request to verified implementation

**Result**: Type-safe, maintainable, project-aware authentication state management

---

## Summary

These examples demonstrate:

1. **Discriminated Unions** - Type-safe state machines
2. **Branded Types** - Domain-specific type safety
3. **Result Types** - Explicit error handling
4. **Type-Safe APIs** - End-to-end type safety
5. **Monorepo Config** - Performance optimization
6. **Conditional Types** - Advanced type utilities
7. **Template Literals** - Type-safe string patterns
8. **Complete Agent Workflow** - Investigation → Detection → Generation → Verification

**Common Patterns Across Examples**:
- Investigation first (understand project context)
- Type safety over convenience
- Compile-time error prevention
- Self-documenting code
- Zero or minimal runtime overhead
- Adaptable to different projects

**Key Takeaways**:
- Types should make invalid states impossible
- Invest in type infrastructure for long-term benefit
- Let the compiler guide refactoring
- Balance type safety with developer experience
- Advanced types enable better APIs

These patterns adapt to your specific project needs while maintaining type safety and maintainability.
