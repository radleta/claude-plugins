# The 4-Phase Agent-Optimization Workflow

## Overview

This file provides the complete, detailed workflow for transforming any human-oriented instruction into agent-optimized format.

**When to use this file:** When actively transforming instructions and need step-by-step guidance through the full optimization process.

---

## Workflow at a Glance

```
1. INVESTIGATE 🔍
   ↓
   Analyze instruction, identify complexity, list issues
   ↓
2. APPLY PRINCIPLES 🎯
   ↓
   Select principles based on complexity level
   ↓
3. TRANSFORM ✨
   ↓
   Convert human format → agent-optimized format
   ↓
4. VALIDATE ✅
   ↓
   Check quality, grade result, iterate if needed
```

---

## Phase 1: INVESTIGATE 🔍

**Objective:** Understand the current instruction and determine the appropriate optimization approach

### Actions

1. **Read the instruction carefully**
   - What is the instruction trying to achieve?
   - Who is the intended executor (agent type/role)?
   - What is the expected outcome?

2. **Identify complexity level**

   Use this decision tree:

   ```
   Is it a single action with obvious validation?
   ├─ Yes → **Simple** (1-2 steps)
   └─ No → Does it have 3-5 steps with some dependencies?
       ├─ Yes → **Multi-Step**
       └─ No → Does it have 6+ steps, complex dependencies, tool usage?
           ├─ Yes → **Complex**
           └─ No → Is it mission-critical (cannot fail)?
               └─ Yes → **Mission-Critical**
   ```

   **Complexity Definitions:**

   - **Simple:** 1-2 steps, obvious validation, no dependencies
     - Example: "Run tests before committing"
     - Apply: Core 4 principles only

   - **Multi-Step:** 3-5 steps, some dependencies, multiple validation points
     - Example: "Create component and add tests"
     - Apply: Core 4 + #8 (dependencies), #10 (acceptance criteria), #14 (examples)

   - **Complex:** 6+ steps, many dependencies, tool usage, investigation required
     - Example: "Implement new feature following project patterns"
     - Apply: Core 4 + #1 (XML), #2 (formats), #8, #10, #14, #19 (iterative), #20 (tools)

   - **Mission-Critical:** Cannot fail, production systems, security-critical
     - Example: "Implement authentication microservice"
     - Apply: All 25 principles comprehensively

3. **List current issues**

   Use this checklist to identify problems:

   **Vague Terms:**
   - [ ] Contains subjective quality terms? ("good", "bad", "clean", "appropriate")
   - [ ] Contains vague quantities? ("sufficient", "enough", "many", "several")
   - [ ] Contains undefined terms? ("follow conventions", "use best practices")

   **Ambiguous Validation:**
   - [ ] Validation criteria unclear? ("ensure quality")
   - [ ] Success criteria subjective? ("looks good")
   - [ ] No measurable thresholds? (no numbers, percentages, counts)

   **Missing Dependencies:**
   - [ ] Step order implicit? ("Do A, Do B" without stating B requires A)
   - [ ] Prerequisites unstated? (assumes things exist without verifying)
   - [ ] Blocking relationships unclear? (doesn't specify what must complete first)

   **Missing Examples:**
   - [ ] No examples provided?
   - [ ] Only positive examples? (no negative/anti-pattern examples)
   - [ ] Examples not representative? (too simple, doesn't cover edge cases)

   **Subjective Criteria:**
   - [ ] Acceptance criteria are feelings? ("should be fast", "must be clean")
   - [ ] No quantitative thresholds? (no specific numbers)
   - [ ] Cannot be verified objectively? (requires judgment vs. measurement)

   **Passive/Suggestive Language:**
   - [ ] Uses suggestions? ("consider", "you might want to")
   - [ ] Uses passive voice? ("tests should be run" vs "run tests")
   - [ ] Uses questions? ("have you checked?" vs "check")

4. **Determine principle level to apply**

   Based on complexity identified in step 2:

   - **Simple** → Core 4 only (#7, #9, #13, #23)
   - **Multi-Step** → Core 4 + #8, #10, #14
   - **Complex** → Core 4 + #1, #2, #8, #10, #14, #19, #20, #21
   - **Mission-Critical** → All 25 principles

### Output from Phase 1

Create analysis document:

```markdown
## Investigation Report: [Instruction Name]

### Complexity Level
[Simple / Multi-Step / Complex / Mission-Critical]

### Current Issues Identified
1. [Issue 1: e.g., Vague validation - "ensure quality" undefined]
2. [Issue 2: e.g., Implicit dependencies - step order not explicit]
3. [Issue 3: e.g., Subjective criteria - "good coverage" not quantified]
[... list all issues found]

### Principles to Apply
- Core 4: #7, #9, #13, #23 (ALWAYS)
- Additional: [list specific principles based on complexity]

### Optimization Strategy
[Brief description of transformation approach]
- [Strategy point 1]
- [Strategy point 2]
```

---

## Phase 2: APPLY PRINCIPLES 🎯

**Objective:** Select and prepare to apply appropriate principles based on complexity

### Actions

1. **Apply Core 4 ALWAYS**

   No matter the complexity, these 4 are non-negotiable:

   - **#7 Make Every Step Executable:** Replace vague directives with specific, measurable actions
   - **#9 Avoid Ambiguity:** Quantify everything, define unclear terms
   - **#13 Use Imperative Voice:** Direct commands, not suggestions
   - **#23 Explicit Role Definition:** Define identity, purpose, expertise, scope

2. **Add principles for multi-step workflows**

   If complexity is Multi-Step or higher, add:

   - **#8 State Dependencies Explicitly:** Use `<dependencies>`, `<requires>`, `<blocks>`
   - **#10 Comprehensive Acceptance Criteria:** Add measurable validation for each step
   - **#14 Positive + Negative Examples:** Show both what to do and what not to do

3. **Add principles for complex workflows**

   If complexity is Complex or Mission-Critical, add:

   - **#1 Use Structured Formats:** Use XML for steps, workflow, dependencies
   - **#2 Explicit Format Specification:** Provide output templates/schemas
   - **#19 Iterative Frameworks:** Support Think → Act → Observe → Decide cycles
   - **#20 Tool Usage Specifications:** Document when/when-not to use each tool
   - **#21 Execution Order Explicit:** Use `order="first|second|third"` attributes

4. **For mission-critical, consider all 25**

   Review full principle list in SKILL.md (see "The Complete 25 Principles: Summary Table" section) and apply all relevant ones.

### Output from Phase 2

```markdown
## Principles Application Plan

### Core 4 (Applied to All)
- [x] #7: Make Every Step Executable
  - Strategy: Replace "ensure quality" with specific linter/test commands
- [x] #9: Avoid Ambiguity
  - Strategy: Define "good coverage" as "≥80%"
- [x] #13: Use Imperative Voice
  - Strategy: Change "consider adding" to "add"
- [x] #23: Explicit Role Definition
  - Strategy: Add <role> with identity, purpose, scope

### Additional Principles (Based on Complexity)
- [x] #8: State Dependencies
  - Strategy: Use <dependencies> for each step
- [x] #10: Acceptance Criteria
  - Strategy: Add measurable criteria for each step
[... etc]

### Total Principles Applying: [count]
```

---

## Phase 3: TRANSFORM ✨

**Objective:** Convert human format → agent-optimized format using selected principles

### Core Transformation Actions

1. **Transform vague → executable** (#7)

   For every vague directive:
   - Identify the vague term
   - Replace with specific command or action
   - Add verification method (command to run, expected output)

   ```markdown
   ❌ "Ensure tests pass"
   ✅ "Run tests and verify all pass:
       - Command: npm test
       - Expected: All tests green, 0 failures
       - If failures: Fix failing tests before proceeding"
   ```

2. **Transform ambiguous → quantified** (#9)

   For every ambiguous term:
   - Identify subjective/vague quality term
   - Replace with number, percentage, or measurable threshold
   - Provide formula or calculation if needed

   ```markdown
   ❌ "Good test coverage"
   ✅ "Test coverage ≥80% for lines, branches, and functions
       - Command: npm test -- --coverage
       - Verify: Coverage report shows ≥80% in all categories"
   ```

3. **Transform suggestions → commands** (#13)

   For every suggestion or question:
   - Replace with imperative verb (Add, Create, Run, Verify, etc.)
   - Remove hedging language ("consider", "might want to", "probably")
   - Make it a direct order

   ```markdown
   ❌ "You should probably add some tests"
   ✅ "Add tests for each public function"

   ❌ "Consider documenting this"
   ✅ "Document this function with JSDoc"
   ```

4. **Add role definition** (#23)

   At the start of the instruction, add:

   ```xml
   <role>
     <identity>[Who/what the agent is]</identity>
     <purpose>[What the agent does]</purpose>
     <expertise>
       <area>[Expertise 1]</area>
       <area>[Expertise 2]</area>
     </expertise>
     <scope>
       <in-scope>
         <item>[What agent handles]</item>
       </in-scope>
       <out-of-scope>
         <item>[What agent doesn't handle]</item>
       </out-of-scope>
     </scope>
   </role>
   ```

### Multi-Step Transformation Actions

5. **Make dependencies explicit** (#8)

   For multi-step workflows:
   - Identify which steps depend on which
   - Add `<dependencies>`, `<requires>`, `<prerequisite>`, `<blocks>`
   - State what must be true before each step starts

   ```xml
   <step id="2">
     <description>Create component</description>
     <dependencies>
       <requires>Step 1 (investigation) completed</requires>
       <prerequisite>Investigation report exists with patterns documented</prerequisite>
     </dependencies>
     <blocks>
       <step-id>3-test</step-id>
       <reason>Cannot test what doesn't exist</reason>
     </blocks>
   </step>
   ```

6. **Add acceptance criteria** (#10)

   For each step:
   - List measurable criteria for "done"
   - Assign priorities (critical, high, medium, low)
   - Specify validation method

   ```xml
   <acceptance-criteria>
     <criterion priority="critical">File exists at [path]</criterion>
     <criterion priority="high">Linter passes (npm run lint)</criterion>
     <criterion priority="high">Tests pass (npm test)</criterion>
   </acceptance-criteria>
   ```

7. **Add positive + negative examples** (#14)

   For concepts being taught:
   - Show a good example (and explain why it's good)
   - Show a bad example (and explain why it's bad)
   - Use contrast to clarify boundaries

   ```xml
   <examples>
     <positive>
       <example>[Good example]</example>
       <why-good>[Explanation of what makes it good]</why-good>
     </positive>
     <negative>
       <example>[Bad example]</example>
       <why-bad>[Explanation of what makes it bad]</why-bad>
     </negative>
   </examples>
   ```

### Complex Transformation Actions

8. **Use XML structure** (#1)

   For complex workflows (3+ steps):
   - Wrap in `<workflow>`, `<task>`, or `<protocol>`
   - Use `<step>` for each major action
   - Use attributes for metadata (id, order, priority)

9. **Specify output formats** (#2)

   For reports or analysis:
   - Provide template showing expected structure
   - Use markdown code block or JSON schema
   - Mark required vs. optional fields

   ```markdown
   **Output Format (Required):**

   ```markdown
   # Report Title

   ## Section 1
   - Finding 1: [description]
   - Finding 2: [description]

   ## Section 2
   [Details]
   ```
   ```

10. **Add iterative support** (#19)

    For investigation-driven tasks:
    - Support Think → Act → Observe → Decide cycles
    - Define decision points with clear conditions
    - Specify what to do in each outcome

11. **Document tool usage** (#20)

    For tool-heavy workflows:
    - When to use each tool
    - When NOT to use (use alternative instead)
    - Parameters and examples

### Output from Phase 3

The fully transformed, agent-optimized instruction in appropriate format (markdown for simple, XML for complex).

---

## Phase 4: VALIDATE ✅

**Objective:** Ensure the transformation meets quality standards

### Validation Checklist

Run through this 10-item checklist:

**Critical (Must Pass 100%):**
- [ ] Every step is executable (specific, actionable, measurable)
- [ ] No ambiguous or subjective terms remain
- [ ] Imperative voice used throughout
- [ ] Role explicitly defined (identity, purpose, scope)

**High Priority (Must Pass ≥90%):**
- [ ] Positive AND negative examples provided (where applicable)
- [ ] Dependencies explicit for multi-step workflows
- [ ] Acceptance criteria measurable (not subjective)
- [ ] Output formats specified (for reports/analysis)

**Medium Priority (Should Pass ≥80%):**
- [ ] Structured formats used appropriately (XML for complex)
- [ ] Tool usage documented (for tool-heavy workflows)

### Quality Grading

Assign grade based on checklist results:

**Grade A (Excellent):**
- All critical items pass (100%)
- ≥90% high priority items pass
- ≥80% medium priority items pass
- Ready for production use

**Grade B (Good):**
- All critical items pass (100%)
- 70-89% high priority items pass
- Some improvement needed but usable

**Grade C (Needs Work):**
- All critical items pass (100%)
- 50-69% high priority items pass
- Significant improvement needed

**Grade D (Insufficient):**
- Some critical items fail
- Major revisions required
- Not ready for use

### Iteration

If grade is B or lower:

1. **Identify failures** - Which checklist items failed?
2. **Prioritize fixes** - Critical first, then high priority
3. **Apply fixes** - Transform again addressing failures
4. **Re-validate** - Run checklist again
5. **Repeat until Grade A**

### Output from Phase 4

```markdown
## Validation Report

### Quality Grade: [A/B/C/D]

### Checklist Results
**Critical (4/4 passed):**
- [x] Every step executable
- [x] No ambiguity
- [x] Imperative voice
- [x] Role defined

**High Priority (6/6 passed):**
- [x] Positive + negative examples
- [x] Dependencies explicit
- [x] Acceptance criteria measurable
- [x] Output formats specified
[... etc]

### Issues Found
[If any - list specific issues and how to fix]

### Final Assessment
[Ready for use / Needs iteration]
```

---

## Complete Workflow Example

**Input (Human):**
```
Create a React component. Make sure it follows the project's patterns and add tests.
```

**Phase 1 Output (Investigation):**
```markdown
Complexity: Multi-Step (3-5 steps)
Issues: Vague ("make sure", "follows patterns"), no dependencies stated, no validation criteria
Principles: Core 4 + #8, #10, #14
```

**Phase 2 Output (Principles):**
```markdown
Applying: #7, #9, #13, #23, #8, #10, #14
```

**Phase 3 Output (Transformation):**
```xml
<task name="create-react-component">
  <role>
    <identity>Expert React component creator</identity>
    <purpose>Create production-quality components with testing</purpose>
    <scope>
      <in-scope>Functional components, TypeScript, testing</in-scope>
      <out-of-scope>State management, backend integration</out-of-scope>
    </scope>
  </role>

  <workflow type="sequential">
    <step id="1-investigate" order="first">
      <description>Investigate project component patterns</description>
      <actions>
        <action>Find existing components (search for files matching **/*Component*.tsx)</action>
        <action>Identify file location pattern (examine 3+ examples)</action>
        <action>Identify naming convention</action>
        <action>Identify test patterns</action>
      </actions>
      <acceptance-criteria>
        <criterion>Patterns documented with 3+ examples</criterion>
        <criterion>File location identified</criterion>
        <criterion>Naming convention identified</criterion>
      </acceptance-criteria>
      <blocks>
        <step-id>2-create</step-id>
      </blocks>
    </step>

    <step id="2-create" order="second">
      <description>Create component following discovered patterns</description>
      <dependencies>
        <requires>Step 1 completed</requires>
        <prerequisite>Investigation report exists</prerequisite>
      </dependencies>
      <actions>
        <action>Create component at [location from investigation]</action>
        <action>Use [naming pattern from investigation]</action>
        <action>Define TypeScript props interface</action>
      </actions>
      <acceptance-criteria>
        <criterion>File exists at correct location</criterion>
        <criterion>Naming follows pattern</criterion>
        <criterion>Linter passes (npm run lint)</criterion>
      </acceptance-criteria>
      <blocks>
        <step-id>3-test</step-id>
      </blocks>
    </step>

    <step id="3-test" order="third">
      <description>Create tests</description>
      <dependencies>
        <requires>Step 2 completed</requires>
        <prerequisite>Component file exists and compiles</prerequisite>
      </dependencies>
      <actions>
        <action>Create test file at [location from investigation]</action>
        <action>Test component renders</action>
        <action>Test props handling</action>
        <action>Test edge cases</action>
      </actions>
      <acceptance-criteria>
        <criterion>Test file created</criterion>
        <criterion>All tests pass (npm test)</criterion>
        <criterion>Coverage ≥80%</criterion>
      </acceptance-criteria>
    </step>
  </workflow>
</task>
```

**Phase 4 Output (Validation):**
```markdown
Grade: A
All critical passed (4/4)
All high priority passed (6/6)
Ready for use
```

---

## Quick Reference

**Phase 1:** Analyze instruction → Identify complexity → List issues → Determine principles
**Phase 2:** Apply Core 4 always → Add principles based on complexity
**Phase 3:** Transform vague → executable, ambiguous → quantified, suggestions → commands, add structure
**Phase 4:** Validate with checklist → Grade quality → Iterate if needed

---

## Additional Resources

**For transformation patterns:** Use Read tool on transformation-patterns.md when need 10+ before/after examples
**For validation details:** Use Read tool on validation.md when need complete grading rubric
**For example transformations:** Use Read tool on examples.md when need 7 complete examples across complexity levels
**For principle details:** See SKILL.md - All content inline in "Core 4 Principles" and "Additional Principles" sections
