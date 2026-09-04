---
tags: [agent-expert/additional-principles]
summary: "Principle #19: Iterative Frameworks — Think/Act/Observe/Decide cycles for investigation-driven and uncertain tasks"
---

# Principle #19: Iterative Frameworks

**Category:** Process & Workflow
**Priority:** Complex investigative workflows
**Complexity Cost:** High

**When to use:**
- Investigation-driven tasks
- When agent needs to observe and adapt
- Uncertain environments requiring exploration

**How to apply:**

Support Think → Act → Observe → Decide cycles:

```xml
<workflow type="iterative">
  <phase name="investigate">
    <thought>What do I need to discover?</thought>
    <action>Explore codebase (search for patterns, find files, read contents)</action>
    <observation>Document findings with examples</observation>
    <decision>
      If patterns clear → Proceed to implementation
      If unclear → Ask user for clarification
      If no patterns found → Ask user for preferred approach
    </decision>
  </phase>

  <phase name="implement">
    <thought>How do I apply discovered patterns?</thought>
    <action>Create files following patterns</action>
    <observation>Verify files created correctly</observation>
    <decision>
      If validation passes → Proceed to testing
      If validation fails → Fix issues and retry
    </decision>
  </phase>
</workflow>
```
