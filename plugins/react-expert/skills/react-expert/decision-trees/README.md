# Decision Trees for React Development

## Overview

This folder contains **clear, executable decision trees** for common choices React developers face. Each tree uses branching logic to guide you from a question to the right solution.

## Purpose

Decision trees solve a critical problem: **agents and developers often make poor architectural choices** not because they lack knowledge, but because they lack a clear decision-making process. These trees provide that process.

## How to Use Decision Trees

### Structure

Every decision tree follows this pattern:

```
Start: [Root Question]
├─ [Condition A]
│   ├─ [Sub-condition A1]
│   │   └─ [SOLUTION/LEAF]
│   └─ [Sub-condition A2]
│       └─ [SOLUTION/LEAF]
└─ [Condition B]
    └─ [SOLUTION/LEAF]
```

### Process

1. **Start at the root question** - Read the top-level question
2. **Evaluate the first condition** - Does it match your situation?
3. **Follow the matching branch** - Continue down that path
4. **Reach a leaf node** - This is your answer (marked with →)
5. **Review the code example** - See implementation below the tree

### Rules

- **One path only** - Follow only the first matching condition
- **Read conditions literally** - Don't interpret; match exactly
- **Stop at leaf nodes** - When you reach a solution, stop
- **Check antipatterns** - After choosing, verify you didn't match an antipattern

## Available Decision Trees

### 1. State Management (`state-management.md`)

**When to use:** Choosing between useState, useReducer, Context, or external state libraries

**Solves:**
- "Should I use Redux or Context?"
- "When do I need useReducer instead of useState?"
- "Is this state too complex for local state?"

**Tree structure:**
- Root: What kind of state?
- Branches: Simple value, complex state, global app state
- Leaves: useState, useReducer, Context, Redux Toolkit, Zustand, Jotai, XState

**Examples:** 8 code examples covering all major state approaches

---

### 2. Effect Usage (`effect-usage.md`)

**When to use:** Deciding if you need useEffect (or if you're misusing it)

**Solves:**
- "Should this be in useEffect or during render?"
- "Why is my effect running infinitely?"
- "Do I need useEffect for this event handler?"

**Tree structure:**
- Root: What needs to happen?
- Branches: Derive value, sync external system, run on trigger, initialize
- Leaves: No effect (compute during render), useEffect with deps, event handler

**Examples:** 6 examples including common antipatterns

**Critical focus:** When NOT to use useEffect (most important section)

---

### 3. Performance Optimization (`performance.md`)

**When to use:** Deciding whether and how to optimize component performance

**Solves:**
- "Should I wrap this in React.memo?"
- "When is useMemo appropriate?"
- "Is this optimization premature?"

**Tree structure:**
- Root: Is there a measured performance problem?
- Branches: Component re-renders, expensive calculations, callbacks, large lists
- Leaves: React.memo, useMemo, useCallback, virtualization, or DON'T optimize

**Examples:** 5 examples including cases where optimization makes things WORSE

**Critical focus:** Premature optimization antipatterns

---

### 4. Data Fetching (`data-fetching.md`)

**When to use:** Choosing how to fetch data from APIs

**Solves:**
- "Should I use React Query or plain fetch?"
- "Where should data fetching happen?"
- "How do I handle loading and error states?"

**Tree structure:**
- Root: Where is component rendered?
- Branches: Server vs client, simple vs complex, REST vs GraphQL
- Leaves: Server Components, useEffect + fetch, React Query, SWR, Apollo Client, WebSocket

**Examples:** 5 examples covering server and client approaches

**Framework-specific:** Includes Next.js, Remix patterns

---

## Decision Tree Quality Standards

Each tree in this folder meets these criteria:

### 1. Clarity
- ASCII tree diagram that renders in any text viewer
- Clear, unambiguous conditions (no subjective terms)
- Single path from root to leaf
- Explicit leaf nodes (solutions)

### 2. Completeness
- Covers all common scenarios for the topic
- No "it depends" leaves (always provides concrete answer)
- Includes code examples for every leaf
- Addresses edge cases in antipatterns section

### 3. Executability
- Conditions are testable/measurable
- Examples are copy-paste ready
- No hand-waving or vague guidance
- Specific tool/library recommendations

### 4. Safety
- Antipatterns section shows what NOT to do
- Explains why wrong choices are wrong
- Provides correction path from antipattern to pattern

## How These Trees Were Designed

### Agent-Optimization Principles

These trees follow agent-optimization principles:

1. **Explicit over implicit** - All conditions are spelled out
2. **Structured format** - ASCII tree is parseable and clear
3. **Positive + negative examples** - Both patterns and antipatterns
4. **Measurable criteria** - "3+ fields" not "complex"
5. **Executable instructions** - Code examples for every leaf

### Common Pitfalls Avoided

**Pitfall 1: Subjective conditions**
- ❌ "If state is complex..." (What's complex?)
- ✅ "If object has 5+ fields..." (Measurable)

**Pitfall 2: Multiple valid paths**
- ❌ "Use Context OR Redux" (Which one??)
- ✅ Tree branches on criteria to single solution

**Pitfall 3: Missing examples**
- ❌ "Use React.memo" (How?)
- ✅ Complete code example showing memo usage

**Pitfall 4: No negative guidance**
- ❌ Only shows what to do
- ✅ Includes antipatterns section showing what NOT to do

## Using Multiple Trees Together

Some decisions require multiple trees:

### Example: Building a feature

1. **Start with state-management.md** - Choose state approach
2. **Check effect-usage.md** - Decide if effects needed
3. **Review data-fetching.md** - Pick data fetching strategy
4. **Consult performance.md** - Only after measuring issues

### Example: Debugging an issue

1. **Check antipatterns** in relevant tree
2. **Identify which condition matched** (wrong branch taken?)
3. **Follow correct branch** to find right solution
4. **Refactor** using code example

## When Decision Trees Aren't Enough

These trees handle **common, clear-cut decisions**. They don't cover:

- **Highly context-specific** architecture (use investigation protocols)
- **Novel patterns** not in mainstream React (research needed)
- **Team preferences** that override technical choices (defer to team)
- **Experimental features** still in beta (wait for stability)

In those cases, use:
- Investigation protocols in `@investigation/`
- Validation checklists in `@validation/checklist.md`
- Core principles in `SKILL.md`

## Contributing New Trees

To add a new decision tree:

1. **Identify the decision point** - What question needs a tree?
2. **Draft the tree structure** - Root question, branches, leaves
3. **Make conditions measurable** - Replace subjective with objective
4. **Write code examples** - One per leaf node
5. **Add antipatterns section** - Common mistakes
6. **Validate** - Can someone follow it mechanically?

## Quick Reference

| Tree | Use When | Outputs |
|------|----------|---------|
| state-management.md | Choosing state approach | useState, useReducer, Context, Redux, Zustand, etc. |
| effect-usage.md | Deciding if effect needed | useEffect, event handler, or nothing |
| performance.md | Considering optimization | React.memo, useMemo, useCallback, or wait |
| data-fetching.md | Fetching data from API | Server Components, React Query, SWR, fetch |

## See Also

- `@rules/` - Pattern rules and conventions
- `@investigation/` - When to investigate vs decide
- `@validation/` - Quality checklists
- `@templates/` - Code templates for implementations
