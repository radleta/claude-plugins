# Pattern Category 5: Examples Sections

### Pattern 10: Examples with Positive + Negative

**Before:**
```markdown
## Examples

Good description:
"Creates React components with TypeScript and hooks"
```

**After:**
```markdown
## Examples

<examples category="skill-descriptions">
  <positive>
    <example id="1">
      Creates React components with TypeScript, props typing, and hooks.
      Use when building UI components, refactoring class components, or
      scaffolding component structures.
    </example>
    <why-good>
      - WHAT: Specific capabilities (React, TypeScript, props, hooks)
      - WHEN: 3 trigger scenarios (building, refactoring, scaffolding)
      - Keywords: React, TypeScript, components, props, hooks, UI (rich)
      - Format: [WHAT]. Use when [WHEN1], [WHEN2], or [WHEN3].
    </why-good>
  </positive>

  <positive>
    <example id="2">
      Guides high-quality code changes with project investigation, quality
      checklists, testing, and documentation. Use when implementing features,
      fixing bugs, refactoring, or updating code.
    </example>
    <why-good>
      - WHAT: Specific approach (investigation, checklists, testing, docs)
      - WHEN: 4 scenarios (implementing, fixing, refactoring, updating)
      - Keywords: quality, investigation, checklists, testing (rich)
    </why-good>
  </positive>

  <negative>
    <example id="1">
      Helps with React
    </example>
    <why-bad>
      - WHAT: Vague ("helps with" - helps how?)
      - WHEN: No trigger scenarios
      - Keywords: Only "React" (too sparse)
      - Format: Incomplete, missing WHEN clause entirely
    </why-bad>
  </negative>

  <negative>
    <example id="2">
      Use when you need to code
    </example>
    <why-bad>
      - WHAT: Missing (no capabilities described)
      - WHEN: Extremely vague ("need to code" - too generic)
      - Keywords: "code" is too generic
      - Format: No WHAT statement
    </why-bad>
  </negative>
</examples>
```

**Why Better:**
- Multiple positive examples (pattern recognition)
- Negative examples (anti-patterns)
- Explicit why good/bad
- Structured format
- IDs for reference

---

### Pattern 11: Sufficient Distinct Instances

**Before:**
```markdown
Example: Use when creating components
```

**After:**
```markdown
<examples category="trigger-scenarios" count="5">
  <example id="1" complexity="simple">
    Use when building new UI components from scratch
  </example>

  <example id="2" complexity="simple">
    Use when refactoring class components to functional components
  </example>

  <example id="3" complexity="moderate">
    Use when scaffolding component structures following established patterns
  </example>

  <example id="4" complexity="moderate">
    Use when implementing components with complex state management and hooks
  </example>

  <example id="5" complexity="advanced">
    Use when creating compound components with context providers and consumers
  </example>

  <coverage-analysis>
    - Simple use cases: 2 examples
    - Moderate complexity: 2 examples
    - Advanced scenarios: 1 example
    - Total distinct scenarios: 5
    - Variation demonstrated: Yes (new creation, refactoring, scaffolding, state management, compound)
  </coverage-analysis>
</examples>
```

**Why Better:**
- 5 distinct examples (not just 1)
- Complexity levels varied
- Different scenarios covered
- Coverage analysis shows thoroughness

---
