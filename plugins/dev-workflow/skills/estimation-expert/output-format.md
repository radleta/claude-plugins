---
tags: [estimation-expert/output]
summary: "Standard markdown template for presenting effort estimates with classification table, scenarios, critical path, and assumptions"
---

# Output Format

Present estimates in this format:

```markdown
## Effort Estimate: {Milestone/Feature Name}

### Remaining Work Classification
| Item | Type | Parallel? | Risk | Base Hours | Adjusted Hours |
|------|------|-----------|------|------------|----------------|
| ... | ... | ... | ... | ... | ... |

### Summary
| Scenario | Work-Days | Calendar (at current pace) |
|----------|-----------|--------------------------|
| Optimistic | X | ~Y weeks |
| Realistic | X | ~Y weeks |
| Pessimistic | X | ~Y weeks |

### Critical Path
The minimum timeline is set by: [serial dependency chain]

### Assumptions
- [key assumptions that could change the estimate]
```
