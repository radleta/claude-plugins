# React Rules Reference

This directory contains **hard constraints** that break React applications if violated. These are not best practices or style preferences - these are the rules that, when broken, cause bugs, crashes, infinite loops, and production incidents.

## Purpose

React's rules exist because of how React works internally - its rendering model, reconciliation algorithm, and hooks system have specific requirements. Violating these rules doesn't just make code "less clean" - it makes code **broken**.

## When to Use This Reference

**Use this when:**
- Writing React components from scratch
- Reviewing agent-generated React code
- Debugging mysterious React bugs
- Teaching agents about React constraints
- Setting up ESLint rules

**Each rule file contains:**
- Clear statement of what's forbidden/required
- Why it matters (what breaks if violated)
- ❌ WRONG examples (code that violates)
- ✅ CORRECT examples (code that follows)
- ESLint rule name (if exists)
- Agent checklist for verification

## The 6 Critical Rule Categories

### 1. hooks-rules.md
**Rules of Hooks** - How to call hooks without breaking React's internal state tracking

**When violated**: React loses track of hook state, components crash, hooks return wrong values

**Quick check**: Are all hooks at top level? Same order every render? Named with "use" prefix?

---

### 2. dependency-arrays.md
**Dependency Array Requirements** - What must go in useEffect/useMemo/useCallback deps

**When violated**: Infinite loops, stale closures, wrong values, memory leaks

**Quick check**: Is every value from component scope in the deps array? Are object deps memoized?

---

### 3. immutable-updates.md
**Immutable State Updates** - Never mutate state directly

**When violated**: React doesn't detect changes, UI doesn't update, stale renders

**Quick check**: Using spread operator? No .push()/.splice()? No direct assignment to state?

---

### 4. key-prop-requirements.md
**Key Prop Requirements** - Stable, unique keys for list items

**When violated**: State corruption, wrong items rendered, performance issues, React warnings

**Quick check**: Using item.id as key? Not using array index? Keys unique among siblings?

---

### 5. typescript-essentials.md
**TypeScript with React** - Correct types for props, events, children

**When violated**: Type errors, runtime crashes, missing props, incorrect event handling

**Quick check**: Event handlers typed? Children prop explicit? No implicit any?

---

### 6. performance-traps.md
**Performance Anti-Patterns** - Common patterns that cause unnecessary re-renders

**When violated**: Slow UI, janky interactions, excessive renders, poor user experience

**Quick check**: Objects/functions memoized? Callbacks wrapped? Event handlers not re-created?

---

## Quick Violation → Consequence Table

| Rule Violated | Immediate Consequence | Symptom |
|--------------|----------------------|---------|
| Hooks in condition | React error: "Rendered fewer hooks than expected" | App crashes |
| Hooks in wrong order | Hook returns wrong state | State corruption |
| Missing dependency | Stale closure | Wrong values used |
| Missing cleanup | Memory leak | Performance degrades over time |
| Object in deps without memo | Infinite re-render | App freezes, browser tab crashes |
| Direct state mutation | UI doesn't update | Changes not reflected |
| Array .push() to state | UI doesn't update | Changes not reflected |
| Index as key | State attached to wrong items | Input fields swap values |
| Unstable keys | Component remounts | State resets, focus lost |
| Wrong event type | Type error or undefined properties | Runtime crash |
| Missing children type (React 18+) | Type error | Build fails |
| New object/function in render | Unnecessary re-renders | Janky UI, performance issues |

## ESLint Rules to Enable

These rules catch violations automatically:

```json
{
  "rules": {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    "react/jsx-key": "error",
    "react/no-array-index-key": "warn",
    "@typescript-eslint/no-explicit-any": "error"
  }
}
```

**For complete ESLint configuration**, see **eslint-config-recommended.json** in this folder for:
- Full React + TypeScript ESLint setup
- All rules mapped to Top 10 Agent Mistakes
- Installation instructions
- Package.json scripts
- Integration with VS Code, pre-commit hooks, CI/CD

## Agent Checklist: Before Submitting React Code

Before an agent considers React code "done", verify:

- [ ] All hooks called at top level (no conditions/loops)
- [ ] All hooks called in same order every render
- [ ] Custom hooks start with "use"
- [ ] Every value from component scope in effect/memo/callback deps
- [ ] Object/array dependencies are memoized
- [ ] Cleanup functions for subscriptions, timers, listeners
- [ ] State updates use spread operator or immutable methods
- [ ] No .push(), .splice(), or direct mutations
- [ ] List items have stable, unique keys (not index)
- [ ] Event handlers have correct types
- [ ] Children prop explicitly typed (React 18+)
- [ ] No new objects/functions created in render (unless intentional)

## How to Use These Rules

### For Code Review
1. Open the relevant rule file
2. Check ❌ WRONG examples against code under review
3. Verify code matches ✅ CORRECT patterns
4. Use agent checklist to systematically verify

### For Debugging
1. Identify symptom (infinite loop, stale value, crash)
2. Check Quick Violation → Consequence Table
3. Open relevant rule file
4. Compare buggy code to examples
5. Apply fix from ✅ CORRECT example

### For Learning
1. Read each rule file sequentially
2. Understand WHY each rule exists
3. See how violations cause bugs
4. Internalize correct patterns

## Rule Files in Detail

**hooks-rules.md** (~250 lines)
The 4 core rules about how to call hooks, with examples of each violation type and ESLint integration.

**dependency-arrays.md** (~300 lines)
Comprehensive guide to dependency arrays - what goes in them, what breaks when they're wrong, and how to fix common patterns.

**immutable-updates.md** (~250 lines)
Complete reference for immutable state updates - objects, arrays, nested structures, and common mutations to avoid.

**key-prop-requirements.md** (~200 lines)
Everything about the key prop - why index keys are dangerous, how to choose good keys, and what breaks when keys are wrong.

**typescript-essentials.md** (~200 lines)
React-specific TypeScript patterns - event types, children prop, generic components, and React 18 breaking changes.

**performance-traps.md** (~200 lines)
Common patterns that cause unnecessary re-renders and how to avoid them without premature optimization.

---

## Remember

These aren't guidelines - these are **rules**. Following them isn't about writing "good" React code, it's about writing **working** React code.

Every rule in this directory exists because violating it causes bugs in production.
