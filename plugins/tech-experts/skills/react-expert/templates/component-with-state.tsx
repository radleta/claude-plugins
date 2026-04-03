# Template: Component with State

**When to Use**: Component needs to manage local state using `useState` hook.

**Complexity**: Low

**Common Mistakes Agents Make**:
- Not typing state variables explicitly when TypeScript can't infer
- Mutating state directly instead of using immutable updates
- Using one complex object when multiple simple state variables are clearer
- Not using functional updates when new state depends on previous state
- Forgetting to initialize state with proper default values

## Template

```typescript
import React, { useState } from 'react';

interface {{ComponentName}}Props {
  /**
   * Initial {{stateName}} value
   */
  initial{{StateName}}?: {{StateType}};

  /**
   * Callback when {{stateName}} changes
   */
  on{{StateName}}Change?: ({{stateName}}: {{StateType}}) => void;
}

/**
 * {{ComponentName}} - {{Description}}
 */
export function {{ComponentName}}({
  initial{{StateName}} = {{defaultValue}},
  on{{StateName}}Change,
}: {{ComponentName}}Props) {
  // Simple state variable
  const [{{stateName}}, set{{StateName}}] = useState<{{StateType}}>(initial{{StateName}});

  // Another state variable (different concern)
  const [{{anotherState}}, set{{AnotherState}}] = useState<{{AnotherType}}>({{anotherDefault}});

  // Boolean state (for toggles)
  const [{{isFlag}}, set{{IsFlag}}] = useState<boolean>(false);

  // Array state (for lists)
  const [{{items}}, set{{Items}}] = useState<{{ItemType}}[]>([]);

  // Object state (for complex data)
  const [{{objectState}}, set{{ObjectState}}] = useState<{{ObjectType}}>({
    {{property1}}: {{value1}},
    {{property2}}: {{value2}},
  });

  /**
   * Handle {{stateName}} update with immutable pattern
   */
  const handle{{StateName}}Update = (new{{StateName}}: {{StateType}}) => {
    // Update local state
    set{{StateName}}(new{{StateName}});

    // Notify parent if callback provided
    on{{StateName}}Change?.(new{{StateName}});
  };

  /**
   * Toggle boolean state
   */
  const toggle{{IsFlag}} = () => {
    set{{IsFlag}}(prev => !prev);
  };

  /**
   * Add item to array (immutable)
   */
  const add{{Item}} = (new{{Item}}: {{ItemType}}) => {
    set{{Items}}(prev => [...prev, new{{Item}}]);
  };

  /**
   * Remove item from array (immutable)
   */
  const remove{{Item}} = ({{itemId}}: string) => {
    set{{Items}}(prev => prev.filter(item => item.id !== {{itemId}}));
  };

  /**
   * Update item in array (immutable)
   */
  const update{{Item}} = ({{itemId}}: string, updates: Partial<{{ItemType}}>) => {
    set{{Items}}(prev =>
      prev.map(item =>
        item.id === {{itemId}} ? { ...item, ...updates } : item
      )
    );
  };

  /**
   * Update object state property (immutable)
   */
  const update{{ObjectState}}Property = (
    property: keyof {{ObjectType}},
    value: {{ObjectType}}[typeof property]
  ) => {
    set{{ObjectState}}(prev => ({
      ...prev,
      [property]: value,
    }));
  };

  /**
   * Functional update when new state depends on previous state
   */
  const increment{{Counter}} = () => {
    set{{StateName}}(prevCount => prevCount + 1);
  };

  return (
    <div className="{{component-name}}">
      <div>Current {{stateName}}: {{{stateName}}}</div>

      <button onClick={() => handle{{StateName}}Update({{newValue}})}>
        Update {{StateName}}
      </button>

      <button onClick={toggle{{IsFlag}}}>
        Toggle (Current: {{{isFlag}} ? 'ON' : 'OFF'})
      </button>

      <div>
        <h3>Items ({{{items}}.length})</h3>
        {{{items}}.map(item => (
          <div key={item.id}>
            {item.name}
            <button onClick={() => remove{{Item}}(item.id)}>Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Adaptation Rules

- [ ] Replace `{{ComponentName}}` with component name
- [ ] Replace `{{stateName}}`, `{{StateType}}` with actual state variable and type
- [ ] Remove state variables you don't need (keep relevant ones only)
- [ ] Use explicit type annotation `useState<Type>()` when initial value is `null` or TypeScript can't infer
- [ ] Use functional updates `setState(prev => ...)` when new state depends on old state
- [ ] Always use immutable update patterns (spread operator, map, filter)
- [ ] Choose descriptive names for setter functions (`setUser`, not `setU`)
- [ ] Initialize state with sensible defaults

## Related

- Rule: @rules/hooks-rules.md (useState best practices)
- Rule: @rules/immutable-updates.md (immutable state updates)
- Decision: @decision-trees/state-management.md (useState vs useReducer vs Context)
- Template: @templates/component-with-reducer.tsx (for complex state logic)

## Example: CounterWithHistory Component

```typescript
import React, { useState } from 'react';

interface CounterWithHistoryProps {
  /**
   * Initial counter value
   */
  initialCount?: number;

  /**
   * Callback when count changes
   */
  onCountChange?: (count: number) => void;
}

/**
 * CounterWithHistory - A counter that tracks its change history
 */
export function CounterWithHistory({
  initialCount = 0,
  onCountChange,
}: CounterWithHistoryProps) {
  // Number state
  const [count, setCount] = useState<number>(initialCount);

  // Array state for history
  const [history, setHistory] = useState<number[]>([initialCount]);

  // Boolean state for display mode
  const [showHistory, setShowHistory] = useState<boolean>(false);

  /**
   * Update count and add to history
   */
  const updateCount = (newCount: number) => {
    setCount(newCount);
    setHistory(prev => [...prev, newCount]);
    onCountChange?.(newCount);
  };

  /**
   * Increment using functional update
   * (new state depends on previous state)
   */
  const increment = () => {
    setCount(prev => {
      const newCount = prev + 1;
      setHistory(prevHistory => [...prevHistory, newCount]);
      onCountChange?.(newCount);
      return newCount;
    });
  };

  /**
   * Decrement using functional update
   */
  const decrement = () => {
    setCount(prev => {
      const newCount = prev - 1;
      setHistory(prevHistory => [...prevHistory, newCount]);
      onCountChange?.(newCount);
      return newCount;
    });
  };

  /**
   * Reset to initial value
   */
  const reset = () => {
    updateCount(initialCount);
  };

  /**
   * Clear history
   */
  const clearHistory = () => {
    setHistory([count]);
  };

  /**
   * Toggle history display
   */
  const toggleHistory = () => {
    setShowHistory(prev => !prev);
  };

  return (
    <div className="counter-with-history">
      <div className="counter-display">
        <h2>Count: {count}</h2>
      </div>

      <div className="counter-controls">
        <button onClick={decrement}>-</button>
        <button onClick={increment}>+</button>
        <button onClick={reset}>Reset</button>
      </div>

      <div className="history-controls">
        <button onClick={toggleHistory}>
          {showHistory ? 'Hide' : 'Show'} History
        </button>
        <button onClick={clearHistory}>Clear History</button>
      </div>

      {showHistory && (
        <div className="history-display">
          <h3>History ({history.length} changes)</h3>
          <ul>
            {history.map((value, index) => (
              <li key={index}>
                Change {index + 1}: {value}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

## Notes

### When to Use Functional Updates

Use `setState(prev => ...)` when:
- New state depends on previous state (`count + 1`)
- Inside async callbacks or event handlers
- Updating state in rapid succession
- Preventing stale closure issues

```typescript
// ❌ Avoid (can use stale state)
const increment = () => {
  setCount(count + 1);
};

// ✅ Prefer (always uses latest state)
const increment = () => {
  setCount(prev => prev + 1);
};
```

### Immutable Array Updates

Always create new arrays, never mutate:

```typescript
// ❌ Wrong (mutates state)
const addItem = (item) => {
  items.push(item);
  setItems(items);
};

// ✅ Correct (immutable)
const addItem = (item) => {
  setItems(prev => [...prev, item]);
};

// ❌ Wrong (mutates during filter)
const removeItem = (id) => {
  const index = items.findIndex(item => item.id === id);
  items.splice(index, 1);
  setItems(items);
};

// ✅ Correct (immutable)
const removeItem = (id) => {
  setItems(prev => prev.filter(item => item.id !== id));
};
```

### Immutable Object Updates

Use spread operator for shallow updates:

```typescript
// ✅ Update single property
setUser(prev => ({
  ...prev,
  name: 'New Name'
}));

// ✅ Update nested property
setUser(prev => ({
  ...prev,
  address: {
    ...prev.address,
    city: 'New City'
  }
}));
```

### Type Annotation Requirements

Explicit type needed when initial value doesn't match final type:

```typescript
// ❌ TypeScript infers string | null, which is correct but may need explicit
const [user, setUser] = useState(null);

// ✅ Explicit type annotation
const [user, setUser] = useState<User | null>(null);

// ✅ TypeScript can infer from initial value
const [count, setCount] = useState(0); // inferred as number
const [items, setItems] = useState<Item[]>([]); // explicit for empty array
```
