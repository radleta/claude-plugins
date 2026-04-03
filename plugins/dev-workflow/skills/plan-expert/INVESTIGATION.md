# Investigation Methodology

Investigation is the foundation of every good plan. Plans built on assumptions fail during implementation. Plans built on evidence succeed.

## The Investigation Mindset

**Discover reality, don't assume it.** Every codebase has surprises:
- Conventions that aren't obvious from file names
- Historical decisions that constrain new work
- Patterns that evolved over time (old code vs new code)
- Hidden dependencies between modules

**Investigation is NOT implementation.** Read files, search patterns, examine history — never modify code during investigation.

## Investigation Areas

### 1. Architecture Discovery

**What to discover:**
- File and directory organization (where do things live?)
- Module boundaries (what depends on what?)
- Entry points (where does execution start?)
- Configuration (build tools, environment, deployment)

**How to investigate:**
- Find key config files: package.json, tsconfig.json, Cargo.toml, pyproject.toml, and other build manifests
- Examine top-level directory structure
- Read 3-5 representative files to understand patterns
- Map module dependencies (imports/exports)

**Document as:**
```markdown
## Architecture
- Entry point: src/index.ts
- Module structure: src/{feature}/ with index.ts barrel exports
- Config: TypeScript strict mode, ESM modules, Vitest for testing
- Build: Vite with custom plugins in vite.config.ts
- Key dependencies: React 18, TanStack Query, Zod for validation
```

### 2. Pattern Discovery

**What to discover:**
- Naming conventions (files, functions, variables, types)
- Code organization patterns (how are features structured?)
- Error handling patterns (try/catch? Result types? Error boundaries?)
- State management patterns (where does state live?)

**How to investigate:**
- Search for similar functionality to what you're building
- Compare 3+ examples of the same pattern
- Look for inconsistencies (old patterns vs new patterns)
- Check for documented conventions (CLAUDE.md, CONTRIBUTING.md, style guides)

**Document as:**
```markdown
## Patterns
- File naming: kebab-case for files, PascalCase for components
- Feature structure: src/{feature}/{Feature}.tsx + {Feature}.test.tsx + index.ts
- Error handling: custom AppError class with error codes, caught at boundary
- State: React Query for server state, Zustand for client state
- NEW pattern (since 2024): Zod schemas co-located with types
- OLD pattern (pre-2024): manual validation in handlers — do NOT follow
```

### 3. Reference Implementation Discovery

**What to discover:**
- Existing code that does something similar to what you're building
- Test patterns used in the project
- Configuration examples for similar features

**How to investigate:**
- Search for features similar to what you're planning
- Read their implementation, tests, and configuration
- Note file structure, naming, patterns used
- Extract code snippets as reference (with file:line citations)

**Document as:**
```markdown
## Reference Implementations
- Similar feature: src/features/users/ (user CRUD)
  - Component: src/features/users/UserForm.tsx:15-89
  - API handler: src/api/users.ts:23-67
  - Tests: src/features/users/__tests__/UserForm.test.tsx
  - Patterns to follow: form validation with Zod, optimistic updates with React Query
```

### 4. Constraint Discovery

**What to discover:**
- Testing requirements (framework, coverage thresholds, patterns)
- Build constraints (strict TypeScript, ESLint rules, formatting)
- CI/CD requirements (what runs on PR, what blocks merge)
- API contracts (existing schemas, versioning, backwards compatibility)

**How to investigate:**
- Read CI configuration (.github/workflows, .gitlab-ci.yml)
- Check linter/formatter configs (.eslintrc, .prettierrc, biome.json)
- Look at test configuration (jest.config, vitest.config, pytest.ini)
- Review API schemas (OpenAPI specs, GraphQL schemas, Protobuf definitions)

**Document as:**
```markdown
## Constraints
- TypeScript: strict mode, no implicit any, no unused variables
- Tests: Vitest, coverage threshold 80%, tests must pass before merge
- Lint: ESLint with custom rules (no console.log, max-depth 3)
- CI: GitHub Actions runs test + lint + typecheck on every PR
- API: OpenAPI 3.0 spec in docs/api.yaml, backwards-compatible changes only
```

### 5. Historical Context Discovery

**What to discover:**
- Why the code is structured the way it is
- Previous attempts at similar changes
- Known issues or technical debt in the affected area
- Team decisions that constrain the work

**How to investigate:**
- Check git history for the affected files (recent commits, who changed what)
- Search for related issues/PRs in the repository
- Look for TODO/FIXME/HACK comments in the code
- Read CHANGELOG or release notes for context

**Document as:**
```markdown
## Historical Context
- Authentication was refactored 3 months ago (PR #234) — new pattern in src/auth/
- Old session-based auth still exists in src/legacy/ — DO NOT modify, scheduled for removal
- Known issue: token refresh race condition (issue #567) — plan must not make this worse
- Decision: team chose JWT over session cookies for stateless scaling (ADR-003)
```

### 6. UI Infrastructure Discovery (MANDATORY When UI_INVOLVED)

**This area is NOT optional when the task classification gate sets UI_INVOLVED = true.** Skip only for purely backend/CLI tasks.

**What to discover:**
- Component framework and version (React, Vue, Svelte, etc.)
- Story/isolated rendering tool (Storybook, Histoire, Ladle, etc.)
- Existing component patterns (file structure, naming, prop conventions)
- Design system or component library in use (if any)
- State management approach (hooks, context, stores)
- Existing mock data patterns (how do existing stories define test data?)

**How to investigate:**
- Search for story files (*.stories.tsx, *.stories.ts, *.story.vue)
- Read 3+ existing components to discover file structure patterns
- Check for Storybook/Histoire config files
- Look for shared mock data or fixture patterns
- Examine how existing components handle loading, error, and empty states

**Document as:**
```markdown
## UI Infrastructure
- Framework: React 18 with TypeScript
- Stories: Storybook 8 (config: .storybook/main.ts)
- Component pattern: src/features/{area}/{Component}.tsx + {Component}.stories.tsx
- Mock data: co-located {Area}MockData.ts files with typed constants
- State: TanStack Query for server state, local state via useState
- Design system: Tailwind CSS + custom components in src/components/ui/
- Existing story variants: most components have Default + Loading + Error
```

**Why this matters for CDD:** If the project already has story infrastructure, CDD phases follow existing patterns. If not, the first story phase must also set up the story tooling. Discovering existing mock data patterns ensures new mock data files are consistent.

## Investigation Depth Guide

| Change Scope | Time Budget | Areas to Cover | Depth |
|-------------|-------------|----------------|-------|
| Bug fix (1-2 files) | 5-10 min | Affected files + immediate dependencies | Read affected code, check test coverage |
| Small feature (3-5 files) | 15-30 min | Architecture + patterns + reference impl | Map structure, find similar features |
| Large feature (5-15 files) | 30-60 min | All 6 areas | Thorough investigation, document everything |
| Architectural change | 1-2 hours | All 6 areas + historical deep-dive | Comprehensive, consult git history and decisions |

## Investigation Output Template

```markdown
# Investigation: [Feature/Change Name]

## Summary
[2-3 sentences: what was discovered, key constraints, recommended approach]

## Architecture
[File structure, modules, entry points, dependencies]

## Patterns to Follow
[Naming, structure, error handling, state management]

## Reference Implementations
[Similar features with file:line citations]

## Constraints
[Testing, build, CI, API contracts]

## Historical Context
[Why things are the way they are, known issues]

## UI Infrastructure (MANDATORY when UI_INVOLVED)
[Component framework, story tool, component patterns, mock data conventions]

## Red Flags
[Anything that needs extra caution during implementation]
```

## Common Investigation Mistakes

| Mistake | Consequence | Fix |
|---------|-------------|-----|
| Skip investigation, start planning | Plan doesn't match codebase reality | Always investigate first, even for "obvious" changes |
| Read only 1 example of a pattern | Miss pattern variations and evolution | Compare 3+ examples of same pattern |
| Ignore git history | Miss context for why code is structured this way | Check history for affected files |
| Don't check CI/CD | Plan includes changes that break the build | Review CI config before designing approach |
| Assume patterns from other projects | Impose foreign conventions on the codebase | Discover THIS project's patterns |
| Over-investigate (analysis paralysis) | Waste time investigating irrelevant areas | Scale depth to change scope |
