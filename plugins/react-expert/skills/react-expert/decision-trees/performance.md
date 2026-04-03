# Performance Optimization Decision Tree

## When to Use This Tree

Use this tree when considering whether to optimize React component performance. **Most important rule: Only optimize when you have a measured problem.** Premature optimization adds complexity for no benefit.

## The Core Question

**"Is there a measured performance problem, and if so, what's the root cause?"**

---

## The Decision Tree

```
Start: Is there a MEASURED performance problem?
│
├─ NO → Do you have hard evidence (React Profiler, user metrics)?
│   └─ → DON'T OPTIMIZE! Ship the feature first, measure later.
│
└─ YES → What does React Profiler show as the bottleneck?
    │
    ├─ Component re-renders unnecessarily
    │   │
    │   ├─ Props haven't actually changed, but component still re-renders?
    │   │   └─ → Wrap component with React.memo
    │   │
    │   └─ Props are new objects/arrays each render (reference changes)?
    │       │
    │       ├─ Object/array created in parent?
    │       │   └─ → useMemo the prop in parent component
    │       │
    │       └─ Inline object in JSX?
    │           └─ → Extract to variable or useMemo
    │
    ├─ Expensive calculation runs on every render
    │   │
    │   ├─ Calculation uses props/state as inputs?
    │   │   └─ → Wrap calculation in useMemo
    │   │
    │   └─ Calculation is truly static (no dependencies)?
    │       └─ → Move outside component or use constant
    │
    ├─ Passing callback props causing unnecessary child re-renders
    │   │
    │   ├─ Child is wrapped in React.memo?
    │   │   └─ → Wrap callback in useCallback
    │   │
    │   └─ Child is not memoized?
    │       └─ → useCallback won't help! Memoize child first.
    │
    └─ Large list rendering slowly (1000+ items)
        │
        ├─ All items visible in viewport?
        │   │
        │   ├─ Can you paginate or lazy-load?
        │   │   └─ → Implement pagination
        │   │
        │   └─ Must show all items?
        │       └─ → Profile to find actual bottleneck (likely not list rendering)
        │
        └─ Most items not visible (scrollable list)?
            └─ → Use virtualization (react-window or react-virtual)
```

---

## Code Examples for Each Solution

### Solution 1: DON'T OPTIMIZE (Most Important!)

**When:** No measured performance problem

```typescript
// ✅ This is FINE! Don't optimize yet.
function UserList({ users }: Props) {
  return (
    <div>
      {users.map(user => (
        <UserCard key={user.id} user={user} />
      ))}
    </div>
  );
}

function UserCard({ user }: Props) {
  return (
    <div>
      <h3>{user.name}</h3>
      <p>{user.email}</p>
    </div>
  );
}

// Don't add React.memo, useMemo, or useCallback unless you measure a problem!
```

**Why not optimize:**
- Modern React is fast enough for most UIs
- Optimization adds code complexity
- Memoization has overhead (memory + comparison cost)
- You might optimize the wrong thing

**When to measure:**
- User reports slowness
- You notice lag in UI interactions
- Lighthouse/Core Web Vitals show issues

---

### Solution 2: React.memo for unnecessary re-renders

**When:** Props haven't changed but component re-renders

```typescript
// ❌ BEFORE - Child re-renders when parent count changes
function Parent() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <button onClick={() => setCount(count + 1)}>Count: {count}</button>
      <ExpensiveChild data="static" /> {/* Re-renders even though props didn't change! */}
    </div>
  );
}

function ExpensiveChild({ data }: Props) {
  // Expensive rendering logic here
  const result = doExpensiveCalculation(data);
  return <div>{result}</div>;
}

// ✅ AFTER - Child only re-renders when props change
const ExpensiveChild = memo(function ExpensiveChild({ data }: Props) {
  const result = doExpensiveCalculation(data);
  return <div>{result}</div>;
});

// ✅ Custom comparison function (advanced)
const ExpensiveChild = memo(
  function ExpensiveChild({ user }: Props) {
    return <div>{user.name}</div>;
  },
  (prevProps, nextProps) => {
    // Return true if props are equal (skip re-render)
    return prevProps.user.id === nextProps.user.id;
  }
);
```

**When to use:**
- Component render time >16ms (one frame) measured in React Profiler
- Parent re-renders often (>5 times per user interaction)
- Props rarely change (<20% of renders)
- React Profiler shows unnecessary re-renders

**When NOT to use:**
- Props change frequently (>80% of renders)
- Component render time <16ms (measured in Profiler)
- You haven't measured a problem

---

### Solution 3: useMemo for props to prevent reference changes

**When:** Creating objects/arrays in parent causes child re-renders

```typescript
// ❌ BEFORE - New object every render, breaks memoization
function Parent() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <button onClick={() => setCount(count + 1)}>Count: {count}</button>
      <ExpensiveChild
        options={{ theme: 'dark', size: 'large' }} // NEW object every render!
      />
    </div>
  );
}

const ExpensiveChild = memo(function ExpensiveChild({ options }: Props) {
  // This still re-renders every time! memo doesn't help because options is always new
  return <div>Theme: {options.theme}</div>;
});

// ✅ AFTER - useMemo keeps same reference
function Parent() {
  const [count, setCount] = useState(0);

  const options = useMemo(
    () => ({ theme: 'dark', size: 'large' }),
    [] // Empty deps - same object every render
  );

  return (
    <div>
      <button onClick={() => setCount(count + 1)}>Count: {count}</button>
      <ExpensiveChild options={options} /> {/* Now memo works! */}
    </div>
  );
}

// ✅ ALTERNATIVE - Extract to constant if truly static
const OPTIONS = { theme: 'dark', size: 'large' };

function Parent() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <button onClick={() => setCount(count + 1)}>Count: {count}</button>
      <ExpensiveChild options={OPTIONS} />
    </div>
  );
}
```

**When to use:**
- Child is memoized with React.memo
- Passing objects/arrays as props
- Props are derived from state/props

---

### Solution 4: useMemo for expensive calculations

**When:** Heavy computation runs every render unnecessarily

```typescript
// ❌ BEFORE - Expensive calculation on every render
function DataTable({ data, filters }: Props) {
  // This runs on EVERY render, even if data/filters didn't change!
  const sortedAndFiltered = data
    .filter(item => filters.every(f => f.fn(item)))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <table>
      {sortedAndFiltered.map(item => (
        <tr key={item.id}><td>{item.name}</td></tr>
      ))}
    </table>
  );
}

// ✅ AFTER - Memoized calculation
function DataTable({ data, filters }: Props) {
  const sortedAndFiltered = useMemo(() => {
    console.log('Recalculating...'); // Only logs when data or filters change
    return data
      .filter(item => filters.every(f => f.fn(item)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data, filters]);

  return (
    <table>
      {sortedAndFiltered.map(item => (
        <tr key={item.id}><td>{item.name}</td></tr>
      ))}
    </table>
  );
}
```

**How to know if calculation is expensive:**
```typescript
function Component() {
  const start = performance.now();
  const result = expensiveCalculation();
  const end = performance.now();
  console.log(`Calculation took ${end - start}ms`);

  // If > 1-2ms consistently, consider useMemo
  // If < 1ms, don't bother
}
```

---

### Solution 5: useCallback for callback props

**When:** Passing callbacks to memoized children

```typescript
// ❌ BEFORE - New function every render breaks child memo
function Parent() {
  const [items, setItems] = useState([]);

  return (
    <div>
      <ExpensiveChild
        onAdd={(item) => setItems([...items, item])} // NEW function every render!
      />
    </div>
  );
}

const ExpensiveChild = memo(function ExpensiveChild({ onAdd }: Props) {
  // Still re-renders every time because onAdd is always new
  return <button onClick={() => onAdd('new')}>Add</button>;
});

// ✅ AFTER - useCallback preserves function reference
function Parent() {
  const [items, setItems] = useState([]);

  const handleAdd = useCallback(
    (item: string) => {
      setItems([...items, item]);
    },
    [items] // Recreate when items changes
  );

  return (
    <div>
      <ExpensiveChild onAdd={handleAdd} /> {/* Now memo works! */}
    </div>
  );
}

// ✅ BETTER - Use functional update to remove dependency
function Parent() {
  const [items, setItems] = useState([]);

  const handleAdd = useCallback(
    (item: string) => {
      setItems(prevItems => [...prevItems, item]); // No dependency on items!
    },
    [] // Never recreates!
  );

  return (
    <div>
      <ExpensiveChild onAdd={handleAdd} />
    </div>
  );
}
```

**Important:** useCallback only helps if child is memoized!

---

### Solution 6: Virtualization for large lists

**When:** Rendering 1000+ items in a scrollable list

```typescript
// ❌ BEFORE - Rendering 10,000 items (slow!)
function MessageList({ messages }: Props) {
  return (
    <div style={{ height: '600px', overflow: 'auto' }}>
      {messages.map(msg => (
        <MessageItem key={msg.id} message={msg} />
      ))}
    </div>
  );
}

// ✅ AFTER - Only render visible items
import { FixedSizeList } from 'react-window';

function MessageList({ messages }: Props) {
  return (
    <FixedSizeList
      height={600}
      itemCount={messages.length}
      itemSize={50}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          <MessageItem message={messages[index]} />
        </div>
      )}
    </FixedSizeList>
  );
}

// ✅ Variable size items (more complex)
import { VariableSizeList } from 'react-window';

function MessageList({ messages }: Props) {
  const getItemSize = (index: number) => {
    // Calculate height based on content
    return messages[index].text.length > 100 ? 80 : 50;
  };

  return (
    <VariableSizeList
      height={600}
      itemCount={messages.length}
      itemSize={getItemSize}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          <MessageItem message={messages[index]} />
        </div>
      )}
    </VariableSizeList>
  );
}
```

**When to use:**
- Lists with 1000+ items
- Scrollable container
- Items have predictable heights

**When NOT to use:**
- Small lists (< 100 items)
- All items visible (no scrolling)
- Items have wildly varying, unpredictable heights

---

## Antipatterns: When Optimization Makes Things Worse

### Antipattern 1: Memoizing everything "just in case"

❌ **WRONG:**
```typescript
function Component({ name }: Props) {
  // Unnecessary memoization adds overhead!
  const greeting = useMemo(() => `Hello, ${name}`, [name]);
  const handleClick = useCallback(() => console.log(name), [name]);

  return <button onClick={handleClick}>{greeting}</button>;
}
```

✅ **RIGHT:**
```typescript
function Component({ name }: Props) {
  // Simple operations should NOT be memoized
  const greeting = `Hello, ${name}`;
  const handleClick = () => console.log(name);

  return <button onClick={handleClick}>{greeting}</button>;
}
```

**Why it's wrong:** Memoization has overhead (memory + comparison). For cheap operations, the overhead costs more than the operation itself.

---

### Antipattern 2: useCallback without React.memo

❌ **WRONG:**
```typescript
function Parent() {
  const handleClick = useCallback(() => {
    console.log('clicked');
  }, []);

  return <Child onClick={handleClick} />; // Child is NOT memoized!
}

function Child({ onClick }: Props) {
  return <button onClick={onClick}>Click</button>;
}
```

✅ **RIGHT - Remove useCallback:**
```typescript
function Parent() {
  const handleClick = () => console.log('clicked');
  return <Child onClick={handleClick} />;
}
```

**OR - If Child is expensive, memoize it:**
```typescript
const Child = memo(function Child({ onClick }: Props) {
  return <button onClick={onClick}>Click</button>;
});

function Parent() {
  const handleClick = useCallback(() => console.log('clicked'), []);
  return <Child onClick={handleClick} />;
}
```

**Why it's wrong:** useCallback only helps prevent re-renders if child is memoized. Otherwise, you're adding overhead for no benefit.

---

### Antipattern 3: Wrong dependencies in useMemo

❌ **WRONG:**
```typescript
function Component({ items }: Props) {
  // Missing 'items' dependency!
  const sorted = useMemo(() => {
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }, []); // BUG: Will only sort once, ignoring new items!

  return <List items={sorted} />;
}
```

✅ **RIGHT:**
```typescript
function Component({ items }: Props) {
  const sorted = useMemo(() => {
    return [...items].sort((a, b) => a.name.localeCompare(b.name));
  }, [items]); // Correctly depends on items

  return <List items={sorted} />;
}
```

**Why it's wrong:** Missing dependencies causes stale values. Always include all dependencies (ESLint will warn you).

---

### Antipattern 4: Memoizing props that change constantly

❌ **WRONG:**
```typescript
function Parent() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY }); // Changes constantly!
    },
    []
  );

  // Child re-renders every mouse move anyway!
  return <ExpensiveChild position={mousePos} />;
}

const ExpensiveChild = memo(function ExpensiveChild({ position }: Props) {
  return <div>{position.x}, {position.y}</div>;
});
```

✅ **RIGHT - Don't memo when props change constantly:**
```typescript
function Parent() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // No useCallback needed - child will re-render anyway
  const handleMouseMove = (e: MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  // Remove memo - it's checking on every mouse move for nothing
  return <Child position={mousePos} />;
}

function Child({ position }: Props) {
  return <div>{position.x}, {position.y}</div>;
}
```

**Why it's wrong:** If props change frequently, memoization checks run constantly with no benefit. You pay the overhead cost without the benefit.

---

### Antipattern 5: Over-engineering with multiple optimization layers

❌ **WRONG:**
```typescript
// Too much optimization!
const Button = memo(function Button({ onClick, label }: Props) {
  const handleClick = useCallback(() => {
    onClick();
  }, [onClick]);

  const displayLabel = useMemo(() => label.toUpperCase(), [label]);

  return <button onClick={handleClick}>{displayLabel}</button>;
});
```

✅ **RIGHT:**
```typescript
// Simple is better
function Button({ onClick, label }: Props) {
  return <button onClick={onClick}>{label.toUpperCase()}</button>;
}
```

**Why it's wrong:** Stacking multiple optimizations adds complexity and often provides no benefit. Start simple, add optimization only when measured.

---

## Performance Measurement Guide

### Use React Profiler

```typescript
// Wrap your app to collect performance data
import { Profiler } from 'react';

function onRenderCallback(
  id: string,
  phase: 'mount' | 'update',
  actualDuration: number,
  baseDuration: number,
  startTime: number,
  commitTime: number
) {
  console.log(`${id} (${phase}) took ${actualDuration}ms`);
}

<Profiler id="App" onRender={onRenderCallback}>
  <App />
</Profiler>
```

### Use Browser DevTools

1. Open React DevTools
2. Go to "Profiler" tab
3. Click record
4. Interact with your app
5. Stop recording
6. Analyze the flame graph:
   - **Gray bars** = components that didn't render
   - **Colored bars** = components that rendered (taller = slower)
   - **Ranked chart** = sort components by render time

### Set Performance Budgets

```typescript
// Example: Warn if component takes > 16ms (one frame at 60fps)
if (actualDuration > 16) {
  console.warn(`${id} took ${actualDuration}ms - too slow!`);
}
```

---

## Decision Criteria Summary

| Problem | Solution | When to Use |
|---------|----------|-------------|
| No measured issue | Do nothing | Always start here |
| Unnecessary re-renders | React.memo | Props rarely change, expensive render |
| Object/array props | useMemo props | Child is memoized |
| Expensive calculation | useMemo | Calculation > 1-2ms |
| Callback props | useCallback | Child is memoized |
| Large lists (1000+ items) | Virtualization | Scrollable container |

---

## Optimization Priority Order

1. **Measure first** - Use React Profiler, don't guess
2. **Architectural fixes** - Move state down, split components
3. **Code splitting** - Lazy load routes/components
4. **Virtualization** - For large lists
5. **React.memo** - For expensive components
6. **useMemo** - For expensive calculations
7. **useCallback** - Only with React.memo

---

## When to Consider Architectural Changes Instead

Sometimes the problem isn't optimization, it's architecture:

**Consider refactoring if:**
- State is too high in component tree (move state down)
- One component does too much (split into smaller components)
- Prop drilling is excessive (use Context)
- Too many dependencies (simplify data flow)

---

## See Also

- `@rules/performance-traps.md` - Common performance mistakes
- `@decision-trees/state-management.md` - Choosing the right state approach
- `@rules/dependency-arrays.md` - useMemo and useCallback dependencies
