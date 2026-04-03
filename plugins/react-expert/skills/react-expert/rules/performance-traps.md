# Performance Traps

React is fast by default, but certain patterns cause unnecessary re-renders that slow down the UI. These aren't bugs - the app still works - but they create janky interactions, slow responses, and poor user experience.

**The golden rule**: Don't create new objects, arrays, or functions during render unless necessary.

---

## Rule 1: Don't Create New Objects/Arrays in Render

**Statement**: Creating new objects or arrays during render causes child components to re-render unnecessarily because the reference changes every time.

### Why This Matters

React uses reference equality (`===`) to check if props changed. New object/array = new reference = prop "changed" = child re-renders, even if the data inside is identical.

### ❌ WRONG: New Object on Every Render

```typescript
function UserProfile({ userId }: { userId: string }) {
  const [userData, setUserData] = useState<User | null>(null);

  // WRONG: New object created every render
  const config = {
    showAvatar: true,
    showBio: true,
    theme: 'light'
  };

  return <UserDisplay user={userData} config={config} />;
}
```

**What breaks**:
- Every render creates new config object
- config reference changes: `{...} !== {...}`
- UserDisplay receives "new" prop, re-renders
- UserDisplay re-renders even if user prop didn't change
- **Symptom**: Unnecessary re-renders, janky UI

### ❌ WRONG: New Array on Every Render

```typescript
function Dashboard() {
  const [data, setData] = useState(initialData);

  // WRONG: New array created every render
  const filters = ['active', 'pending', 'completed'];

  return <DataTable data={data} filters={filters} />;
}
```

**What breaks**:
- Every render creates new filters array
- DataTable receives "new" filters prop, re-renders
- **Symptom**: Unnecessary re-renders

### ✅ CORRECT: Move Constant Outside Component

```typescript
// Define constant outside component - created once
const CONFIG = {
  showAvatar: true,
  showBio: true,
  theme: 'light'
};

function UserProfile({ userId }: { userId: string }) {
  const [userData, setUserData] = useState<User | null>(null);

  // Same reference every render
  return <UserDisplay user={userData} config={CONFIG} />;
}
```

**Why this works**: CONFIG created once, same reference every render, UserDisplay only re-renders when user changes.

### ✅ CORRECT: Memoize with useMemo

```typescript
function Dashboard() {
  const [data, setData] = useState(initialData);

  // Memoized - same reference unless dependencies change
  const filters = useMemo(() => ['active', 'pending', 'completed'], []);

  return <DataTable data={data} filters={filters} />;
}
```

**Why this works**: useMemo returns same array reference unless dependencies change (empty deps = never changes).

### ✅ CORRECT: Derive Props Inline When Child is Memoized

```typescript
const UserDisplay = React.memo(({ user, config }: Props) => {
  // Component implementation
});

function UserProfile({ userId }: { userId: string }) {
  const [userData, setUserData] = useState<User | null>(null);

  // OK if UserDisplay is memoized and checks props deeply
  return (
    <UserDisplay
      user={userData}
      config={{ showAvatar: true, showBio: true }}
    />
  );
}
```

**Why this works**: If UserDisplay is memoized with custom comparison, it can handle new object references. But this is advanced - usually better to memoize the prop.

---

## Rule 2: Don't Create New Functions in Render

**Statement**: Creating new functions during render causes child components to re-render unnecessarily because the function reference changes every time.

### Why This Matters

Functions are objects. New function = new reference = prop changed = child re-renders.

### ❌ WRONG: New Function on Every Render

```typescript
function TodoList({ todos }: { todos: Todo[] }) {
  const [filter, setFilter] = useState('all');

  // WRONG: New function created every render
  const handleToggle = (id: string) => {
    toggleTodo(id);
  };

  return (
    <div>
      {todos.map(todo => (
        <TodoItem key={todo.id} todo={todo} onToggle={handleToggle} />
      ))}
    </div>
  );
}
```

**What breaks**:
- Every render creates new handleToggle function
- All TodoItem components receive "new" onToggle prop
- All TodoItem components re-render, even if their todo didn't change
- **Symptom**: Entire list re-renders on every parent render

### ❌ WRONG: Inline Function Prop

```typescript
function TodoList({ todos }: { todos: Todo[] }) {
  return (
    <div>
      {todos.map(todo => (
        <TodoItem
          key={todo.id}
          todo={todo}
          // WRONG: New function for every item, every render
          onToggle={() => toggleTodo(todo.id)}
        />
      ))}
    </div>
  );
}
```

**What breaks**:
- Every render creates new function for every todo
- With 100 todos, 100 new functions created
- All TodoItems re-render
- **Symptom**: Poor performance with large lists

### ✅ CORRECT: Memoize with useCallback

```typescript
function TodoList({ todos }: { todos: Todo[] }) {
  const [filter, setFilter] = useState('all');

  // Memoized - same reference unless dependencies change
  const handleToggle = useCallback((id: string) => {
    toggleTodo(id);
  }, []); // Empty deps - function never changes

  return (
    <div>
      {todos.map(todo => (
        <TodoItem key={todo.id} todo={todo} onToggle={handleToggle} />
      ))}
    </div>
  );
}
```

**Why this works**: useCallback returns same function reference. TodoItems only re-render when their todo changes.

### ✅ CORRECT: Memoize with Dependencies

```typescript
function SearchForm({ initialQuery }: { initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);

  // Memoized - new function only when query changes
  const handleSearch = useCallback(() => {
    performSearch(query);
  }, [query]); // New function only when query changes

  return <SearchButton onSearch={handleSearch} />;
}
```

**Why this works**: Function only changes when query changes. SearchButton doesn't re-render unnecessarily.

### ✅ CORRECT: Pass Stable Function from Props

```typescript
interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string) => void; // Stable function from parent
}

const TodoItem = React.memo(({ todo, onToggle }: TodoItemProps) => {
  return (
    <div>
      <input
        type="checkbox"
        checked={todo.done}
        // Can inline here - passes id to stable function
        onChange={() => onToggle(todo.id)}
      />
      {todo.text}
    </div>
  );
});
```

**Why this works**: If onToggle is stable (memoized in parent), the inline arrow function is fine. React.memo prevents re-render if props haven't changed.

---

## Rule 3: Memoize Child Components When Appropriate

**Statement**: Wrap components in React.memo when they receive complex props or are expensive to render, to prevent unnecessary re-renders.

### Why This Matters

By default, when parent re-renders, all children re-render - even if their props didn't change. React.memo prevents re-render if props haven't changed (shallow comparison).

### ❌ WRONG: No Memoization for Expensive Component

```typescript
function ExpensiveItem({ data }: { data: ItemData }) {
  // Expensive computation or rendering
  const processed = expensiveProcessing(data);

  return (
    <div>
      {processed.map(item => <div key={item.id}>{item.name}</div>)}
    </div>
  );
}

function ItemList({ items }: { items: ItemData[] }) {
  const [filter, setFilter] = useState('');

  return (
    <div>
      <input value={filter} onChange={e => setFilter(e.target.value)} />
      {items.map(item => (
        <ExpensiveItem key={item.id} data={item} />
      ))}
    </div>
  );
}
```

**What breaks**:
- User types in filter input
- ItemList re-renders on every keystroke
- All ExpensiveItem components re-render
- Expensive processing runs for every item, every keystroke
- **Symptom**: Laggy typing, slow UI

### ✅ CORRECT: Memoize Expensive Component

```typescript
// Memoize with React.memo
const ExpensiveItem = React.memo(({ data }: { data: ItemData }) => {
  const processed = expensiveProcessing(data);

  return (
    <div>
      {processed.map(item => <div key={item.id}>{item.name}</div>)}
    </div>
  );
});

function ItemList({ items }: { items: ItemData[] }) {
  const [filter, setFilter] = useState('');

  return (
    <div>
      <input value={filter} onChange={e => setFilter(e.target.value)} />
      {items.map(item => (
        <ExpensiveItem key={item.id} data={item} />
      ))}
    </div>
  );
}
```

**Why this works**: React.memo prevents ExpensiveItem from re-rendering unless data prop changes. Items only re-render when their data actually changes.

### ✅ CORRECT: Memoize with Custom Comparison

```typescript
const ExpensiveItem = React.memo(
  ({ data }: { data: ItemData }) => {
    const processed = expensiveProcessing(data);
    return <div>...</div>;
  },
  (prevProps, nextProps) => {
    // Custom comparison - only re-render if data.id or data.updatedAt changed
    return (
      prevProps.data.id === nextProps.data.id &&
      prevProps.data.updatedAt === nextProps.data.updatedAt
    );
  }
);
```

**Why this works**: Custom comparison gives fine-grained control. Component only re-renders when specific properties change.

### When to Use React.memo

**Use React.memo when**:
- Component is expensive to render
- Component receives complex props (objects, arrays, functions)
- Component is rendered many times (in a list)
- Parent re-renders frequently but child's props change rarely

**Don't use React.memo when**:
- Component is cheap to render
- Props change frequently anyway
- Component only renders once or twice
- Premature optimization (measure first!)

---

## Rule 4: Memoize Expensive Computations

**Statement**: Use useMemo for expensive computations that don't need to run on every render.

### Why This Matters

Expensive computations slow down render. If the inputs haven't changed, the result is the same - no need to recompute.

### ❌ WRONG: Expensive Computation on Every Render

```typescript
function DataVisualization({ data, filters }: Props) {
  // WRONG: Expensive computation runs every render
  const processedData = data
    .filter(item => filters.categories.includes(item.category))
    .map(item => ({
      ...item,
      score: calculateComplexScore(item)
    }))
    .sort((a, b) => b.score - a.score);

  return <Chart data={processedData} />;
}
```

**What breaks**:
- Component re-renders for any reason (e.g., parent re-render, unrelated state change)
- Expensive computation runs every time
- **Symptom**: Slow renders, janky UI

### ✅ CORRECT: Memoize Expensive Computation

```typescript
function DataVisualization({ data, filters }: Props) {
  // Memoized - only recomputes when data or filters change
  const processedData = useMemo(() => {
    return data
      .filter(item => filters.categories.includes(item.category))
      .map(item => ({
        ...item,
        score: calculateComplexScore(item)
      }))
      .sort((a, b) => b.score - a.score);
  }, [data, filters]);

  return <Chart data={processedData} />;
}
```

**Why this works**: Computation only runs when data or filters change. Other re-renders use cached result.

### When to Use useMemo

**Use useMemo when**:
- Computation is expensive (filtering/sorting large arrays, complex calculations)
- Result is used as prop to memoized child component
- Computation involves loops, recursion, or heavy processing

**Don't use useMemo when**:
- Computation is cheap (simple arithmetic, string concatenation)
- Result changes on every render anyway
- Premature optimization (measure first!)

---

## Rule 5: Avoid Inline Styles with Objects

**Statement**: Creating inline style objects during render causes unnecessary re-renders because the object reference changes.

### ❌ WRONG: Inline Style Object

```typescript
function Button({ label }: { label: string }) {
  // WRONG: New style object every render
  return (
    <button style={{ padding: '10px', backgroundColor: 'blue' }}>
      {label}
    </button>
  );
}
```

**What breaks**:
- Every render creates new style object
- If Button is in a list, all buttons re-render
- **Symptom**: Unnecessary re-renders

### ✅ CORRECT: Use CSS Classes

```typescript
function Button({ label }: { label: string }) {
  return <button className="btn btn-primary">{label}</button>;
}
```

**Why this works**: className is a string (primitive), same value every render.

### ✅ CORRECT: Memoize Style Object

```typescript
function Button({ label, color }: { label: string; color: string }) {
  const style = useMemo(
    () => ({ padding: '10px', backgroundColor: color }),
    [color]
  );

  return <button style={style}>{label}</button>;
}
```

**Why this works**: Style object only changes when color changes.

### ✅ CORRECT: Define Style Constant Outside

```typescript
const BUTTON_STYLE = { padding: '10px', backgroundColor: 'blue' };

function Button({ label }: { label: string }) {
  return <button style={BUTTON_STYLE}>{label}</button>;
}
```

**Why this works**: Same reference every render.

---

## Common Patterns

### Pattern: Memoized Filtered List

```typescript
function UserList({ users, searchQuery }: Props) {
  const filteredUsers = useMemo(() => {
    return users.filter(user =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [users, searchQuery]);

  return (
    <ul>
      {filteredUsers.map(user => (
        <UserItem key={user.id} user={user} />
      ))}
    </ul>
  );
}
```

### Pattern: Memoized Event Handler with State

```typescript
function TodoList({ todos, onToggle }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []); // No deps - uses functional update

  return (
    <div>
      {todos.map(todo => (
        <TodoItem
          key={todo.id}
          todo={todo}
          selected={selectedIds.has(todo.id)}
          onSelect={handleSelect}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}
```

### Pattern: Memoized Child with Stable Props

```typescript
const ExpensiveChild = React.memo(({ data, onAction }: Props) => {
  // Expensive rendering
  return <div>...</div>;
});

function Parent() {
  const [count, setCount] = useState(0);
  const [data, setData] = useState(initialData);

  const handleAction = useCallback((id: string) => {
    // Handle action
  }, []);

  return (
    <div>
      <button onClick={() => setCount(count + 1)}>Count: {count}</button>
      {/* ExpensiveChild won't re-render when count changes */}
      <ExpensiveChild data={data} onAction={handleAction} />
    </div>
  );
}
```

### Pattern: Separate State to Minimize Re-renders

```typescript
// WRONG: Single state causes unnecessary re-renders
function Form() {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });

  return (
    <div>
      <NameInput value={formData.name} onChange={...} />
      <EmailInput value={formData.email} onChange={...} />
      <MessageInput value={formData.message} onChange={...} />
    </div>
  );
}

// CORRECT: Separate state, each input only re-renders itself
function Form() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  return (
    <div>
      <NameInput value={name} onChange={setName} />
      <EmailInput value={email} onChange={setEmail} />
      <MessageInput value={message} onChange={setMessage} />
    </div>
  );
}
```

---

## Measuring Performance

Don't guess - measure! Use React DevTools Profiler:

1. Open React DevTools
2. Go to Profiler tab
3. Click record
4. Interact with your app
5. Stop recording
6. Analyze:
   - Which components re-render?
   - How long does each render take?
   - Why did they re-render?

**Only optimize after measuring.** Premature optimization adds complexity without proven benefit.

---

## Agent Checklist: Performance

Before submitting performance-sensitive code, verify:

- [ ] No new objects created in render (move to constant or useMemo)
- [ ] No new arrays created in render (move to constant or useMemo)
- [ ] No new functions created in render (use useCallback)
- [ ] Expensive child components wrapped in React.memo
- [ ] Expensive computations wrapped in useMemo
- [ ] Props to memoized components are stable (primitives or memoized)
- [ ] Inline style objects avoided (use CSS classes or memoize)
- [ ] State split appropriately (don't group unrelated state)
- [ ] Performance measured with React DevTools Profiler

---

## When to Optimize

**Optimize when**:
- Profiler shows slow renders
- UI feels janky or laggy
- Lists with many items (100+)
- Expensive computations visible in profile
- User reports performance issues

**Don't optimize when**:
- App feels fast
- Components render quickly
- Small lists (< 50 items)
- No user complaints
- Premature - measure first!

**Remember**: Optimization adds complexity. Only optimize what's actually slow.

---

## Summary

Avoid performance traps by preventing unnecessary re-renders:

1. **Don't create objects/arrays in render** - move to constants or useMemo
2. **Don't create functions in render** - use useCallback
3. **Memoize expensive children** - use React.memo
4. **Memoize expensive computations** - use useMemo
5. **Avoid inline style objects** - use CSS classes or memoize

But remember: **measure before optimizing**. React is fast by default. Only optimize what's actually slow.
