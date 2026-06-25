---
tags: [agent-expert/additional-principles]
summary: "Principle #8: State Dependencies Explicitly — use requires/prerequisite/blocks tags to make step ordering unambiguous"
---

# Principle #8: State Dependencies Explicitly

**Category:** Explicitness & Clarity
**Priority:** Multi-step workflows
**Complexity Cost:** Medium

**When to use:**
- Multi-step workflows (2+ steps)
- Steps that must execute in specific order
- Prerequisites exist for certain steps

**How to apply:**

```xml
<step id="2" order="second">
  <description>Create component</description>

  <dependencies>
    <requires>Step 1 (investigation) must be completed</requires>
    <prerequisite>Investigation report exists and is complete</prerequisite>
  </dependencies>

  <blocks>
    <step-id>3-test</step-id>
    <reason>Cannot test what doesn't exist</reason>
  </blocks>
</step>
```

**Dependency types:**
- `<requires>`: Previous step that must complete first
- `<prerequisite>`: State that must be true before starting
- `<blocks>`: What this step prevents from starting
- `<optional-for>`: Can run before, during, or after this
