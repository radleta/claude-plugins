# Agent-Optimization Examples: Before & After Transformations

## Overview

This file provides complete before/after transformation examples across different complexity levels.

**When to use this file:** When you need concrete examples of transformations or want to see what "agent-optimized" looks like in practice.

---

## Example 1: Simple Instruction (Core 4 Only)

**Complexity:** Simple (1-2 steps, obvious validation)
**Principles Applied:** Core 4 (#7, #9, #13, #23)

### Before (Human)

```markdown
Make sure the code is good quality before committing.
```

### Issues Identified

- ❌ Vague: "make sure", "good quality" undefined
- ❌ Ambiguous: What does "quality" mean?
- ❌ Suggestive: "make sure" is passive
- ❌ No role defined
- ❌ No specific actions
- ❌ No measurable criteria

### After (Agent-Optimized)

```markdown
<role>
  <identity>Expert code quality verifier</identity>
  <purpose>Ensure code meets quality standards before committing</purpose>
  <expertise>
    <area>Linting and code style</area>
    <area>Type checking</area>
    <area>Test coverage analysis</area>
  </expertise>
</role>

Verify code quality before committing:

- [ ] Run linter: npm run lint
  - Expected: 0 errors, 0 warnings
  - If failures: Fix linting issues before proceeding

- [ ] Compile TypeScript: tsc --noEmit
  - Expected: Compilation succeeds with no errors
  - If failures: Fix type errors before proceeding

- [ ] Run all tests: npm test
  - Expected: All tests pass (green)
  - If failures: Fix failing tests before proceeding

- [ ] Check test coverage: npm test -- --coverage
  - Expected: Coverage ≥80% for lines, branches, and functions
  - If below: Add tests to reach threshold

- [ ] Verify all public functions have JSDoc comments
  - Expected: Every exported function has JSDoc with purpose, params, returns
  - If missing: Add JSDoc to undocumented functions
```

### Grade: A (Excellent)

**Why it works:**
- ✅ Every step executable with specific commands
- ✅ No ambiguity (quantified thresholds: ≥80%, 0 errors)
- ✅ Imperative voice ("Run", "Verify", "Check")
- ✅ Role defined with identity and purpose
- ✅ Measurable success criteria
- ✅ Clear actions for failures

---

## Example 2: Multi-Step Instruction

**Complexity:** Multi-Step (3-5 steps, some dependencies)
**Principles Applied:** Core 4 + #8, #10, #14

### Before (Human)

```markdown
Create a React component. Follow the project's conventions and add tests.
```

### Issues Identified

- ❌ Vague: "create component" - what exactly?
- ❌ Ambiguous: "follow conventions" - which conventions?
- ❌ Implicit dependencies: "add tests" depends on component existing
- ❌ No validation criteria
- ❌ No examples
- ❌ No role defined

### After (Agent-Optimized)

```xml
<role>
  <identity>Expert React component creator</identity>
  <purpose>Create production-quality React components with testing and documentation</purpose>
  <expertise>
    <area>React functional components and hooks</area>
    <area>TypeScript type safety</area>
    <area>Component testing with React Testing Library</area>
  </expertise>
  <scope>
    <in-scope>
      <item>Creating functional components</item>
      <item>Adding TypeScript types</item>
      <item>Writing component tests</item>
    </in-scope>
    <out-of-scope>
      <item>State management libraries (separate concern)</item>
      <item>Backend integration (separate concern)</item>
    </out-of-scope>
  </scope>
</role>

<workflow type="sequential">
  <step id="1-investigate" order="first">
    <description>Investigate project component patterns</description>

    <actions>
      <action>Find existing components (search for files matching **/*Component*.tsx OR **/*Component*.jsx)</action>
      <action>Examine 3+ components to identify patterns</action>
      <action>Document file organization (e.g., src/components/)</action>
      <action>Document naming convention (e.g., PascalCase.tsx)</action>
      <action>Identify test patterns (location, naming, framework)</action>
    </actions>

    <acceptance-criteria>
      <criterion priority="critical">Patterns documented with 3+ examples each</criterion>
      <criterion priority="critical">File location pattern identified</criterion>
      <criterion priority="critical">Naming convention identified</criterion>
      <criterion priority="high">Test patterns identified</criterion>
    </acceptance-criteria>

    <blocks>
      <step-id>2-create</step-id>
      <step-id>3-test</step-id>
      <reason>Cannot create component without knowing patterns</reason>
    </blocks>
  </step>

  <step id="2-create" order="second">
    <description>Create component following discovered patterns</description>

    <dependencies>
      <requires>Step 1 completed</requires>
      <prerequisite>Investigation report complete with all patterns documented</prerequisite>
    </dependencies>

    <actions>
      <action>Create component file at [location from investigation]</action>
      <action>Use [naming pattern from investigation]</action>
      <action>Define TypeScript props interface (if TS project)</action>
      <action>Implement component functionality</action>
      <action>Export component correctly</action>
    </actions>

    <acceptance-criteria>
      <criterion priority="critical">Component file exists at correct location</criterion>
      <criterion priority="critical">Naming follows discovered pattern</criterion>
      <criterion priority="high">Linter passes (npm run lint)</criterion>
      <criterion priority="high">TypeScript compiles (if TS: tsc --noEmit)</criterion>
    </acceptance-criteria>

    <blocks>
      <step-id>3-test</step-id>
      <reason>Cannot test what doesn't exist</reason>
    </blocks>
  </step>

  <step id="3-test" order="third">
    <description>Create tests for component</description>

    <dependencies>
      <requires>Step 2 completed</requires>
      <prerequisite>Component file exists and compiles</prerequisite>
    </dependencies>

    <actions>
      <action>Create test file at [location from investigation]</action>
      <action>Use [naming pattern from investigation]</action>
      <action>Test component renders without errors</action>
      <action>Test props handling</action>
      <action>Test edge cases (null, empty, invalid props)</action>
    </actions>

    <acceptance-criteria>
      <criterion priority="critical">Test file created at correct location</criterion>
      <criterion priority="critical">All tests pass (npm test)</criterion>
      <criterion priority="high">Coverage ≥80% (npm test -- --coverage)</criterion>
    </acceptance-criteria>
  </step>
</workflow>

<examples category="component-creation">
  <positive>
    <example>
      Created Button component:
      - Location: src/components/Button.tsx
      - Props interface: ButtonProps with variant, size, onClick
      - Tests: src/components/__tests__/Button.test.tsx
      - All tests pass, coverage 87%
    </example>
    <why-good>
      Follows all discovered patterns, comprehensive tests, exceeds coverage threshold
    </why-good>
  </positive>

  <negative>
    <example>
      Created component:
      - Location: components/button.js (wrong location, wrong casing)
      - No TypeScript (project uses TS)
      - No tests created
    </example>
    <why-bad>
      Didn't follow investigation findings, ignored TypeScript, skipped tests
    </why-bad>
  </negative>
</examples>
```

### Grade: A (Excellent)

**Why it works:**
- ✅ All Core 4 principles applied
- ✅ Dependencies explicit with `<blocks>` and `<requires>`
- ✅ Each step has measurable acceptance criteria
- ✅ Both positive and negative examples provided
- ✅ Investigation-first approach (discovers patterns)
- ✅ XML structure for complex multi-step workflow

---

## Example 3: Testing Instruction

**Complexity:** Simple → Multi-Step
**Principles Applied:** Core 4 + #10

### Before (Human)

```markdown
Add appropriate tests.
```

### After (Agent-Optimized)

```markdown
<role>
  <identity>Expert test engineer</identity>
  <purpose>Create comprehensive, maintainable test suites</purpose>
  <expertise>
    <area>Unit testing and integration testing</area>
    <area>Test coverage analysis</area>
    <area>Edge case identification</area>
  </expertise>
</role>

Create test file with comprehensive coverage:

**Location:** [Per investigation - e.g., __tests__/ComponentName.test.tsx or src/components/ComponentName.test.tsx]

**Naming:** [Per investigation - e.g., ComponentName.test.tsx]

**Test coverage requirements:**

1. **Test each public method/function**
   - One test per public method minimum
   - Verify correct output for valid inputs
   - Example: `test('calculateTotal sums all items correctly', ...)`

2. **Test edge cases**
   - Null inputs
   - Empty inputs (empty array, empty string, etc.)
   - Invalid inputs (wrong type, out of range, etc.)
   - Boundary values (min, max, zero, negative)
   - Example: `test('calculateTotal handles empty array', ...)`

3. **Test error conditions**
   - Expected errors throw correctly
   - Error messages are meaningful
   - Example: `test('validateUser throws error for invalid email', ...)`

4. **Test main workflow integration**
   - Components work together
   - Data flows correctly between modules
   - Example: `test('submit button calls onSubmit with form data', ...)`

**Acceptance Criteria:**

- [ ] Test file exists at [location from investigation]
- [ ] Test file naming follows [pattern from investigation]
- [ ] All public methods have at least one test
- [ ] Edge cases tested (null, empty, invalid)
- [ ] Error conditions tested
- [ ] All tests pass: npm test
- [ ] Coverage ≥80%: npm test -- --coverage
  - Lines ≥80%
  - Branches ≥80%
  - Functions ≥80%
```

### Grade: A (Excellent)

**Why it works:**
- ✅ Specific (no vague "appropriate")
- ✅ Quantified thresholds (≥80%)
- ✅ Executable checklist
- ✅ Examples for each category
- ✅ Measurable acceptance criteria
- ✅ Role defined

---

## Example 4: Documentation Instruction

**Complexity:** Simple
**Principles Applied:** Core 4 + #2, #10

### Before (Human)

```markdown
Document the changes.
```

### After (Agent-Optimized)

```markdown
<role>
  <identity>Expert technical documentation specialist</identity>
  <purpose>Create clear, comprehensive documentation for code changes</purpose>
  <expertise>
    <area>API documentation (JSDoc, TSDoc)</area>
    <area>Changelog management</area>
    <area>README and usage guides</area>
  </expertise>
</role>

Update documentation for all changes:

**1. Add JSDoc to all exported functions:**

Format:
```typescript
/**
 * [Purpose - 1-2 sentences describing what function does]
 *
 * @param [paramName] - [Description of parameter]
 * @param [paramName2] - [Description of parameter]
 * @returns [Description of return value and type]
 *
 * @example
 * // [Usage example showing realistic use]
 * [code example]
 */
```

Example:
```typescript
/**
 * Calculates the total price of all items in the cart including tax.
 *
 * @param items - Array of cart items with price and quantity
 * @param taxRate - Tax rate as decimal (e.g., 0.08 for 8%)
 * @returns Total price including tax, rounded to 2 decimal places
 *
 * @example
 * // Calculate total for shopping cart
 * const total = calculateTotal(cartItems, 0.08);
 */
```

**2. Update README.md (if public API changed):**

Add or update sections:
- **New features:** Add section describing new functionality with usage example
- **Changed behavior:** Update existing sections with new behavior
- **Breaking changes:** Add warning banner and migration guide

**3. Add entry to CHANGELOG.md:**

Location: Under `[Unreleased]` section at top of file

Format: `[type]: [description]`

Types:
- `Added`: New features
- `Changed`: Changes in existing functionality
- `Deprecated`: Soon-to-be removed features
- `Removed`: Removed features
- `Fixed`: Bug fixes
- `Security`: Security fixes

Example:
```markdown
## [Unreleased]

### Added
- calculateTotal function for cart total with tax calculation

### Fixed
- Edge case where empty cart caused division by zero
```

**Acceptance Criteria:**

- [ ] All exported functions have JSDoc comments
- [ ] JSDoc includes: purpose, all params, return value, 1 example
- [ ] README.md updated if public API changed
- [ ] CHANGELOG.md has entry under [Unreleased]
- [ ] CHANGELOG entry uses correct type (Added/Changed/Fixed/etc.)
- [ ] No spelling errors in documentation
```

### Grade: A (Excellent)

**Why it works:**
- ✅ Specific format templates provided
- ✅ Examples for each documentation type
- ✅ Measurable checklist
- ✅ No ambiguity about what to document

---

## Example 5: Investigation Instruction

**Complexity:** Multi-Step (investigation-driven)
**Principles Applied:** Core 4 + #2, #10, #19

### Before (Human)

```markdown
Look at the codebase and figure out how to structure the new feature.
```

### After (Agent-Optimized)

```xml
<role>
  <identity>Expert codebase investigator</identity>
  <purpose>Discover patterns and conventions through systematic exploration</purpose>
  <expertise>
    <area>Pattern recognition in codebases</area>
    <area>Architecture analysis</area>
    <area>Convention discovery</area>
  </expertise>
</role>

<investigation-protocol type="iterative">
  <objective>
    Discover existing patterns for [feature type] to ensure new feature follows project conventions
  </objective>

  <phase name="discover">
    <thought>What patterns exist for similar features?</thought>

    <actions>
      <action>Find similar existing features (search for files matching **/*[SimilarFeature]*.ts)</action>
      <action>Examine 3-5 examples of similar features</action>
      <action>Document file organization patterns</action>
      <action>Document naming conventions</action>
      <action>Document code structure patterns</action>
    </actions>

    <observation>Record findings with specific examples</observation>

    <decision>
      If clear patterns found (3+ consistent examples) → Proceed to synthesis
      If inconsistent patterns found (conflicting approaches) → Ask user for preferred approach
      If no patterns found (new feature type) → Ask user for architectural guidance
    </decision>
  </phase>

  <phase name="synthesize">
    <thought>How should I apply these patterns?</thought>

    <actions>
      <action>Create investigation report using format below</action>
      <action>Identify commonalities across examples</action>
      <action>Note any variations or special cases</action>
    </actions>

    <observation>Patterns documented and ready to apply</observation>
  </phase>

  <output-format>
    **Format (Required):**

    ```markdown
    # Investigation Report: [Feature Name]

    ## File Organization
    - Pattern: [describe pattern, e.g., src/features/[feature-name]/]
    - Examples:
      - [example 1 path]
      - [example 2 path]
      - [example 3 path]

    ## Naming Conventions
    - Files: [pattern, e.g., [FeatureName]Service.ts, [FeatureName]Controller.ts]
    - Classes: [pattern, e.g., PascalCase]
    - Functions: [pattern, e.g., camelCase]
    - Examples:
      - [example 1]
      - [example 2]

    ## Code Structure
    - Architecture: [pattern, e.g., layered (controller → service → repository)]
    - Dependencies: [pattern, e.g., dependency injection via constructor]
    - Error handling: [pattern, e.g., try/catch with custom error types]
    - Examples:
      [code snippet showing pattern]

    ## Key Findings
    1. [Finding 1 with evidence]
    2. [Finding 2 with evidence]
    3. [Finding 3 with evidence]

    ## Recommendations
    - [Recommendation 1]: [Rationale]
    - [Recommendation 2]: [Rationale]
    ```
  </output-format>

  <acceptance-criteria>
    <criterion priority="critical">Investigation report completed using required format</criterion>
    <criterion priority="critical">File organization pattern identified with 3+ examples</criterion>
    <criterion priority="critical">Naming conventions identified with examples</criterion>
    <criterion priority="high">Code structure patterns identified</criterion>
    <criterion priority="high">Recommendations provided with rationale</criterion>
  </acceptance-criteria>
</investigation-protocol>
```

### Grade: A (Excellent)

**Why it works:**
- ✅ Iterative Think → Act → Observe → Decide framework
- ✅ Explicit output format template
- ✅ Decision points with clear conditions
- ✅ Handles edge cases (no patterns found, inconsistent patterns)
- ✅ Measurable acceptance criteria

---

## Summary: What Makes These Work

### Common Success Factors

1. **Explicit Everything**
   - No vague terms
   - All thresholds quantified
   - Commands are specific

2. **Measurable Validation**
   - Acceptance criteria for every step
   - Specific commands to run
   - Clear pass/fail determination

3. **Examples Included**
   - Both positive and negative (when applicable)
   - Real-world scenarios
   - Explanations of why they work/fail

4. **Role Defined**
   - Identity, purpose, expertise stated
   - Scope clarified (in/out)

5. **Dependencies Explicit**
   - Step order clear
   - Prerequisites stated
   - Blocking relationships identified

---

## Additional Examples

**For more comprehensive examples:** See @docs/agent-optimized/examples.md

Contains:
- Complete React component creation (3-phase workflow)
- Code review protocol (7 categories)
- Database migration (4-phase with rollback)

---

## Quick Reference

| Before | After | Principles |
|--------|-------|------------|
| "Ensure quality" | "Run lint, tests, coverage ≥80%" | #7, #9 |
| "Add appropriate tests" | "Test methods, edges, errors. Coverage ≥80%" | #7, #9, #10 |
| "Document changes" | [Template with JSDoc format, README, CHANGELOG] | #2, #7, #10 |
| "Look at codebase" | [Investigation protocol with output format] | #2, #7, #10, #19 |

All examples demonstrate: Core 4 always applied + additional principles based on complexity

---

## Example 8: Subagent Dispatch (Multi-Step + Subagent Patterns)

**Complexity:** Multi-Step with subagent dispatch
**Principles Applied:** Core 4 + #8 (Dependencies), #20 (Tool Specs), Context Crafting, Model Selection, Status Handling

### Before (Human)

```markdown
After implementing, have an agent review the code and check security.
```

### Issues Identified

- No context for the reviewer (which files? what requirements?)
- No model selection (using default for everything)
- No status handling (what if reviewer finds issues?)
- No review ordering (quality and security in undefined order)
- Vague: "review the code" — for what? quality? requirements? completeness?

### After (Agent-Optimized)

```xml
<verification-pipeline>
  <step id="4" order="fourth">
    <description>Code quality + requirements review</description>
    <invocation>
      Launch code-verifier agent (model: sonnet):
      - Pass: files changed, change summary, plan path, requirements
      - Expected: APPROVED or ISSUES_FOUND with file:line findings
    </invocation>
    <on-issues>Fix issues, re-dispatch review (automatic loop, max 3 cycles)</on-issues>
  </step>

  <step id="5" order="fifth" depends-on="4">
    <description>Security review (AFTER quality approved)</description>
    <invocation>
      Launch security-verifier agent (model: sonnet):
      - Pass: files changed, entry points, security-relevant details
      - Expected: APPROVED or ISSUES_FOUND with severity ratings
    </invocation>
    <on-issues>Fix issues, re-dispatch security review</on-issues>
  </step>
</verification-pipeline>
```

### Why This Is Better

- Context crafted per agent (reviewer gets files + requirements, not session history)
- Model selected per task (sonnet for judgment-heavy review)
- Status handling defined (APPROVED → proceed, ISSUES_FOUND → fix loop)
- Review ordering explicit (quality before security — don't waste security review on code that will change)
- Dependencies stated (step 5 depends on step 4 passing)

**Grade:** A (Executable, unambiguous, role-defined, context-crafted, model-selected)
