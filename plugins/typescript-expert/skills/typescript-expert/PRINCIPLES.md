# TypeScript Principles & Best Practices

Comprehensive guidance for TypeScript 5.x excellence: type system mastery, modern features, and best practices.

## TypeScript 5.x Features (PRIORITIZE THESE)

### TS 5.0+ Features (Always Available)

#### const Type Parameters
**Use**: When you want literal type inference in generics

```typescript
function tuple<const T extends readonly unknown[]>(...args: T): T {
  return args;
}

const result = tuple(1, "hello", true);
// Type: readonly [1, "hello", true]
// NOT: (string | number | boolean)[]
```

**Agent Rule**: Use `<const T>` when user wants exact literal values preserved.

#### satisfies Operator
**Use**: Type check without widening

```typescript
type Color = string | [number, number, number];

const palette = {
  red: [255, 0, 0],
  green: "#00ff00"
} satisfies Record<string, Color>;

// palette.red is [number, number, number] (specific)
// palette.green is string (specific)
// Both checked against Color constraint
```

**Agent Rule**: Use when user wants type checking AND specific type preservation.

### TS 5.2+ Features

#### using Declarations (Explicit Resource Management)
**Use**: Automatic cleanup of resources

```typescript
{
  using file = getFileHandle();
  // Automatically calls file[Symbol.dispose]() at end of block
}

interface Disposable {
  [Symbol.dispose](): void;
}

class FileHandle implements Disposable {
  [Symbol.dispose]() {
    this.close();
  }
}
```

**Agent Rule**: Generate for file handles, database connections, locks.

### TS 5.4+ Features

#### NoInfer Utility Type
**Use**: Prevent type inference in specific positions

```typescript
function createStore<T>(
  initial: T,
  merge: (a: T, b: NoInfer<T>) => T
) {
  // b doesn't influence T inference
}

const store = createStore(
  { name: "Alice" },
  (a, b) => ({ ...a, ...b })
);
// T inferred only from initial, not from merge function
```

**Agent Rule**: Use in API functions where one parameter shouldn't affect generic inference.

### TS 5.5+ Features

#### Inferred Type Predicates
**Use**: Automatic type guard inference

```typescript
// TS 5.5+: No explicit "value is Type" needed!
function isString(value: unknown) {
  return typeof value === "string";
}
// TypeScript automatically infers: value is string

const values: unknown[] = ["hello", 42, "world"];
const strings = values.filter(isString);
// strings: string[] (automatically!)
```

**Agent Rule**: For TS 5.5+, skip explicit type predicates. Let TypeScript infer.

**Pre-5.5** (explicit):
```typescript
function isString(value: unknown): value is string {
  return typeof value === "string";
}
```

---

## Core TypeScript Principles

Comprehensive guidance for TypeScript excellence across type system mastery, architecture, and performance.

## 1. Type Safety First

**Principle**: Make invalid states unrepresentable. Use the type system to catch errors at compile time.

### Strictness Configuration

**Enable all strict flags**:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true
  }
}
```

**Why each matters**:
- `strict: true` - Enables all strictness checks (safest baseline)
- `noUncheckedIndexedAccess` - Array/object access returns `T | undefined`
- `noImplicitOverride` - Requires `override` keyword for clarity
- `exactOptionalPropertyTypes` - `undefined` must be explicit

### Avoid `any`

**When `any` appears**:
- First question: Can this be properly typed?
- If truly necessary: Add comment explaining why
- Consider `unknown` instead (safer, forces type checking)

**Replace `any` with**:
- `unknown` - When type is truly unknown, force checking before use
- Generics - When working with multiple types
- Union types - When value can be one of several types
- Type guards - To narrow unknown types safely

### Discriminated Unions

**Pattern**: Use discriminated unions for state machines and variant types.

**Structure**:
- Common discriminant property (`type`, `kind`, `status`)
- Union of interface/type literals
- Exhaustive checking with `never`

**Benefits**:
- Type-safe state transitions
- Exhaustive handling enforced by compiler
- Self-documenting state machine

### Branded Types

**Pattern**: Create nominal types from structural types for domain safety.

**Use cases**:
- User IDs vs Product IDs (both strings, but different domains)
- Validated data (email addresses, URLs)
- Units of measurement (meters vs feet)

**Benefits**:
- Prevents mixing incompatible values
- Encodes domain rules in types
- Catches bugs at compile time

## 2. Type-Level Programming

**Principle**: Use TypeScript's type system to compute types, not just describe them.

### Conditional Types

**Pattern**: `T extends U ? X : Y`

**Use cases**:
- Type inference based on conditions
- Extracting types from complex structures
- Building utility types

**Advanced patterns**:
- Distributive conditional types
- Inferring with `infer` keyword
- Recursive conditional types

### Mapped Types

**Pattern**: `{ [K in keyof T]: Transform<T[K]> }`

**Use cases**:
- Making all properties optional/readonly
- Transforming property types
- Filtering properties

**Advanced patterns**:
- Key remapping with `as`
- Conditional property mapping
- Template literal types in keys

### Template Literal Types

**Pattern**: Build string literal types from unions.

**Use cases**:
- Type-safe event names
- API route patterns
- CSS class names

**Benefits**:
- Autocomplete for string values
- Catch typos at compile time
- Self-documenting string contracts

### Utility Types

**Built-in utilities**:
- `Partial<T>`, `Required<T>`, `Readonly<T>`
- `Pick<T, K>`, `Omit<T, K>`
- `Record<K, T>`, `Extract<T, U>`, `Exclude<T, U>`
- `ReturnType<T>`, `Parameters<T>`

**Custom utilities**:
- Create project-specific utility types
- Compose utilities for complex transformations
- Document utility types with examples

## 3. Generics Mastery

**Principle**: Write reusable code with proper generic constraints.

### Generic Constraints

**Pattern**: `<T extends Constraint>`

**Use cases**:
- Constraining generic parameters
- Ensuring properties exist
- Narrowing generic types

**Best practices**:
- Constrain as specifically as needed
- Use multiple type parameters when needed
- Provide defaults when sensible

### Generic Inference

**Let TypeScript infer**:
- Return types from implementation
- Generic parameters from arguments
- Conditional type results

**When to annotate**:
- Public API boundaries
- When inference is too wide
- For documentation clarity

### Variance

**Understanding variance**:
- Covariance: `T` in output positions (return types)
- Contravariance: `T` in input positions (parameter types)
- Invariance: `T` in both positions

**Why it matters**:
- Affects type compatibility
- Impacts generic soundness
- Influences API design

## 4. Domain Modeling with Types

**Principle**: Model the business domain using TypeScript's type system.

### Rich Domain Types

**Encode business rules**:
- Use discriminated unions for state
- Create branded types for IDs and primitives
- Model relationships with types
- Represent invalid states as impossible

**Benefits**:
- Business logic enforced at compile time
- Self-documenting domain model
- Refactoring guided by compiler

### Type-Safe State Machines

**Pattern**: Discriminated unions for states, transition functions.

**Structure**:
- State union with discriminant
- Transition functions that preserve invariants
- Exhaustive pattern matching

**Benefits**:
- Invalid transitions impossible
- Current state always clear
- Visual representation in types

### Value Objects

**Pattern**: Branded types with validation.

**Structure**:
- Brand to make type nominal
- Constructor function with validation
- Utility functions for operations

**Benefits**:
- Domain primitives are strongly typed
- Validation happens once
- Type safety between domains

## 5. Error Handling Patterns

**Principle**: Make errors explicit in types, avoid throwing exceptions.

### Result Types

**Pattern**: `Result<T, E> = Success<T> | Failure<E>`

**Benefits**:
- Errors are visible in type signatures
- Forces handling of error cases
- Type-safe error propagation
- No uncaught exceptions

**Implementation approaches**:
- Simple `{ ok: true, value: T } | { ok: false, error: E }`
- Functional style with `map`, `flatMap`, `mapError`
- Integration with async code

### Discriminated Error Unions

**Pattern**: Union of specific error types with discriminant.

**Benefits**:
- Exhaustive error handling
- Specific error information preserved
- Type-safe error recovery

**Structure**:
- Each error type has discriminant
- Union all possible errors
- Handle with exhaustive switch

### Type-Safe Try-Catch

**When you must use exceptions**:
- Use typed error boundaries
- Create error type guards
- Document what exceptions can be thrown

## 6. Full-Stack Type Safety

**Principle**: Share types between frontend and backend for end-to-end safety.

### Shared Type Packages

**Structure**:
- Monorepo with shared types package
- Or: Code generation from schema
- Version shared types carefully

**What to share**:
- API request/response types
- Domain models
- Event types
- Configuration types

### Type Generation

**From schema to types**:
- GraphQL → TypeScript (graphql-codegen)
- OpenAPI → TypeScript (openapi-typescript)
- Prisma → TypeScript (prisma client)
- Database → TypeScript (kysely, drizzle)

**Benefits**:
- Single source of truth
- Types always in sync
- Refactoring catches breaking changes

### Type-Safe RPC

**Pattern**: Use tRPC or similar for procedure calls.

**Benefits**:
- No manual type definitions for API
- Autocomplete for API calls
- Type errors on contract violations
- Refactor-safe API evolution

## 7. Architecture Patterns

**Principle**: Organize types for clarity, maintainability, and reusability.

### Type Organization

**File structure**:
- `types/` directory for shared types
- Colocate types with implementation when specific
- Separate domain types from technical types

**Module organization**:
- One concept per file (User types in `user.types.ts`)
- Barrel exports (`index.ts`) for public API
- Internal types not exported

### Type Imports

**Import types explicitly**:
```typescript
import type { User } from './user';
```

**Benefits**:
- Clear distinction: type vs value
- Optimization: type imports can be elided
- Avoid circular dependency issues

### Circular Dependencies

**Avoid with**:
- Extract shared types to separate module
- Use type imports (`import type`)
- Refactor into clearer hierarchy

## 8. Performance Optimization

**Principle**: Monitor and optimize TypeScript compilation performance.

### Build Time

**Diagnose slow builds**:
- Use `tsc --extendedDiagnostics`
- Check `tsc --listFiles` output
- Profile with `--generateTrace`

**Optimize with**:
- Project references for monorepos
- Incremental compilation
- Skip lib check when safe
- Reduce checked files with includes/excludes

### Type Complexity

**Avoid**:
- Deeply nested conditional types
- Massive union types (>100 members)
- Recursive types without limits

**When unavoidable**:
- Cache computed types
- Split complex types into smaller pieces
- Use `type` instead of `interface` when needed

### Declaration Files

**Optimize `.d.ts` generation**:
- Use `declarationMap` for debugging
- Exclude test files from declaration
- Ensure declaration files are treeshakable

## 9. Framework Integration (For Detection Only)

**Note**: This section provides context for **detecting** which frameworks a project uses and understanding project patterns during investigation. For framework-specific TypeScript implementation, use dedicated framework skills (react-typescript-expert, nodejs-typescript-expert, etc.). This content supports investigation protocols, not direct implementation.

**Principle**: Apply TypeScript expertise to framework-specific patterns.

### React

**Component typing**:
- Use `React.FC` sparingly (or avoid)
- Prefer inline props type
- Generic components with inference

**Hooks**:
- Type custom hooks carefully
- Use proper generic constraints
- Infer state types when possible

**Context**:
- Type context value explicitly
- Use discriminated unions for complex state
- Provide type-safe hooks for context

### Node.js/Express

**Request/Response typing**:
- Extend Express types with declaration merging
- Type request params, query, body
- Use middleware for type narrowing

**Dependency injection**:
- Type-safe DI containers
- Inject with interfaces, not concrete types

### Vue/Angular/Others

**Framework-specific patterns**:
- Understand framework's type system
- Use framework's utility types
- Follow framework type conventions

## 10. Migration Strategies

**Principle**: Incrementally improve type safety.

### JavaScript to TypeScript

**Approach**:
1. Add `tsconfig.json` with loose settings
2. Rename files `.js` → `.ts` incrementally
3. Add types gradually (start with function signatures)
4. Enable strict flags one at a time
5. Replace `any` with proper types

### Improving Existing TypeScript

**Approach**:
1. Enable stricter compiler flags incrementally
2. Add `@ts-expect-error` for temporary issues
3. Fix errors file by file or directory by directory
4. Replace `any` and `as any` systematically
5. Introduce advanced patterns gradually

## 11. Documentation

**Principle**: Types are documentation, but comments add context.

### When to Document

**TSDoc comments for**:
- Public API functions and types
- Complex type utilities
- Non-obvious type constraints
- Generic parameters

**Include**:
- Purpose and usage
- Parameter descriptions
- Return value meaning
- Examples for complex APIs

### Type Naming

**Conventions**:
- Clear, descriptive names
- Suffix with semantics when helpful (`UserId` not `UserIdType`)
- Consistent naming across project

## 12. Testing

**Principle**: Test runtime behavior and type behavior separately.

### Runtime Tests

**Standard testing**:
- Unit tests for functions
- Integration tests for modules
- E2E tests for flows

### Type Tests

**Test types with**:
- `expectTypeOf` from vitest or similar
- Type assertion tests (`const x: Type = value`)
- `@ts-expect-error` for error cases

**What to test**:
- Generic type inference
- Conditional type resolution
- Type guard narrowing

---

## Summary: Core TypeScript Principles

1. **Type Safety First** - Make invalid states unrepresentable
2. **Type-Level Programming** - Compute types, don't just describe them
3. **Generics Mastery** - Write reusable, properly constrained code
4. **Domain Modeling** - Encode business rules in types
5. **Explicit Errors** - Make errors visible in type signatures
6. **Full-Stack Safety** - Share types across the stack
7. **Clear Architecture** - Organize types for maintainability
8. **Performance Conscious** - Monitor and optimize build times
9. **Framework Aware** - Apply TypeScript to framework patterns
10. **Incremental Improvement** - Migrate toward stricter types gradually
11. **Documentation** - Types + comments = complete picture
12. **Test Types** - Verify type behavior alongside runtime behavior

**These principles adapt to your project's maturity, architecture, and goals.**
