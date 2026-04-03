# Pattern Detection - Request to Guidance Mapping

**Purpose**: Map user requests to the appropriate rules, decision trees, or templates.

## Detection Flow

```
User Request
    ↓
Extract Keywords
    ↓
Match to Category
    ↓
Load Appropriate File(s)
    ↓
Generate Code Following Guidance
```

## Keyword → Category → File Mapping

### Category 1: Hooks Rules & Constraints

**Keywords**: "hook", "useEffect", "useState", "rules", "violation", "error", "crash"

**Signals**:
- User mentions hook-related errors
- Asks about hook rules
- Wants to know when/how to use hooks
- Has infinite loop or stale closure issues

**Load**:
- @rules/hooks-rules.md → Call order, conditions, loops
- @rules/dependency-arrays.md → useEffect, useMemo, useCallback deps

**Decision**: Does request involve hooks? Load rules first.

---

### Category 2: State Management Choice

**Keywords**: "state", "manage", "useState", "useReducer", "context", "redux", "zustand", "global", "share"

**Signals**:
- User asks which state solution to use
- Needs to manage complex state
- Wants to share state across components
- Asks about state management libraries

**Load**:
- @decision-trees/state-management.md → Decision tree for choosing approach
- @rules/immutable-updates.md → How to update state correctly
- @templates/component-with-state.tsx → useState example
- @templates/component-with-reducer.tsx → useReducer example
- @templates/context-provider.tsx → Context example

**Decision Tree**:
```
Start: What type of state?
├─ Simple local state (number, string, boolean)
│   └─ Use useState → @templates/component-with-state.tsx
├─ Complex local state (object with multiple fields)
│   └─ Use useReducer → @templates/component-with-reducer.tsx
├─ Shared state (multiple components in tree)
│   └─ Use Context → @templates/context-provider.tsx
└─ Global app state (many components, different trees)
    └─ Use library → @decision-trees/state-management.md
```

---

### Category 3: Effect & Lifecycle

**Keywords**: "effect", "useEffect", "lifecycle", "mount", "unmount", "cleanup", "dependency", "infinite loop"

**Signals**:
- User needs side effects (data fetching, subscriptions)
- Mentions lifecycle methods or timing
- Has infinite loop issues
- Asks about cleanup or dependencies

**Load**:
- @rules/dependency-arrays.md → What must be in deps
- @decision-trees/effect-usage.md → When to use/not use effects
- @templates/component-with-effect.tsx → Correct effect patterns
- @templates/conditional-effects.tsx → Effect with conditions inside
- @templates/data-fetching-effect.tsx → Data fetching with effects (when not using library)

**Decision Tree**:
```
Start: What needs to happen?
├─ Run once on mount
│   └─ useEffect with empty deps [] → Check @rules/dependency-arrays.md
├─ Run when value changes
│   └─ useEffect with value in deps [value] → Verify exhaustive
├─ Subscribe to something (event, socket, etc.)
│   └─ useEffect with cleanup function → @templates/component-with-effect.tsx
└─ Derive value from props/state
    └─ DON'T use effect! → @decision-trees/effect-usage.md (when NOT to use)
```

---

### Category 4: Performance Optimization

**Keywords**: "performance", "slow", "re-render", "optimize", "memo", "useMemo", "useCallback", "lag"

**Signals**:
- User reports slow rendering
- Asks about performance optimization
- Wants to prevent re-renders
- Mentions memoization

**Load**:
- @decision-trees/performance.md → When to optimize
- @templates/memo-component.tsx → React.memo usage patterns
- @templates/derived-state.tsx → useMemo for derived values
- @rules/dependency-arrays.md → useMemo/useCallback deps

**Decision Tree**:
```
Start: Is performance actually slow? (measured with profiler)
├─ No → DON'T optimize yet (premature optimization)
│   └─ Write simple code first
└─ Yes → What's the cause?
    ├─ Expensive calculation on every render
    │   └─ Use useMemo → @decision-trees/performance.md
    ├─ Component re-renders unnecessarily
    │   └─ Use React.memo → @decision-trees/performance.md
    ├─ Passing new function references
    │   └─ Use useCallback → @decision-trees/performance.md
    └─ Large list rendering
        └─ Use virtualization → @decision-trees/performance.md
```

---

### Category 5: Lists & Keys

**Keywords**: "list", "map", "array", "key", "index", "key prop"

**Signals**:
- User needs to render array of items
- Has key prop warnings
- Asks about using index as key

**Load**:
- @rules/key-prop-requirements.md → Key rules (no indexes!)
- @templates/list-rendering.tsx → Correct list patterns

**Decision**: List rendering? → Load key rules first, they're critical.

---

### Category 6: Forms & Input

**Keywords**: "form", "input", "field", "validation", "submit", "onChange", "controlled", "uncontrolled"

**Signals**:
- User needs form handling
- Asks about controlled vs uncontrolled
- Needs form validation

**Load**:
- @templates/form-controlled.tsx → Controlled form pattern
- @rules/typescript-essentials.md → Event types
- @templates/event-handlers.tsx → All event type examples

**Decision**: Form? → Use controlled pattern (easier to validate).

---

### Category 7: TypeScript Integration

**Keywords**: "TypeScript", "type", "interface", "generic", "props", "event", "children", "typing"

**Signals**:
- User asks about TypeScript with React
- Has type errors
- Needs to type props, events, or children

**Load**:
- @rules/typescript-essentials.md → Event types, children, generics
- @templates/function-component.tsx → Basic TypeScript component
- @templates/generic-component.tsx → Generic component example
- @templates/event-handlers.tsx → All event types

**Decision**: TypeScript question? → Load rules first for common mistakes.

---

### Category 8: Advanced Patterns

**Keywords**: "context", "provider", "ref", "forwardRef", "error boundary", "suspense", "lazy", "code split", "custom hook", "reusable hook"

**Signals**:
- User needs advanced React features
- Asks about Context API
- Needs ref forwarding
- Wants error boundaries or code splitting
- Wants to extract reusable logic into custom hook

**Load** (based on specific request):
- @templates/context-provider.tsx → Context pattern
- @templates/forward-ref.tsx → Ref forwarding
- @templates/error-boundary.tsx → Error catching
- @templates/suspense-lazy.tsx → Code splitting
- @templates/custom-hook.tsx → Custom hook patterns

---

### Category 9: Data Fetching

**Keywords**: "fetch", "api", "data", "loading", "async", "react query", "swr", "axios"

**Signals**:
- User needs to fetch data
- Asks about data fetching patterns
- Mentions loading/error states

**Load**:
- @decision-trees/data-fetching.md → Client vs server, library choice
- @templates/data-fetching-effect.tsx → Complete data fetching pattern
- @templates/component-with-effect.tsx → useEffect for fetching (basic)
- @decision-trees/effect-usage.md → When effects appropriate

**Decision Tree**:
```
Start: Where does data come from?
├─ External API
│   └─ Use data fetching library → @decision-trees/data-fetching.md
├─ Server component (Next.js/Remix)
│   └─ Use framework patterns (separate skill)
└─ Simple one-time fetch
    └─ useEffect with fetch → @templates/data-fetching-effect.tsx
```

---

## Multi-Category Requests

Some requests span multiple categories. Load all relevant files:

**Example**: "Create form with validation using TypeScript"
- Load: @templates/form-controlled.tsx (form pattern)
- Load: @rules/typescript-essentials.md (event types)
- Load: @templates/event-handlers.tsx (typed onChange)

**Example**: "Component with state that fetches data on mount"
- Load: @templates/component-with-state.tsx (useState pattern)
- Load: @templates/component-with-effect.tsx (useEffect pattern)
- Load: @rules/dependency-arrays.md (verify deps correct)

---

## Default Fallback

**If keywords don't match clearly**:
1. Load @templates/function-component.tsx (basic component)
2. Ask user for clarification about:
   - State needed?
   - Effects needed?
   - TypeScript?
   - Form/list/data fetching?

---

## Priority Order

When multiple files apply, load in this order:
1. **@rules/** (constraints first - prevent violations)
2. **@decision-trees/** (guide choices)
3. **@templates/** (working examples)
4. **@investigation/** (if context needed)
5. **@validation/** (verify after generation)

---

**Detection ensures agents load exactly what's needed for each request!**
