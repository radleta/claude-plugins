---
name: code-verification
description: "Code quality and requirements verification: 13 detection categories, traceability against idea.md's Contracts & Acceptance, and almost-right logic detection. Use when reviewing code changes for quality, convention violations, over-engineering, requirements coverage, or decision conformance — even for small or markdown-only diffs."
---

# Code Verification Methodology

## Contract

This skill supplies the *categories* — what to look for. The `reviewer-contract`
skill supplies the *conduct* — kill-mandate framing, quote-plus-consequence
findings, the `would-ship-bug | real-minor | nit` severity scale, clean context,
the mandatory dimensions-checked-clean list, and the undeliverable-vs-undecided
split. Load both. Where this skill and the reviewer contract appear to differ on
how a finding is reported, the reviewer contract wins.

**Binding document.** The authority on what the changes had to achieve is
`idea.md` — its `## Contracts & Acceptance` section for behavior and its
`## Decisions` for the choices the implementation must not contradict: numbered
`D{n}.` lines, or a table's rows in an `idea.md` written before the line form.
There is no separate spec document.

## Detection Categories

### Requirements Categories

**missing-requirements**: Requirements stated but not implemented
- Each explicit requirement has corresponding implementation
- Each acceptance criterion is satisfied
- All user stories/tasks are addressed
- No requirements were "forgotten" during implementation

**context-drift**: Implementation diverged from original intent
- Implementation matches what user actually asked for
- No assumptions that change the scope
- No "improvements" that weren't requested
- Terminology matches user's terminology

**partial-implementation**: Features only partially implemented
- Each feature is fully functional, not just scaffolded
- Edge cases mentioned in requirements are handled
- Error scenarios mentioned are implemented
- All stated behaviors are present
- No placeholder comments standing in for implementation (`// ...`, `// rest of code`)
- No functions that describe behavior in comments but lack actual logic
- No components that implement only the first case and comment "repeat for remaining"
- No files that end abruptly without completing all declared exports/functions

**scope-creep**: Implementation exceeds stated requirements
- No unrequested features added
- No "nice to have" additions without user consent
- Complexity matches requirement complexity

### Quality Categories

**almost-right-patterns**: Code that looks correct but has subtle logical flaws
- Off-by-one errors in loops and array access
- Incorrect boundary conditions
- Wrong comparison operators (< vs <=, == vs ===)
- Incorrect null/undefined handling
- Race conditions in async code
- Incorrect error propagation
- Swallowed exceptions: `catch` blocks that discard exception details (bare `catch`, `catch (Exception)` without logging, `catch (Exception ex)` that only uses `ex.Message` without logging the full exception). Every catch that doesn't re-throw MUST log the full exception object via the project's logging framework (e.g., `ILogger`, `console.error`, `logging.exception`) so stack traces reach observability tools (Application Insights, Sentry, etc.). Using only `ex.Message` in a return string is NOT sufficient — the stack trace and inner exceptions are lost.

**over-engineering**: Unnecessary complexity that should be simplified
- Abstractions without clear benefit
- Unnecessary wrapper classes/functions
- Premature optimization
- Over-generalized solutions for specific problems
- Unnecessary design patterns
- Configuration options that aren't needed

**convention-violations**: Code that doesn't follow project patterns or CLAUDE.md conventions
- File naming doesn't match project convention
- File location doesn't match project structure
- Code style doesn't match existing patterns
- Import patterns differ from project standard
- Error handling style inconsistent with project
- Build/test/lint commands don't match documented commands

**code-smells**: Patterns indicating potential problems
- Functions too long (>50 lines)
- Too many parameters (>5)
- Deep nesting (>3 levels)
- Duplicated code blocks
- Magic numbers/strings without constants
- Commented-out code (should be deleted)

### codebase-alignment
Code that creates parallel implementations of existing functionality.
New files, functions, or classes that duplicate what already exists in the codebase.
Backwards compatibility shims (old interface preserved alongside new) without
an approved decision in the plan's `## Decisions`.
Extension by copy-paste rather than by modifying the original.

### decision-conformance
Code that contradicts a decision recorded in `idea.md`'s `## Decisions`, a line or a legacy table row.
**When active:** whenever the dispatch supplies a binding document. Read that document's `## Decisions`: each `D{n}.` line, or each row of a legacy table, is one decision.

Checklist:
- Each decision's choice (the line's `X`, or a legacy row's Decision cell) is reflected in the implementation — code doesn't contradict the ruling
- Data models match decision specifications (types, field names, storage formats match what decisions describe)
- Architectural approach matches decisions (extend vs create, which file to modify, integration pattern)
- No implementation of a rejected alternative (code implements the approach a decision's `not Y` ruled against)

**Scope boundary:** Does NOT check structural completeness (completeness-verifier's job). Only checks: given that the code exists, does it match what the decisions said to build?

### Contract Artifact Categories

These three apply against `idea.md`'s `## Contracts & Acceptance` section — the
interface contracts between ownership units and the acceptance outcomes stated
there. Skip a category when the binding document states nothing of that kind,
and say so in `## Dimensions Checked` rather than omitting the line.

**contract-conformance**: Implementation violates an interface contract the binding document declares
- Every declared boundary (module seam, CLI/API shape, data format, file layout) matches what the code actually produces or consumes
- Where a contract states a precondition, the code rejects violating input rather than silently proceeding
- Where a contract states a resulting state, that state is reachable from every valid input path — trace the paths
- Anti-pattern: reading the contract and implementing only the happy path

**invariant-preservation**: A stated invariant has no enforcement in code
- Each invariant the binding document asserts has at least one enforcement point (runtime check, guard clause, or documented structural enforcement)
- For security-relevant invariants, verify absence-of-violation across all relevant call sites
- Anti-pattern: invariants that appear in comments or in the design document but have no executable enforcement

**acceptance-trace**: Code does not produce what an Acceptance Outcome states
- For each acceptance outcome expressed as a real-input observable behavior, the code produces the stated behavior for the stated input
- For each stated failure path, the code fails the stated way (right exit code, right error, right state) — not a different failure, not a silent success
- Anti-pattern: code satisfying the prose description of an outcome while producing a different observable result

## Out of Scope

- Exhaustive completeness pattern grep (use completeness-verifier agent). This skill flags truncation patterns noticed during quality read as a secondary signal.
- Test quality (use /verify-tests)
- Security analysis (use /verify-security)

## Workflow

### Step 1: Gather Context

Project conventions come from the instruction files (CLAUDE.md, .claude/CLAUDE.md,
.claude/rules/*.md, README.md) first, then from existing code near the changed files; documented
patterns are the authority. Requirements come from the binding document, read directly — never
a summary of it, and never the session transcript (reviewer contract, clause 4). Read every
changed file the dispatch names once; those reads serve both analyses below.

### Step 2: Requirements and Quality Analysis

**Done when:** every requirement, acceptance outcome and `## Decisions` line or row in the binding
document has been traced to its implementation, and every changed file has been checked against
each detection category above.

### Step 3: Unified Verdict

Label every finding `would-ship-bug`, `real-minor`, or `nit` per the reviewer
contract's severity scale, then set status: `FINDINGS` when at least one
`would-ship-bug` or `real-minor` fired, `APPROVED` otherwise — a verdict
carrying only nits is APPROVED, and nits are recorded rather than iterated on.

Write the `## Dimensions Checked` list either way. On an APPROVED verdict it is
the only evidence the review was performed; a clean verdict without it is a
rubber stamp.

Emit no grade, score, or percentage.

## Output Format

The literal headings and the MCP `role`/`status` values are owned by the
dispatching agent's `<verdict-body-structure>`. The mandatory content is owned by
the `reviewer-contract` skill: every finding carries a location, a verbatim quote,
a concrete consequence, and exactly one severity label; every verdict carries a
`## Dimensions Checked` list; anything the changes deliberately leave open goes
under `## Undecided` rather than being reported as a finding.

Traceability is reported per requirement (requirement → implementation location →
met / not-met / partial). Quality findings are grouped by detection category
(almost-right, over-engineering, convention-violations, code-smells,
codebase-alignment, decision-conformance, and the three contract-artifact
categories) with `file:line` citations.
