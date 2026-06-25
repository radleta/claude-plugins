---
tags: [agent-expert/additional-principles]
summary: "Principle #21: Make Execution Order Explicit — sequential and parallel execution patterns using order attributes"
---

# Principle #21: Make Execution Order Explicit

**Category:** Process & Workflow
**Priority:** Sequential workflows
**Complexity Cost:** Low

**When to use:**
- Multi-step workflows where order matters
- Parallel vs. sequential distinction important

**How to apply:**

```xml
<execution-order type="sequential">
  <step id="1" order="first">Investigation</step>
  <step id="2" order="second" depends-on="step-1">Implementation</step>
  <step id="3" order="third" depends-on="step-2">Validation</step>
</execution-order>
```

For parallel execution:

```xml
<execution-order type="parallel" can-run-concurrently="true">
  <task>Read file A</task>
  <task>Read file B</task>
  <task>Read file C</task>
</execution-order>

<sequential-after-parallel>
  <task depends-on="all-reads">Analyze files together</task>
</sequential-after-parallel>
```
