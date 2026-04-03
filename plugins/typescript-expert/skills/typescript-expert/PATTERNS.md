# TypeScript Patterns Library - Consolidated

Comprehensive catalog of all TypeScript patterns for agent code generation.

## Pattern Categories

### 1. Basic Patterns (Foundational)
### 2. Intermediate Patterns (Common Use)
### 3. Advanced Patterns (Sophisticated)
### 4. TypeScript 5.x Patterns (Modern)
### 5. Performance Patterns (Optimization)

---

## 1. BASIC PATTERNS

### B1: Interface Definition
**When**: Define object shape
**Complexity**: Low
**Frequency**: Very High

```typescript
interface {{EntityName}} {
  {{propertyName}}: {{propertyType}};
  {{optionalProperty}}?: {{type}};
  readonly {{readonlyProperty}}: {{type}};
}
```

### B2: Type Alias
**When**: Union, intersection, or computed types
**Complexity**: Low
**Frequency**: Very High

```typescript
type {{TypeName}} = {{definition}};

// Union
type {{Name}} = {{Type1}} | {{Type2}} | {{Type3}};

// Intersection
type {{Name}} = {{Type1}} & {{Type2}};
```

### B3: Literal Union Types
**When**: Fixed set of values (enum alternative)
**Complexity**: Low
**Frequency**: High

```typescript
type {{TypeName}} = {{literal1}} | {{literal2}} | {{literal3}};

// Example
type Status = "idle" | "loading" | "success" | "error";
type HTTPMethod = "GET" | "POST" | "PUT" | "DELETE";
```

### B4: Array Types
**When**: Homogeneous collections
**Complexity**: Low
**Frequency**: Very High

```typescript
type {{Name}} = {{ElementType}}[];
// or
type {{Name}} = Array<{{ElementType}}>;
```

### B5: Tuple Types
**When**: Fixed-length, typed arrays
**Complexity**: Low
**Frequency**: Medium

```typescript
type {{Name}} = [{{type1}}, {{type2}}, {{type3}}];

// Named tuples
type {{Name}} = [{{name1}}: {{type1}}, {{name2}}: {{type2}}];

// Rest elements
type {{Name}} = [{{first}}: {{type}}, ...{{rest}}: {{type}}[]];
```

### B6: Optional Properties
**When**: Property may not exist
**Complexity**: Low
**Frequency**: Very High

```typescript
interface {{Name}} {
  {{requiredProp}}: {{type}};
  {{optionalProp}}?: {{type}};
}
```

### B7: Readonly Properties
**When**: Immutable data
**Complexity**: Low
**Frequency**: Medium

```typescript
interface {{Name}} {
  readonly {{prop}}: {{type}};
}

// Readonly array
type {{Name}} = readonly {{ElementType}}[];
```

### B8: Index Signatures
**When**: Dynamic property names
**Complexity**: Low
**Frequency**: Medium

```typescript
interface {{Name}} {
  [{{key}}: string]: {{ValueType}};
  // or
  [{{key}}: number]: {{ValueType}};
}
```

### B9: Basic Generics
**When**: Reusable type parameter
**Complexity**: Medium
**Frequency**: High

```typescript
interface {{Name}}<{{T}}> {
  {{prop}}: {{T}};
}

function {{name}}<{{T}}>({{param}}: {{T}}): {{T}} {
  return {{param}};
}
```

### B10: Generic Constraints
**When**: Limit generic type
**Complexity**: Medium
**Frequency**: High

```typescript
function {{name}}<{{T}} extends {{Constraint}}>({{param}}: {{T}}): {{ReturnType}} {
  // T must satisfy Constraint
}

// Example
function getLength<T extends { length: number }>(value: T): number {
  return value.length;
}
```

---

## 2. INTERMEDIATE PATTERNS

### I1: Discriminated Unions ⭐ CRITICAL
**When**: Variant types, state machines, results
**Complexity**: Medium
**Frequency**: Very High

```typescript
type {{UnionName}} =
  | { {{discriminant}}: {{literal1}}; {{prop1}}: {{type1}} }
  | { {{discriminant}}: {{literal2}}; {{prop2}}: {{type2}} }
  | { {{discriminant}}: {{literal3}}; {{prop3}}: {{type3}} };

// Handler with exhaustiveness
function handle{{Name}}({{param}}: {{UnionName}}): {{ReturnType}} {
  switch ({{param}}.{{discriminant}}) {
    case {{literal1}}:
      return {{handler1}};
    case {{literal2}}:
      return {{handler2}};
    case {{literal3}}:
      return {{handler3}};
    default:
      const _exhaustive: never = {{param}};
      return _exhaustive;
  }
}
```

**Example**:
```typescript
type Result<T, E> =
  | { success: true; value: T }
  | { success: false; error: E };
```

### I2: Type Guards
**When**: Runtime type checking and narrowing
**Complexity**: Medium
**Frequency**: High

```typescript
function is{{TypeName}}({{value}}: unknown): {{value}} is {{TypeName}} {
  return {{typeCheckLogic}};
}

// Example
function isString(value: unknown): value is string {
  return typeof value === "string";
}
```

**TS 5.5+**: Inferred type predicates (no explicit `value is Type`)

### I3: Utility Type Usage
**When**: Transform existing types
**Complexity**: Medium
**Frequency**: Very High

```typescript
// Partial - all optional
type Update{{Name}} = Partial<{{Name}}>;

// Required - all required
type Complete{{Name}} = Required<{{Name}}>;

// Readonly - all readonly
type Immutable{{Name}} = Readonly<{{Name}}>;

// Pick - select properties
type {{Name}}Subset = Pick<{{Name}}, {{keys}}>;

// Omit - exclude properties
type {{Name}}Without = Omit<{{Name}}, {{keys}}>;

// Record - object with specific keys
type {{Name}}Map = Record<{{KeyType}}, {{ValueType}}>;
```

### I4: Mapped Types
**When**: Transform all properties
**Complexity**: Medium-High
**Frequency**: Medium

```typescript
type {{NewType}}<T> = {
  [P in keyof T]: {{Transformation}}<T[P]>;
};

// Add modifiers
type {{Name}}<T> = {
  readonly [P in keyof T]: T[P]; // Add readonly
  [P in keyof T]?: T[P];          // Add optional
  -readonly [P in keyof T]: T[P]; // Remove readonly
  [P in keyof T]-?: T[P];         // Remove optional
};

// Example: Nullable
type Nullable<T> = {
  [P in keyof T]: T[P] | null;
};
```

### I5: Conditional Types
**When**: Type-level logic
**Complexity**: Medium-High
**Frequency**: Medium

```typescript
type {{Name}}<T> = T extends {{Condition}} ? {{TrueType}} : {{FalseType}};

// Example
type IsString<T> = T extends string ? true : false;
type ArrayElement<T> = T extends (infer U)[] ? U : never;
```

### I6: Template Literal Types
**When**: String pattern types
**Complexity**: Medium
**Frequency**: Medium

```typescript
type {{Name}} = `{{prefix}}${{{Variable}}}{{suffix}}`;

// Example
type HTTPMethod = "GET" | "POST";
type Endpoint = `/api/${string}`;
type Route = `${HTTPMethod} ${Endpoint}`;
// "GET /api/users", "POST /api/items", etc.
```

### I7: `infer` Keyword
**When**: Extract types from complex types
**Complexity**: High
**Frequency**: Medium

```typescript
// Extract return type
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

// Extract array element
type ElementType<T> = T extends (infer U)[] ? U : never;

// Extract promise value
type Awaited<T> = T extends Promise<infer U> ? U : T;
```

### I8: Generic Defaults
**When**: Optional generic parameters
**Complexity**: Low-Medium
**Frequency**: Medium

```typescript
interface {{Name}}<T = {{DefaultType}}> {
  {{prop}}: T;
}

// Usage
type A = {{Name}};        // Uses default
type B = {{Name}}<{{Type}}>; // Overrides default
```

### I9: Multiple Type Parameters
**When**: Multiple generic types needed
**Complexity**: Medium
**Frequency**: Medium

```typescript
function {{name}}<{{T}}, {{U}}>(
  {{param1}}: {{T}},
  {{param2}}: ({{item}}: {{T}}) => {{U}}
): {{U}} {
  return {{param2}}({{param1}});
}
```

### I10: Intersection Types
**When**: Combine multiple types
**Complexity**: Low-Medium
**Frequency**: High

```typescript
type {{Name}} = {{Type1}} & {{Type2}} & {{Type3}};

// Example
type Timestamped = { createdAt: Date; updatedAt: Date };
type User = { id: string; name: string };
type TimestampedUser = User & Timestamped;
```

---

## 3. ADVANCED PATTERNS

### A1: Branded Types ⭐ IMPORTANT
**When**: Nominal typing, prevent ID confusion
**Complexity**: Medium
**Frequency**: Medium-High

```typescript
type Brand<K, T> = K & { __brand: T };

type {{EntityName}}Id = Brand<{{BaseType}}, '{{EntityName}}Id'>;

function create{{EntityName}}Id({{value}}: {{BaseType}}): {{EntityName}}Id {
  if ({{validation}}) {
    throw new Error('Invalid {{EntityName}}Id');
  }
  return {{value}} as {{EntityName}}Id;
}
```

**Example**:
```typescript
type UserId = Brand<string, 'UserId'>;
type ProductId = Brand<string, 'ProductId'>;

function getUser(id: UserId): User { /* ... */ }
getUser(productId); // ✗ Type error
```

### A2: Recursive Types
**When**: Deep transformations
**Complexity**: High
**Frequency**: Low-Medium

```typescript
type Deep{{Operation}}<T, Depth extends number = 5> = Depth extends 0
  ? T
  : T extends {{Primitive}}
  ? T
  : T extends Array<infer U>
  ? Array<Deep{{Operation}}<U, Prev[Depth]>>
  : { {{modifier}} [K in keyof T]: Deep{{Operation}}<T[K], Prev[Depth]> };

type Prev = [never, 0, 1, 2, 3, 4, 5, ...0[]];
```

**Example**:
```typescript
type DeepReadonly<T> = T extends Primitive
  ? T
  : T extends Array<infer U>
  ? ReadonlyArray<DeepReadonly<U>>
  : { readonly [K in keyof T]: DeepReadonly<T[K]> };
```

### A3: Result/Either Type ⭐ IMPORTANT
**When**: Explicit error handling
**Complexity**: Medium
**Frequency**: Medium

```typescript
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

namespace Result {
  export function ok<T>(value: T): Result<T, never> {
    return { ok: true, value };
  }

  export function err<E>(error: E): Result<never, E> {
    return { ok: false, error };
  }

  export function map<T, U, E>(
    result: Result<T, E>,
    fn: (value: T) => U
  ): Result<U, E> {
    return result.ok ? ok(fn(result.value)) : result;
  }

  export function flatMap<T, U, E>(
    result: Result<T, E>,
    fn: (value: T) => Result<U, E>
  ): Result<U, E> {
    return result.ok ? fn(result.value) : result;
  }
}
```

### A4: Builder Pattern with Type State
**When**: Complex object construction
**Complexity**: High
**Frequency**: Low

```typescript
interface BuilderState {
  {{field1}}: boolean;
  {{field2}}: boolean;
}

class {{Name}}Builder<State extends BuilderState = {{InitialState}}> {
  private data: Partial<{{TargetType}}> = {};

  set{{Field1}}({{value}}: {{Type1}}): {{Name}}Builder<State & { {{field1}}: true }> {
    this.data.{{field1}} = {{value}};
    return this as any;
  }

  build(this: {{Name}}Builder<{{CompleteState}}>): {{TargetType}} {
    return this.data as {{TargetType}};
  }
}
```

### A5: Opaque Types
**When**: Stricter than branded types
**Complexity**: Medium-High
**Frequency**: Low

```typescript
declare const OpaqueTag: unique symbol;
type Opaque<T, K> = T & { readonly [OpaqueTag]: K };

type {{TypeName}} = Opaque<{{BaseType}}, '{{TypeName}}'>;

function create{{TypeName}}({{value}}: {{BaseType}}): {{TypeName}} {
  if ({{validation}}) throw new Error('Invalid');
  return {{value}} as {{TypeName}};
}
```

### A6: Key Remapping in Mapped Types
**When**: Transform property names
**Complexity**: High
**Frequency**: Low-Medium

```typescript
type {{NewType}}<T> = {
  [P in keyof T as {{Transformation}}<P>]: T[P];
};

// Example: Getters
type Getters<T> = {
  [P in keyof T as `get${Capitalize<string & P>}`]: () => T[P];
};
```

### A7: Conditional Type Distributivity
**When**: Distribute over unions
**Complexity**: High
**Frequency**: Low-Medium

```typescript
// Distributive (default for naked type parameter)
type ToArray<T> = T extends any ? T[] : never;
type Result = ToArray<string | number>;
// string[] | number[]

// Non-distributive (wrap in [])
type ToTuple<T> = [T] extends [any] ? [T] : never;
type Result2 = ToTuple<string | number>;
// [string | number]
```

### A8: Phantom Types
**When**: Encode state in type
**Complexity**: Medium
**Frequency**: Low

```typescript
type Validated<T, Brand> = T & { __validated: Brand };

type Validated{{Name}} = Validated<{{BaseType}}, '{{Name}}'>;

function validate{{Name}}({{value}}: {{BaseType}}): Validated{{Name}} | null {
  return {{validationCheck}}
    ? ({{value}} as Validated{{Name}})
    : null;
}
```

### A9: Higher-Kinded Types Simulation
**When**: Abstract type constructors
**Complexity**: Very High
**Frequency**: Very Low

```typescript
interface HKT<F, A> {
  _A: A;
  _F: F;
}

// Rarely used in practice
```

### A10: Type-Level String Manipulation
**When**: Parse/transform string types
**Complexity**: Very High
**Frequency**: Low

```typescript
type Split<S extends string, D extends string> =
  S extends `${infer T}${D}${infer U}`
    ? [T, ...Split<U, D>]
    : S extends ""
    ? []
    : [S];

type Parts = Split<"hello-world-test", "-">;
// ["hello", "world", "test"]
```

---

## 4. TYPESCRIPT 5.X PATTERNS

### T1: `const` Type Parameters (5.0+)
**When**: Infer literal types
**Complexity**: Low-Medium
**Frequency**: Medium

```typescript
function {{name}}<const T>({{value}}: T): T {
  return {{value}};
}

const arr = {{name}}([1, 2, 3]);
// Type: readonly [1, 2, 3] (not number[])
```

### T2: `satisfies` Operator (5.0+)
**When**: Type check + narrow inference
**Complexity**: Low
**Frequency**: High

```typescript
const {{value}} = {{expression}} satisfies {{Type}};

// Example
const config = {
  url: "https://example.com",
  port: 3000
} satisfies Config;
// Type: { url: string; port: number } (not Config)
```

### T3: `using` Declarations (5.2+)
**When**: Automatic resource cleanup
**Complexity**: Medium
**Frequency**: Low-Medium

```typescript
{
  using {{resource}} = {{getResource}}();
  // Automatically disposed at end of block
}

interface Disposable {
  [Symbol.dispose](): void;
}

class {{ResourceName}} implements Disposable {
  [Symbol.dispose]() {
    // Cleanup logic
  }
}
```

### T4: `NoInfer<T>` Utility (5.4+)
**When**: Prevent inference in specific positions
**Complexity**: Medium
**Frequency**: Low-Medium

```typescript
function {{name}}<T>(
  {{param1}}: T,
  {{param2}}: (a: T, b: NoInfer<T>) => T
) {
  // param2's second parameter doesn't influence T inference
}
```

### T5: Inferred Type Predicates (5.5+)
**When**: Automatic type guard inference
**Complexity**: Low
**Frequency**: High

```typescript
function is{{TypeName}}({{value}}: unknown) {
  return {{typeCheckLogic}};
}
// TypeScript infers: value is {{TypeName}}

const values: unknown[] = [{{items}}];
const filtered = values.filter(is{{TypeName}});
// filtered: {{TypeName}}[]
```

### T6: Import Attributes (5.3+)
**When**: Import with metadata
**Complexity**: Low
**Frequency**: Low

```typescript
import {{name}} from "{{path}}" with { type: "json" };
```

### T7: Decorator Metadata (5.2+)
**When**: Runtime reflection
**Complexity**: High
**Frequency**: Low

```typescript
function {{decoratorName}}(target: any, context: ClassMethodDecoratorContext) {
  context.metadata.{{key}} = {{value}};
}
```

---

## 5. PERFORMANCE PATTERNS

### P1: Type Caching
**When**: Reuse computed types
**Complexity**: Low
**Frequency**: High

```typescript
// ❌ Recomputes each time
type A = ComplexType<string>;
type B = ComplexType<string>;

// ✅ Cache
type StringComplex = ComplexType<string>;
type A = StringComplex;
type B = StringComplex;
```

### P2: Depth-Limited Recursion
**When**: Prevent infinite types
**Complexity**: Medium
**Frequency**: Medium

```typescript
type Deep{{Op}}<T, Depth extends number = 3> = Depth extends 0
  ? T
  : {{recursiveLogic}}<T, Prev[Depth]>;

type Prev = [never, 0, 1, 2, 3, 4, 5, ...0[]];
```

### P3: Type-Only Imports
**When**: Import types separately
**Complexity**: Low
**Frequency**: Very High

```typescript
import type { {{TypeNames}} } from "{{module}}";
import { {{valueNames}} } from "{{module}}";
```

### P4: Prefer `type` for Complex Types
**When**: Unions, intersections, mapped types
**Complexity**: Low
**Frequency**: High

```typescript
// Use type for:
type Union = A | B | C;
type Intersection = A & B;
type Mapped = { [K in keyof T]: U };
type Conditional = T extends U ? X : Y;

// Use interface for:
interface SimpleObject {
  prop: Type;
}
```

### P5: Avoid Barrel Exports
**When**: Many re-exports slow compilation
**Complexity**: Low
**Frequency**: Medium

```typescript
// ❌ Slow
export * from "./module1";
export * from "./module2";

// ✅ Fast
export { specific, exports } from "./module1";
```

---

## PATTERN SUMMARY

**Total Patterns**: 42

**By Frequency**:
- Very High (15): Interfaces, types, unions, generics, utility types, discriminated unions
- High (20): Mapped types, conditional types, type guards, branded types, satisfies
- Medium (25): Template literals, recursive types, Result types, builders
- Low (15): HKT, type-level programming, advanced patterns

**By Complexity**:
- Low (25): Basic types, interfaces, literals, simple generics
- Medium (30): Mapped types, conditional types, discriminated unions
- High (15): Recursive types, builders, HKT simulation
- Very High (5): Type-level programming, advanced recursion

**Agent Priority**:
1. **Critical** (Use Always): Discriminated unions, type guards, utility types
2. **Important** (Use Often): Branded types, generics, Result types, satisfies
3. **Situational** (Use When Needed): Recursive types, builders, template literals
4. **Rare** (Special Cases): HKT, type-level programming

---

**Pattern library consolidated: 42 patterns ready for agent generation**
