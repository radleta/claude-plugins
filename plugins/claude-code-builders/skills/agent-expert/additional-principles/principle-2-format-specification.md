---
tags: [agent-expert/additional-principles]
summary: "Principle #2: Explicit Format Specification — provide output templates for investigation reports and structured data responses"
---

# Principle #2: Explicit Format Specification

**Category:** Structure & Format
**Priority:** Recommended for reports/analysis
**Complexity Cost:** Medium

**When to use:**
- Investigation reports
- Analysis outputs
- Any structured data response

**How to apply:**

Provide template or schema for expected output:

````markdown
**Output Format (Required):**

```markdown
# Investigation Report: [Name]

## Summary
- Finding 1: [description]
- Finding 2: [description]

## Details
[Detailed findings with evidence and examples]

## Recommendations
1. [Recommendation with rationale]
2. [Recommendation with rationale]
```
````

**Why it matters:**
- Prevents ambiguous outputs
- Ensures consistency across runs
- Enables validation and downstream processing
