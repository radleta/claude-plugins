---
tags: [agent-expert/additional-principles]
summary: "Principle #10: Comprehensive Acceptance Criteria — measurable pass/fail criteria with priority levels for every workflow step"
---

# Principle #10: Comprehensive Acceptance Criteria

**Category:** Explicitness & Clarity
**Priority:** Best practice for all multi-step tasks
**Complexity Cost:** Low

**When to use:**
- Every step in a multi-step workflow
- Any task where validation is important

**How to apply:**

```xml
<acceptance-criteria>
  <criterion id="1" priority="critical">File exists at expected path</criterion>
  <criterion id="2" priority="high">Linter passes (npm run lint, 0 warnings)</criterion>
  <criterion id="3" priority="high">Tests pass (npm test, all green)</criterion>
  <criterion id="4" priority="medium">Coverage ≥80%</criterion>
</acceptance-criteria>
```

**Priority levels:**
- **critical**: Must pass, cannot proceed without
- **high**: Should pass, important for quality
- **medium**: Nice to have, but not blocking
- **low**: Optional, best-effort
