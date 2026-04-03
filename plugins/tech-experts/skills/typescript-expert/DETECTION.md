# Pattern Detection Rules

How to detect which TypeScript pattern to generate based on context signals.

## Detection Method

**Input**: User request + Project investigation
**Output**: Pattern to generate
**Process**: Match signals → Select pattern → Use template from @PATTERNS.md

---

## Signal → Pattern Mapping

### State Management Signals

**Keywords**: state, status, loading, pending, fetch, async
**Grep Patterns**: `status.*:.*['"]`, `is\w+.*boolean`, `useState`

**Detected Signals**:
- Multiple boolean flags (isLoading, isError, isSuccess)
- Status string literals ("loading", "success", "error")
- State machine keywords

**Pattern**: **Discriminated Union** (Pattern I1 in @PATTERNS.md)

**Template**:
```typescript
type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };
```

---

### ID/Domain Type Signals

**Keywords**: id, identifier, userId, productId, email, uuid
**Grep Patterns**: `\w+Id.*:.*string`, multiple ID type definitions

**Detected Signals**:
- Multiple ID types (userId, productId, orderId)
- Risk of ID confusion
- Domain-specific primitives

**Pattern**: **Branded Types** (Pattern A1 in @PATTERNS.md)

**Template**:
```typescript
type Brand<K, T> = K & { __brand: T };
type UserId = Brand<string, 'UserId'>;
```

---

### Error Handling Signals

**Keywords**: error, exception, try, catch, throw, handle error
**Grep Patterns**: `try\s*{`, `throw\s+new`

**Detected Signals**:
- High try-catch usage
- Explicit error handling needed
- No exceptions preference

**Pattern**: **Result Type** (Pattern A3 in @PATTERNS.md)

**Template**:
```typescript
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

---

### Reusability Signals

**Keywords**: reusable, generic, multiple types, abstract, flexible
**Context**: Function works with different types

**Pattern**: **Generic Function** (Pattern B9 in @PATTERNS.md)

**Template**:
```typescript
function name<T extends Constraint>(param: T): ReturnType {
  // ...
}
```

---

### Type Transformation Signals

**Keywords**: make optional, make readonly, transform, convert all properties
**Context**: Modify existing type

**Patterns**:
- **Utility Types** (Pattern I3) - Built-in transformations
- **Mapped Types** (Pattern I4) - Custom transformations

**Templates**:
```typescript
// Utility
type Update = Partial<Original>;
type Subset = Pick<Original, Keys>;

// Mapped
type Nullable<T> = { [P in keyof T]: T[P] | null };
```

---

### Runtime Checking Signals

**Keywords**: check type, validate, narrow, instanceof, typeof
**Context**: Runtime type validation needed

**Pattern**: **Type Guard** (Pattern I2 in @PATTERNS.md)

**Template** (TS 5.5+):
```typescript
function isType(value: unknown) {
  return typeCheckLogic;
}
// Inferred: value is Type
```

---

### String Pattern Signals

**Keywords**: route, path, event name, CSS class, API endpoint
**Context**: Type-safe strings with patterns

**Pattern**: **Template Literal Types** (Pattern I6 in @PATTERNS.md)

**Template**:
```typescript
type Route = `/api/${string}`;
type EventName = `on${Capitalize<string>}`;
```

---

### Fixed Values Signals

**Keywords**: enum, constants, options, choices
**Context**: Fixed set of possible values

**Pattern**: **Literal Union** (Pattern B3 in @PATTERNS.md)

**Template**:
```typescript
type Status = "idle" | "loading" | "success" | "error";
```

---

### Literal Inference Signals

**Keywords**: exact value, literal type, preserve literals
**Context**: Want literal types not widened types

**Patterns**:
- **as const** (Pattern I8) - For objects/arrays
- **const type parameter** (Pattern T1) - For generic functions

**Templates**:
```typescript
const config = { url: "..." } as const;

function tuple<const T>(...args: T): T {
  return args;
}
```

---

### Type Check + Inference Signals

**Keywords**: satisfies, check type but keep specific
**Context**: Want type checking AND narrow inference

**Pattern**: **satisfies Operator** (Pattern T2 in @PATTERNS.md)

**Template**:
```typescript
const value = expression satisfies Type;
// Type of value: specific type (not widened to Type)
```

---

## Decision Tree

```
User Request Analysis
│
├─ Contains "state", "status", "loading"?
│   └─ YES → Discriminated Union
│
├─ Multiple ID types mentioned?
│   └─ YES → Branded Types
│
├─ Error handling, "result", "either"?
│   └─ YES → Result Type
│
├─ "Generic", "reusable", "works with any"?
│   └─ YES → Generic Function
│
├─ "Make optional", "transform properties"?
│   └─ YES → Utility Types or Mapped Types
│
├─ "Check type", "validate", "narrow"?
│   └─ YES → Type Guard
│
├─ "Route", "path", "event name"?
│   └─ YES → Template Literal Types
│
├─ "Fixed values", "enum", "options"?
│   └─ YES → Literal Union
│
├─ "Exact value", "literal type"?
│   └─ YES → as const or const T
│
├─ "Type check but keep specific"?
│   └─ YES → satisfies operator
│
└─ Otherwise → Ask for clarification or use judgment
```

---

## Context Signals from Investigation

### Project Investigation Informs Pattern Selection

**Strict mode enabled** (tsconfig.strict: true):
- Generate strict-compatible types
- No implicit any
- Explicit null/undefined handling

**TS 5.5+ detected**:
- Use inferred type predicates
- Skip explicit `value is Type`

**Discriminated unions found in codebase**:
- Continue this pattern
- Use consistent discriminant property names

**Branded types detected** (\_\_brand pattern):
- Generate branded types for new IDs
- Follow existing brand pattern

**High try-catch usage**:
- Consider suggesting Result type
- Make errors explicit in types

---

## Multi-Pattern Scenarios

Sometimes multiple patterns apply:

**Example**: "Create type-safe API client"
- **Discriminated Union** for response states
- **Branded Types** for IDs in requests
- **Result Type** for error handling
- **Generic Function** for reusable fetch

**Approach**: Generate composite solution using multiple patterns

---

## Pattern Priority

When multiple patterns could work:

1. **Most Specific** - Pattern most directly solves the problem
2. **Project Consistency** - Pattern already used in project
3. **Simplicity** - Simpler pattern if equally effective
4. **Type Safety** - Pattern with stronger guarantees

---

## Unknown Pattern Detection

If no clear pattern matches:

1. **Ask clarifying questions**
2. **Show pattern options** with trade-offs
3. **Default to simplest** that works
4. **Document reasoning**

---

## Pattern Combinations

Common combinations:

- **Discriminated Union + Type Guard** - State machine with narrowing
- **Branded Type + Generic** - Type-safe generic with domain types
- **Result + Discriminated Union** - Nested error handling
- **Template Literal + Literal Union** - Constrained string patterns

---

**Detection rules ready: Map signals → patterns → generate from @PATTERNS.md**
