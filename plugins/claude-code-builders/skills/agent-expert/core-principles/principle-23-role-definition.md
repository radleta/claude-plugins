---
tags: [agent-expert/core-principles]
summary: "Principle #23: Explicit Role Definition — XML role structure with identity, purpose, expertise, and scope"
---

# Principle #23: Explicit Role Definition ⭐

**Category:** Role & Context
**Priority:** ALWAYS APPLY
**Complexity Cost:** Medium

**What it means:**
- Define who/what the agent is (identity)
- State what the agent does (purpose)
- List areas of expertise
- Clarify what's in scope and out of scope

**How to apply:**

Use XML structure for role definition:

```xml
<role>
  <identity>[Who/what the agent is]</identity>

  <purpose>
    [What the agent does, its primary objective]
  </purpose>

  <expertise>
    <area>[Area of expertise 1]</area>
    <area>[Area of expertise 2]</area>
    <area>[Area of expertise 3]</area>
  </expertise>

  <scope>
    <in-scope>
      <item>[Task type 1 this handles]</item>
      <item>[Task type 2 this handles]</item>
      <item>[Task type 3 this handles]</item>
    </in-scope>

    <out-of-scope>
      <item>[Task type agent should NOT handle]</item>
      <item>[Separate concern to be handled elsewhere]</item>
    </out-of-scope>
  </scope>
</role>
```

**Complete Example:**

```xml
<role>
  <identity>Expert React component creator</identity>

  <purpose>
    Create production-quality React components with TypeScript, testing,
    and documentation following project patterns
  </purpose>

  <expertise>
    <area>React functional components and hooks</area>
    <area>TypeScript type safety and props interfaces</area>
    <area>Component testing with React Testing Library</area>
    <area>JSDoc documentation for components</area>
  </expertise>

  <scope>
    <in-scope>
      <item>Creating new functional components</item>
      <item>Adding TypeScript props interfaces</item>
      <item>Writing component tests</item>
      <item>Adding JSDoc documentation</item>
      <item>Following discovered project patterns</item>
    </in-scope>

    <out-of-scope>
      <item>State management libraries (Redux, Zustand - separate concern)</item>
      <item>Backend API integration (separate concern)</item>
      <item>Build configuration (webpack, vite - separate concern)</item>
      <item>Deployment and CI/CD (separate concern)</item>
    </out-of-scope>
  </scope>
</role>
```

**Why it matters:**
- Aligns agent behavior with expected expertise level
- Sets vocabulary and terminology (technical vs. beginner-friendly)
- Clarifies boundaries (what to do, what NOT to do)
- Prevents scope creep and confusion
- Establishes context for decision-making
