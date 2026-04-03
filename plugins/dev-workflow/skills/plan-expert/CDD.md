# Component-Driven Development Planning

When a feature involves UI, standard planning interleaves UI and backend work per phase. This creates two failure modes that CDD phasing eliminates.

## The Two Failure Modes

**Mockup-to-code gap**: HTML mockups look right in a browser but don't become real components. An agent building the actual component starts from scratch — the mockup is a reference picture, not code. Translation is lossy.

**Late UI rework**: You build backend services, review the UI, then discover the data model needs a field you didn't plan for. Backend is already shipped. Rework is expensive.

Both share a root cause: **the UI is reviewed too late to influence the data model.**

## When to Use CDD Phasing

**CDD is the default for any plan that involves UI work.** If the feature touches components, pages, forms, dashboards, or any user-facing surface — use CDD phasing. Only skip CDD if the user explicitly opts out.

CDD is especially valuable when:
- Multiple UI surfaces exist (pages, admin views, dashboards, emails)
- Scale or pagination concerns exist (tables with 100+ rows, bulk operations)
- Tier/role complexity exists (different users see different things)
- Agent-executed implementation (stories serve as unambiguous specs)
- Team handoffs (backend dev builds to the mock data contract)

## When NOT to Use CDD Phasing

Use standard planning only when:
- Feature is purely backend-only or CLI-only (zero UI involvement)
- The user explicitly requests a different approach

## The CDD Ordering Principle

CDD doesn't prescribe a fixed number of phases. It establishes an **ordering constraint**:

```
DATA MODEL phases → STORY phases (risk-ordered) → BACKEND phases
```

How many phases each section becomes depends on the project's scope. Use the existing plan-expert granularity rules (5-10 min per step, 1-2 files, atomic phases) to determine the right number. A small project might have 4 total phases. A large project might have 12+.

### Data Model Phases (Come First)

Build the foundation that stories will reference:
- Entities, types, enums, schemas
- Table definitions, migrations
- Shared type definitions consumed by both UI and backend

These phases have no review gate — they're the skeleton the stories flesh out.

### Story Phases (Come Next, Ordered by Risk)

Build every UI component as an isolated story with mock data. Order story phases by **risk to the data model** — surfaces most likely to reveal entity gaps come first:

1. **Most complex user-facing UI first** — these are most likely to reveal missing fields, wrong types, or structural problems in the data model
2. **Remaining user-facing UI** — fills out the complete user experience
3. **Admin/aggregation views last** — these aggregate data from multiple features, so they must come after all user-facing stories are reviewed (if a user-facing story changes an entity field, the admin view needs to reflect that)

**Each story phase has a REVIEW GATE.** At the gate:
- Review rendered components for data shape correctness
- If the review reveals entity changes needed, apply them before the next phase (this is cheap — no backend to rework yet)
- The review gate checklist is below

**Schema locks after the last story phase.** Once all stories are reviewed and approved, the data model is frozen. Backend phases build to this contract.

### Backend Phases (Come Last)

After all stories are reviewed, backend phases are pure execution:
- Build services and API endpoints
- Write hooks that swap mock data for real API calls
- Add emails, notifications, background jobs
- Tests

No component creation happens here. The stories already exist and are approved. The only frontend work is wiring — hooks that replace mock data imports with real `fetch()` calls.

## The Component Pattern

Each feature area follows a consistent file structure. Adapt naming and organization to match the project's existing conventions:

| File | Role | Built When |
|------|------|------------|
| Mock data | Defines data shapes and realistic sample values — **this is the API contract** | Story phases |
| Pure UI component | Props in, render out. No data fetching, no side effects | Story phases |
| Stories | Isolated rendering of every component state (see variants below) | Story phases |
| Hook | API calls, data fetching, mutations | Backend phases |
| Provider/Glue | Connects hook output to component props | Backend phases |

**The mock data file is the contract.** When you define mock data with specific fields, you're implicitly defining what the API response must look like. The backend is built to match this shape — not the other way around.

## Story Variants

Each component needs stories covering every real-world state:

| Variant | Why It Matters |
|---------|---------------|
| Empty | What does the user see when there's no data? |
| Loading | Skeleton or spinner state |
| Error | API failure state |
| Populated (few items) | Normal use case with realistic data |
| Scale (100+, 1000+) | Does pagination work? Does the layout break? |
| Filtered/searched | Does filtering change the layout? |
| Tier/role variants | Does the component adapt to different user types? |

**The scale variant is critical.** If mock data only shows 5 items but production has 1000, the story won't reveal pagination or performance problems. Always include a scale variant with realistic numbers.

## Review Gate Checklist

At each story phase review gate, verify:

- [ ] Data shapes in mock data match entity field names and types
- [ ] All user states are covered (not just the happy path)
- [ ] Scale variants render correctly (100+, 1000+ items)
- [ ] Tier/role variants display correctly
- [ ] Empty, loading, and error states are handled
- [ ] Component is accessible (keyboard navigation, screen reader, contrast)
- [ ] Mobile viewport renders correctly (if applicable)

**If any data shape mismatch is found:** Fix the entity definition before proceeding to the next story phase. This is cheap — it's just a type change. Compare this to discovering the same issue after backend phases have shipped.

## Step File Conventions for CDD Plans

Story step files should include:
- Mock data definitions (field names, types, realistic sample values)
- Component list with prop interfaces
- Story variants for each component
- **REVIEW GATE** marker with the checklist above
- Note: "If this review reveals entity changes, update entities before proceeding"

Backend step files should include:
- Service methods with signatures
- API endpoints with request/response shapes matching mock data contracts
- Hook implementation (replacing mock data with real API calls)
- Tests
- Deployment/shipping statement

## Decisions: Splitting vs Bundling Story Phases

| Factor | Split into separate phases | Bundle into one phase |
|--------|--------------------------|----------------------|
| Different data models involved | Split | — |
| Independent review cycles | Split | — |
| Same data model, same feature area | — | Bundle |
| Reviewer fatigue (50+ stories) | Split | — |
| Components depend on each other | — | Bundle |

## Why CDD Works Better Than Alternatives

**vs. Backend-first**: Backend-first means the API defines the data shape. When UI review reveals the shape is wrong (it always does), you rework services and endpoints.

**vs. Per-feature vertical slices**: Each feature's story review might reveal an entity field that a previous feature's backend already uses. You either rework shipped code or live with the suboptimal shape.

**vs. HTML mockups**: Mockups don't compile, don't type-check, don't handle state, and don't reveal data shape requirements. An agent building a component from an HTML mockup starts from scratch.

**CDD's advantage**: Stories ARE the code. The component is already built — it just needs real data wired in. The mock data file IS the API contract. No translation gap, no rework, no surprises.
