---
name: plan-expert
description: "Research-validated framework for creating implementation plans that agents can execute autonomously. Use when planning code changes, designing implementation approaches, decomposing features into steps, or evaluating plan quality — even for seemingly simple tasks."
---

<role>
  <identity>Expert planning architect for agent-executable code change plans</identity>

  <purpose>
    Create comprehensive, unambiguous implementation plans that agents can
    execute autonomously with zero human interpretation needed
  </purpose>

  <expertise>
    <area>Codebase investigation methodology before planning</area>
    <area>Step decomposition with correct granularity</area>
    <area>Decision documentation with options and rationale</area>
    <area>Plan quality assessment and grading</area>
    <area>Agent-optimized plan writing (explicit, structured, measurable)</area>
  </expertise>

  <scope>
    <in-scope>
      <item>Planning methodology for code changes</item>
      <item>Investigation protocols for understanding codebases</item>
      <item>Step decomposition and dependency mapping</item>
      <item>Decision documentation and risk assessment</item>
      <item>Plan quality evaluation and improvement</item>
      <item>Agent-executable plan writing</item>
    </in-scope>

    <out-of-scope>
      <item>Code implementation (use code-change or implement-code)</item>
      <item>Plan file structure and folder layout (use plan-it command)</item>
      <item>Code review and verification (use verify-* commands)</item>
      <item>Project management and sprint planning</item>
    </out-of-scope>
  </scope>
</role>

## The 9 Planning Principles

These principles define what separates effective plans from plans that fail during execution.

### 1. Investigate Before You Plan

Discover the codebase reality before designing an approach. Plans built on assumptions fail during implementation.

**What to investigate:**
- Architecture: file structure, module organization, entry points, dependencies
- Patterns: naming conventions, code style, existing similar implementations
- Constraints: testing framework, build system, deployment pipeline, CI requirements
- Context: why the current code is structured this way (git history, comments, decisions)

**Investigation depth scales with risk:**
- Small bug fix → 5 minutes scanning affected files
- New feature → 30 minutes mapping architecture and patterns
- Architectural change → 1+ hours deep-diving into structure, dependencies, and history

### 2. Make Every Step Agent-Executable and Atomic

Each step must be specific enough that an agent can execute it without human interpretation. Each step must also be **atomic** — it completes ALL side effects and leaves the codebase in a consistent state.

- **Specify affected files** — list exact paths to create or modify
- **Define acceptance criteria** — measurable yes/no verification per step
- **State dependencies** — which steps must complete before this one starts
- **Include verification commands** — how to confirm the step succeeded
- **Specify expected deliverables** — list the count and type of outputs (e.g., "3 components, 1 hook, 1 test file") so the implementer can scope-lock and verify completeness against a concrete target
- **Reference specific extension points** — each step that modifies existing code must cite the specific file:line to extend, not just "follow existing patterns." This constrains the agent's decision surface and prevents parallel implementations.
- **Reference reusable sources by path** — when a step applies a pattern, decision, or contract documented elsewhere (wiki page, skill methodology, project doc, code anchor, spec section, HANDOFF entry, external URL), name it via `Apply: Rx` and catalogue Rx in the plan's References table. Never duplicate the source content into the step body. Workstream-specific application (file path, range, behavior) belongs in the step; the canonical source stays where it lives. (see Plan Anatomy: Required Assets table for the References table specification)
- **Complete all side effects** — reference updates, cross-references, and cleanup happen IN the step that created the change, not deferred to a later "cleanup" step

```markdown
BAD:  "Update the authentication system"
GOOD: "Modify src/auth/middleware.ts (2 functions, 1 type update):
       - Add OAuth2 token validation in validateRequest()
       - Add refresh token rotation in refreshTokens()
       - Update AuthConfig interface in src/types/auth.ts
       Deliverables: 2 new functions + 1 modified interface
       Verify: existing auth tests pass (npm test -- --grep auth)"
```

**Atomic phase rule**: Never create a catch-all "Update References" or "Clean Up" phase at the end of a plan. If Phase 1 renames a module, Phase 1 also greps for and updates all references to the old name. Each phase leaves zero dangling references for later phases to fix.

### 3. Right-Size the Granularity

Steps too large cause implementation drift. Steps too small waste context and create dependency chains.

**Target: 5-10 minutes of implementation work per step.**

| Too Coarse | Right-Sized | Too Fine |
|------------|-------------|----------|
| "Build the API" | "Add validation to POST /api/users endpoint in users.ts" | "Create the file. Add the import. Write the function signature." |
| "Add authentication" | "Add JWT middleware to auth.ts and wire into route config" | "Import jsonwebtoken. Call jwt.verify. Check expiration." |

**Deliverable counts are a granularity signal.** If you can't count what the step produces, the step is too coarse. If the count exceeds 10, the step may be too large. Target 1-3 deliverables per step.

**New file justification.** Steps that create new files must justify why an existing file can't be extended. If a similar file exists, the step must reference it and explain the decision.

### 4. Document Decisions with a Living Decision Table

Every non-obvious choice needs documentation. Future agents (and humans) need to understand WHY, not just WHAT. Decisions evolve — the record must evolve with them.

**Maintain a Decision Table as the canonical record of all plan decisions.** Create it during planning, update it whenever decisions change during execution. Never delete rows — only update status so the full history is preserved.

| ID | Decision | Status | Date | Rationale | Supersedes |
|----|----------|--------|------|-----------|------------|
| D1 | Use JWT for auth tokens | Accepted | 2026-03-10 | Stateless, scales horizontally, jsonwebtoken already in deps | — |
| D2 | Bcrypt cost factor 12 | Superseded | 2026-03-10 | Matches existing pattern in user service | — |
| D3 | Bcrypt cost factor 10 | Accepted | 2026-03-11 | Load testing showed 300ms too slow at scale | D2 |

**Decision statuses:**
- **Proposed** — under discussion, not yet committed to
- **Accepted** — committed, implementation proceeds based on this
- **Superseded** — replaced by a newer decision (link via Supersedes column)
- **Reverted** — rolled back during execution (document why in rationale)

**Update the decision table when:**
- A new non-obvious choice is made during planning or execution
- An accepted decision proves wrong and must change
- User feedback during review changes the approach
- Investigation during execution reveals new constraints
- The plan scope expands and new trade-offs emerge

**Each decision's detail section captures:**
- Context: why this decision matters
- Options considered: at least 2 alternatives
- Choice made: which option and why
- Trade-offs: what you give up
- Affected files: what changes as a result

### 5. Identify Risks and Mitigations

Name what could go wrong before it does. Every plan has risks — pretending otherwise causes implementation surprises.

**Common risk categories:**
- **Breaking changes**: existing tests fail, API contracts change, data migrations needed
- **Integration risks**: dependencies between modules, third-party API changes
- **Performance risks**: N+1 queries, large payloads, missing indexes
- **Scope risks**: requirements ambiguity, feature creep, underestimated complexity

### 6. Design for Verification

Build verification into the plan, not as an afterthought. Each step should state how to confirm it worked.

**Verification hierarchy:**
1. Automated tests (strongest — write tests BEFORE or WITH implementation)
2. Build/compile checks (TypeScript compiles, linter passes)
3. Manual verification commands (curl endpoint, check database state)
4. Visual confirmation (screenshot comparison, UI state check)

Every implementation step's Acceptance Criteria must include ≥1 concrete verification command from this hierarchy or the lightweight tier defined in PLAN-QUALITY.md — steps without verification are flagged by Phase 4 validation and cap the plan at Grade C.

### 7. Separate Planning from Execution

Planning is read-only investigation and document creation. Never implement during planning.

- Investigation: read files, search patterns, examine history
- Planning: write plan documents, decisions, steps
- Execution: implement code changes (SEPARATE phase, after plan approval)

### 8. Match the Artifact

Structured artifacts beat prose for correctness when correctness is combinatorial. A prose description of a state machine can omit states silently; a State & Transition Matrix with every (state × event) cell filled cannot. A prose API description can omit exception conditions; a Method Contract with `requires`, `ensures`, `throws` fields cannot. Decision Tables expose missing branches that conditional prose conceals.

**Implementer perspective:** A surgical fix to one cell of an existing state machine, decision tree, or method contract needs the structural artifact MORE than the original author did, because the fix must remain consistent with every cell it doesn't touch. The principle therefore applies to fixes and refactors as much as to new construction — gating fires on combinatorial structure in the touched code, not on whether the step is framed as design or fix.

This principle does NOT mean every plan step needs every artifact. It means: when the structural context has a combinatorial shape (states × events, conditions × outcomes, call sites × preconditions), use the matching artifact to surface the bugs prose hides.

**Selection guide and templates:** See `plan-expert/ARTIFACTS.md` for the artifact selection table (indexed by structural pattern type) and copy-pasteable templates for each artifact. See `plan-expert/SIGNALS.md` for the signal list that fires the artifact-required check on plan steps.

**Migration note (deprecated schema):** The previous plan-step schema used `design-step: true|false` YAML frontmatter to gate artifact requirements on author intent. This key is now deprecated. Steps with `design-step:` frontmatter (any value) are rejected by `step-quality-reviewer` with finding `deprecated-frontmatter`. Migration target: replace the frontmatter key with an `## Artifact: <type>` heading (or `## Artifact: none` with substantive rationale). Gating is now content-driven — signals fire on the step text, not on author-set flags.

### 9. Plan Reconciliation Gates

After every design-producing step, a mandatory reconciliation step is auto-inserted. Design-producing steps are those whose deliverables include architectural outputs consumed by later steps.

**Design-producing step detection cues:**
- Component design / API design / interface definition
- Architecture spikes / prototyping
- Data model design
- UI/UX design that produces component specifications
- Step deliverables include "design," "schema," "API contract," "interface definition," "component spec," "prototype"
- Step explicitly says it produces outputs consumed by later steps

**Reconciliation step template:**

```markdown
# Step NNr: Reconcile plan after [design step name]

## Description
Review changes produced by step NN against remaining plan steps.
Hard gate — cannot proceed until plan is trued up.

## Actions
- [ ] Review what changed during step NN (new files, modified interfaces, changed data models)
- [ ] Compare changes against steps NN+1 through final step
- [ ] Identify affected future steps (file paths changed, criteria invalidated, new steps needed, steps now unnecessary)
- [ ] Check if changes affect the spec (architecture, components, data flow) — if yes, update spec
- [ ] Present reconciliation summary to user for review
- [ ] Update affected plan steps (add sub-steps, modify criteria, adjust dependencies)

## Acceptance Criteria
- [ ] All affected future steps updated or flagged
- [ ] Spec updated if "what" changed (not just "how")
- [ ] User approved reconciliation changes
```

**Sub-step numbering:** When reconciliation adds steps after a completed step, use alphabetical sub-steps: `02a`, `02b`, `02c`. Original step stays as-is (completed work is done). If a step's outputs are superseded, mark it as `COMPLETED -> SUPERSEDED by 02a`.

**Superseded steps:** Steps marked `COMPLETED -> SUPERSEDED by NNa` are preserved for audit trail but no longer treated as authoritative. Agents reading the plan should use the superseding step instead.

## Plan Anatomy: Required Assets

A complete plan contains these assets:

| Asset | Purpose | Quality Gate |
|-------|---------|-------------|
| **Objective** | Single sentence stating what and why (< 25 words) | Clear, measurable, no jargon |
| **Investigation findings** | Architecture, patterns, examples discovered | Evidence-based with file:line refs |
| **Implementation steps** | Ordered sequence of agent-executable actions (8-15 steps typical) | Each has files, criteria, dependencies |
| **Decision table** | Living record of all decisions with status tracking (Proposed/Accepted/Superseded/Reverted) | Never delete rows; update status as decisions evolve |
| **References table** | Living catalogue of authoritative sources the plan applies (wiki pages, skills, docs, code anchors, spec sections, HANDOFF entries, external URLs) with workstream-specific application column | All local paths resolve; anchors exist; no source duplication in step bodies; no orphan refs |
| **Risk assessment** | What could go wrong and mitigations | At least 2 risks per plan |
| **Verification strategy** | How to confirm the plan succeeded | Tests, checks, or commands |

**File structure principle:** Flat-first. Plan assets live directly in `scratch/[project]/` (no `plan/` subdirectory). Start with single files (research.md, decisions.md, steps/NN-name.md). Only escalate to folders when content volume demands it (e.g., 4+ decisions, 200+ lines of research). Max depth: 2 levels from project root.

## Edit Delegation Protocol

ALL writes to plan files (`README.md`, `research.md`, `decisions.md`, `steps/*.md`) go through a foreground sub-agent. Main session never opens Write/Edit on plan files — even one-line decision-table updates, single criterion additions, or typo fixes during the validation fix loop. The sub-agent reads source artifacts (`spec.md`, `idea.md` if present) directly; main session never pre-summarizes spec content into the dispatch prompt.

**Why:** The artifacts are large by nature — spec alone runs hundreds of lines, plus research, decisions, and N step files drafted in sequence. Main session stays the orchestrator; the actual artifact reading and writing happens in an isolated sub-agent context. Models bias to "I need this in context" — resist.

**Tier:** Sonnet for trivial single-section edits or fix-loop typo applications. Opus when the spec requires translation/decomposition (the initial steps/ generation, README.md authoring, or restructure-class fix-loop applications) — most plan-writing falls here. All dispatches are foreground because the next step (validation, re-review, user approval) depends on the file being on disk.


Trust the returned diff. Main session does NOT re-Read plan files after a delegated write unless a specific downstream step needs the contents.

## Planning Workflow

<workflow type="sequential">
  <gate id="0-classify" name="Classify Task">
    BEFORE any investigation, classify the task on TWO dimensions:

    **Dimension 1: UI Involvement**
    - Components, pages, forms, dashboards, user-facing surfaces → UI_INVOLVED = true
    - Purely backend, CLI, infrastructure, data pipeline → UI_INVOLVED = false

    If UI_INVOLVED: load CDD.md NOW. CDD phasing reshapes the entire plan —
    investigation areas, step ordering, and validation all change.
    Only skip CDD if the user explicitly opts out.

    **Dimension 2: App Type** (determines testing/verification protocol)
    - React, Vue, Svelte, Next.js, or browser-based app → APP_TYPE = web-app
    - Command-line tool, terminal utility, script → APP_TYPE = cli
    - Backend API, microservice, serverless → APP_TYPE = api (no protocol yet)
    - Library, SDK, package → APP_TYPE = library (no protocol yet)
    - None of the above → APP_TYPE = general (no protocol yet)

    If APP_TYPE has a protocol file: load protocols/{APP_TYPE}.md NOW.
    The protocol adds testing strategy, verification requirements, and
    app-type-specific checklist items that shape the entire plan.

    Note: Both dimensions can be active simultaneously. A web-app always
    has UI_INVOLVED = true and gets BOTH CDD.md and protocols/web-app.md.
  </gate>

  <phase id="1-investigate" name="Investigate">
    Explore the codebase to understand current state.
    Read architecture, patterns, and similar implementations.
    Document findings with file:line references.
    If UI_INVOLVED: UI Infrastructure Discovery is MANDATORY (not optional).
    Discover component framework, story tool, component patterns, mock data conventions.
    If APP_TYPE has a protocol: execute protocol-specific investigation areas
    (testing infrastructure, story infrastructure, CLI framework, etc.).
  </phase>

  <phase id="2-analyze" name="Analyze Requirements">
    Extract explicit requirements from the request.
    Infer implicit requirements (error handling, tests, docs).
    Identify constraints (must-nots, compatibility, performance).
    Define completeness criteria (what "done" means).
  </phase>

  <phase id="3-design" name="Design Approach">
    Define primary strategy with rationale.

    If UI_INVOLVED — apply CDD ordering (from CDD.md):
      DATA MODEL phases → STORY phases (risk-ordered) → BACKEND phases
      - Stories use mock data that defines the API contract
      - Each story phase has a REVIEW GATE
      - Schema locks after last story phase review
      - Backend builds to match mock data shapes, NOT the other way around
      See CDD.md for full methodology: component pattern, story variants, review gate checklist.

    If NOT UI_INVOLVED — standard step decomposition:
      Break into implementation steps (8-15 typical).

    Map dependencies between steps.
    Document key decisions with options considered.
    Assess risks and define mitigations.
  </phase>

  <phase id="4-validate" name="Validate Plan">
    Check every step is agent-executable (specific files, clear criteria).
    Verify no vague language remains ("appropriate", "as needed", "etc.").
    Confirm dependencies are explicit and acyclic.
    Ensure verification strategy covers all steps.
    Verify decision table exists with all non-obvious choices recorded and status set.

    If UI_INVOLVED — verify CDD compliance:
      - Plan follows DATA MODEL → STORIES → BACKEND ordering
      - Story phases exist with review gates
      - Mock data files serve as API contract
      - No backend phases precede story phase completion
      If any of these fail, restructure the plan before grading.

    If APP_TYPE has a protocol — verify protocol compliance:
      - App-type-specific checklist items pass (from protocol file)
      - Testing strategy covers all required tiers
      - Protocol-specific investigation areas were covered
      If checklist score is below threshold, plan is capped at Grade C.

    Load the `verify-fix-loop-expert` skill using the Skill tool before entering the validation loop.

    <!-- Canonical affinity groups
         Keep in sync with implement-code.md and verify-all.md affinity maps
         AFFINITY_GROUPS:
           frontend:     [react-expert, typescript-expert]
           backend-net:  [csharp-expert, dynamodb-expert, google-sheets-expert]  # shared .NET/C# integration context
           infra:        [github-actions-expert, gcp-expert]
           cli-scripts:  [cli-expert, scripts-expert, powershell-expert]
         Max 2-3 skills per group. Ungrouped skills → their own solo domain-reviewer dispatch. -->

    Dispatch parallel review subagents:
    1. **step-quality** reviewer (see step-quality-reviewer-prompt.md in this skill directory)
    2. **investigation-quality** reviewer (see investigation-quality-reviewer-prompt.md in this skill directory)
    3. **domain reviewers** — group detected skills by affinity map above. Launch one **domain-reviewer** agent per group with any detected skills (and one per ungrouped solo skill) via the Agent tool. Each dispatch prompt is a thin parameter block:
       ```
       /<skill-1> [/<skill-2> ...]

       Artifact: scratch/{project}/README.md
       Depth: thorough
       Type: plan
       ```
       The agent handles skill loading and methodology internally. Verdict parsing: extract **Status:** from inside `## Aggregate` (missing = Issues Found fail-safe).

    Verify-fix loop (mandatory):
    1. IF all reviewers return Approved → exit loop, proceed to plan quality grading.
    2. IF any reviewer returns Issues Found:
       a. Fix flagged issues using report findings.
       b. IMMEDIATELY return to dispatch step — re-dispatch ALL reviewers. Do NOT proceed without re-verification.
    3. Max 10 iterations. If exceeded, escalate to user.
    4. NEVER exit this loop without an Approved verdict or explicit user escalation.

    If the plan introduces technologies not in the spec's Skill Coverage section,
    run skill coverage detection and gate before dispatching reviewers.

    After all reviewers pass:
    Grade plan quality using PLAN-QUALITY.md checklist.
  </phase>
</workflow>

## When to Plan vs When to Just Code

Not everything needs a plan. Use this decision guide:

| Signal | Action |
|--------|--------|
| You could describe the diff in one sentence | Skip planning, just code |
| Change touches 1-2 files with clear scope | Light plan (mental model) |
| Change touches 3+ files or unfamiliar code | Standard plan (investigation + steps) |
| Architectural change or new subsystem | Comprehensive plan (full assets) |
| Requirements are ambiguous or contested | Plan with interview/discovery phase |

## File Loading Protocol

Load sibling pages on demand based on task context. See `## Pages` below for the full index with per-file load-when guidance. Quick reference:

- **Always load at classification gate:** CDD.md (UI_INVOLVED = true), protocols/web-app.md (APP_TYPE = web-app), protocols/cli.md (APP_TYPE = cli)
- **Load during investigation:** INVESTIGATION.md (most plans)
- **Load at validation:** PLAN-QUALITY.md, step-quality-reviewer-prompt.md, investigation-quality-reviewer-prompt.md
- **Load on demand:** ANTI-PATTERNS.md (plan review), EXAMPLES.md (need before/after examples)

**Agent-internal pages — loaded by dispatched reviewers, not by plan authors:**
- **SIGNALS.md** — Loaded by the step-quality-reviewer dispatch via explicit Read instruction at the top of its task (before any rule application). This is the actual load mechanism — there is no `skills:` field on a general-purpose dispatch. Plan authors do NOT load this page at validation time.

## Pages

- [Wiki-Health Baseline Gotcha](wiki-health-baseline-gotcha.md) — wiki-health pre-existing condition check: baseline state must be established before validating plan acceptance criteria
- [Anti-Patterns](ANTI-PATTERNS.md) — 15+ named anti-patterns organized by category with root causes, failure modes, and fixes
- [Artifacts](ARTIFACTS.md) — Artifact selection table for State Matrix, Decision Table, Method Contracts, Concrete Examples, Sequence Diagram, and Invariants — when each fires + copy-pasteable templates (Principle 8)
- [Signals](SIGNALS.md) — Combinatorial signal list organized by artifact type — used by step-quality-reviewer to fire the artifact-required check
- [CDD](CDD.md) — Component-Driven Development phasing for UI plans: stories-first ordering, review gates, mock-data-as-contract pattern
- [Examples](EXAMPLES.md) — Annotated before/after examples of steps, decisions, investigations, risk assessments, and complete plans
- [Investigation](INVESTIGATION.md) — Investigation methodology: discovery areas, depth scaling by risk, anti-patterns, and findings documentation
- [Plan Quality](PLAN-QUALITY.md) — 5 quality dimensions, 77-item checklist, grading rubric A/B/C/D, and verification cap rules
- [Step-Quality Reviewer Prompt](step-quality-reviewer-prompt.md) — Dispatch template for step-quality reviewer: granularity, decision-constraining, completeness checklists
- [Investigation-Quality Reviewer Prompt](investigation-quality-reviewer-prompt.md) — Dispatch template for investigation-quality reviewer: evidence quality and assumption detection checklists
- [Protocols Index](protocols/README.md) — Index of app-type planning protocols loaded at the classification gate based on APP_TYPE
- [Web App Protocol](protocols/web-app.md) — Web app planning protocol: 3-tier testing, story requirements, visual verification, 10 checklist items (APP_TYPE = web-app)
- [CLI Protocol](protocols/cli.md) — CLI app planning protocol: 3-tier testing, exit codes, piping, output formats, 8 checklist items (APP_TYPE = cli)

## Meta

- [Operations Log](log.md) — Timestamped wiki operations log (ingest, lint, query filings)
- [Schema](schema.md) — Wiki conventions and page-type definitions
