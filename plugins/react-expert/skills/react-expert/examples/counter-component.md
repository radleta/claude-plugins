# Example: Generating a Component with State

This example demonstrates the complete 4-step workflow for generating a React component with state management.

## User Request

"Create a counter component with increment/decrement"

---

## Step 1: Investigate

**Tool: Read** → `package.json`
```
React 18.2, TypeScript present
```

**Tool: Read** → `tsconfig.json`
```
strict mode enabled
```

**Tool: Grep** → "export" patterns
```
Team uses named exports
```

**Findings**:
- React 18.2 available (can use all React 18+ features)
- TypeScript enabled (need proper types)
- Named exports preferred (match project style)

---

## Step 2: Detect Pattern

**Keywords extracted**: "component", "state", "increment", "decrement"

**Pattern identified**: Component with local state (simple counter)

**Files to load**:
- @templates/component-with-state.tsx → Basic useState pattern
- @rules/immutable-updates.md → Ensure state updates correctly

---

## Step 3: Generate

**Using template** from @templates/component-with-state.tsx

**Adapted to project**:
- Named export (project convention)
- TypeScript types (strict mode)
- Function updater form (best practice)

```typescript
import { useState } from 'react';

interface CounterProps {
  initialValue?: number;
}

export function Counter({ initialValue = 0 }: CounterProps) {
  const [count, setCount] = useState(initialValue);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(prev => prev + 1)}>
        Increment
      </button>
      <button onClick={() => setCount(prev => prev - 1)}>
        Decrement
      </button>
    </div>
  );
}
```

---

## Step 4: Verify

**Verification against** @validation/ checklist:

- [x] Hooks at top level (useState called at component top level)
- [x] No conditions/loops around hooks
- [x] Immutable state update (setCount with function updater)
- [x] Props typed correctly (CounterProps interface)
- [x] Named export (matches project convention)
- [x] TypeScript types present (no `any`)
- [x] Event handlers typed correctly (implicit from onClick)
- [x] No array keys (not applicable)
- [x] No direct mutation (not applicable)
- [x] No missing dependencies (not applicable)

**Result**: ✅ All checks pass. Code is production-ready.

---

## Key Takeaways

**Investigation mattered**:
- Found TypeScript → Used proper types
- Found named exports → Matched convention
- Found React 18.2 → Could use modern features if needed

**Template saved time**:
- Correct useState pattern
- Function updater form (prevents stale closure bugs)
- Proper TypeScript types

**Verification caught potential issues**:
- Confirmed hook at top level
- Confirmed immutable updates
- Confirmed types correct

**This workflow prevents**:
- Top 10 Mistake #4: Direct state mutation (used function updater)
- Top 10 Mistake #6: Incorrect TypeScript types (proper event/prop types)
- Top 10 Mistake #7: Wrong state choice (useState appropriate for simple counter)

---

**See other examples**: Load @examples/ for more workflow examples
