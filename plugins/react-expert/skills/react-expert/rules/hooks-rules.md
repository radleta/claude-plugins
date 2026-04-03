# Rules of Hooks

React Hooks have strict rules about how they must be called. These rules exist because React tracks hooks by their **call order** - React doesn't use hook names or any other identifier. Breaking these rules causes React to lose track of which state belongs to which hook, leading to crashes and state corruption.

## The Problem: React's Internal Hook Tracking

React maintains an internal list of hooks for each component. On every render, React walks through this list in order. If hooks are called conditionally or in different orders, React's internal pointer gets out of sync with your hooks, causing state to be attached to the wrong hooks or React to crash.

**Key insight**: React doesn't know which hook is which - it only knows the order they're called in.

---

## Rule 1: Only Call Hooks at the Top Level

**Statement**: Never call hooks inside conditions, loops, or nested functions.

### Why This Matters

If you call hooks conditionally, the number of hooks changes between renders. React expects the exact same hooks in the exact same order every render. When that expectation is violated, React crashes with:

```
Error: Rendered fewer hooks than expected. This may be caused by an accidental early return statement.
```

### ❌ WRONG: Hook Inside Condition

```typescript
function UserProfile({ userId }: { userId: string }) {
  // This is WRONG - useState is only called sometimes
  if (userId) {
    const [user, setUser] = useState<User | null>(null);
  }

  return <div>Profile</div>;
}
```

**What breaks**: On first render with userId, React registers one hook. On second render without userId, React registers zero hooks. React crashes because it expects one hook.

### ❌ WRONG: Hook Inside Loop

```typescript
function TodoList({ todos }: { todos: Todo[] }) {
  // This is WRONG - number of hooks changes with todos.length
  todos.forEach(todo => {
    const [isComplete, setIsComplete] = useState(false);
  });

  return <div>Todos</div>;
}
```

**What breaks**: If todos has 3 items, React registers 3 hooks. If todos later has 2 items, React expects 3 hooks but only gets 2. React crashes.

### ❌ WRONG: Hook Inside Nested Function

```typescript
function SearchBox() {
  const handleSearch = () => {
    // This is WRONG - hook is in a nested function
    const [query, setQuery] = useState('');
    console.log(query);
  };

  return <button onClick={handleSearch}>Search</button>;
}
```

**What breaks**: The hook is only called when handleSearch runs, not during render. React doesn't track it properly, and state is lost between calls.

### ✅ CORRECT: All Hooks at Top Level

```typescript
function UserProfile({ userId }: { userId: string }) {
  // All hooks at top level, called unconditionally
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  // Conditional LOGIC is fine, just not conditional HOOKS
  useEffect(() => {
    if (userId) {
      setLoading(true);
      fetchUser(userId).then(setUser).finally(() => setLoading(false));
    }
  }, [userId]);

  if (!userId) {
    return <div>Please log in</div>;
  }

  return loading ? <Spinner /> : <div>{user?.name}</div>;
}
```

**Why this works**: Both hooks are always called, in the same order, every render. The conditional logic happens inside the hook or in the JSX, not in the hook call itself.

### ✅ CORRECT: Loop Logic Inside Hook

```typescript
function TodoList({ todos }: { todos: Todo[] }) {
  // Single hook at top level
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  const toggleComplete = (id: string) => {
    setCompletedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div>
      {todos.map(todo => (
        <TodoItem
          key={todo.id}
          todo={todo}
          isComplete={completedIds.has(todo.id)}
          onToggle={() => toggleComplete(todo.id)}
        />
      ))}
    </div>
  );
}
```

**Why this works**: One hook is called once, always. The loop is in the JSX, not in hook calls.

---

## Rule 2: Only Call Hooks in the Same Order Every Render

**Statement**: Hooks must be called in the exact same order on every render of a component.

### Why This Matters

React uses the call order to match hooks to their state. If Hook A is first on render 1, React expects Hook A to be first on render 2. If Hook B is first on render 2, React gives Hook B the state that belonged to Hook A, causing state corruption.

### ❌ WRONG: Conditional Early Return Before Hooks

```typescript
function ProductDetail({ productId }: { productId: string | null }) {
  // This is WRONG - early return before hooks means different hook order
  if (!productId) {
    return <div>Select a product</div>;
  }

  // These hooks only run when productId exists
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);

  return loading ? <Spinner /> : <div>{product?.name}</div>;
}
```

**What breaks**:
- First render with productId=null: 0 hooks called
- Second render with productId="abc": 2 hooks called
- React crashes: "Rendered more hooks than during the previous render"

### ❌ WRONG: Conditional Hook Based on Props

```typescript
function UserSettings({ userId, showAdvanced }: Props) {
  const [name, setName] = useState('');

  // This is WRONG - hook only called sometimes
  if (showAdvanced) {
    const [settings, setSettings] = useState<Settings>({});
  }

  const [email, setEmail] = useState('');

  return <form>...</form>;
}
```

**What breaks**:
- showAdvanced=false: Hook order is [name, email]
- showAdvanced=true: Hook order is [name, settings, email]
- React gives email's state to settings, corruption occurs

### ✅ CORRECT: All Hooks Before Any Return

```typescript
function ProductDetail({ productId }: { productId: string | null }) {
  // ALL hooks at the top, before any conditional returns
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (productId) {
      setLoading(true);
      fetchProduct(productId).then(setProduct).finally(() => setLoading(false));
    }
  }, [productId]);

  // Conditional rendering happens AFTER all hooks
  if (!productId) {
    return <div>Select a product</div>;
  }

  return loading ? <Spinner /> : <div>{product?.name}</div>;
}
```

**Why this works**: Both hooks are always called, in the same order, before any return statement.

### ✅ CORRECT: Conditional State with Always-Called Hook

```typescript
function UserSettings({ userId, showAdvanced }: Props) {
  const [name, setName] = useState('');
  // Hook is ALWAYS called, even if not used
  const [settings, setSettings] = useState<Settings>({});
  const [email, setEmail] = useState('');

  return (
    <form>
      <input value={name} onChange={e => setName(e.target.value)} />
      <input value={email} onChange={e => setEmail(e.target.value)} />
      {showAdvanced && (
        <AdvancedSettings settings={settings} onChange={setSettings} />
      )}
    </form>
  );
}
```

**Why this works**: All three hooks are always called in the same order. The conditional rendering is in JSX, not in hook calls.

---

## Rule 3: Only Call Hooks from React Functions

**Statement**: Only call hooks from React function components or custom hooks, never from regular JavaScript functions.

### Why This Matters

Hooks need React's rendering context to work. When called outside React functions, hooks have no component to attach state to, causing errors or undefined behavior.

### ❌ WRONG: Hook in Regular Utility Function

```typescript
// This is WRONG - regular function, not a React component or hook
function calculateDiscount(price: number): number {
  const [discount, setDiscount] = useState(0); // Error!
  return price * (1 - discount);
}

function ProductPrice({ price }: { price: number }) {
  const finalPrice = calculateDiscount(price);
  return <div>${finalPrice}</div>;
}
```

**What breaks**: React error: "Invalid hook call. Hooks can only be called inside of the body of a function component."

### ❌ WRONG: Hook in Event Handler

```typescript
function SearchForm() {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // This is WRONG - hook in event handler
    const [results, setResults] = useState<Result[]>([]);
    fetchResults().then(setResults);
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

**What breaks**: Hook is only called when event fires, not during render. React loses track of state.

### ✅ CORRECT: Hook in Function Component

```typescript
function ProductPrice({ price }: { price: number }) {
  // Hook in function component - correct!
  const [discount, setDiscount] = useState(0);

  const finalPrice = price * (1 - discount);

  return (
    <div>
      <div>${finalPrice}</div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.1"
        value={discount}
        onChange={e => setDiscount(parseFloat(e.target.value))}
      />
    </div>
  );
}
```

**Why this works**: Hook is called during component render, in the component body.

### ✅ CORRECT: Extract to Custom Hook

```typescript
// Custom hook (starts with "use") - correct!
function useDiscount(initialDiscount = 0) {
  const [discount, setDiscount] = useState(initialDiscount);
  return { discount, setDiscount };
}

function ProductPrice({ price }: { price: number }) {
  const { discount, setDiscount } = useDiscount();
  const finalPrice = price * (1 - discount);

  return (
    <div>
      <div>${finalPrice}</div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.1"
        value={discount}
        onChange={e => setDiscount(parseFloat(e.target.value))}
      />
    </div>
  );
}
```

**Why this works**: Custom hook is a valid place to call hooks. React recognizes functions starting with "use" as hooks.

---

## Rule 4: Custom Hooks Must Start with "use"

**Statement**: Custom hook functions must start with the prefix "use" (e.g., useUserData, useFetch, useDebounce).

### Why This Matters

React and ESLint use the "use" prefix to identify hooks. Without it:
- ESLint can't enforce Rules of Hooks
- React DevTools don't show your hook
- Other developers don't know it's a hook

### ❌ WRONG: Custom Hook Without "use" Prefix

```typescript
// This is WRONG - doesn't start with "use"
function fetchUserData(userId: string) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/users/${userId}`)
      .then(r => r.json())
      .then(setUser)
      .finally(() => setLoading(false));
  }, [userId]);

  return { user, loading };
}
```

**What breaks**:
- ESLint won't check this function for Rules of Hooks violations
- If called conditionally, React won't catch the error
- Unclear to other developers that this is a hook

### ✅ CORRECT: Custom Hook With "use" Prefix

```typescript
// Correct - starts with "use"
function useUserData(userId: string) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/users/${userId}`)
      .then(r => r.json())
      .then(setUser)
      .finally(() => setLoading(false));
  }, [userId]);

  return { user, loading };
}

function UserProfile({ userId }: { userId: string }) {
  const { user, loading } = useUserData(userId);

  if (loading) return <Spinner />;
  return <div>{user?.name}</div>;
}
```

**Why this works**:
- ESLint recognizes "use" prefix and enforces Rules of Hooks
- React DevTools shows the hook
- Clear to developers that this is a hook with special rules

---

## ESLint Configuration

Enable the official Rules of Hooks linter:

```json
{
  "plugins": ["react-hooks"],
  "rules": {
    "react-hooks/rules-of-hooks": "error"
  }
}
```

This catches violations of Rules 1-4 at build time.

---

## Agent Checklist: Hooks Rules

Before submitting code with hooks, verify:

- [ ] All hooks called at top level (not inside conditions, loops, or nested functions)
- [ ] All hooks called before any early returns or conditional returns
- [ ] Hook call order is identical across all render paths
- [ ] Hooks only called from React function components or custom hooks
- [ ] Custom hooks start with "use" prefix
- [ ] No hooks in event handlers, utility functions, or class methods
- [ ] ESLint rule `react-hooks/rules-of-hooks` is enabled and passing

---

## Common Patterns

### Pattern: Conditional Effect Logic

**WRONG**: Conditional hook call
```typescript
if (shouldSync) {
  useEffect(() => { sync(); }, []);
}
```

**CORRECT**: Hook always called, logic conditional
```typescript
useEffect(() => {
  if (shouldSync) {
    sync();
  }
}, [shouldSync]);
```

### Pattern: Dynamic Number of States

**WRONG**: Loop of useState calls
```typescript
items.forEach(item => {
  const [state, setState] = useState(item.value);
});
```

**CORRECT**: Single state with array/object
```typescript
const [states, setStates] = useState<Record<string, any>>(() =>
  Object.fromEntries(items.map(item => [item.id, item.value]))
);
```

### Pattern: Extracting Hook Logic

**WRONG**: Regular function with hooks
```typescript
function getData() {
  const [data, setData] = useState(null);
  return data;
}
```

**CORRECT**: Custom hook with "use" prefix
```typescript
function useData() {
  const [data, setData] = useState(null);
  return data;
}
```

---

## Debugging Hook Errors

**Error**: "Rendered more hooks than during the previous render"
- **Cause**: Conditional hook call or early return before hooks
- **Fix**: Move all hooks before any returns, remove conditionals around hooks

**Error**: "Rendered fewer hooks than expected"
- **Cause**: Conditional hook call or conditional return before hooks
- **Fix**: Move all hooks to top level, ensure same hooks every render

**Error**: "Invalid hook call"
- **Cause**: Hook called outside React function or custom hook
- **Fix**: Move hook into component body or custom hook with "use" prefix

**Error**: Wrong state returned from hook
- **Cause**: Hook order changed between renders
- **Fix**: Ensure hook order is identical on every render path

---

## Summary

The Rules of Hooks exist because of React's internal hook tracking mechanism. React doesn't identify hooks by name - it identifies them by call order. To keep React's tracking accurate:

1. **Always** call hooks at the top level
2. **Always** call hooks in the same order
3. **Only** call hooks from React functions (components or custom hooks)
4. **Always** name custom hooks with "use" prefix

These aren't suggestions - violating them breaks your app.
