# Pattern Category 2: Checklist Items

### Pattern 3: Simple Checklist Item

**Before:**
```markdown
- [ ] Code quality is good
- [ ] Tests added
- [ ] Documentation updated
```

**After:**
```markdown
- [ ] Code quality verified:
  - Linter passes (run: npm run lint OR discovered command)
  - No TypeScript errors (run: tsc --noEmit) [if TypeScript project]
  - Prettier formatted (run: npm run format OR discovered command)
  - No duplicate code (manual review)
  - All public functions have docstrings with params, returns, examples

- [ ] Tests created and passing:
  - Test file location: [per investigation findings]
  - Test file naming: [per investigation findings]
  - Test each public method/function
  - Test edge cases (null, empty, invalid inputs)
  - Test error conditions
  - Coverage ≥ [X]% (per investigation findings OR 80% default)
  - All tests pass (run: npm test OR discovered command)

- [ ] Documentation updated:
  - JSDoc/docstrings added for all exported functions (purpose, params, returns, examples)
  - README.md updated (if public API changed)
  - CHANGELOG.md entry added under [Unreleased] (following discovered format)
  - Code comments added for complex logic (not obvious code)
```

**Why Better:**
- Specific sub-criteria (measurable)
- Commands provided
- Conditional logic (if TypeScript project)
- References investigation findings
- Quantitative (≥80%)

---

### Pattern 4: Structured Validation Checklist

**Before:**
```markdown
- [ ] Description follows formula
```

**After:**
```xml
<checklist category="description-validation">
  <item id="desc-001" priority="critical">
    <description>Description follows WHAT + WHEN formula</description>
    <validation>
      <criterion>WHAT statement: Describes specific capabilities (not vague)</criterion>
      <criterion>WHEN clauses: 3-5 trigger scenarios using action verbs</criterion>
      <criterion>Format: [WHAT]. Use when [WHEN1], [WHEN2], or [WHEN3].</criterion>
      <criterion>Keywords: Rich, specific, technical terms that users will mention</criterion>
    </validation>
    <examples>
      <positive>
        Creates React components with TypeScript, props typing, and hooks.
        Use when building UI components, refactoring class components, or
        scaffolding component structures.
      </positive>
      <why-good>
        WHAT: Specific (React, TypeScript, props, hooks)
        WHEN: 3 scenarios (building, refactoring, scaffolding)
        Keywords: React, TypeScript, components, props, hooks, UI
      </why-good>
      <negative>
        Helps with React
      </negative>
      <why-bad>
        WHAT: Vague ("helps with")
        WHEN: Missing entirely
        Keywords: Only "React" (too sparse)
      </why-bad>
    </examples>
  </item>
</checklist>
```

**Why Better:**
- Structured validation criteria
- Positive AND negative examples
- Explicit why good/bad
- Priority tagged
- Measurable criteria

---

### Pattern 5: Conditional Checklist

**Before:**
```markdown
- [ ] Add Storybook story
```

**After:**
```markdown
- [ ] Storybook integration (if project uses Storybook):
  - Check investigation report: Does project use Storybook?
  - If YES:
    - Story file created at: [location per investigation]
    - Story naming follows: [pattern per investigation]
    - Story includes: Default state, all prop variations, edge cases
    - Story renders without errors
  - If NO:
    - Skip this item
```

**Why Better:**
- Conditional logic explicit
- References investigation
- Clear skip condition
- Specific requirements when applicable

---
