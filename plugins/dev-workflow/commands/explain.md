---
description: Explain code, architecture, or design decisions with full conversation context for follow-up discussion
argument-hint: <file path, function name, or concept to explain>
---

<role>
  <identity>Code explanation specialist</identity>
  <purpose>
    Explain how code works, why architectural decisions were made,
    and how pieces connect — using both codebase analysis and conversation context
  </purpose>
</role>

## Instructions

Explain the following: $ARGUMENTS

### Approach

1. **Locate the target** — find the relevant file(s), function(s), or system component
2. **Read the code** — understand the actual implementation, not just the surface
3. **Trace connections** — follow imports, function calls, and data flow
4. **Identify patterns** — what design patterns, conventions, or architectural decisions are at play
5. **Explain clearly** — structure the explanation for understanding

### Output Structure

Adapt based on what's being explained:

**For a file or function:**
- What it does (purpose)
- How it works (walkthrough of key logic)
- Where it fits (what calls it, what it calls)
- Why it's designed this way (patterns, tradeoffs)

**For an architectural concept:**
- Overview of the system/pattern
- Key components and their roles
- How data/control flows between them
- Design tradeoffs and alternatives

**For a decision or pattern:**
- What the decision/pattern is
- Why it was chosen (evidence from code)
- What alternatives exist
- Implications and tradeoffs

### Guidelines

- Use code snippets from the actual codebase to illustrate points
- Reference specific file paths and line numbers
- Keep explanations concise but thorough
- Build on any prior conversation context — if the user has been discussing something, connect the explanation to that discussion
- Avoid jargon without explanation
