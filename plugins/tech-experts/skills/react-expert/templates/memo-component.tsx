# Template: React.memo Component

**When to Use**: Preventing unnecessary re-renders of expensive components when props haven't changed.

**Complexity**: Medium

**Common Mistakes Agents Make**:
- Overusing React.memo on every component (premature optimization)
- Not understanding when React.memo helps (props must be stable)
- Using React.memo with unstable props (new objects/functions every render)
- Not providing custom comparison function when needed
- Wrapping components that always render differently

## Template

```typescript
import React, { memo } from 'react';

/**
 * Props for {{ComponentName}}
 */
interface {{ComponentName}}Props {
  {{propName}}: {{PropType}};
  {{onEvent}}?: ({{param}}: {{ParamType}}) => void;
}

/**
 * {{ComponentName}} - Memoized component
 *
 * Only re-renders when props change (shallow comparison)
 */
export const {{ComponentName}} = memo(function {{ComponentName}}({
  {{propName}},
  {{onEvent}},
}: {{ComponentName}}Props) {
  console.log('{{ComponentName}} rendered');

  return (
    <div className="{{component-name}}">
      {/* Component content */}
    </div>
  );
});

// Display name for dev tools
{{ComponentName}}.displayName = '{{ComponentName}}';
```

## Template with Custom Comparison

```typescript
import React, { memo } from 'react';

interface {{ComponentName}}Props {
  {{complexProp}}: {{ComplexType}};
  {{otherProp}}: {{OtherType}};
}

/**
 * Custom comparison function
 * Returns true if props are equal (skip re-render)
 * Returns false if props are different (re-render)
 */
function arePropsEqual(
  prev: {{ComponentName}}Props,
  next: {{ComponentName}}Props
): boolean {
  // Custom comparison logic
  // For example: deep comparison of specific properties

  // Compare simple props
  if (prev.{{otherProp}} !== next.{{otherProp}}) {
    return false;
  }

  // Deep comparison of complex prop
  if (prev.{{complexProp}}.{{property1}} !== next.{{complexProp}}.{{property1}}) {
    return false;
  }

  // All relevant props are equal
  return true;
}

/**
 * {{ComponentName}} with custom comparison
 */
export const {{ComponentName}} = memo(
  function {{ComponentName}}({ {{complexProp}}, {{otherProp}} }: {{ComponentName}}Props) {
    return (
      <div>
        {/* Component content */}
      </div>
    );
  },
  arePropsEqual // Custom comparison function
);

{{ComponentName}}.displayName = '{{ComponentName}}';
```

## Adaptation Rules

- [ ] Replace `{{ComponentName}}` with actual component name
- [ ] Only use memo for expensive components that render frequently
- [ ] Ensure props are stable (no new objects/arrays/functions on every render)
- [ ] Use custom comparison function for complex props if needed
- [ ] Profile before and after to verify performance improvement
- [ ] Add displayName for better debugging

## Related

- Rule: @rules/performance-traps.md (when NOT to optimize)
- Rule: @rules/dependency-arrays.md (useMemo and useCallback)
- Decision: @decision-trees/performance.md (when to use React.memo)

## Example: Expensive List Item

```typescript
import React, { memo, useState } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

interface UserCardProps {
  user: User;
  onSelect: (userId: string) => void;
}

/**
 * UserCard - Memoized to prevent re-render when parent updates
 *
 * Without memo: Re-renders every time parent's state changes
 * With memo: Only re-renders when user or onSelect changes
 */
export const UserCard = memo(function UserCard({ user, onSelect }: UserCardProps) {
  console.log(`UserCard rendered for ${user.name}`);

  return (
    <div className="user-card" onClick={() => onSelect(user.id)}>
      <img src={user.avatar} alt={user.name} />
      <h3>{user.name}</h3>
      <p>{user.email}</p>
    </div>
  );
});

UserCard.displayName = 'UserCard';

/**
 * Parent component
 */
function UserList() {
  const [users] = useState<User[]>([
    { id: '1', name: 'Alice', email: 'alice@example.com', avatar: '/alice.jpg' },
    { id: '2', name: 'Bob', email: 'bob@example.com', avatar: '/bob.jpg' },
  ]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [counter, setCounter] = useState(0);

  // ⚠️ Problem: Creates new function on every render
  // This breaks memo because onSelect prop is always different
  // const handleSelect = (userId: string) => {
  //   setSelectedId(userId);
  // };

  // ✅ Solution: Memoize callback with useCallback
  const handleSelect = useCallback((userId: string) => {
    setSelectedId(userId);
  }, []);

  return (
    <div>
      <button onClick={() => setCounter(c => c + 1)}>
        Counter: {counter}
      </button>

      <div>
        {/* UserCard only re-renders when user or handleSelect changes */}
        {/* Clicking counter button doesn't re-render UserCards */}
        {users.map(user => (
          <UserCard
            key={user.id}
            user={user}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </div>
  );
}
```

## Example: Custom Comparison for Complex Props

```typescript
import React, { memo } from 'react';

interface ChartData {
  values: number[];
  labels: string[];
  metadata: {
    title: string;
    color: string;
  };
}

interface ChartProps {
  data: ChartData;
  width: number;
  height: number;
}

/**
 * Custom comparison: Only re-render if values or dimensions change
 * Ignore metadata changes
 */
function areChartPropsEqual(prev: ChartProps, next: ChartProps): boolean {
  // Check dimensions
  if (prev.width !== next.width || prev.height !== next.height) {
    return false;
  }

  // Check data values length
  if (prev.data.values.length !== next.data.values.length) {
    return false;
  }

  // Check each value
  for (let i = 0; i < prev.data.values.length; i++) {
    if (prev.data.values[i] !== next.data.values[i]) {
      return false;
    }
  }

  // Ignore metadata changes (title, color don't affect chart data)
  // This is the custom part - normal React.memo would re-render on metadata change

  return true; // Props are equal, skip re-render
}

/**
 * Chart - Expensive component with custom comparison
 */
export const Chart = memo(
  function Chart({ data, width, height }: ChartProps) {
    console.log('Chart rendered');

    // Expensive rendering logic
    return (
      <svg width={width} height={height}>
        {/* Chart visualization */}
      </svg>
    );
  },
  areChartPropsEqual
);

Chart.displayName = 'Chart';
```

## Example: When NOT to Use Memo

```typescript
// ❌ Don't use memo here - component is simple and fast
const SimpleText = memo(function SimpleText({ text }: { text: string }) {
  return <p>{text}</p>;
});

// ❌ Don't use memo here - props change on every render anyway
const CurrentTime = memo(function CurrentTime({ time }: { time: Date }) {
  return <div>{time.toLocaleTimeString()}</div>;
});

// ❌ Don't use memo with unstable props
function Parent() {
  return (
    <MemoizedChild
      data={{ value: 123 }} // New object every render!
      onClick={() => {}} // New function every render!
    />
  );
}

// ✅ Use memo for expensive components with stable props
function Parent() {
  const data = useMemo(() => ({ value: 123 }), []);
  const onClick = useCallback(() => {}, []);

  return (
    <MemoizedChild
      data={data} // Stable reference
      onClick={onClick} // Stable reference
    />
  );
}
```

## Notes

### When to Use React.memo

**Good candidates:**
- Expensive components (complex calculations, heavy rendering)
- Components that render frequently
- Components in lists
- Components with stable props
- Pure functional components

**Bad candidates:**
- Simple, fast components
- Components that always render with different props
- Components with frequently changing props
- Components with unstable props (new objects/functions)

### Memo vs useMemo vs useCallback

```typescript
// React.memo - Wrap entire component
const MyComponent = memo(function MyComponent(props) {
  return <div>...</div>;
});

// useMemo - Memoize computed value
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(a, b);
}, [a, b]);

// useCallback - Memoize function
const handleClick = useCallback(() => {
  doSomething(value);
}, [value]);
```

### Props Must Be Stable

React.memo is useless if props change every render:

```typescript
// ❌ Props unstable - memo has no effect
function Parent() {
  return (
    <MemoChild
      data={{ x: 1 }} // New object every render
      onClick={() => {}} // New function every render
    />
  );
}

// ✅ Props stable - memo works
function Parent() {
  const data = useMemo(() => ({ x: 1 }), []);
  const onClick = useCallback(() => {}, []);

  return (
    <MemoChild
      data={data}
      onClick={onClick}
    />
  );
}
```

### Shallow Comparison

Default React.memo uses shallow comparison:

```typescript
// These changes trigger re-render:
prev.name !== next.name // ✓ Different value
prev.data !== next.data // ✓ Different reference

// These DON'T trigger re-render:
// (even if contents changed, references are same)
prev.data === next.data // Same reference, even if data.value changed internally
```

### Profiling First

Always profile before optimizing:

```typescript
// 1. Use React DevTools Profiler
// 2. Identify slow components
// 3. Apply memo to those components
// 4. Measure improvement
// 5. Keep if beneficial, remove if not
```

### Display Name

Always add displayName for debugging:

```typescript
export const MyComponent = memo(function MyComponent(props) {
  return <div>...</div>;
});

// Shows "MyComponent" in React DevTools
MyComponent.displayName = 'MyComponent';
```
