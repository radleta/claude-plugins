# TypeScript Reference - Performance & Troubleshooting

Quick reference for performance optimization, common issues, and edge cases.

## Performance Optimization

### Must-Have tsconfig Options

```json
{
  "compilerOptions": {
    "skipLibCheck": true,        // ⚡⚡⚡ 30-50% faster
    "incremental": true,          // ⚡⚡⚡ 2-3x faster rebuilds
    "isolatedModules": true,      // ⚡⚡ Required for esbuild/SWC
    "moduleResolution": "bundler" // ⚡⚡ For Vite/esbuild
  }
}
```

### Project References (Monorepos)

**When**: Monorepo with 3+ packages

**Setup**:
```json
// Root tsconfig.json
{
  "files": [],
  "references": [
    { "path": "./packages/shared" },
    { "path": "./packages/api" }
  ]
}

// Package tsconfig.json
{
  "compilerOptions": {
    "composite": true,  // Required
    "declaration": true // Required
  },
  "references": [{ "path": "../shared" }]
}
```

**Build**: `tsc --build`

### Type Complexity Limits

**Avoid**:
- Recursive types > 5 levels deep
- Union types > 100 members
- Deeply nested conditional types (> 5 levels)

**Fix**: Add depth limits
```typescript
type Deep<T, Depth extends number = 3> = Depth extends 0
  ? T
  : { [K in keyof T]: Deep<T[K], Prev[Depth]> };

type Prev = [never, 0, 1, 2, 3, 4, 5, ...0[]];
```

### Import Optimization

**Always use type-only imports**:
```typescript
import type { User, Config } from "./types";
import { api } from "./api";
```

**Avoid barrel exports** (or use sparingly):
```typescript
// ❌ Slow
export * from "./module1";
export * from "./module2";

// ✅ Fast
export { specific, exports } from "./module1";
```

---

## Common Issues & Solutions

### Issue 1: "Type instantiation is excessively deep"

**Cause**: Recursive type without termination or depth limit

**Solution**:
```typescript
// Add depth limit
type DeepPartial<T, D extends number = 5> = D extends 0
  ? T
  : { [K in keyof T]?: DeepPartial<T[K], Prev[D]> };
```

### Issue 2: Slow Type Checking

**Diagnose**:
```bash
tsc --extendedDiagnostics
tsc --generateTrace traceDir
```

**Common Fixes**:
- Enable `skipLibCheck: true`
- Reduce type complexity
- Use project references
- Cache computed types

### Issue 3: Circular Type References

**Problem**:
```typescript
interface A { b: B; }
interface B { a: A; }
// Can cause infinite type checking
```

**Solution**:
```typescript
interface A { b: B | null; }
interface B { a: A | null; }
// Break cycle with null
```

### Issue 4: Type 'never' Unexpectedly

**Cause**: Conflicting constraints or impossible intersection

**Debug**:
```typescript
type A = string & number; // never (impossible)
type B = { x: string } & { x: number }; // { x: never }
```

**Solution**: Check for conflicting types in intersection

### Issue 5: Generic Inference Not Working

**Problem**:
```typescript
function create<T>(value: T, default: T) {
  // T inferred too wide from both parameters
}
```

**Solution**: Use `NoInfer<T>` (TS 5.4+)
```typescript
function create<T>(value: T, default: NoInfer<T>) {
  // T only inferred from first parameter
}
```

---

## TypeScript 5.x Migration

### From TS 4.x to 5.x

**New Features to Adopt**:
1. `const` type parameters - Literal inference
2. `satisfies` operator - Type check + narrow
3. `using` declarations - Resource management
4. `NoInfer` - Control inference
5. Inferred type predicates - Simpler guards

**Breaking Changes**:
- Some stricter checking
- Deprecated features removed (check release notes)

**Migration Steps**:
1. Update `package.json`: `"typescript": "^5.6.0"`
2. Run `npm install`
3. Check for errors: `tsc --noEmit`
4. Fix errors incrementally
5. Adopt new features gradually

---

## Module System Guide

### ESM vs CommonJS

**Detect**:
- package.json `type: "module"` → ESM
- No type field → CommonJS (default)

**tsconfig for ESM**:
```json
{
  "compilerOptions": {
    "module": "ESNext" or "NodeNext",
    "moduleResolution": "bundler" or "node16"
  }
}
```

**tsconfig for CommonJS**:
```json
{
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "node"
  }
}
```

### Import Extensions

**ESM**: Requires `.js` extension in imports (even in .ts files)
```typescript
import { foo } from "./bar.js"; // Note: .js not .ts
```

**CommonJS**: No extension needed
```typescript
import { foo } from "./bar";
```

---

## Declaration Files (.d.ts)

### When to Write

- Adding types for JavaScript library
- Augmenting third-party types
- Module declarations for non-TS files

### Structure

```typescript
// Ambient module
declare module "package-name" {
  export interface Config {
    // ...
  }
  export function api(): void;
}

// Global augmentation
declare global {
  interface Window {
    customProp: string;
  }
}

// Module augmentation
declare module "express" {
  interface Request {
    user?: User;
  }
}
```

---

## Edge Cases

### Template Literal Edge Cases

**Be careful with**:
- Very large unions (combinatorial explosion)
- Recursive template literals

**Example**:
```typescript
// ❌ Slow (4 × 4 × 4 = 64 combinations)
type A = "a" | "b" | "c" | "d";
type Combo = `${A}-${A}-${A}`;

// ✅ Better
type Combo = `${A}-${string}`;
```

### Conditional Type Distribution

**Unexpected behavior**:
```typescript
type ToArray<T> = T extends any ? T[] : never;
type Result = ToArray<string | number>;
// string[] | number[] (distributed)
// NOT: (string | number)[]
```

**Prevent distribution**:
```typescript
type ToTuple<T> = [T] extends [any] ? [T] : never;
type Result = ToTuple<string | number>;
// [string | number] (not distributed)
```

### as const Gotchas

**Readonly applies recursively**:
```typescript
const obj = { nested: { x: 1 } } as const;
obj.nested.x = 2; // ✗ Error: readonly
```

**Array becomes readonly tuple**:
```typescript
const arr = [1, 2, 3] as const;
// Type: readonly [1, 2, 3]
arr.push(4); // ✗ Error: readonly
```

---

## Debugging TypeScript Types

### Reveal Type

```typescript
type Reveal<T> = T extends infer U ? U : never;
type Test = Reveal<ComplexType>; // Hover to see resolved type
```

### Expand Type Alias

```typescript
type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;
type Expanded = Expand<ComplexIntersection>; // See all properties
```

### Test Type Equality

```typescript
type Expect<T extends true> = T;
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false;

type Test = Expect<Equal<Type1, Type2>>;
// Compile error if not equal
```

---

## Performance Monitoring

### Build Time Tracking

```bash
# Measure build time
time tsc

# Detailed diagnostics
tsc --extendedDiagnostics

# Trace (visualize in chrome://tracing)
tsc --generateTrace traceDir
```

### Watch Mode Optimization

```json
{
  "watchOptions": {
    "watchFile": "useFsEvents",
    "excludeDirectories": ["**/node_modules", "**/.git"]
  }
}
```

---

## Best Practices Summary

### Type Design
- Prefer `type` for unions/intersections/mapped/conditional
- Use `interface` for simple object shapes
- Cache computed types in type aliases
- Limit recursive types to 5 levels

### Performance
- Always: `skipLibCheck: true`, `incremental: true`
- Use `import type` for type-only imports
- Avoid barrel exports when possible
- Use project references for monorepos

### Code Generation
- Generate strict-mode-compatible types
- Make invalid states unrepresentable
- Use discriminated unions for variants
- Prefer branded types for domain IDs

### Maintenance
- Document complex types with comments
- Use TSDoc for public APIs
- Test types with type assertions
- Monitor build times

---

## Quick Commands

```bash
# Type check only (no emit)
tsc --noEmit

# Watch mode
tsc --watch

# Project references build
tsc --build

# Clean build
tsc --build --clean

# Diagnostics
tsc --extendedDiagnostics

# Generate trace
tsc --generateTrace traceDir

# List files
tsc --listFiles

# Show config
tsc --showConfig
```

---

**Reference complete: Performance, troubleshooting, edge cases, and best practices**
