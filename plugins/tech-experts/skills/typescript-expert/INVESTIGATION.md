# Investigation Protocols - Agent-Executable

Tool-specific investigation protocols for TypeScript projects.

## Protocol 1: TypeScript Configuration Discovery

**Tool**: Read
**Target**: `tsconfig.json` (if location unknown: Glob `**/tsconfig.json`)

**Extract**:
```
1. compilerOptions.strict → Boolean
2. compilerOptions.target → ES version string
3. compilerOptions.module → Module system string
4. compilerOptions.moduleResolution → Resolution mode
5. compilerOptions.lib → Array of libs
6. compilerOptions.skipLibCheck → Boolean
7. compilerOptions.incremental → Boolean
8. compilerOptions.composite → Boolean (project references)
```

**Decision Tree**:
```
Is strict mode enabled?
├─ Yes (strict: true)
│   └─ Generate strict-mode-compatible types
│       - No `any` types
│       - Explicit null/undefined handling
│       - All parameters typed
│
└─ No (strict: false or undefined)
    └─ Check individual flags
        ├─ strictNullChecks: true → Handle null/undefined explicitly
        ├─ noImplicitAny: true → No implicit any
        └─ Recommend: Enable strict mode in suggestions

Is composite: true present?
├─ Yes → This is a monorepo with project references
│   └─ Look for references array
│       └─ Understand package dependencies
└─ No → Standalone project

Target ES version?
├─ ES2020+ → Use modern features freely
├─ ES2015-ES2019 → Avoid latest features
└─ ES5 → Very conservative, legacy support
```

**Verification**:
```bash
# Validate tsconfig.json syntax
tsc --showConfig
```

---

## Protocol 2: TypeScript Version Detection

**Tool**: Read
**Target**: `package.json`

**Extract**:
```
devDependencies.typescript OR dependencies.typescript
```

**Decision Tree**:
```
TypeScript version >= 5.6?
├─ Yes → Use all TS 5.x features
│   - const type parameters
│   - satisfies operator
│   - using declarations
│   - NoInfer utility
│   - Inferred type predicates
│
├─ TypeScript 5.0-5.5?
│   └─ Check specific version
│       ├─ 5.5+ → Inferred type predicates available
│       ├─ 5.4+ → NoInfer available
│       ├─ 5.2+ → using declarations available
│       └─ 5.0+ → const type parameters, satisfies available
│
├─ TypeScript 4.x?
│   └─ No TS 5.x features
│       - Recommend upgrade
│       - Use TS 4.x patterns only
│
└─ TypeScript < 4.0?
    └─ Very outdated
        - Strong upgrade recommendation
        - Limited pattern support
```

**Verification**:
```bash
# Check installed version
npx tsc --version
```

---

## Protocol 3: Existing Type Pattern Discovery

**Tool**: Grep
**Pattern 1**: `type\s+\w+\s*=` (Type aliases)
**Pattern 2**: `interface\s+\w+` (Interfaces)
**Pattern 3**: `type\s+\w+\s*=.*\|` (Union types)

**Extract Count and Analyze**:

**Example investigation approach** (adapt to your tools):
```bash
# Find all type definitions
grep -r "type\s\+\w\+\s*=" src/ --count

# Find all interfaces
grep -r "interface\s\+\w\+" src/ --count

# Find discriminated unions (type with |)
grep -r "type.*=.*{.*}.*|.*{.*}" src/
```

**Pattern Detection**:
```
High type alias usage (> 50)?
└─ Project prefers type over interface
    └─ Use type for new definitions

High interface usage (> 50)?
└─ Project prefers interface
    └─ Use interface for object shapes

Discriminated unions found (grep matches > 5)?
└─ Project uses discriminated union pattern
    └─ Continue this pattern for state/variants

Branded types detected (pattern: __brand)?
└─ Project uses nominal typing
    └─ Generate branded types for IDs
```

---

## Protocol 4: ID Type Discovery

**Tool**: Grep
**Pattern**: `\w+Id.*:.*string` OR `\w+Id.*:.*number`

**Extract**:

**Example investigation approach** (adapt to your tools):
```bash
# Find all ID-like properties
grep -r "\w\+Id\s*:\s*string\|number" src/ -o | sort | uniq
```

**Analysis**:
```
Multiple ID types found (userId, productId, orderId, etc.)?
├─ Yes (> 3 different ID types)
│   └─ Generate branded types for each
│       type Brand<K, T> = K & { __brand: T };
│       type UserId = Brand<string, 'UserId'>;
│       type ProductId = Brand<string, 'ProductId'>;
│
└─ No (< 3 ID types)
    └─ Branded types optional, use judgment
```

---

## Protocol 5: State Management Pattern Detection

**Tool**: Grep
**Pattern 1**: `useState` (React state)
**Pattern 2**: `status.*:.*['"]` (Status fields)
**Pattern 3**: `isLoading.*isError.*isSuccess` (Boolean flags)

**Extract**:

**Example investigation approach** (adapt to your tools):
```bash
# Find state management patterns
grep -r "useState\|useReducer" src/

# Find status fields
grep -r "status\s*:\s*['\"]" src/

# Find boolean flag patterns
grep -r "is\w\+\s*:\s*boolean" src/ --count
```

**Pattern Analysis**:
```
Multiple boolean flags for state (isLoading, isError, isSuccess)?
├─ Yes → Anti-pattern, should be discriminated union
│   └─ Suggest refactor:
│       type State<T> =
│         | { status: 'idle' }
│         | { status: 'loading' }
│         | { status: 'success'; data: T }
│         | { status: 'error'; error: Error };
│
└─ No → Check for discriminated unions
    └─ status: 'loading' | 'success' | 'error' found?
        ├─ Yes → Good pattern, continue using
        └─ No → Introduce for new state
```

---

## Protocol 6: Error Handling Pattern Detection

**Tool**: Grep
**Pattern 1**: `try\s*{` (Try-catch blocks)
**Pattern 2**: `throw\s+new\s+Error` (Throwing errors)
**Pattern 3**: `Result.*=.*{.*ok:` (Result type pattern)

**Extract**:

**Example investigation approach** (adapt to your tools):
```bash
# Count try-catch usage
grep -r "try\s*{" src/ --count

# Count throw statements
grep -r "throw\s\+new" src/ --count

# Find Result type pattern
grep -r "Result.*{.*ok:" src/
```

**Analysis**:
```
High try-catch usage (> 10 occurrences)?
├─ Yes → Project uses exceptions
│   ├─ Result type found?
│   │   ├─ Yes → Migrating to Result pattern
│   │   └─ No → Suggest Result type for new code
│   │       type Result<T, E = Error> =
│   │         | { ok: true; value: T }
│   │         | { ok: false; error: E };
│   │
│   └─ Continue existing pattern for consistency
│
└─ Low try-catch (< 5)
    └─ Check for Result type
        ├─ Found → Use Result type consistently
        └─ Not found → Either pattern acceptable
```

---

## Protocol 7: Utility Type Usage Detection

**Tool**: Grep
**Pattern**: `Partial<|Required<|Readonly<|Pick<|Omit<|Record<`

**Extract**:

**Example investigation approach** (adapt to your tools):
```bash
# Find utility type usage
grep -r "Partial<\|Required<\|Readonly<\|Pick<\|Omit<\|Record<" src/ --count
```

**Analysis**:
```
High utility type usage (> 20)?
└─ Project leverages TypeScript utilities
    └─ Use utilities extensively in new code

Low usage (< 5)?
└─ Project may not be aware of utilities
    └─ Introduce utilities where applicable
```

---

## Protocol 8: Generic Usage Pattern

**Tool**: Grep
**Pattern 1**: `<T>|<T,|<T extends`
**Pattern 2**: `function.*<\w+>`

**Extract**:

**Example investigation approach** (adapt to your tools):
```bash
# Find generic function definitions
grep -r "function\s\+\w\+<\w\+>" src/ --count

# Find generic interfaces
grep -r "interface\s\+\w\+<\w\+>" src/ --count
```

**Analysis**:
```
High generic usage (> 30)?
└─ Project uses advanced TypeScript
    └─ Use complex generics confidently

Medium usage (10-30)?
└─ Moderate TypeScript proficiency
    └─ Use generics, explain complexity

Low usage (< 10)?
└─ Basic TypeScript usage
    └─ Introduce generics gradually
```

---

## Protocol 9: Module System Detection

**Tool**: Read
**Target**: `package.json`

**Extract**:
```
type field: "module" OR "commonjs" OR undefined
```

**Also Check tsconfig.json**:
```
compilerOptions.module: "ESNext" | "CommonJS" | "NodeNext" | etc.
```

**Decision Tree**:
```
package.json type: "module"?
├─ Yes → ESM project
│   └─ Use import/export syntax
│       import { foo } from "./bar.js";  // Note: .js extension
│       export { baz };
│
└─ No → CommonJS (default)
    └─ tsconfig module: "ESNext" or "ES2020"?
        ├─ Yes → ESM in TypeScript, CJS in output
        │   └─ Use import/export in .ts files
        └─ No → Pure CommonJS
            └─ Use require/module.exports compatible
```

---

## Protocol 10: Build Tool Detection

**Tool**: Read + Grep
**Target**: `package.json`

**Extract**:
```
devDependencies keys: "vite", "webpack", "esbuild", "rollup", "parcel", "swc"
scripts: Check for build commands
```

**Analysis**:
```
Vite detected?
└─ Use moduleResolution: "bundler"
    └─ Optimized for Vite

Webpack detected?
└─ Check for ts-loader or babel-loader
    └─ May need specific tsconfig settings

esbuild/SWC detected?
└─ Ensure isolatedModules: true
    └─ Required for these tools

No bundler detected?
└─ Pure tsc compilation
    └─ Standard tsconfig sufficient
```

---

## Protocol 11: Testing Framework Detection

**Tool**: Read
**Target**: `package.json`

**Extract**:
```
devDependencies: "jest", "vitest", "mocha", "@types/jest", etc.
```

**Decision Tree**:
```
Jest detected?
└─ Check for @types/jest
    ├─ Present → TypeScript configured
    └─ Missing → Recommend installing

Vitest detected?
└─ Modern testing setup
    └─ Use Vitest type definitions

No test framework?
└─ Recommend Vitest (modern) or Jest
```

---

## Protocol 12: Linter/Formatter Detection

**Tool**: Read
**Target**: Look for config files

**Check for**:
```
.eslintrc.* files (ESLint)
.prettierrc.* files (Prettier)
tsconfig.json → @typescript-eslint/* in package.json
```

**Analysis**:
```
ESLint + @typescript-eslint found?
└─ Project has TypeScript linting
    └─ Follow existing lint rules

Prettier found?
└─ Code formatting enforced
    └─ Generate formatted code

Neither found?
└─ No enforced style
    └─ Follow TypeScript conventions
```

---

## Investigation Checklist

After running all protocols, verify:

- [ ] TypeScript version identified
- [ ] Compiler configuration understood (strict mode, target, module)
- [ ] Existing type patterns discovered (interface vs type preference)
- [ ] ID types analyzed (branded types needed?)
- [ ] State management pattern identified
- [ ] Error handling approach determined
- [ ] Utility type usage level assessed
- [ ] Generic usage complexity understood
- [ ] Module system clarified (ESM vs CommonJS)
- [ ] Build tool identified
- [ ] Testing framework detected
- [ ] Linter/formatter presence checked

---

## Investigation Report Template

After investigation, create mental model:

```
Project: {{projectName}}

TypeScript Setup:
- Version: {{version}}
- Strict Mode: {{true/false}}
- Target: {{ES version}}
- Module: {{module system}}

Patterns Detected:
- Type vs Interface: {{preference}}
- Discriminated Unions: {{yes/no}}
- Branded Types: {{yes/no}}
- Error Handling: {{exceptions/Result type}}
- State Management: {{pattern}}

Tooling:
- Build Tool: {{tool}}
- Test Framework: {{framework}}
- Linter: {{yes/no}}

Recommendations:
- {{recommendation 1}}
- {{recommendation 2}}
```

---

**Investigation protocols complete: 12 tool-specific protocols ready for agent execution**
