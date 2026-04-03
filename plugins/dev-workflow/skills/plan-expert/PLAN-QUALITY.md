# Plan Quality: Assessment and Improvement

## The 5 Quality Dimensions

Every plan can be evaluated across these 5 dimensions:

### 1. Completeness

Does the plan cover everything needed for successful implementation?

**Indicators of completeness:**
- All explicit requirements from the request are addressed
- Implicit requirements are identified (error handling, tests, documentation)
- Constraints are documented (compatibility, performance, security)
- Edge cases are acknowledged
- Verification strategy exists for every step

**Indicators of incompleteness:**
- Requirements from the request have no corresponding step
- No mention of testing or verification
- Error handling not addressed
- "etc.", "and so on", "as needed" appear in steps
- No risk assessment

### 2. Granularity

Are steps sized correctly for autonomous agent execution?

**Right-sized steps:**
- 5-10 minutes of implementation work
- Touch 1-2 files per step
- Have clear start and end conditions
- Can be verified independently

**Over-granular (too fine):**
- Steps take < 2 minutes each
- Create unnecessary dependencies between micro-steps
- Waste context on trivial actions
- Example: "Create file → Add import → Write function signature → Add parameters"

**Under-granular (too coarse):**
- Steps take > 15 minutes with no intermediate checkpoints
- Bundle unrelated changes together
- Can't verify partial progress
- Example: "Build the entire authentication system"

### 3. Executability

Can an agent execute each step without human interpretation?

**Executable steps have:**
- Specific file paths (not "the relevant files")
- Concrete actions (not "update as appropriate")
- Measurable acceptance criteria (not "looks good")
- Clear dependencies (not "after the previous work is done")
- Verification commands (not "make sure it works")

**Non-executable steps contain:**
- Vague verbs: "ensure", "consider", "properly handle"
- Ambiguous scope: "related files", "as needed", "etc."
- Subjective criteria: "clean code", "good performance", "appropriate tests"
- Missing specifics: no file paths, no function names, no test commands

### 4. Verifiability

Can each step's success be objectively confirmed?

**Verifiable criteria:**
- Test command with expected output: "Run `npm test -- auth` — all pass"
- Build check: "TypeScript compiles with `tsc --noEmit` — zero errors"
- Specific assertion: "File src/auth/middleware.ts exports `validateToken` function"
- Coverage threshold: "Coverage for src/auth/ >= 80%"

**Non-verifiable criteria:**
- "Code is well-structured"
- "Tests are comprehensive"
- "Performance is acceptable"
- "Error handling is robust"

### 5. Navigability

Can someone understand the plan's structure and find any detail quickly?

**Navigable plans have:**
- Clear objective (one sentence, < 25 words)
- Numbered steps with descriptive names
- Explicit dependencies between steps
- Single source of truth for status (README.md progress table)
- Flat-first structure — files by default, folders only when content demands it
- Max depth of 2 levels from plan root (root -> category -> file)

**Non-navigable plans have:**
- Wall of prose with no structure
- Steps buried in paragraphs
- Duplicated information in multiple places (e.g., status in README AND TODO AND step files)
- Excessive folder depth (folder-per-item when files suffice)
- Link-only index files that add navigation hops without content
- Empty scaffolding folders created "just in case"

---

## Quality Checklist (70 Items + 5 CDD Items + App-Type Items)

### Investigation Quality (10 items)

- [ ] Architecture documented (file structure, modules, entry points)
- [ ] Patterns discovered with 3+ examples from codebase
- [ ] Reference implementations identified with file:line citations
- [ ] Testing framework and patterns documented
- [ ] Build/CI constraints identified
- [ ] Historical context checked (git history, related PRs/issues)
- [ ] Naming conventions documented with examples
- [ ] Error handling patterns identified
- [ ] API contracts and schemas reviewed (if applicable)
- [ ] Known issues in affected area documented

### Requirements Quality (8 items)

- [ ] Core objective stated in single sentence (< 25 words)
- [ ] All explicit requirements from request have corresponding steps
- [ ] Implicit requirements identified (error handling, tests, docs, logging)
- [ ] Constraints documented (compatibility, performance, security)
- [ ] Completeness criteria defined (what "done" means, specifically)
- [ ] Out-of-scope items explicitly stated
- [ ] No "etc.", "and so on", or "as needed" in requirements
- [ ] Success metrics are quantitative, not qualitative

### Step Quality (18 items)

- [ ] Steps numbered sequentially (01, 02, ...) with descriptive names
- [ ] Each step takes 5-10 minutes of implementation work
- [ ] Each step lists specific files to create or modify (exact paths)
- [ ] Each step has measurable acceptance criteria (yes/no verifiable)
- [ ] Each step states dependencies on other steps
- [ ] Each step includes verification method (test command, build check, etc.)
- [ ] Steps don't bundle unrelated changes
- [ ] No vague language ("appropriate", "as needed", "properly")
- [ ] No step requires human judgment to complete
- [ ] Total steps are 8-15 for typical features (adjust for scope)
- [ ] First step addresses highest-risk or most uncertain area
- [ ] Steps follow logical implementation order (foundations first)
- [ ] Each step is atomic — completes all side effects (reference updates, cross-references, cleanup) within itself
- [ ] No catch-all "Update References" or "Clean Up" step at the end — each step owns its own consistency
- [ ] Each step that modifies code references specific file:line to extend
- [ ] Steps creating new files justify why existing files can't be extended
- [ ] No assumed backwards compatibility without approved decision in decision table
- [ ] Each step has 1-3 deliverables (countable outputs)

### DRY and Reuse Quality
- [ ] Investigation identified existing similar implementations before proposing new ones
- [ ] No parallel implementations without explicit justification in decision table
- [ ] Extension points cited with file:line for each modification step
- [ ] Backwards compatibility only proposed with user-approved decision
- [ ] Plan prefers extending existing patterns over creating new abstractions

### Reconciliation Quality (4 items)
- [ ] Design-producing steps have a reconciliation gate after them
- [ ] Reconciliation steps include spec-change check (if "what" changed, update spec)
- [ ] Sub-step numbering is consistent (NNa, NNb, not arbitrary)
- [ ] Superseded steps are marked clearly ("COMPLETED -> SUPERSEDED by NNa")

### Structure Quality (7 items)

- [ ] Plan uses flat-first structure (files by default, folders only when content demands it)
- [ ] Max depth is 2 levels from plan root (root -> category -> file)
- [ ] No link-only index files (every file has real content)
- [ ] No empty scaffolding (folders/files created only when they have content)
- [ ] Single source of truth for status (one location, not duplicated)
- [ ] Steps are files (steps/NN-name.md), not folders with README.md inside
- [ ] All actions and acceptance criteria use markdown checkboxes (`- [ ]`) so /update-todos can mark them programmatically

### Decision Quality (10 items)

- [ ] Decision table exists with columns: ID, Decision, Status, Date, Rationale, Supersedes
- [ ] Every non-obvious choice has a row in the decision table
- [ ] Each decision has a status (Proposed/Accepted/Superseded/Reverted)
- [ ] Each decision lists 2+ options considered (in detail section)
- [ ] Trade-offs stated for each option
- [ ] Chosen option has clear rationale (not "it seemed best")
- [ ] Affected files listed per decision
- [ ] Superseded decisions link to their replacement via Supersedes column
- [ ] Decisions are consistent with discovered patterns
- [ ] No decisions contradict project constraints

### CDD Quality — MANDATORY for UI Plans (5 items)

**These items are MANDATORY when UI_INVOLVED = true (set by the classification gate).** A UI plan that scores below 4/5 on CDD items is automatically capped at Grade C — regardless of how well other dimensions score. For non-UI plans, skip this section.

- [ ] Data model phases come before all story phases
- [ ] Story phases come before all backend phases (stories-first ordering)
- [ ] Story phases ordered by risk (complex user-facing first, admin/aggregation last)
- [ ] Each story phase has a review gate with checklist
- [ ] Schema lock point identified (after final story phase review)

### Web App Quality — MANDATORY for Web App Plans (10 items)

**These items are MANDATORY when APP_TYPE = web-app.** A web app plan scoring < 7/10 on these items is automatically capped at Grade C. For non-web-app plans, skip this section. Full details in protocols/web-app.md.

**Testing (5 items):**
- [ ] Unit tests included IN each implementation step (not deferred to a final step)
- [ ] Component tests cover rendering, interactions, and state variants (loading, error, empty)
- [ ] Integration tests verify end-to-end data flow for each feature
- [ ] E2e browser tests planned for critical user flows (using chrome-browser agent)
- [ ] Test verification commands specified per step (not just "run tests")

**Visual Verification (5 items):**
- [ ] Every new component has stories with all required variants (default, loading, error, empty)
- [ ] Stories include responsive variants (mobile 375px, tablet 768px, desktop 1280px)
- [ ] Story phase review gates include visual verification (screenshots at 3 breakpoints)
- [ ] Accessibility verified in stories (contrast, keyboard nav, ARIA, touch targets)
- [ ] Story tool setup included if project lacks one

### CLI Quality — MANDATORY for CLI Plans (8 items)

**These items are MANDATORY when APP_TYPE = cli.** A CLI plan scoring < 6/8 on these items is automatically capped at Grade C. For non-CLI plans, skip this section. Full details in protocols/cli.md.

- [ ] Exit codes defined and documented (0 = success, non-zero = specific error categories)
- [ ] Error messages go to stderr, normal output to stdout
- [ ] Help text included for every command and subcommand (--help flag)
- [ ] Machine-readable output format available (JSON/CSV) for scripting
- [ ] TTY detection: colors/formatting disabled when piped
- [ ] Unit tests cover argument parsing, core logic, and output formatting
- [ ] Integration tests verify full command execution with real arguments
- [ ] Piping tested: stdin input and stdout output work with Unix pipes

### Risk & Verification Quality (8 items)

- [ ] At least 2 risks identified per plan
- [ ] Each risk has a mitigation strategy
- [ ] Breaking change risks are flagged explicitly
- [ ] Verification strategy covers all steps
- [ ] Tests are part of the plan (not an afterthought)
- [ ] Integration points between steps have verification
- [ ] Rollback approach exists for high-risk changes
- [ ] Performance impact assessed for data-heavy changes

---

## Grading Rubric

### Grade Caps (Conditional Checklists)

**CDD Cap (UI Plans):** If UI_INVOLVED = true and CDD checklist scores < 4/5, the plan is capped at Grade C. A UI plan without proper CDD phasing has a structural flaw — backend-first ordering will cause late rework.

**Web App Cap:** If APP_TYPE = web-app and web app checklist scores < 7/10, the plan is capped at Grade C. A web app plan without proper testing strategy and visual verification will ship untested UI.

**CLI Cap:** If APP_TYPE = cli and CLI checklist scores < 6/8, the plan is capped at Grade C. A CLI plan without proper exit codes, output handling, and testing will produce a tool that can't be composed with other tools.

### Grade A: Agent-Ready

**All 5 dimensions strong. Plan can be handed to an agent for autonomous execution.**

- Investigation: thorough, evidence-based, with file:line references
- Requirements: complete, no gaps, quantitative success criteria
- Steps: right-sized, executable, verifiable, properly ordered
- Decisions: documented with options, rationale, and affected files
- Risks: identified with mitigations, verification covers all steps
- Checklist: 64+ items pass (91%+) from base checklist
- **UI plans**: CDD checklist 5/5 (all items pass)
- **Web app plans**: Web app checklist 9+/10
- **CLI plans**: CLI checklist 7+/8

### Grade B: Needs Polish

**Most dimensions solid but some gaps. Fixable without re-planning.**

- Investigation: done but may miss 1-2 areas
- Requirements: mostly complete, minor gaps in implicit requirements
- Steps: some vague language or missing file paths
- Decisions: major decisions documented, minor ones assumed
- Risks: identified but mitigations may be thin
- Checklist: 51-63 items pass (71-89%)

**Fix:** Address specific checklist failures. Usually takes 15-30 minutes.

### Grade C: Needs Rework

**Significant gaps. Plan needs substantial revision before execution.**

- Investigation: superficial or missing areas
- Requirements: gaps in coverage, vague criteria
- Steps: wrong granularity, missing dependencies, vague actions
- Decisions: undocumented or no alternatives considered
- Risks: not assessed
- Checklist: 37-50 items pass (52-70%)

**Fix:** Re-investigate affected areas, rewrite weak steps, add decisions and risks.

### Grade D: Start Over

**Fundamental issues. Plan doesn't reflect codebase reality.**

- Investigation: skipped or based on assumptions
- Requirements: incomplete or misunderstood
- Steps: not executable, wrong order, missing files
- Decisions: none documented
- Risks: none identified
- Checklist: < 37 items pass (< 52%)

**Fix:** Start from investigation phase. The plan's foundation is wrong.

---

## Quick Quality Scan (5-Minute Check)

Run this before detailed grading:

1. **Read the objective.** Is it one clear sentence? Can you explain it to someone?
2. **Scan step names.** Do they tell a story of the implementation?
3. **Check for vague words.** Search for: "appropriate", "as needed", "etc.", "properly", "ensure"
4. **Look at first step.** Does it specify exact files and acceptance criteria?
5. **Check last step.** Is there a verification/testing step?
6. **Check structure depth.** Is max depth 2? Are there unnecessary folder wrappers or link-only index files?

**If any of these fail**, the plan needs work before detailed grading.

---

## Plan Sizing Guide

| Scope | Steps | Investigation | Decisions | Risks |
|-------|-------|---------------|-----------|-------|
| Bug fix | 2-3 | Affected files only | 0-1 | 1 |
| Small feature | 5-8 | Architecture + patterns | 1-2 | 1-2 |
| Medium feature | 8-15 | All 6 investigation areas | 2-4 | 2-3 |
| Large feature | 15-25 | Comprehensive + historical | 3-6 | 3-5 |
| Architectural change | 10-15 | Deep dive all areas | 5-10 | 5+ |

**Warning signs of wrong sizing:**
- Bug fix with 10 steps → scope creep, re-examine
- Large feature with 3 steps → under-decomposed, too coarse
- 0 decisions for any feature → decisions are being made implicitly (dangerous)
- 0 risks for any non-trivial change → risks are being ignored (dangerous)
