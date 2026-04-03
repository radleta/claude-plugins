# Planning Anti-Patterns

Common failures that cause plans to fail during implementation. Each anti-pattern includes why it happens, what goes wrong, and how to fix it.

## Category 1: Investigation Failures

### Skip-the-Investigation

**Pattern:** Jump straight to designing steps without understanding the codebase.

**Why it happens:** Feels faster. Agent assumes it knows the codebase structure.

**What goes wrong:** Plan creates files in wrong locations, uses wrong naming conventions, misses existing utilities, duplicates functionality.

**Fix:** Always investigate first. Even 5 minutes of reading key files prevents hours of rework.

---

### Assumption-Based Planning

**Pattern:** Plan based on what a typical project looks like instead of what THIS project looks like.

**Why it happens:** Agent applies generic knowledge instead of discovering project-specific patterns.

**What goes wrong:** "Create tests in __tests__/" when project uses "tests/". "Use Jest" when project uses Vitest. "Add Redux" when project uses Zustand.

**Fix:** Compare 3+ examples of the same pattern IN the codebase before planning. Document discovered patterns with file:line references.

---

### Shallow Investigation

**Pattern:** Read 1 file and assume the whole project follows the same pattern.

**Why it happens:** First file found seems representative. Investigation feels "done enough."

**What goes wrong:** Old patterns vs new patterns diverge. First file found may be an exception, not the rule.

**Fix:** Read 3+ examples. Look for pattern evolution (old code vs new code). Document which pattern to follow and which to avoid.

---

## Category 2: Granularity Failures

### The Mega-Step

**Pattern:** "Step 1: Build the entire authentication system"

**Why it happens:** Agent groups related work into one conceptual unit. Feels cleaner with fewer steps.

**What goes wrong:** No way to verify partial progress. Agent drifts from plan mid-step. No clear point to check correctness.

**Fix:** Break into 5-10 minute steps. Each step should touch 1-2 files and have independently verifiable acceptance criteria.

---

### The Micro-Step

**Pattern:** "Step 1: Create file. Step 2: Add import. Step 3: Write function signature."

**Why it happens:** Over-applying the "make it specific" principle. Fear of vagueness leads to excessive decomposition.

**What goes wrong:** 30 steps for a simple feature. Massive dependency chains. Context window wasted on trivial bookkeeping.

**Fix:** Each step should be a meaningful unit of work (5-10 min). "Create the UserForm component with validation and props typing" is one step, not five.

---

### Inconsistent Step Sizing

**Pattern:** Step 1 takes 5 minutes, Step 2 takes 3 hours, Step 3 takes 10 minutes.

**Why it happens:** Agent decomposes some areas deeply and hand-waves others.

**What goes wrong:** Long steps hide complexity and risk. Short steps create noise. Progress tracking becomes meaningless.

**Fix:** Aim for consistent 5-10 minute steps. If one step takes significantly longer, split it. If three steps take 5 minutes each, merge them.

---

## Category 3: Executability Failures

### The Vague Step

**Pattern:** "Ensure proper error handling throughout the codebase."

**Why it happens:** Agent knows error handling is needed but doesn't specify which files, which errors, or which patterns.

**What goes wrong:** Implementing agent must guess scope, approach, and completeness. Results vary wildly between runs.

**Fix:** Replace with: "Add error handling to src/api/users.ts: wrap database calls in try/catch, return appropriate HTTP status codes (400 for validation, 404 for not found, 500 for server errors). Add error boundary in src/components/UserPage.tsx."

---

### The Assumed Context Step

**Pattern:** "Update the relevant configuration files."

**Why it happens:** Plan author knows which files but doesn't write them down. Assumes implementer will figure it out.

**What goes wrong:** Implementing agent doesn't know which configuration files. May miss files, update wrong files, or skip the step entirely.

**Fix:** List EVERY file. "Update configuration: modify src/config/routes.ts (add new route), update src/config/nav.ts (add menu item), update .env.example (add new env var API_TIMEOUT)."

---

### The Subjective Criterion

**Pattern:** Acceptance criteria: "Code is clean and well-structured."

**Why it happens:** Quality feels important but hard to quantify. Agent uses general quality language as placeholder.

**What goes wrong:** No objective way to verify. Implementing agent marks it "done" based on its own interpretation. Review becomes subjective debate.

**Fix:** Replace with measurable criteria: "TypeScript compiles (tsc --noEmit), ESLint passes (npm run lint), test coverage >= 80% (npm test -- --coverage), all public functions have JSDoc."

---

## Category 4: Completeness Failures

### The Happy-Path-Only Plan

**Pattern:** Plan covers the main feature but ignores error cases, edge cases, and failure modes.

**Why it happens:** Happy path is the most visible and satisfying to plan. Error handling is boring and complex.

**What goes wrong:** Implementation handles the happy path but crashes on invalid input, network failures, or edge cases. "Works on my machine" syndrome.

**Fix:** For every step, explicitly require: happy path implementation, error handling, edge case handling, and tests covering all three.

---

### The Test-Last Plan

**Pattern:** Testing is a single final step: "Step 8: Add tests."

**Why it happens:** Agent treats testing as a separate concern that happens after "real work."

**What goes wrong:** Tests written after implementation often only verify the happy path. Testing reveals that the implementation needs restructuring. Tests are superficial because the agent is "done" mentally.

**Fix:** Include testing IN each step: "Create UserForm with validation AND write tests for: valid input, empty fields, invalid email, duplicate username."

---

### The Missing Implicit Requirements

**Pattern:** Plan addresses what was asked but not what was implied.

**Why it happens:** Agent takes the request literally without considering technical necessities.

**What goes wrong:** Feature works but has no logging, no documentation, no migration, no backwards compatibility.

**Fix:** Checklist of implicit requirements for every plan: error handling, testing, documentation, logging, migration, backwards compatibility, performance, security. Explicitly state which apply and which don't.

---

## Category 5: AI-Specific Planning Failures

### The Over-Engineered Plan

**Pattern:** Plan introduces abstractions, design patterns, and infrastructure that far exceed the actual need.

**Why it happens:** AI agents tend toward comprehensive solutions. "What if we need to extend this later?" thinking.

**What goes wrong:** Simple feature requires a factory pattern, three abstraction layers, and a plugin system. Implementation takes 5x longer than necessary.

**Fix:** Apply YAGNI (You Aren't Gonna Need It). Each abstraction must justify itself against the CURRENT requirement. Ask: "Would the simplest possible implementation solve this?"

---

### The Context Drift Plan

**Pattern:** Plan starts aligned with requirements but gradually drifts to solving different problems.

**Why it happens:** As the agent plans more steps, it loses sight of the original objective. New "interesting" problems emerge during planning.

**What goes wrong:** Plan delivers something adjacent to but different from what was requested. Steps 1-3 match the requirement, steps 4-8 solve something else.

**Fix:** After writing each step, re-read the objective. Ask: "Does this step directly contribute to the stated objective?" Delete steps that don't.

---

### The Copy-Paste Architecture Plan

**Pattern:** Plan describes architecture from documentation or tutorials rather than the actual codebase.

**Why it happens:** Agent has training data about "how React apps should be structured" but doesn't investigate how THIS app is structured.

**What goes wrong:** Plan creates a textbook structure that conflicts with the existing codebase. New code feels foreign to the project.

**Fix:** Investigation phase discovers ACTUAL patterns. Plan follows discovered patterns, not textbook patterns. Document deviations only when existing patterns are clearly wrong.

---

### The Infinite Planning Loop

**Pattern:** Plan keeps growing as the agent discovers more things to plan for.

**Why it happens:** Each investigation reveals more context, which suggests more steps, which require more investigation.

**What goes wrong:** Planning phase never ends. 30 steps for a 2-hour feature. Analysis paralysis.

**Fix:** Set a planning budget proportional to implementation scope. Bug fix plan: 30 minutes max. Feature plan: 1-2 hours max. If planning exceeds the budget, the scope needs splitting, not more planning.

---

## Category 6: Atomicity Failures

### The Deferred Cleanup Phase

**Pattern:** Plan creates a catch-all "Update References" or "Clean Up" phase at the end to fix side effects from earlier phases.

**Why it happens:** It feels cleaner to batch all reference updates together. Each phase focuses on its "main action" and defers secondary concerns.

**What goes wrong:** The cleanup phase is vague ("update any references") because it can't anticipate every side effect. Phases 1-N leave the codebase in inconsistent states — if execution stops mid-plan, references are broken. The cleanup phase often misses items because it's too far removed from the change that created the need.

**Example:**
```markdown
❌ BAD:
Phase 1: Rename module-a to module-b
Phase 2: Rename module-c to module-d
Phase 3: Update all references to old module names  ← catch-all

✅ GOOD:
Phase 1: Rename module-a to module-b
  - Rename directory
  - Update module frontmatter
  - Grep entire repo for "module-a", update every hit
  - Verify: zero grep results for old name

Phase 2: Rename module-c to module-d
  - Rename directory
  - Update module frontmatter
  - Grep entire repo for "module-c", update every hit
  - Verify: zero grep results for old name
```

**Fix:** Each phase must complete ALL side effects of its change: reference updates, cross-references, documentation updates, and verification. Apply the **atomic phase rule**: after any phase completes, the codebase is fully consistent with zero dangling references. No phase should depend on a future cleanup phase.

---

### The Non-Atomic Phase

**Pattern:** Phase performs its main action but leaves cleanup, verification, or reference updates for "later."

**Why it happens:** Agent focuses on the primary deliverable of each phase and treats side effects as secondary. "I'll fix the references in a cleanup pass."

**What goes wrong:** If execution stops after Phase 3 of 6, the codebase has broken references from Phases 1-3 that were supposed to be fixed in Phase 6. Each phase's incompleteness compounds.

**Fix:** Apply this test to every phase: "If execution stops immediately after this phase, is the codebase consistent?" If no, the phase is missing steps. Add reference updates, verification, and cleanup WITHIN the phase.

---

## Category 7: UI Planning Failures

### The Backend-First UI

**Pattern:** Plan builds API endpoints and services first, then creates UI components to consume them.

**Why it happens:** Backend feels like the "real work." Agent wants to establish the API contract first and build UI to match.

**What goes wrong:** UI review reveals the API shape is wrong — a field is missing, a list needs pagination the API doesn't support, or the data is grouped differently than the UI needs. Backend is already built and tested. Rework is expensive.

**Fix:** Apply CDD phasing (load CDD.md). Build all UI components as stories with mock data first. Review the stories. The mock data shapes become the API contract. Backend is built to match — not the other way around.

---

### The HTML Mockup Trap

**Pattern:** Plan creates HTML mockups (standalone .html files) as the UI deliverable, then has a later phase "convert mockups to components."

**Why it happens:** HTML mockups are fast to create and look good in a browser. Feels like progress.

**What goes wrong:** HTML mockups don't compile, don't type-check, don't handle state transitions, and don't reveal data shape requirements. An agent building a real component from an HTML mockup starts from scratch — the mockup is a picture, not code. The "conversion" step is really "build from scratch while looking at a reference."

**Fix:** Skip mockups. Build real components with stories directly. Stories ARE the deliverable — they render real components with real props and real state handling. If mockups already exist, treat them as design references, not source of truth.

---

### The Interleaved Story Review

**Pattern:** Plan builds stories and backend together per feature vertical (Phase 1: Feature A stories + backend, Phase 2: Feature B stories + backend).

**Why it happens:** Per-feature vertical slices seem clean and self-contained. Each phase ships a complete feature.

**What goes wrong:** Phase 3's story review reveals a data model change that Phase 1's backend already uses. You either rework Phase 1's shipped code or live with the suboptimal data shape. The later in the plan a story reveals a schema issue, the more expensive the fix.

**Fix:** Apply CDD phasing. Review ALL stories before ANY backend work. Schema changes during story review are cheap (just type definitions). Schema changes after backend phases ship are expensive (services, endpoints, tests, migrations).

---

## Category 8: DRY and Reuse Failures

### Parallel Implementation
**Pattern:** Creating a new file, function, or class when a similar one already exists in the codebase, without explicit justification in the decision table.
**Why it happens:** Assumed backwards compatibility makes it feel safer to create alongside rather than modify. Investigation was shallow — the existing implementation wasn't found.
**What goes wrong:** Code duplication, architectural divergence, maintenance burden doubles. Two implementations drift apart over time.
**Fix:** Investigate existing code thoroughly. Reference specific file:line to extend. Justify new files in the decision table. Default is extend/adapt, not create alongside.

---

### Assumed Backwards Compatibility
**Pattern:** Preserving old interfaces alongside new ones without explicit user approval. Creating wrapper functions, compatibility shims, or "v2" versions that keep the old code alive.
**Why it happens:** Safety reflex — avoiding breaking changes feels responsible. But assumed BC without approval is just code duplication.
**What goes wrong:** Duplicate code paths, confusion about which is canonical, bloat. Old interface never gets removed because "someone might use it."
**Fix:** Default to extend/adapt (agile: build and switch). If backwards compatibility is genuinely needed, propose it to the user with rationale. Only proceed with BC when explicitly approved and recorded in the decision table.

---

### Vague Extension Point
**Pattern:** Step says "extend the existing service" or "update the handler" without specifying which method, function, or class at which file:line.
**Why it happens:** Incomplete investigation, skipped codebase exploration. The planner knows something exists but didn't look closely enough to cite specifics.
**What goes wrong:** Agent invents its own approach — may modify the wrong function, create a parallel implementation, or add code in the wrong place.
**Fix:** Investigate the codebase. Cite the specific function/method/class name and file:line to extend. "Add email lookup to UserService.getById() at user-service.ts:45, following the getByUsername() pattern at line 32."

---

## Anti-Pattern Quick Reference

| Anti-Pattern | Category | Quick Fix |
|-------------|----------|-----------|
| Skip investigation | Investigation | Always investigate first |
| Assume patterns | Investigation | Discover 3+ examples from codebase |
| Shallow investigation | Investigation | Compare multiple examples |
| Mega-step | Granularity | Split to 5-10 min steps |
| Micro-step | Granularity | Merge trivial steps |
| Inconsistent sizing | Granularity | Target uniform 5-10 min |
| Vague step | Executability | Specify files, actions, criteria |
| Assumed context | Executability | List every file explicitly |
| Subjective criterion | Executability | Use measurable verification |
| Happy path only | Completeness | Include error + edge cases |
| Test last | Completeness | Include tests in each step |
| Missing implicit reqs | Completeness | Checklist implicit requirements |
| Over-engineered | AI-Specific | Apply YAGNI, simplest solution |
| Context drift | AI-Specific | Re-read objective after each step |
| Copy-paste architecture | AI-Specific | Follow discovered patterns |
| Infinite planning | AI-Specific | Set planning time budget |
| Deferred cleanup | Atomicity | Each phase updates its own references |
| Non-atomic phase | Atomicity | Phase must leave codebase consistent |
| Backend-first UI | UI Planning | Build stories first, backend matches mock data shapes |
| HTML mockup trap | UI Planning | Build real components with stories, skip mockups |
| Interleaved story review | UI Planning | Review ALL stories before ANY backend work |
| Parallel Implementation | DRY & Reuse | Investigate existing code, reference file:line, justify new files |
| Assumed Backwards Compatibility | DRY & Reuse | Default extend/adapt, BC requires explicit user approval |
| Vague Extension Point | DRY & Reuse | Cite specific function/method at file:line |
