# Pattern Category 10: Goal Specification

### Pattern 20: Vague vs Goal-Oriented

**Before:**
```markdown
Create a good component.
```

**After:**
```xml
<objectives hierarchy="true">
  <primary-goal id="component-creation">
    Create production-quality React component following project conventions
    with complete testing, documentation, and accessibility
  </primary-goal>

  <sub-goals>
    <goal id="investigation" supports="component-creation">
      <description>Discover and document project patterns</description>
      <success-criteria>
        <criterion>Investigation report completed</criterion>
        <criterion>All patterns documented with examples</criterion>
      </success-criteria>
    </goal>

    <goal id="implementation" supports="component-creation">
      <description>Create component following discovered patterns</description>
      <success-criteria>
        <criterion>Component file created at correct location</criterion>
        <criterion>Follows naming convention</criterion>
        <criterion>Uses project code style</criterion>
        <criterion>TypeScript interfaces defined (if TS project)</criterion>
        <criterion>Linter passes</criterion>
      </success-criteria>
    </goal>

    <goal id="testing" supports="component-creation">
      <description>Comprehensive test coverage</description>
      <success-criteria>
        <criterion>Test file created at correct location</criterion>
        <criterion>All public methods tested</criterion>
        <criterion>Edge cases covered</criterion>
        <criterion>Coverage ≥ 80%</criterion>
        <criterion>All tests pass</criterion>
      </success-criteria>
    </goal>

    <goal id="documentation" supports="component-creation">
      <description>Complete documentation</description>
      <success-criteria>
        <criterion>Component has JSDoc with purpose, props, examples</criterion>
        <criterion>README updated if public component</criterion>
        <criterion>CHANGELOG entry added</criterion>
      </success-criteria>
    </goal>

    <goal id="accessibility" supports="component-creation">
      <description>Accessible component (WCAG 2.1 AA)</description>
      <success-criteria>
        <criterion>Proper ARIA labels</criterion>
        <criterion>Keyboard navigation supported</criterion>
        <criterion>Focus management implemented</criterion>
        <criterion>Screen reader tested</criterion>
      </success-criteria>
    </goal>
  </sub-goals>

  <measurable-outcomes>
    <outcome>Component created at correct location with correct naming</outcome>
    <outcome>Linter and TypeScript compile with zero errors</outcome>
    <outcome>Test coverage ≥ 80%, all tests pass</outcome>
    <outcome>Documentation complete (JSDoc, README if needed, CHANGELOG)</outcome>
    <outcome>Accessibility verified (ARIA, keyboard, focus)</outcome>
  </measurable-outcomes>
</objectives>
```

**Why Better:**
- Hierarchical goals (primary → sub-goals)
- Each goal has success criteria
- Success criteria are measurable
- Outcomes quantified
- No ambiguity about "good"

---

## Summary: Pattern Categories

1. **Investigation Protocols** - Structured discovery with explicit criteria
2. **Checklist Items** - Specific, measurable, validated
3. **Tool Specifications** - Complete documentation (when/how/examples)
4. **Validation & Criteria** - Measurable, prioritized, verifiable
5. **Examples Sections** - Positive + negative with explanations
6. **Workflow & Dependencies** - Explicit order and relationships
7. **Role & Context** - Identity, scope, environment
8. **Content Templates** - Exact structure for outputs
9. **Anti-Patterns** - What NOT to do with fixes
10. **Goal Specification** - Hierarchical, measurable objectives

---

## Usage Guide

**When creating agent-optimized skills:**

1. **Identify complexity** - Simple/Structured/Highly Structured
2. **Select applicable patterns** - Based on skill needs
3. **Apply transformations** - Convert human → agent format
4. **Validate** - Check against agent-optimization principles
5. **Test** - Verify agent can execute without ambiguity

**Pattern selection by skill type:**

- **Expert skills:** Patterns 1-5, 12-15, 20
- **CLI skills:** Patterns 6-7, 8-9, 16-17
- **Writer skills:** Patterns 10-11, 16-17, 18-19

---

## See Also

- **[AGENTIC.md](../AGENTIC.md)** - Framework and 25 principles
- **[validation/README.md](../validation/README.md)** - Agent-optimization validation
- **scratch/skill-builder-agentic/agentic-principles.md** - Detailed principles documentation
