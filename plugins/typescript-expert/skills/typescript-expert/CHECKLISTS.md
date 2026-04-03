# TypeScript Quality Checklists

Comprehensive verification checklists for TypeScript code quality, type safety, and performance.

## Type Safety Checklist (40 items)

### Strict Mode & Configuration
- [ ] `strict: true` enabled in tsconfig.json
- [ ] `noUncheckedIndexedAccess: true` for safer array/object access
- [ ] `noImplicitOverride: true` for class inheritance clarity
- [ ] `exactOptionalPropertyTypes: true` for precise optional handling
- [ ] `noImplicitReturns: true` ensures all paths return
- [ ] `noFallthroughCasesInSwitch: true` for exhaustive switches
- [ ] `noUnusedLocals: true` catches unused variables
- [ ] `noUnusedParameters: true` (or use `_` prefix for intentional unused)

### Type Usage
- [ ] No `any` types present (or justified with comments)
- [ ] `unknown` used instead of `any` where type is truly unknown
- [ ] No `as any` assertions (or justified with comments)
- [ ] Type assertions (`as`) only used when necessary and safe
- [ ] No `@ts-ignore` comments (use `@ts-expect-error` with explanation)
- [ ] All function parameters have types (no implicit `any`)
- [ ] All function return types explicit for public APIs
- [ ] Generic constraints are as specific as needed

### Type Patterns
- [ ] Discriminated unions used for variant types
- [ ] Exhaustive checking with `never` for discriminated unions
- [ ] Branded types for domain-specific primitives (IDs, validated data)
- [ ] `const` assertions used for literal types where appropriate
- [ ] Readonly types/properties where data shouldn't mutate
- [ ] Union types properly narrowed with type guards
- [ ] Intersection types used correctly (not creating `never`)
- [ ] Tuple types used for fixed-length heterogeneous arrays

### Type Guards
- [ ] Type guards defined for custom types
- [ ] Type guards use `is` predicate syntax
- [ ] Type guards properly narrow union types
- [ ] Runtime validation matches type guards
- [ ] No type assertions after type guard checks

### Generics
- [ ] Generic parameters have descriptive names (not just `T`)
- [ ] Generic constraints specified when needed
- [ ] Generic defaults provided where sensible
- [ ] No unnecessary generic parameters (let inference work)
- [ ] Generic variance considered (covariance/contravariance)

### Nullability
- [ ] Null and undefined handled explicitly
- [ ] Optional chaining (`?.`) used appropriately
- [ ] Nullish coalescing (`??`) used instead of `||` for null/undefined
- [ ] No implicit undefined in arrays/objects (noUncheckedIndexedAccess)

## Type Architecture Checklist (30 items)

### Organization
- [ ] Types organized in clear directory structure
- [ ] Domain types separated from technical types
- [ ] Shared types in dedicated modules/packages
- [ ] Type imports use `import type` syntax
- [ ] Barrel exports (`index.ts`) for public type APIs
- [ ] Internal types not exported from modules
- [ ] Type files named descriptively (`.types.ts` suffix)

### API Design
- [ ] Public API types explicitly defined
- [ ] Request/response types defined for all endpoints
- [ ] Versioning strategy for API types
- [ ] Breaking changes to types documented
- [ ] Deprecated types marked with `@deprecated` JSDoc

### Domain Modeling
- [ ] Business domain modeled with rich types
- [ ] Invalid states unrepresentable in type system
- [ ] State machines modeled with discriminated unions
- [ ] Value objects use branded types
- [ ] Entity types distinguish between ID types

### Error Handling
- [ ] Error types explicitly defined
- [ ] Result types or Either patterns used (or throwing is intentional)
- [ ] Discriminated error unions for multiple error types
- [ ] Error handling is exhaustive (no unhandled cases)
- [ ] Type guards for error narrowing

### Full-Stack Types
- [ ] Types shared between frontend and backend
- [ ] Shared types versioned appropriately
- [ ] Type generation configured (GraphQL, OpenAPI, Prisma, etc.)
- [ ] Database types align with TypeScript types
- [ ] API contracts type-safe end-to-end

### Patterns
- [ ] No circular dependencies in type definitions
- [ ] Utility types extracted when reused
- [ ] Type composition preferred over duplication
- [ ] Mapped types used for transformations
- [ ] Conditional types for computed types

## Compiler Configuration Checklist (25 items)

### Basic Configuration
- [ ] `target` set appropriately for runtime (ES2020+ recommended)
- [ ] `module` matches bundler/runtime (ESNext, CommonJS, etc.)
- [ ] `moduleResolution` set to `bundler` or `node16`
- [ ] `lib` includes necessary APIs (DOM, ES2023, etc.)
- [ ] `jsx` configured if using React/JSX

### Module Resolution
- [ ] `baseUrl` set for absolute imports (if needed)
- [ ] `paths` configured for aliases
- [ ] Path mappings work in both IDE and build
- [ ] `resolveJsonModule` enabled if importing JSON
- [ ] `esModuleInterop` enabled for CJS/ESM compatibility

### Output Configuration
- [ ] `outDir` configured appropriately
- [ ] `declaration: true` for libraries
- [ ] `declarationMap: true` for debugging declarations
- [ ] `sourceMap: true` for debugging
- [ ] `removeComments: false` preserves JSDoc in declarations

### Strictness (covered in Type Safety, but worth double-checking)
- [ ] `strict: true` enabled
- [ ] Additional strictness flags considered
- [ ] No flags disabled unless absolutely necessary

### Performance
- [ ] `skipLibCheck: true` for faster builds (when safe)
- [ ] `incremental: true` for faster rebuilds
- [ ] `composite: true` for project references (monorepos)
- [ ] Includes/excludes configured to minimize checked files
- [ ] `types` array specified to limit @types packages

### Advanced
- [ ] Project references configured for monorepos
- [ ] `references` array points to dependencies
- [ ] Build order correct for project references
- [ ] `isolatedModules: true` for bundler compatibility

## Performance Checklist (20 items)

### Build Time
- [ ] Build completes in reasonable time (<1min for medium projects)
- [ ] Incremental builds much faster than full builds
- [ ] `tsc --diagnostics` run to identify bottlenecks
- [ ] `tsc --listFiles` shows no unexpected files
- [ ] Project references used in monorepos

### Type Complexity
- [ ] No deeply nested conditional types (>5 levels)
- [ ] Union types have <100 members
- [ ] Recursive types have termination conditions
- [ ] Complex types cached in type aliases
- [ ] `type` used instead of `interface` when needed for performance

### Declaration Files
- [ ] Declaration generation time acceptable
- [ ] `.d.ts` files are properly treeshakable
- [ ] No unnecessary types exported
- [ ] Declaration maps generated for debugging

### Runtime Performance
- [ ] No runtime overhead from type system (TypeScript erases types)
- [ ] Type guards don't duplicate validation logic unnecessarily
- [ ] Branded types have zero runtime cost
- [ ] Generics don't cause code duplication issues

### Monitoring
- [ ] Build times tracked over time
- [ ] Performance regressions caught in CI
- [ ] Type complexity limits established
- [ ] `--generateTrace` used to profile slow types

## Framework-Specific Checklist (For Detection Only - 25 items)

**Note**: This checklist helps **detect** which frameworks a project uses and understand project patterns during investigation. For framework-specific implementation, use dedicated framework skills (react-typescript-expert, nodejs-typescript-expert, etc.).

### React
- [ ] Component props types defined clearly
- [ ] Generic components have proper inference
- [ ] Hooks typed correctly (useState, useReducer, etc.)
- [ ] Custom hooks have explicit return types
- [ ] Context API fully typed
- [ ] Event handlers typed explicitly
- [ ] Refs typed with correct element types
- [ ] Forward refs properly typed

### Node.js/Express
- [ ] Request types extended properly
- [ ] Response types include custom properties
- [ ] Middleware typed with proper generics
- [ ] Route handler types explicit
- [ ] Dependency injection container typed
- [ ] Configuration types defined
- [ ] Environment variables typed

### Vue
- [ ] Component props use `defineProps` with types
- [ ] Emits defined with types
- [ ] Composables typed explicitly
- [ ] Refs and reactive data typed
- [ ] Store mutations/actions typed (Pinia/Vuex)

### Angular
- [ ] Component classes properly typed
- [ ] Services use dependency injection types
- [ ] RxJS observables typed explicitly
- [ ] Template variables typed in component

### Testing
- [ ] Test fixtures properly typed
- [ ] Mock types align with real types
- [ ] Test utilities typed for reusability

## Migration Checklist (20 items)

### JavaScript to TypeScript
- [ ] `tsconfig.json` created with appropriate settings
- [ ] `allowJs: true` enabled during migration
- [ ] `checkJs: false` initially (to avoid errors)
- [ ] Files renamed from `.js` to `.ts` incrementally
- [ ] Type definitions added file by file
- [ ] `any` used temporarily, marked for improvement
- [ ] Third-party types installed (`@types/...`)
- [ ] Strict flags enabled incrementally

### Improving Type Safety
- [ ] Current strict flags documented
- [ ] Plan for enabling additional strict flags
- [ ] `any` types identified and replaced systematically
- [ ] Type assertions reviewed and justified
- [ ] Union types narrowed with type guards
- [ ] Discriminated unions replace loose unions

### Code Review
- [ ] Migration progress tracked
- [ ] Team trained on TypeScript patterns
- [ ] Type errors prioritized and fixed
- [ ] Legacy patterns documented for eventual refactor

## Documentation Checklist (15 items)

### TSDoc Comments
- [ ] Public API functions have TSDoc comments
- [ ] Complex types have explanatory comments
- [ ] Generic parameters documented with `@typeParam`
- [ ] Parameters documented with `@param`
- [ ] Return values documented with `@returns`
- [ ] Examples provided for non-obvious APIs (`@example`)
- [ ] Deprecations marked with `@deprecated`

### Type Naming
- [ ] Types have clear, descriptive names
- [ ] Naming consistent across project
- [ ] Branded types named semantically (UserId not UserIdBrand)
- [ ] Utility types named by transformation (ReadonlyDeep)

### README/Docs
- [ ] TypeScript version documented
- [ ] Type architecture explained
- [ ] Shared types package documented (if exists)
- [ ] Framework-specific type patterns explained

## Testing Checklist (15 items)

### Runtime Tests
- [ ] Unit tests for all functions
- [ ] Integration tests for modules
- [ ] E2E tests for critical flows
- [ ] Edge cases covered

### Type Tests
- [ ] Complex type inference tested
- [ ] Conditional type resolution tested
- [ ] Type guard narrowing tested
- [ ] Generic constraint behavior tested
- [ ] Error cases tested with `@ts-expect-error`

### Coverage
- [ ] Type coverage tracked (e.g., with type-coverage)
- [ ] Test coverage meets project standards
- [ ] Critical paths have both runtime and type tests

### CI/CD
- [ ] Type checking runs in CI
- [ ] Type tests run in CI
- [ ] Build time monitored in CI

---

## Summary

These checklists ensure comprehensive TypeScript quality across:

1. **Type Safety** (40 items) - Strict configuration, proper patterns, no `any`
2. **Type Architecture** (30 items) - Organization, API design, domain modeling
3. **Compiler Configuration** (25 items) - tsconfig.json optimization
4. **Performance** (20 items) - Build time, type complexity, monitoring
5. **Framework-Specific** (25 items) - React, Node.js, Vue, Angular, Testing
6. **Migration** (20 items) - JS to TS, improving existing code
7. **Documentation** (15 items) - TSDoc, naming, architecture docs
8. **Testing** (15 items) - Runtime tests, type tests, coverage

**Total: 190+ verification items for comprehensive TypeScript quality**

Use these checklists to ensure your TypeScript code meets high standards for safety, maintainability, and performance.
