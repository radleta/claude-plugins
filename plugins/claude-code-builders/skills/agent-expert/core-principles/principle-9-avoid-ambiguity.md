---
tags: [agent-expert/core-principles]
summary: "Principle #9: Avoid Ambiguity and Vagueness — replace subjective terms with quantitative metrics"
---

# Principle #9: Avoid Ambiguity and Vagueness ⭐

**Category:** Explicitness & Clarity
**Priority:** ALWAYS APPLY
**Complexity Cost:** Low

**What it means:**
- No subjective terms that can be interpreted differently
- Quantify everything possible
- Define any potentially ambiguous terms explicitly
- Provide examples to clarify meaning

**How to apply:**

1. **Identify subjective/ambiguous terms:**
   - Quality judgments: "good", "bad", "high-quality", "clean"
   - Quantity: "sufficient", "enough", "many", "few"
   - Performance: "fast", "slow", "efficient"
   - Size: "large", "small", "reasonable"

2. **Replace with quantitative metrics:**
   ```markdown
   ❌ "Good test coverage"
   ✅ "Test coverage ≥80% for lines, branches, and functions"

   ❌ "Fast enough performance"
   ✅ "Response time <200ms (95th percentile), initial load <1s"

   ❌ "Sufficient documentation"
   ✅ "Documentation with: purpose (1-2 sentences), all parameters (name + type + description), return value, 1-2 usage examples"
   ```

3. **Define ambiguous terms in context:**
   ```markdown
   Example: Instead of "Follow best practices", specify:
   "Follow these React best practices:
    - Use functional components with hooks (not class components)
    - Memoize expensive calculations with useMemo
    - Use useCallback for event handlers passed to children
    - Lift state to common ancestor when shared
    - Keep components focused (single responsibility)"
   ```

**Examples:**

```markdown
❌ Ambiguous: "Add sufficient examples"
✅ Specific: "Add 3-5 distinct examples covering simple, moderate, and complex use cases"

❌ Ambiguous: "Keep components small"
✅ Specific: "Keep components <200 lines. If larger, split into sub-components."

❌ Ambiguous: "Ensure good performance"
✅ Specific: "Ensure performance meets:
    - First Contentful Paint <1.8s
    - Time to Interactive <3.9s
    - Cumulative Layout Shift <0.1
    - Lighthouse Performance Score ≥90"
```

**Why it matters:**
- Ambiguity causes inconsistent agent behavior across runs
- Different agents may interpret the same term differently
- Quantitative criteria are objectively measurable
- Removes guesswork and increases reliability
