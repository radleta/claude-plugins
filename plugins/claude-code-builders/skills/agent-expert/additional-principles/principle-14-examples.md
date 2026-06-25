---
tags: [agent-expert/additional-principles]
summary: "Principle #14: Positive AND Negative Examples — contrast clarifies boundaries; negative examples are disproportionately effective for LLMs"
---

# Principle #14: Positive AND Negative Examples ⭐

**Category:** Examples & Patterns
**Priority:** Best practice (recommended for most instructions)
**Complexity Cost:** Medium

**When to use:**
- Teaching patterns
- Showing transformations
- Clarifying ambiguous concepts
- Skill descriptions and documentation

**How to apply:**

```xml
<examples category="skill-descriptions">
  <positive>
    <example>
      Creates React components with TypeScript, props typing, and hooks.
      Use when building UI components, refactoring class components, or
      scaffolding component structures.
    </example>
    <why-good>
      - WHAT: Specific capabilities (React, TypeScript, props, hooks)
      - WHEN: 3 clear trigger scenarios (building, refactoring, scaffolding)
      - Keywords: Rich and technical (React, TypeScript, components, props, hooks, UI)
    </why-good>
  </positive>

  <negative>
    <example>Helps with React</example>
    <why-bad>
      - WHAT: Vague ("helps with" - helps how?)
      - WHEN: Missing entirely (when would I use this?)
      - Keywords: Only "React" (too sparse, not discoverable)
    </why-bad>
  </negative>
</examples>
```

**Why both positive AND negative:**
- Agents learn from pattern matching
- Positive shows what to do
- Negative shows what NOT to do (and why)
- Contrast clarifies boundaries

> **LLM-Specific Insight:** For instructions consumed by LLMs, negative examples (anti-patterns) are
> disproportionately effective because they target specific statistical biases in model outputs. A list
> of 20 banned patterns often outperforms equivalent positive prescriptions. LLMs default to certain
> outputs (e.g., Inter font, purple gradients, placeholder comments) due to training data frequency.
> Explicitly banning these defaults forces the model off its statistical path. When writing agent
> instructions, weight your negative examples heavily — they do more work than the positive ones.
>
> **The Exhaustive Enumeration Technique:** When targeting known LLM failure modes, enumerate every
> specific banned pattern rather than describing the category generically. "Don't use placeholder
> comments" is weaker than listing every variant: `// ...`, `// rest of code`, `// implement here`,
> `// similar to above`. The model may interpret the generic instruction loosely but cannot rationalize
> away an explicit pattern match.
