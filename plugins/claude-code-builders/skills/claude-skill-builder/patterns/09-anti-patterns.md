# Pattern Category 9: Anti-Patterns

### Pattern 18: Common Anti-Patterns

**Before:**
```markdown
Don't write bad descriptions.
```

**After:**
```xml
<anti-patterns category="description-writing">
  <anti-pattern name="vague-capabilities" severity="high">
    <example>Helps with coding</example>
    <why-problematic>
      "Helps with" is meaningless. What specifically does it do?
      Agent won't know when to load this skill.
    </why-problematic>
    <impact>Skill never gets loaded (no trigger match)</impact>
    <fix>
      Specify exact capabilities:
      "Creates TypeScript components with props interfaces, hooks, and test files"
    </fix>
  </anti-pattern>

  <anti-pattern name="missing-when-clause" severity="critical">
    <example>Expert at React development</example>
    <why-problematic>
      No trigger scenarios. Agent has no WHEN clause to match against user request.
    </why-problematic>
    <impact>Skill never gets loaded (no scenarios to match)</impact>
    <fix>
      Add WHEN scenarios:
      "Use when building components, refactoring class components, or implementing hooks"
    </fix>
  </anti-pattern>

  <anti-pattern name="too-generic-keywords" severity="high">
    <example>Helps users with things</example>
    <why-problematic>
      "helps", "users", "things" are too generic. These words appear in almost
      every skill description, providing no differentiation.
    </why-problematic>
    <impact>Poor specificity leads to wrong skill loading or no loading</impact>
    <fix>
      Use specific keywords:
      "Creates React components", "implements TypeScript interfaces",
      "scaffolds component structures"
    </fix>
  </anti-pattern>

  <anti-pattern name="only-what-no-when" severity="high">
    <example>Creates beautiful UI components with animations and responsive design</example>
    <why-problematic>
      WHAT is great, but missing WHEN clause entirely. Agent doesn't know
      when to load.
    </why-problematic>
    <impact>Partial loading (matches on keywords but not scenarios)</impact>
    <fix>
      Add WHEN clause:
      "...Use when building animated interfaces, creating responsive layouts,
      or implementing complex UI interactions"
    </fix>
  </anti-pattern>

  <anti-pattern name="only-when-no-what" severity="high">
    <example>Use when building features</example>
    <why-problematic>
      WHEN is present but WHAT is completely missing. What kind of features?
      What does this skill actually do?
    </why-problematic>
    <impact>No differentiation, could match any feature work</impact>
    <fix>
      Add WHAT:
      "Creates full-stack CRUD features with API endpoints, database models,
      and UI components. Use when building features..."
    </fix>
  </anti-pattern>
</anti-patterns>
```

**Why Better:**
- Multiple anti-patterns documented
- Each has severity
- Why problematic explained
- Impact stated
- Fix provided
- Structured format

---

### Pattern 19: Before/After Comparison

**Before:**
```markdown
Here's a good way to do it: [example]
```

**After:**
```markdown
## Pattern Comparison: Checklist Design

### ❌ Human-Optimized (Before)
```markdown
- [ ] Code quality is good
- [ ] Add tests
- [ ] Update docs
```

**Problems for Agents:**
- "good" is subjective (unmeasurable)
- "Add tests" is vague (how many? where? what coverage?)
- "Update docs" doesn't specify what/where

---

### ✓ Agent-Optimized (After)
```markdown
- [ ] Code quality verified (measurable criteria):
  - Linter passes (run: npm run lint)
  - No TypeScript errors (run: tsc --noEmit)
  - No duplicate code (manual review)
  - All public functions have docstrings

- [ ] Tests created and passing (specific requirements):
  - Test file at: [per investigation]
  - Test naming: [per investigation]
  - Coverage ≥ 80%
  - All edge cases tested
  - Run: npm test (all pass)

- [ ] Documentation updated (specific locations):
  - JSDoc added to all exported functions
  - README.md updated (if public API changed)
  - CHANGELOG.md entry added under [Unreleased]
```

**Benefits for Agents:**
- Specific, measurable criteria
- Commands to run provided
- Quantitative thresholds (≥80%)
- References investigation findings
- No ambiguity

**Transformation Summary:**
- Vague → Specific
- Subjective → Measurable
- Implicit → Explicit
- General → Detailed
```

**Why Better:**
- Side-by-side comparison
- Problems identified
- Benefits stated
- Transformation explained
- Shows improvement clearly

---
