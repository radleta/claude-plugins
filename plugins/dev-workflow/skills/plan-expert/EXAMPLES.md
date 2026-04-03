# Plan Examples: Good vs Bad

Annotated examples showing the difference between effective and ineffective plan elements.

## Example 1: Step Decomposition

### BAD: Vague, oversized steps

```markdown
# Plan: Add User Authentication

## Steps
1. Set up the authentication system
2. Add login and registration
3. Protect routes
4. Test everything
```

**Why this fails:**
- "Set up the authentication system" — what files? what library? what approach?
- "Add login and registration" — one step for two features, no specifics
- "Protect routes" — which routes? how? middleware?
- "Test everything" — vague scope, no specific test cases
- No dependencies, no acceptance criteria, no file paths
- No investigation of existing patterns
- Grade: D

---

### GOOD: Specific, right-sized, verifiable steps

```markdown
# Plan: Add User Authentication

## Objective
Add JWT-based authentication to the Express API with login, registration,
and route protection for /api/users/* and /api/admin/* endpoints.

## Steps

### Step 01: Create Auth Middleware
**Files:** Create src/middleware/auth.ts
**Actions:**
- Create JWT validation middleware using jsonwebtoken (already in package.json)
- Extract token from Authorization header (Bearer scheme)
- Validate token signature and expiration
- Attach decoded user payload to req.user
- Return 401 for missing/invalid tokens with error message
**Acceptance Criteria:**
- Middleware exports `requireAuth` function
- Invalid token returns { error: "Unauthorized", status: 401 }
- Expired token returns { error: "Token expired", status: 401 }
- Valid token attaches user to request
**Dependencies:** None (first step)
**Verify:** Unit test with valid, invalid, and expired tokens passes

### Step 02: Create Auth Service
**Files:** Create src/services/auth.service.ts
**Actions:**
- Implement `register(email, password)`: hash with bcrypt, create user, return JWT
- Implement `login(email, password)`: verify credentials, return JWT
- Implement `refreshToken(token)`: validate refresh token, return new JWT pair
- Use existing User model from src/models/user.ts (discovered in investigation)
- Follow service pattern from src/services/users.service.ts
**Acceptance Criteria:**
- register: creates user in DB, returns { accessToken, refreshToken }
- login: returns tokens for valid credentials, throws for invalid
- refreshToken: returns new tokens for valid refresh token
- Passwords hashed with bcrypt (cost factor 12, matching existing pattern)
**Dependencies:** None (parallel with Step 01)
**Verify:** All 3 functions tested with happy path + error cases

### Step 03: Create Auth Routes
**Files:** Create src/routes/auth.routes.ts, Modify src/routes/index.ts
**Actions:**
- POST /api/auth/register — validates body (email, password), calls auth.register()
- POST /api/auth/login — validates body (email, password), calls auth.login()
- POST /api/auth/refresh — validates body (refreshToken), calls auth.refreshToken()
- Add auth routes to router in src/routes/index.ts
- Use Zod validation (following pattern in src/routes/users.routes.ts:12-24)
**Acceptance Criteria:**
- All 3 endpoints respond correctly for valid input
- Validation errors return 400 with field-specific messages
- Routes registered at /api/auth/*
**Dependencies:** Step 02 (auth service must exist)
**Verify:** Integration tests with supertest for all 3 endpoints

### Step 04: Protect Existing Routes
**Files:** Modify src/routes/users.routes.ts, Modify src/routes/admin.routes.ts
**Actions:**
- Add requireAuth middleware to all /api/users/* routes
- Add requireAuth + requireRole('admin') to all /api/admin/* routes
- Update existing route tests to include auth headers
**Acceptance Criteria:**
- Protected routes return 401 without token
- Protected routes work normally with valid token
- Admin routes return 403 for non-admin users
- All existing tests updated and passing
**Dependencies:** Step 01 (middleware) + Step 03 (routes working)
**Verify:** Run full test suite: npm test (all pass, including updated existing tests)
```

**Why this works:**
- Each step targets 5-10 minutes of work
- Exact files listed (create vs modify)
- References discovered patterns (Zod validation, bcrypt cost factor, service pattern)
- Clear acceptance criteria per step (yes/no verifiable)
- Dependencies are explicit
- Verification method for each step
- Grade: A

---

## Example 2: Decision Table (Living Record)

### BAD: No decisions documented

```markdown
We'll use JWT for authentication with bcrypt for password hashing.
```

**Why this fails:** No alternatives considered, no rationale, no trade-offs, no decision history. When the plan evolves, there's no record of what changed or why.

---

### GOOD: Decision table with status tracking + detail sections

The **decision table** is the canonical summary — always at the top of `decisions.md` (or the decisions section of README.md). Detail sections follow below it.

```markdown
# Decision Table

| ID | Decision | Status | Date | Rationale | Supersedes |
|----|----------|--------|------|-----------|------------|
| D1 | JWT for auth tokens | Accepted | 2026-03-10 | Stateless, scales horizontally, jsonwebtoken in deps | — |
| D2 | Bcrypt cost factor 12 | Superseded | 2026-03-10 | Matches existing user service pattern | — |
| D3 | Bcrypt cost factor 10 | Accepted | 2026-03-11 | Load test: 300ms/hash too slow at scale → reduced to 100ms | D2 |
| D4 | Refresh token in httpOnly cookie | Accepted | 2026-03-10 | SPA on same domain, avoids localStorage XSS risk | — |
| D5 | Add rate limiting to auth endpoints | Proposed | 2026-03-12 | Pen test flagged brute-force risk on /login | — |

---

## D1: Authentication Token Strategy

### Context
The API needs stateless authentication for horizontal scaling.
Currently no auth — all endpoints are public.

### Options
| Option | Pros | Cons |
|--------|------|------|
| JWT (stateless) | No server-side storage, scales horizontally, works with existing Express setup | Token revocation requires blocklist, larger payload size |
| Session cookies | Simple revocation, smaller payload | Requires session store (Redis), stateful, CORS complexity |
| OAuth2 + OIDC | Industry standard, delegated auth | Over-engineered for internal API, adds external dependency |

### Choice
JWT with short-lived access tokens (15min) and refresh tokens (7 days).

### Rationale
- Project already uses Express with stateless design (discovered: no session middleware)
- jsonwebtoken package already in package.json (v9.0.0)
- API serves SPA frontend on same domain (no CORS issues regardless)
- Short-lived access tokens mitigate revocation concern

### Trade-offs
- Cannot instantly revoke access tokens (15-minute window)
- Must implement refresh token rotation to prevent replay attacks
- Token payload limited to essential user data (id, email, role)

### Affected Files
- src/middleware/auth.ts (new — JWT validation)
- src/services/auth.service.ts (new — token generation)
- src/routes/auth.routes.ts (new — auth endpoints)
- src/config/auth.ts (new — JWT secret, expiration config)

---

## D2: Bcrypt Cost Factor 12 → SUPERSEDED by D3

### Context
Need to choose bcrypt cost factor for password hashing.

### Original Choice
Cost factor 12 (matches existing pattern in src/services/users.service.ts:45).

### Why Superseded
Load testing during Step 05 execution showed 300ms per hash caused API latency spikes under concurrent registration load. Reduced to cost factor 10 (100ms) in D3.

---

## D3: Bcrypt Cost Factor 10

### Context
D2's cost factor 12 proved too slow under load (discovered during execution, not planning).

### Choice
Cost factor 10 (~100ms per hash). Acceptable security margin for current threat model.

### Trade-offs
- Slightly reduced brute-force resistance (still > 10^10 operations to crack)
- Faster registration endpoint (100ms vs 300ms)
```

**Why this works:**
- **Decision table at top** gives instant overview of all decisions and their current status
- **Status tracking** (Proposed/Accepted/Superseded/Reverted) shows how the plan evolved
- **Supersedes column** links replacement decisions to originals — full audit trail
- **Never delete rows** — D2 stays visible even though it's superseded
- **Detail sections** preserve the full context, options, and rationale per decision
- **Dates** show when decisions were made, revealing the plan's evolution timeline
- Grade: A

---

## Example 3: Investigation Findings

### BAD: Generic assumptions

```markdown
## Investigation
The project uses React and TypeScript. Tests are in the tests folder.
```

**Why this fails:** No file:line references, no specific patterns, no evidence. Could describe any React project.

---

### GOOD: Evidence-based findings with citations

```markdown
## Investigation Findings

### Architecture
- Entry point: src/main.tsx:1 (Vite + React 18, createRoot)
- Router: src/router/index.tsx:5 — TanStack Router v1.x (file-based routes)
- Routes live in: src/routes/ (each route is a file, auto-discovered)
- API layer: src/api/ with TanStack Query hooks per entity

### Patterns Discovered
- Component naming: PascalCase files, one component per file
  - Evidence: src/components/UserCard.tsx, src/components/NavBar.tsx, src/components/DataTable.tsx
- State management: Zustand for client state (src/stores/), React Query for server state
  - Evidence: src/stores/authStore.ts:3 `create<AuthState>()`, src/api/useUsers.ts:8 `useQuery()`
- Form handling: React Hook Form + Zod validation
  - Evidence: src/components/LoginForm.tsx:15 `useForm<LoginSchema>()`, src/schemas/login.ts:3 `z.object()`
- Error handling: ErrorBoundary at route level (src/components/ErrorBoundary.tsx)
  - Evidence: src/routes/__root.tsx:12 `<ErrorBoundary fallback={...}>`

### Testing Patterns
- Framework: Vitest + React Testing Library
- Location: co-located with source — src/components/__tests__/
- Naming: {Component}.test.tsx
- Pattern: render → act → assert with screen queries
  - Evidence: src/components/__tests__/UserCard.test.tsx:8-25
- Coverage threshold: 80% (vitest.config.ts:14 `coverage.thresholds.lines: 80`)

### Constraints
- TypeScript: strict mode (tsconfig.json:5 `"strict": true`)
- Lint: ESLint with @typescript-eslint/recommended (eslint.config.js:3)
- CI: GitHub Actions (.github/workflows/ci.yml) runs typecheck + lint + test on PR
- Pre-commit: Husky + lint-staged (package.json:45 `"lint-staged"`)

### Historical Context
- Auth was started 2 months ago but abandoned (branch: feature/auth, stale)
- PR #89 added Zustand stores — team prefers Zustand over Redux (PR discussion)
- No existing auth middleware or JWT handling anywhere in codebase
```

---

## Example 4: Risk Assessment

### BAD: No risks identified

```markdown
## Risks
None identified.
```

**Why this fails:** Every non-trivial change has risks. "None identified" means risks were ignored, not absent.

---

### GOOD: Specific risks with mitigations

```markdown
## Risk Assessment

### Risk 1: Breaking Existing Route Tests (HIGH)
**What:** Adding auth middleware to existing routes will break all current integration tests that don't include auth headers.
**Impact:** CI pipeline fails, blocking other PRs.
**Mitigation:** Step 04 explicitly includes updating ALL existing route tests. Run full test suite after changes. Update CI test helper to include auth token factory.
**Verification:** `npm test` passes with 0 failures after Step 04.

### Risk 2: Token Refresh Race Condition (MEDIUM)
**What:** Multiple simultaneous requests with expired access token could trigger multiple refresh token rotations, invalidating valid refresh tokens.
**Impact:** Users get logged out unexpectedly during concurrent requests.
**Mitigation:** Implement refresh token rotation with grace period (30 seconds). Queue concurrent refresh requests and resolve with same response.
**Verification:** Load test with concurrent expired-token requests — all receive valid new tokens.

### Risk 3: Bcrypt Performance Under Load (LOW)
**What:** Bcrypt with cost factor 12 takes ~300ms per hash. High registration volume could cause API latency.
**Impact:** Slow registration endpoint under load.
**Mitigation:** Acceptable for current scale (< 100 registrations/day). Monitor with existing Datadog integration. If needed, reduce cost factor to 10 (100ms).
**Verification:** Registration endpoint responds in < 500ms under normal load.
```

---

## Example 5: Plan Structure (Flat-First)

### BAD: Excessive folder depth

```
scratch/my-feature/
├── README.md                    # links only
├── TODO.md                      # status only
├── research/
│   ├── README.md                # links only
│   ├── architecture/
│   │   └── README.md            # content finally
│   ├── patterns/
│   │   └── README.md
│   └── examples/
│       └── README.md
├── notes/
│   ├── README.md                # links only
│   └── decisions/
│       ├── README.md            # links only
│       └── 001-use-jwt/
│           └── README.md        # content finally (4 levels deep!)
└── steps/
    ├── README.md                # links only
    └── 01-create-middleware/
        └── README.md            # content finally
```

**Why this fails:**
- 4 levels deep for a single decision (notes/decisions/001-name/README.md)
- 6+ link-only index files that add navigation hops without content
- `notes/` intermediary exists only to wrap decisions/ and references/
- Steps wrapped in folders when they're single files
- Empty scaffolding (issues/ created but unused)
- A simple 3-step plan creates 20+ files

---

### GOOD: Flat-first structure

```
scratch/my-feature/
├── README.md              # Objective, navigation, risks, progress table
├── research.md            # All investigation findings in one file
├── decisions.md           # 2 decisions documented inline
└── steps/
    ├── 01-create-middleware.md
    ├── 02-create-service.md
    └── 03-add-routes.md
```

**Why this works:**
- Max depth: 2 (root -> steps -> file)
- Every file has real content (no link-only indexes)
- 6 total files vs 20+ in the deep version
- No empty scaffolding
- Single README.md serves as both navigation hub and progress tracker
- Decisions and research are files by default, escalated to folders only when content demands it (4+ decisions, 200+ lines of research)

### GOOD: Escalated structure (when content demands it)

```
scratch/big-refactor/
├── README.md
├── research/
│   ├── architecture.md
│   ├── patterns.md
│   └── examples.md
├── decisions/
│   ├── 001-state-management.md
│   ├── 002-api-design.md
│   ├── 003-migration-strategy.md
│   └── 004-testing-approach.md
└── steps/
    ├── 01-setup-new-store.md
    ├── 02-migrate-components.md
    ├── 03-update-api-layer.md
    ├── 04-add-integration-tests.md
    └── 05-remove-legacy-code.md
```

**Why this works:**
- Research split into folder because combined content exceeded 200 lines
- Decisions split into folder because there are 4+ decisions
- Still max depth 2 — no deeper nesting
- Files directly in folders, not wrapped in sub-folders with README.md

---

## Example 6: UI Feature Planning (CDD vs Traditional)

### BAD: Interleaved UI + backend per phase

```markdown
# Plan: Add License Management System

## Steps

### Step 01: Build Subscription UI + Backend
- Create SubscriptionList component
- Create subscription API endpoints
- Wire together with hooks
- Tests

### Step 02: Build Gift Claim UI + Backend
- Create GiftClaim component
- Create gift claim API endpoints
- Wire together with hooks
- Tests

### Step 03: Build Admin Dashboard UI + Backend
- Create AdminLicenseTable component
- Create admin API endpoints
- Wire together with hooks
- Tests
```

**Why this fails:**
- Step 02's UI review might reveal a missing field on the License entity that Step 01's backend already uses
- Admin dashboard (Step 03) aggregates data from Steps 01 and 02 — if either changes, admin needs rework
- No review gates — UI problems are discovered alongside backend problems
- Each step mixes component creation with API work, making changes expensive
- Grade: C

---

### GOOD: CDD phasing — stories first, backend follows

```markdown
# Plan: Add License Management System

## Steps

### Step 01: Data Model
**Files:** Create src/types/license.ts, src/types/subscription.ts, src/types/gift.ts
**Actions:**
- Define License, Subscription, GiftClaim entities with all fields
- Define enums (LicenseStatus, SubscriptionTier, ClaimStatus)
- Define shared types consumed by both UI and API
**Verify:** TypeScript compiles, types exported correctly

### Step 02: Subscription Stories (highest-risk UI)
**Files:** Create src/features/subscription/SubscriptionMockData.ts,
  SubscriptionListUI.tsx, SubscriptionListUI.stories.tsx
**Actions:**
- Define mock data with realistic field values (10 items + 1000-item scale set)
- Build pure SubscriptionList component (props in, render out)
- Write stories: Empty, Loading, Error, Populated, Scale (1000+), FreeTier, PremiumTier
**→ REVIEW GATE:** Review rendered stories. If data shapes need changes, update entities in Step 01 before proceeding.
**Verify:** All stories render correctly in Storybook

### Step 03: Gift Claim Stories
**Files:** Create src/features/gifts/GiftMockData.ts,
  GiftClaimUI.tsx, GiftClaimUI.stories.tsx
**Actions:**
- Define mock data referencing same entity types from Step 01
- Build GiftClaim component with all states
- Write stories: NoClaim, PendingClaim, ActiveClaim, ExpiredClaim, ClaimError
**→ REVIEW GATE:** Review stories. Apply any entity fixes before proceeding.
**Verify:** All stories render correctly

### Step 04: Admin Stories (aggregation — comes last)
**Files:** Create src/features/admin/AdminMockData.ts,
  AdminLicenseTable.tsx, AdminLicenseTable.stories.tsx
**Actions:**
- Mock data references shapes validated by Steps 02-03
- Build admin table with sorting, filtering, pagination
- Write stories: Empty, Populated, Scale (5000+), Filtered, SearchResults
**→ REVIEW GATE:** Final story review. **Schema locks after this review.**
**Verify:** All stories render correctly, pagination handles scale

### Step 05: Subscription Backend + Integration
**Files:** Create src/api/subscriptions.ts, src/features/subscription/useSubscription.ts,
  src/features/subscription/SubscriptionProvider.tsx
**Actions:**
- Build subscription service + API endpoints matching mock data shapes
- Write useSubscription hook (replaces mock data imports with fetch)
- Create provider that connects hook to existing SubscriptionListUI component
- Tests for service, endpoint, and hook
**Verify:** npm test passes, component renders with real API data

### Step 06: Gift Claim Backend + Integration
[Same pattern as Step 05 for gift claims]

### Step 07: Admin Backend + Integration
[Same pattern — admin endpoints aggregate data from Steps 05-06]
```

**Why this works:**
- All UI is reviewed before any backend is built — schema changes are cheap
- Story phases ordered by risk (complex user-facing first, admin last)
- Review gates at each story phase catch data model issues early
- Backend phases are pure execution — no UI surprises, no rework
- Mock data files serve as the API contract
- Phase count is driven by scope, not hardcoded
- Grade: A

---

## Example 7: When NOT to Plan

### OVER-PLANNED: Bug fix that doesn't need a plan

```markdown
# Plan: Fix Typo in Error Message

## Investigation
[200 lines of architecture analysis]

## Steps
1. Find the file with the error message
2. Change "recieved" to "received"
3. Run tests
4. Commit

## Decisions
[Decision document about string management strategy]

## Risks
[Risk assessment about breaking translations]
```

**Why this is wrong:** This is a typo fix. Just fix it. Planning overhead exceeds implementation time by 10x.

### RIGHT-SIZED: Just do it

```
Fix typo: "recieved" → "received" in src/api/errors.ts:42
```

**Planning is for changes where the approach isn't obvious.** If you can describe the diff in one sentence, skip the plan.
