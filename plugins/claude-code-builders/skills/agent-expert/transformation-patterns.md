# Agent-Optimization Transformation Patterns

## Overview

This file provides quick-reference transformation patterns showing before/after examples of common instruction optimizations.

**When to use this file:** When actively transforming instructions and need concrete before/after patterns to follow.

---

## Pattern 1: Vague → Specific

**Problem:** Vague directives that agents can't execute

### Example 1.1: Code Quality

❌ **Before (Vague):**
```markdown
Ensure code quality before committing.
```

✅ **After (Specific):**
```markdown
Verify code quality before committing:
- [ ] Run linter: npm run lint (must pass with 0 warnings)
- [ ] Compile TypeScript: tsc --noEmit (must succeed)
- [ ] Run tests: npm test (all must pass)
- [ ] Check coverage: npm test -- --coverage (≥80%)
- [ ] Verify all public functions have JSDoc comments
```

**Principles:** #7 (Executable), #9 (No Ambiguity), #13 (Imperative)

### Example 1.2: Testing

❌ **Before (Vague):**
```markdown
Add appropriate tests.
```

✅ **After (Specific):**
```markdown
Create test file with:
- Test for each public method
- Tests for edge cases (null, empty, invalid inputs)
- Tests for error conditions
- Achieve coverage ≥80%
- All tests must pass (run: npm test)

Location: [per investigation, e.g., __tests__/ComponentName.test.tsx]
Framework: [per investigation, e.g., Jest with React Testing Library]
```

**Principles:** #7 (Executable), #9 (No Ambiguity), #10 (Acceptance Criteria)

### Example 1.3: Documentation

❌ **Before (Vague):**
```markdown
Document the changes.
```

✅ **After (Specific):**
```markdown
Update documentation:
- Add JSDoc to all exported functions:
  - Purpose (1-2 sentences)
  - All parameters (name, type, description)
  - Return value (type, description)
  - 1-2 usage examples
- Update README.md if public API changed:
  - Add new sections for new features
  - Update existing sections if behavior changed
- Add entry to CHANGELOG.md under [Unreleased] section:
  - Format: [type]: [description]
  - Types: Added, Changed, Fixed, Removed
```

**Principles:** #7 (Executable), #9 (No Ambiguity), #2 (Format Specification)

---

## Pattern 2: Ambiguous → Quantified

**Problem:** Subjective terms that can be interpreted differently

### Example 2.1: Quality Thresholds

❌ **Before (Ambiguous):**
```markdown
Good test coverage
Sufficient documentation
Fast enough performance
```

✅ **After (Quantified):**
```markdown
Test coverage ≥80% for lines, branches, and functions

Documentation with:
- Purpose (1-2 sentences)
- All parameters documented (name, type, description)
- Return value documented
- 1-2 usage examples

Performance targets:
- Response time <200ms (95th percentile)
- Initial load <1s
- Time to interactive <3s
- Lighthouse Performance Score ≥90
```

**Principles:** #9 (No Ambiguity), #11 (Quantitative Thresholds)

### Example 2.2: Size and Scope

❌ **Before (Ambiguous):**
```markdown
Keep components small
Add several examples
```

✅ **After (Quantified):**
```markdown
Keep components <200 lines
- If larger, split into sub-components
- Extract reusable logic to hooks
- Separate concerns (presentation vs. logic)

Add 3-5 distinct examples:
- 1 simple example (basic usage)
- 2-3 moderate examples (common scenarios)
- 1 complex example (edge case or advanced usage)
```

**Principles:** #9 (No Ambiguity), #11 (Quantitative Thresholds)

---

## Pattern 3: Suggestive → Imperative

**Problem:** Suggestions are ambiguous about whether action is required

### Example 3.1: Passive/Suggestive → Active Commands

❌ **Before (Suggestive):**
```markdown
You might want to consider adding tests
It would be good to document the API
Consider following project conventions
Tests should be run before committing
```

✅ **After (Imperative):**
```markdown
Add tests for all public functions
Document the API with JSDoc comments
Follow project conventions (from investigation)
Run tests before committing
```

**Principles:** #13 (Imperative Voice)

### Example 3.2: Questions → Commands

❌ **Before (Questions):**
```markdown
Have you added tests?
Did you check the linter?
Can you document this function?
```

✅ **After (Commands):**
```markdown
Add tests for each public method
Run linter and verify it passes (npm run lint)
Document this function with JSDoc
```

**Principles:** #13 (Imperative Voice), #7 (Executable)

---

## Pattern 4: Implicit → Explicit Dependencies

**Problem:** Step order and dependencies are not stated

### Example 4.1: Simple Sequential Steps

❌ **Before (Implicit):**
```markdown
1. Create component
2. Add tests
3. Update documentation
```

✅ **After (Explicit):**
```xml
<workflow type="sequential">
  <step id="1-create" order="first">
    <description>Create component</description>
    <blocks>
      <step-id>2-test</step-id>
      <step-id>3-document</step-id>
    </blocks>
  </step>

  <step id="2-test" order="second">
    <description>Add tests</description>
    <dependencies>
      <requires>Step 1 (create) must complete</requires>
      <prerequisite>Component file exists and compiles</prerequisite>
    </dependencies>
    <blocks>
      <step-id>3-document</step-id>
    </blocks>
  </step>

  <step id="3-document" order="third">
    <description>Update documentation</description>
    <dependencies>
      <requires>Steps 1 and 2 completed</requires>
      <prerequisite>Component works and tests pass</prerequisite>
    </dependencies>
  </step>
</workflow>
```

**Principles:** #8 (Dependencies), #21 (Execution Order)

---

## Pattern 5: Prose → Structured XML

**Problem:** Prose is hard for agents to parse and execute reliably

### Example 5.1: Multi-Step Workflow

❌ **Before (Prose):**
```markdown
First, investigate the project to find existing patterns. Look at how other components
are organized, what naming conventions are used, and where tests are located. Then,
create a new component following those patterns. Make sure to include TypeScript
types if the project uses TypeScript. After that, add tests for the component.
The tests should cover the main functionality and edge cases. Finally, verify
everything works by running the linter and tests.
```

✅ **After (Structured XML):**
```xml
<workflow type="sequential">
  <step id="1-investigate" order="first">
    <description>Investigate project patterns</description>
    <actions>
      <action>Find existing components (search for files matching **/*Component*.tsx)</action>
      <action>Examine 3+ components for file organization</action>
      <action>Identify naming convention (PascalCase, camelCase, etc.)</action>
      <action>Identify test location and naming patterns</action>
      <action>Check for TypeScript usage (tsconfig.json exists?)</action>
    </actions>
    <acceptance-criteria>
      <criterion>Patterns documented with 3+ examples each</criterion>
      <criterion>File location pattern identified</criterion>
      <criterion>Naming convention identified</criterion>
      <criterion>Test patterns identified</criterion>
      <criterion>TypeScript usage determined</criterion>
    </acceptance-criteria>
    <blocks>
      <step-id>2-create</step-id>
    </blocks>
  </step>

  <step id="2-create" order="second">
    <description>Create component following patterns</description>
    <dependencies>
      <requires>Step 1 completed</requires>
      <prerequisite>Investigation report complete</prerequisite>
    </dependencies>
    <actions>
      <action>Create component at [location from investigation]</action>
      <action>Use [naming pattern from investigation]</action>
      <action condition="if TypeScript">Define props interface</action>
      <action>Implement component functionality</action>
    </actions>
    <acceptance-criteria>
      <criterion>File exists at correct location</criterion>
      <criterion>Naming follows pattern</criterion>
      <criterion>Linter passes (npm run lint)</criterion>
      <criterion condition="TypeScript">TypeScript compiles (tsc --noEmit)</criterion>
    </acceptance-criteria>
    <blocks>
      <step-id>3-test</step-id>
    </blocks>
  </step>

  <step id="3-test" order="third">
    <description>Add tests</description>
    <dependencies>
      <requires>Step 2 completed</requires>
      <prerequisite>Component exists and compiles</prerequisite>
    </dependencies>
    <actions>
      <action>Create test file at [location from investigation]</action>
      <action>Test main functionality</action>
      <action>Test edge cases (null, empty, invalid)</action>
    </actions>
    <acceptance-criteria>
      <criterion>Tests pass (npm test)</criterion>
      <criterion>Coverage ≥80%</criterion>
    </acceptance-criteria>
    <blocks>
      <step-id>4-verify</step-id>
    </blocks>
  </step>

  <step id="4-verify" order="fourth">
    <description>Verify quality</description>
    <dependencies>
      <requires>Steps 1, 2, 3 completed</requires>
    </dependencies>
    <validation>
      <command>npm run lint (must pass)</command>
      <command>npm test (all pass)</command>
      <command>npm test -- --coverage (≥80%)</command>
    </validation>
  </step>
</workflow>
```

**Principles:** #1 (XML Structure), #7 (Executable), #8 (Dependencies), #10 (Acceptance Criteria), #21 (Execution Order)

---

## Pattern 6: No Examples → Positive + Negative Examples

**Problem:** Agents learn from pattern matching; single examples don't show boundaries

### Example 6.1: Teaching a Pattern

❌ **Before (No Examples):**
```markdown
Write a good skill description.
```

✅ **After (Positive + Negative):**
```xml
<examples category="skill-descriptions">
  <positive>
    <example>
      Creates React components with TypeScript, props typing, and hooks.
      Use when building UI components, refactoring class components, or
      scaffolding component structures.
    </example>
    <why-good>
      - WHAT: Specific capabilities (React, TypeScript, props, hooks)
      - WHEN: 3 trigger scenarios (building, refactoring, scaffolding)
      - Keywords: Rich (React, TypeScript, components, props, hooks, UI)
    </why-good>
  </positive>

  <negative>
    <example>Helps with React</example>
    <why-bad>
      - WHAT: Vague ("helps with" - helps how?)
      - WHEN: Missing entirely
      - Keywords: Only "React" (too sparse)
    </why-bad>
  </negative>
</examples>
```

**Principles:** #14 (Positive + Negative Examples), #6 (Separate Instructions/Examples)

---

## Pattern 7: No Acceptance Criteria → Measurable Criteria

**Problem:** Without validation criteria, agents can't verify task completion

### Example 7.1: Adding Validation

❌ **Before (No Criteria):**
```markdown
Create a new component.
```

✅ **After (With Criteria):**
```xml
<task name="create-component">
  <actions>
    <action>Create component file at [location]</action>
    <action>Add TypeScript interface for props</action>
    <action>Implement component</action>
    <action>Export component</action>
  </actions>

  <acceptance-criteria>
    <criterion priority="critical">Component file exists at [path]</criterion>
    <criterion priority="critical">Props interface defined</criterion>
    <criterion priority="critical">Component exported correctly</criterion>
    <criterion priority="high">Linter passes (npm run lint)</criterion>
    <criterion priority="high">TypeScript compiles (tsc --noEmit)</criterion>
    <criterion priority="medium">Component has JSDoc</criterion>
  </acceptance-criteria>

  <validation>
    <command>npm run lint (expect 0 warnings)</command>
    <command>tsc --noEmit (expect success)</command>
    <manual-check>File exists at expected path</manual-check>
  </validation>
</task>
```

**Principles:** #10 (Acceptance Criteria), #7 (Executable), #11 (Quantitative Thresholds)

---

## Pattern 8: Undefined Terms → Explicit Definitions

**Problem:** Terms like "follow conventions" are meaningless without defining what the conventions are

### Example 8.1: Conventions

❌ **Before (Undefined):**
```markdown
Follow project conventions when creating files.
```

✅ **After (Explicit):**
```markdown
Follow these project conventions (from investigation):
- File naming: [specific pattern, e.g., PascalCase.tsx]
- File location: [specific path, e.g., src/components/]
- Code style:
  - Indentation: [e.g., 2 spaces]
  - Quotes: [e.g., single quotes]
  - Semicolons: [e.g., required]
  - Max line length: [e.g., 100 characters]
- Export style: [e.g., named exports vs default]
```

**Principles:** #9 (No Ambiguity), #7 (Executable)

---

## Pattern 9: No Output Format → Explicit Template

**Problem:** Agents don't know what structure to produce for reports/analysis

### Example 9.1: Investigation Report

❌ **Before (No Format):**
```markdown
Document your findings.
```

✅ **After (With Template):**
```markdown
Document findings using this format:

**Output Format (Required):**

```markdown
# Investigation Report: [Component Name]

## File Organization
- Pattern: [describe pattern, e.g., src/components/]
- Examples:
  - [path 1]
  - [path 2]
  - [path 3]

## Naming Convention
- Pattern: [describe pattern, e.g., PascalCase.tsx]
- Examples:
  - [name 1]
  - [name 2]

## Test Patterns
- Location: [e.g., __tests__/ or *.test.tsx]
- Naming: [e.g., ComponentName.test.tsx]
- Framework: [e.g., Jest with React Testing Library]

## TypeScript
- Uses TypeScript: [yes/no]
- Props pattern: [e.g., interface ComponentNameProps { ... }]

## Code Style
- Indentation: [e.g., 2 spaces]
- Quotes: [e.g., single]
- Semicolons: [e.g., yes]
```
```

**Principles:** #2 (Format Specification), #7 (Executable)

---

## Pattern 10: No Role → Explicit Role

**Problem:** Agent doesn't know its identity, expertise level, or boundaries

### Example 10.1: Adding Role

❌ **Before (No Role):**
```markdown
Create a component and add tests.
```

✅ **After (With Role):**
```xml
<task name="create-component-with-tests">
  <role>
    <identity>Expert React component creator</identity>

    <purpose>
      Create production-quality React components with TypeScript,
      comprehensive testing, and documentation
    </purpose>

    <expertise>
      <area>React functional components and hooks</area>
      <area>TypeScript type safety</area>
      <area>Component testing with React Testing Library</area>
      <area>JSDoc documentation</area>
    </expertise>

    <scope>
      <in-scope>
        <item>Creating functional components</item>
        <item>Adding TypeScript types</item>
        <item>Writing component tests</item>
        <item>Adding JSDoc</item>
      </in-scope>

      <out-of-scope>
        <item>State management (Redux, Zustand)</item>
        <item>Backend integration</item>
        <item>Build configuration</item>
      </out-of-scope>
    </scope>
  </role>

  [... rest of task ...]
</task>
```

**Principles:** #23 (Role Definition), #24 (Contextual Grounding)

---

## Quick Reference Table

| From (Human) | To (Agent) | Principles |
|--------------|------------|------------|
| "Ensure code quality" | "Run: npm run lint, tsc --noEmit, npm test. All must pass." | #7, #9, #13 |
| "Good test coverage" | "Test coverage ≥80%" | #9, #11 |
| "Add appropriate tests" | "Test each public method, edge cases, errors. Coverage ≥80%." | #7, #9 |
| "Consider adding..." | "Add..." | #13 |
| "Follow conventions" | "Follow: PascalCase.tsx in src/components/ [from investigation]" | #9, #7 |
| Single example | Positive + negative examples with explanations | #14 |
| "Step 1, Step 2" | `<step id="1"><blocks>2</blocks></step>` with dependencies | #8, #21 |
| Prose paragraph | XML structure with `<workflow>`, `<step>`, `<actions>` | #1 |
| No validation | `<acceptance-criteria>` with measurable criteria | #10 |
| "Document findings" | Provide template showing exact expected structure | #2 |

---

## Pattern: Session Context → Crafted Dispatch

**Problem:** Controller passes raw session context or vague instructions to subagent
**When:** Dispatching worker agents for implementation, review, or verification

### Example: Code Review Dispatch

❌ **Before (Raw Context):**
```markdown
Review the recent code changes.
```

✅ **After (Crafted Dispatch):**
```markdown
You are a code quality reviewer.

## What Changed
Files modified: src/auth/middleware.ts, src/types/auth.ts
Change summary: Added OAuth2 token validation and refresh token rotation.

## Requirements
- Add OAuth2 token validation in validateRequest()
- Add refresh token rotation in refreshTokens()
- Update AuthConfig interface

## Your Job
Read the changed files and verify:
1. Each requirement has corresponding implementation
2. No over-engineering or unnecessary abstractions
3. Code follows project conventions (2-space indent, single quotes)
4. No truncation patterns (placeholder comments, skeleton functions)

## Report Format
- Status: APPROVED or ISSUES_FOUND
- Findings with file:line references
- Recommendations: critical → high → medium
```

**Principles:** #7 (Executable), #23 (Role), #20 (Tool Specs), Context Crafting (subagent-patterns.md)

### Example: Model Selection

❌ **Before (Default to Most Capable):**
```yaml
model: opus  # For a TODO/stub grep scan
```

✅ **After (Right-Sized):**
```yaml
model: haiku  # Mechanical pattern grep — cheapest model works
```

**Principle:** Model Selection (subagent-patterns.md)

---

## Additional Resources

**For complete workflow:** See SKILL.md - All content inline in "The 4-Phase Workflow" section (complete 4-phase transformation process)
**For principle details:** See SKILL.md - All content inline in "Core 4 Principles" and "Additional Principles" sections (all 25 principles explained)
**For validation:** Use Read tool on validation.md when need quality grading rubric
**For full examples:** Use Read tool on examples.md when need complete transformations
**For subagent patterns:** Use Read tool on subagent-patterns.md when dispatching agents or designing multi-agent workflows
