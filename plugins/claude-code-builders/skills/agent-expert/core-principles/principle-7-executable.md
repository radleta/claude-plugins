---
tags: [agent-expert/core-principles]
summary: "Principle #7: Make Every Step Executable — replace vague directives with specific, actionable, measurable steps"
---

# Principle #7: Make Every Step Executable ⭐

**Category:** Explicitness & Clarity
**Priority:** ALWAYS APPLY
**Complexity Cost:** Low

**What it means:**
- No vague directives like "ensure quality" or "add appropriate tests"
- Every step must be specific, actionable, and measurable
- Agent must be able to verify completion (yes/no)

**How to apply:**

1. **Identify vague terms** in your instruction:
   - "good", "appropriate", "sufficient", "reasonable"
   - "ensure quality", "follow best practices"
   - "properly", "correctly", "well"

2. **Replace with specific, measurable actions:**
   ```markdown
   ❌ "Ensure code quality"
   ✅ "Verify code quality:
       - Run linter: npm run lint (must pass with 0 warnings)
       - Compile TypeScript: tsc --noEmit (must succeed)
       - Run tests: npm test (all must pass)
       - Check coverage: npm test -- --coverage (≥80%)
       - Verify all public functions have JSDoc comments"
   ```

3. **Make validation explicit:**
   - Specify the command to run
   - State the expected outcome
   - Define pass/fail criteria

**Examples:**

```markdown
❌ Vague: "Add appropriate tests"
✅ Executable: "Create test file with:
    - Test for each public method
    - Tests for edge cases (null, empty, invalid inputs)
    - Tests for error conditions
    - Achieve coverage ≥80%
    - All tests must pass (run: npm test)"

❌ Vague: "Document the changes"
✅ Executable: "Update documentation:
    - Add JSDoc to all exported functions (params, returns, example)
    - Update README.md if public API changed (add new sections for new features)
    - Add entry to CHANGELOG.md under [Unreleased] section
    - Follow format: [type]: [description]"

❌ Vague: "Follow project conventions"
✅ Executable: "Follow these discovered conventions:
    - File naming: [specific pattern from investigation, e.g., PascalCase.tsx]
    - File location: [specific path from investigation, e.g., src/components/]
    - Code style: [specific style from investigation, e.g., 2-space indent, single quotes]
    - Test location: [specific path from investigation, e.g., __tests__/]"
```

**Why it matters:**
- Vague directives cause agent confusion and inconsistent execution
- Agents cannot infer what you mean - they need explicit guidance
- Executable steps can be verified objectively (yes/no, pass/fail)
- Reduces errors and increases reliability
