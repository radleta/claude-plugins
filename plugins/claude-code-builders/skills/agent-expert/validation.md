# Agent-Optimization Validation & Quality Assessment

## Overview

This file provides the complete validation framework for assessing agent-optimized instructions.

**When to use this file:** When validating transformed instructions or grading existing instruction quality.

---

## The 10-Item Validation Checklist

Use this checklist to validate any agent-optimized instruction:

### Critical Items (Must Pass 100%)

These 4 items MUST pass for any instruction to be acceptable:

- [ ] **1. Every step is executable**
  - No vague directives ("ensure quality", "add appropriate tests")
  - Each step has specific, measurable actions
  - Agent can verify completion objectively (yes/no, pass/fail)
  - Commands specified with expected outcomes

- [ ] **2. No ambiguous or subjective terms**
  - No quality judgments without quantification ("good", "sufficient", "clean")
  - All thresholds are numbers/percentages ("≥80%", "<200ms")
  - Potentially ambiguous terms are defined explicitly
  - Examples provided to clarify meaning

- [ ] **3. Imperative voice used throughout**
  - Direct commands, not suggestions ("Add" not "Consider adding")
  - Action verbs start sentences (Create, Verify, Run, Update)
  - No hedging or conditional language ("probably", "might want to")
  - No passive voice ("tests should be run" → "run tests")

- [ ] **4. Role explicitly defined**
  - Identity stated (who/what the agent is)
  - Purpose stated (what the agent does)
  - Expertise areas listed
  - Scope clarified (in-scope and out-of-scope)

**If any critical item fails:** Instruction is Grade D (Insufficient) and requires major revision.

---

### High Priority Items (Must Pass ≥90%)

These 4 items should pass for high-quality instructions:

- [ ] **5. Positive AND negative examples provided**
  - Both what to do AND what not to do
  - Examples show contrast to clarify boundaries
  - Explanations provided for why good/bad
  - Applies when teaching patterns or transformations

- [ ] **6. Dependencies explicit (for multi-step)**
  - Step execution order is clear
  - Prerequisites stated for each step
  - Blocking relationships identified (what prevents what)
  - Uses `<dependencies>`, `<requires>`, `<blocks>` tags (if XML)

- [ ] **7. Acceptance criteria measurable**
  - Each step has validation criteria
  - Criteria are objective (not subjective)
  - Pass/fail is determinable
  - Priorities assigned (critical, high, medium, low)

- [ ] **8. Output formats specified (for reports/analysis)**
  - Template provided showing expected structure
  - Required vs. optional fields marked
  - Format is markdown, JSON schema, or example
  - Applies to investigation reports, analysis outputs

**For instructions that dispatch subagents, also check:**

- [ ] **8a. Context is crafted, not inherited**
  - Subagent receives constructed context, not raw session history
  - All necessary information provided upfront (task text, files, constraints)
  - No expectation that subagent reads plan files (paste relevant text instead)

- [ ] **8b. Model selection is justified**
  - Model tier matches task complexity (haiku for mechanical, sonnet for judgment, opus for design)
  - Not defaulting to most capable model for all dispatches

- [ ] **8c. Status handling is defined**
  - Expected response statuses documented (APPROVED/ISSUES_FOUND or DONE/BLOCKED)
  - Controller actions for each status specified
  - Escalation path exists for BLOCKED/NEEDS_CONTEXT

**If <90% pass:** Instruction is Grade B (Good) or C (Needs Work) depending on severity.

---

### Medium Priority Items (Should Pass ≥80%)

These 2 items add polish and sophistication:

- [ ] **9. Structured formats used appropriately**
  - XML structure for complex workflows (3+ steps, dependencies)
  - Markdown with headings for simpler instructions
  - Hierarchical tags for nested relationships
  - Tables for specifications and comparisons

- [ ] **10. Tool usage documented (for tool-heavy workflows)**
  - When to use each tool
  - When NOT to use (use alternative instead)
  - Parameters and examples
  - Applies to complex workflows using multiple tools

**If <80% pass:** Minor quality issues, but still usable.

---

## Quality Grading System

Based on checklist results, assign a grade:

### Grade A (Excellent) - Production Ready

**Criteria:**
- ✅ All 4 critical items pass (100%)
- ✅ ≥90% high priority items pass (≥3.6 out of 4)
- ✅ ≥80% medium priority items pass (≥1.6 out of 2)

**Characteristics:**
- Unambiguous, executable, measurable
- Clear dependencies and validation
- Comprehensive examples (positive + negative)
- Appropriate structure for complexity
- Ready for production use without modification

**Example:** See Example 2 in main SKILL.md (multi-step React component with XML structure, dependencies, acceptance criteria)

---

### Grade B (Good) - Usable with Minor Issues

**Criteria:**
- ✅ All 4 critical items pass (100%)
- ⚠️ 70-89% high priority items pass (2.8-3.5 out of 4)
- ⚠️ ≥60% medium priority items pass (≥1.2 out of 2)

**Characteristics:**
- Core quality present (executable, unambiguous, imperative, role defined)
- Some examples or dependencies may be missing
- Validation criteria may be incomplete
- Usable but could be improved

**Common Issues:**
- Missing negative examples (only positive examples provided)
- Some implicit dependencies (not all blocking relationships stated)
- Some acceptance criteria subjective or missing

**Recommendation:** Can be used as-is, but consider improvements for mission-critical tasks.

---

### Grade C (Needs Work) - Significant Issues

**Criteria:**
- ✅ All 4 critical items pass (100%)
- ❌ 50-69% high priority items pass (2.0-2.7 out of 4)
- ❌ 40-59% medium priority items pass (0.8-1.1 out of 2)

**Characteristics:**
- Core principles met but quality is lacking
- Missing examples, dependencies unclear, validation weak
- May work but unreliable or inconsistent

**Common Issues:**
- No examples provided (neither positive nor negative)
- Dependencies implicit or missing
- Acceptance criteria vague or missing
- No output format specification

**Recommendation:** Requires significant revision before use in production.

---

### Grade D (Insufficient) - Not Ready

**Criteria:**
- ❌ One or more critical items fail

**Characteristics:**
- Fundamental issues with agent-optimization
- Vague, ambiguous, suggestive, or no role
- Cannot be executed reliably
- Not ready for use

**Common Issues:**
- Vague steps ("ensure quality" undefined)
- Ambiguous terms ("good coverage" not quantified)
- Suggestions instead of commands ("consider adding")
- No role definition

**Recommendation:** Major revision required. Return to transformation phase.

---

## Quick Validation Questions

Ask these questions for rapid assessment:

### Executability (Critical)

**Q1:** Can I follow each step without guessing?
- ✅ Yes → Step is executable
- ❌ No → Too vague, needs specifics

**Q2:** Is there a command I can run or specific action I can take?
- ✅ Yes, with expected outcome → Executable
- ❌ "Ensure X" without saying how → Not executable

### Ambiguity (Critical)

**Q3:** Are there any words like "good", "appropriate", "sufficient"?
- ✅ No subjective terms → Unambiguous
- ❌ Contains subjective terms → Ambiguous

**Q4:** Are all thresholds quantified with numbers?
- ✅ "≥80%", "<200ms", "3-5 examples" → Quantified
- ❌ "Good coverage", "fast enough" → Ambiguous

### Voice (Critical)

**Q5:** Does every sentence start with an action verb (Create, Run, Verify)?
- ✅ Yes → Imperative
- ❌ "Consider...", "You might..." → Suggestive

### Role (Critical)

**Q6:** Is there a `<role>` section defining identity, purpose, scope?
- ✅ Yes, all present → Role defined
- ❌ Missing or incomplete → No role

### Examples (High Priority)

**Q7:** Are there both positive AND negative examples?
- ✅ Both present with explanations → Excellent
- ⚠️ Only positive examples → Missing negative
- ❌ No examples → Missing

### Dependencies (High Priority - if multi-step)

**Q8:** For each step, is it clear what must complete first?
- ✅ Yes, with `<dependencies>` or clear statement → Explicit
- ❌ Implicit ("Step 1, Step 2" without stating 2 requires 1) → Implicit

---

## Validation Process

Follow these steps when validating:

### Step 1: Run the Checklist

Go through all 10 items systematically:
- Mark each pass/fail
- Note specific issues for failures
- Count passes in each category

### Step 2: Calculate Scores

- **Critical:** X out of 4 passed (must be 4/4 = 100%)
- **High Priority:** X out of 4 passed (calculate percentage)
- **Medium Priority:** X out of 2 passed (calculate percentage)

### Step 3: Assign Grade

Use grading criteria above:
- All critical + ≥90% high + ≥80% medium = **Grade A**
- All critical + 70-89% high + ≥60% medium = **Grade B**
- All critical + 50-69% high + 40-59% medium = **Grade C**
- Any critical failed = **Grade D**

### Step 4: Document Findings

Create validation report:

```markdown
## Validation Report

### Grade: [A/B/C/D]

### Critical Items (X/4 passed)
- [✅/❌] Every step executable
  - [If failed: specific issue]
- [✅/❌] No ambiguity
  - [If failed: specific terms found]
- [✅/❌] Imperative voice
  - [If failed: specific examples of non-imperative]
- [✅/❌] Role defined
  - [If failed: what's missing]

### High Priority Items (X/4 passed = Y%)
- [✅/❌] Positive + negative examples
  - [If failed: only positive / no examples]
- [✅/❌] Dependencies explicit
  - [If failed: which dependencies unclear]
- [✅/❌] Acceptance criteria measurable
  - [If failed: which criteria subjective]
- [✅/❌] Output formats specified
  - [If failed: which outputs undefined]

### Medium Priority Items (X/2 passed = Y%)
- [✅/❌] Structured formats appropriate
  - [If failed: prose instead of XML / wrong level]
- [✅/❌] Tool usage documented
  - [If failed: which tools undocumented]

### Issues to Fix (Priority Order)
1. [Critical issue 1 if any]
2. [Critical issue 2 if any]
3. [High priority issue 1]
4. [High priority issue 2]
[...]

### Recommendations
[Specific improvements needed to reach Grade A]

### Final Assessment
[Ready for use / Needs revision / Not ready]
```

### Step 5: Iterate if Needed

If grade is B or lower:
1. Address critical failures first (if any)
2. Fix high priority issues
3. Improve medium priority items
4. Re-validate
5. Repeat until Grade A

---

## Common Failures and Fixes

### Failure: "Ensure code quality"

**Issue:** Vague, not executable (Critical #1 fails)

**Fix:**
```markdown
Verify code quality:
- Run linter: npm run lint (must pass with 0 warnings)
- Compile TypeScript: tsc --noEmit (must succeed)
- Run tests: npm test (all must pass)
- Check coverage: npm test -- --coverage (≥80%)
```

---

### Failure: "Good test coverage"

**Issue:** Ambiguous (Critical #2 fails)

**Fix:**
```markdown
Test coverage ≥80% for lines, branches, and functions
- Command: npm test -- --coverage
- Verify: Coverage report shows ≥80% in all 3 categories
```

---

### Failure: "Consider adding tests"

**Issue:** Suggestive, not imperative (Critical #3 fails)

**Fix:**
```markdown
Add tests for each public function
```

---

### Failure: No role definition

**Issue:** Role undefined (Critical #4 fails)

**Fix:**
```xml
<role>
  <identity>Expert [domain] specialist</identity>
  <purpose>[What this agent does]</purpose>
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

---

### Failure: Only positive examples

**Issue:** Missing negative examples (High Priority #5 partial)

**Fix:**
```xml
<examples>
  <positive>
    <example>[Good example]</example>
    <why-good>[Explanation]</why-good>
  </positive>
  <negative>
    <example>[Bad example]</example>
    <why-bad>[Explanation]</why-bad>
  </negative>
</examples>
```

---

### Failure: Implicit dependencies

**Issue:** "Step 1, Step 2" without stating 2 requires 1 (High Priority #6 fails)

**Fix:**
```xml
<step id="2">
  <dependencies>
    <requires>Step 1 must complete</requires>
    <prerequisite>[State that must be true]</prerequisite>
  </dependencies>
</step>
```

---

## Severity Guidelines

When documenting failures, use these severity levels:

### Critical (Blockers)
- Vague steps that can't be executed
- Ambiguous validation criteria
- Suggestive instead of imperative language
- No role definition

**Impact:** Cannot be used reliably, will cause agent errors

**Action:** Must fix before use

---

### High (Significant Issues)
- Missing examples (especially negative)
- Implicit dependencies in multi-step workflows
- Subjective acceptance criteria
- No output format for reports

**Impact:** May work but with inconsistency or poor quality

**Action:** Should fix for production use

---

### Medium (Quality Issues)
- Prose instead of XML for complex workflows
- Undocumented tool usage
- Missing optional documentation

**Impact:** Works but less maintainable or harder to understand

**Action:** Nice to fix, not blocking

---

### Low (Polish)
- Minor wording improvements
- Style consistency
- Additional helpful examples

**Impact:** Minimal, mostly aesthetic

**Action:** Optional improvements

---

## Validation Example

**Input:**
```markdown
Create a React component. Follow project conventions and add tests.
```

**Validation:**

**Critical:**
- ❌ Not executable - "follow conventions" undefined
- ❌ Ambiguous - "conventions" not specified
- ❌ Suggestive - implied rather than commanded
- ❌ No role defined

**Grade: D (Insufficient)** - All 4 critical items failed

**Required Fixes:**
1. Make executable: Specify exact steps
2. Remove ambiguity: Define what "conventions" means
3. Use imperative: Direct commands
4. Add role definition

**After Transformation:**
(See Example 2 in main SKILL.md for full transformation)

**Re-Validation:**
- ✅ All critical items pass
- ✅ All high priority pass (dependencies, criteria, examples)
- ✅ All medium priority pass (XML structure, tools)

**Grade: A (Excellent)** - Ready for production

---

## Additional Resources

**For transformation guidance:** See SKILL.md - All content inline in "The 4-Phase Workflow" section (complete 4-phase transformation process)
**For transformation patterns:** Use Read tool on transformation-patterns.md when need 10+ before/after patterns
**For principle details:** See SKILL.md - All content inline in "Core 4 Principles" and "Additional Principles" sections (all 25 principles explained)
**For complete examples:** Use Read tool on examples.md when need 7 full transformations
