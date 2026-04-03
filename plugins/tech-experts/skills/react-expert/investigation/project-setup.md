# Project Setup Investigation

## Purpose

Detect foundational project configuration: React version, TypeScript setup, and framework choice. This determines which React APIs are available and how code should be structured.

## Why This Matters

**React version determines available APIs**:
- React 18.0+ → useTransition, useDeferredValue, useId, Suspense
- React 17.x → Basic hooks, no concurrent features
- React 16.8+ → Hooks available, but limited

**TypeScript changes code generation**:
- Present + strict → All code typed, no implicit any
- Present + loose → Types preferred but flexible
- Absent → Generate JavaScript

**Framework affects patterns**:
- Next.js → Server/Client components, App Router patterns
- Remix → Loader/Action patterns, Route components
- Vite/CRA → Standard React patterns

## Investigation Protocols

---

### Protocol 1: React Version Detection

**Objective**: Determine React version to know which APIs can be used

**Tool**: Read → `package.json`

**Extract**:
- `dependencies.react` version string
- `dependencies.react-dom` version (should match)

**Error Handling**:
- If `package.json` doesn't exist → Report to user: "No package.json found. Is this a React project?"
- If file exists but no `react` in dependencies → Report to user: "React not found in dependencies. Please confirm this is a React project."
- If file exists but invalid JSON → Report to user: "package.json is malformed. Cannot parse dependencies."

**Decision Tree**:
```
React version?
├─ 18.0.0 - 18.3.x (React 18)
│   ├─ ✓ useTransition - For non-urgent updates
│   ├─ ✓ useDeferredValue - For deferring expensive renders
│   ├─ ✓ useId - For accessible unique IDs
│   ├─ ✓ useSyncExternalStore - For external store subscription
│   ├─ ✓ Suspense - For data fetching boundaries
│   ├─ ✓ startTransition - For marking non-urgent updates
│   └─ ✓ All React 17 and earlier features
│
├─ 17.0.0 - 17.0.x (React 17)
│   ├─ ✓ useState, useEffect, useContext, useReducer
│   ├─ ✓ useMemo, useCallback, useRef, useLayoutEffect
│   ├─ ✗ No concurrent features (useTransition, useDeferredValue)
│   ├─ ✗ No useId (use custom ID generation)
│   └─ Note: JSX transform doesn't require React import
│
├─ 16.8.0 - 16.14.x (React 16.8+)
│   ├─ ✓ All hooks available (useState, useEffect, etc.)
│   ├─ ✗ No concurrent features
│   ├─ ✗ Must import React for JSX
│   └─ Note: Older hooks API, check for deprecated patterns
│
└─ < 16.8.0 (Pre-hooks)
    ├─ ✗ No hooks - use class components only
    ├─ ✗ Recommend upgrade if possible
    └─ Note: Legacy project, special handling needed
```

**Verification**:
```bash
grep '"react":' package.json
grep '"react-dom":' package.json
```

**Example Output**:
```
React version: 18.2.0
Available: useTransition, useDeferredValue, useId, useSyncExternalStore, Suspense
Decision: Use React 18 features for optimal performance
```

---

### Protocol 2: TypeScript Detection

**Objective**: Determine if TypeScript is used and its strictness level

**Tool**: Read → `package.json` AND `tsconfig.json`

**Extract**:

**From package.json**:
- `dependencies.typescript` or `devDependencies.typescript`
- Presence indicates TypeScript project

**From tsconfig.json** (if exists):
- `compilerOptions.strict` - Strict mode flag
- `compilerOptions.strictNullChecks` - Null checking
- `compilerOptions.noImplicitAny` - Implicit any disallowed
- `compilerOptions.jsx` - JSX compilation mode

**Error Handling**:
- If `tsconfig.json` doesn't exist but TypeScript is in dependencies → Fallback: Assume TypeScript with default settings (strict: false)
- If `tsconfig.json` exists but is invalid JSON → Report to user: "tsconfig.json is malformed. Using default TypeScript settings."
- If neither file exists → Proceed with JavaScript generation

**Decision Tree**:
```
TypeScript present?
├─ YES
│   ├─ strict: true
│   │   ├─ All code MUST be fully typed
│   │   ├─ No implicit any allowed
│   │   ├─ Null checks enforced
│   │   ├─ Props interfaces required
│   │   ├─ Event handlers typed explicitly
│   │   └─ Return types recommended for functions
│   │
│   ├─ strict: false (or undefined)
│   │   ├─ noImplicitAny: true?
│   │   │   ├─ YES → Type all parameters and variables
│   │   │   └─ NO → Types preferred but some inference OK
│   │   │
│   │   ├─ strictNullChecks: true?
│   │   │   ├─ YES → Handle null/undefined explicitly
│   │   │   └─ NO → Null checking relaxed
│   │   │
│   │   └─ General approach: Add types, but less strict
│   │
│   └─ File extensions
│       ├─ jsx: "react-jsx" → .tsx files, no React import needed
│       ├─ jsx: "react" → .tsx files, import React required
│       └─ Use .tsx for components, .ts for utilities
│
└─ NO
    ├─ Generate .jsx files
    ├─ Use PropTypes for validation (if project uses them)
    ├─ Add JSDoc comments for documentation
    └─ Note: TypeScript setup could be beneficial (suggest if appropriate)
```

**Verification**:
```bash
# Check TypeScript presence
grep '"typescript":' package.json

# Check configuration
cat tsconfig.json | grep -E '"strict"|"noImplicitAny"|"strictNullChecks"|"jsx"'

# Check for .tsx files (evidence of TypeScript usage)
find . -name "*.tsx" -type f | head -5
```

**Example Output**:
```
TypeScript: Found (version 5.2.0)
Configuration:
  - strict: true
  - jsx: "react-jsx"

Decision: Generate TypeScript with strict typing
  - All props interfaces required
  - No implicit any
  - File extension: .tsx
  - React import: NOT required (react-jsx transform)
```

---

### Protocol 3: Framework Detection

**Objective**: Identify if project uses a React framework with specific patterns

**Tool**: Glob → Framework configuration files

**Search Patterns**:
- `next.config.*` (Next.js)
- `remix.config.*` (Remix)
- `vite.config.*` (Vite)
- `craco.config.*` (Create React App with CRACO)
- `.angular.json` (Angular - not React, but detection useful)

**Error Handling**:
- If Glob finds no framework configs → Fallback: Check package.json for build scripts to infer framework
- If multiple framework configs found → Report to user: "Multiple framework configs detected. Please clarify which is active."
- If Glob fails → Fallback: Assume standard React setup without framework

**Extract**:

**Next.js Detection**:
- File: `next.config.js` or `next.config.mjs`
- Additional check: `pages/` or `app/` directory structure
- Version: Check `package.json` for `"next"` version

**Remix Detection**:
- File: `remix.config.js`
- Additional check: `app/routes/` directory

**Vite Detection**:
- File: `vite.config.js` or `vite.config.ts`
- Additional check: `package.json` for `"vite"` dependency

**Create React App Detection**:
- Check: `package.json` for `"react-scripts"`
- No custom config file (unless ejected)

**Decision Tree**:
```
Framework detected?
├─ Next.js
│   ├─ Version?
│   │   ├─ 13.0+ with app directory
│   │   │   ├─ Use: Server Components by default
│   │   │   ├─ Add: "use client" for client components
│   │   │   ├─ Patterns: async components, streaming
│   │   │   └─ Note: Different data fetching paradigm
│   │   │
│   │   └─ 12.x or pages directory
│   │       ├─ Use: Pages Router patterns
│   │       ├─ getServerSideProps / getStaticProps
│   │       └─ Standard component patterns
│   │
│   └─ General Next.js considerations
│       ├─ Image: Use next/image for optimization
│       ├─ Link: Use next/link for navigation
│       ├─ Head: Use next/head for meta tags
│       └─ Note: May delegate to Next.js-specific skill
│
├─ Remix
│   ├─ Use: Route-based structure
│   ├─ Patterns: loader/action functions
│   ├─ Data: useLoaderData, useActionData hooks
│   ├─ Forms: Remix Form component
│   └─ Note: May delegate to Remix-specific skill
│
├─ Vite
│   ├─ Use: Standard React patterns
│   ├─ HMR: Fast refresh available
│   ├─ Imports: ESM imports, no require()
│   └─ Build: Optimized production builds
│
├─ Create React App
│   ├─ Use: Standard React patterns
│   ├─ Env: process.env.REACT_APP_* variables
│   ├─ Public: Assets in /public directory
│   └─ Note: Consider Vite migration if performance issues
│
└─ None (Custom setup)
    ├─ Use: Standard React patterns
    ├─ Check: Webpack/Rollup/other bundler config
    └─ Follow: Project's specific setup
```

**Verification**:
```bash
# Search for framework configs
ls -la next.config.* 2>/dev/null || echo "No Next.js config"
ls -la remix.config.* 2>/dev/null || echo "No Remix config"
ls -la vite.config.* 2>/dev/null || echo "No Vite config"

# Check package.json for framework dependencies
grep -E '"next"|"remix"|"vite"|"react-scripts"' package.json

# Check directory structure
ls -d app/ pages/ 2>/dev/null
```

**Example Output**:
```
Framework: Next.js
Version: 14.0.3
Structure: app/ directory found
Decision: Use Next.js App Router patterns
  - Server Components by default
  - Add "use client" when needed
  - Use next/image and next/link
  - Consider server-side data fetching
```

---

### Protocol 4: Build Tool Detection

**Objective**: Identify build tool configuration for module resolution and path aliases

**Tool**: Read → `tsconfig.json` or `jsconfig.json`

**Extract**:
- `compilerOptions.baseUrl` - Base URL for module resolution
- `compilerOptions.paths` - Path aliases (e.g., `@/*` → `./src/*`)
- `compilerOptions.moduleResolution` - Module resolution strategy

**Decision Tree**:
```
Path aliases configured?
├─ YES
│   ├─ Common patterns found
│   │   ├─ "@/*": ["./src/*"] → Use @/components/Button
│   │   ├─ "@components/*" → Use @components/Button
│   │   ├─ "@utils/*" → Use @utils/helper
│   │   └─ "@hooks/*" → Use @hooks/useCustomHook
│   │
│   └─ Use configured aliases in imports
│       └─ More maintainable than relative paths
│
└─ NO
    ├─ Use relative imports
    ├─ ../../../components/Button (if needed)
    └─ Consider suggesting alias setup for large projects
```

**Verification**:
```bash
# Check for path configuration
cat tsconfig.json | grep -A 10 '"paths"'
cat jsconfig.json | grep -A 10 '"paths"' 2>/dev/null
```

**Example Output**:
```
Path aliases:
  - "@/*": ["./src/*"]
  - "@components/*": ["./src/components/*"]

Decision: Use path aliases in imports
  - ✓ import Button from '@components/Button'
  - ✗ import Button from '../../../components/Button'
```

---

## Investigation Checklist

After completing project setup investigation, verify:

- [ ] React version identified and documented
- [ ] Available React APIs determined (hooks, concurrent features)
- [ ] TypeScript presence confirmed or denied
- [ ] TypeScript strictness level known (if applicable)
- [ ] Framework detected (Next.js/Remix/Vite/CRA/Custom)
- [ ] Framework version noted (affects patterns)
- [ ] Path aliases identified (if configured)
- [ ] File extensions determined (.tsx vs .jsx vs .ts vs .js)
- [ ] JSX transform mode known (affects React import)

## Common Scenarios

### Scenario 1: Modern Next.js with TypeScript
```
React: 18.2.0 (full features available)
TypeScript: 5.2.0, strict mode
Framework: Next.js 14.0 with app directory
Result: Use Server Components, TypeScript strict, modern APIs
```

### Scenario 2: Legacy CRA Project
```
React: 17.0.2 (no concurrent features)
TypeScript: None (JavaScript project)
Framework: Create React App
Result: Standard React patterns, JSX files, PropTypes for validation
```

### Scenario 3: Vite with Relaxed TypeScript
```
React: 18.3.0 (full features available)
TypeScript: 5.0.0, strict: false, noImplicitAny: true
Framework: Vite
Result: Modern React with TypeScript, type parameters but flexible on inference
```

## Integration with Other Protocols

**After project setup investigation**:
1. Continue to `existing-patterns.md` to discover code style
2. Check `state-management-detection.md` if state management needed
3. Verify with `linting-rules.md` before generating code

**Project setup informs**:
- Which APIs can be used (version-dependent)
- File extensions and typing requirements (TypeScript)
- Framework-specific patterns (Next.js/Remix/Vite)
- Import paths (aliases vs relative)

This foundational investigation ensures all subsequent code generation uses appropriate APIs and follows project structure conventions.
