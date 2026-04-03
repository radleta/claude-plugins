# Dependency Array Rules

The dependency array is the second argument to `useEffect`, `useMemo`, `useCallback`, and `useLayoutEffect`. It tells React which values the hook depends on. When dependencies change, React re-runs the hook. When they don't change, React skips re-running.

**The golden rule**: Every value from component scope that's used inside the hook must be in the dependency array.

Violating this rule causes stale closures, infinite loops, memory leaks, and values that never update.

---

## Rule 1: Include ALL Values from Component Scope

**Statement**: If a value from component scope (props, state, derived values) is used inside useEffect/useMemo/useCallback, it MUST be in the dependency array.

### Why This Matters

JavaScript closures capture values at the time the function is created. If you don't include a value in deps, the closure captures the old value and never updates. This is called a **stale closure** - the function remembers old data even when new data exists.

### ❌ WRONG: Missing Dependency

```typescript
function UserGreeting({ userId }: { userId: string }) {
  const [greeting, setGreeting] = useState('');

  // WRONG: userId is used but not in deps
  useEffect(() => {
    fetchUserName(userId).then(name => {
      setGreeting(`Hello, ${name}!`);
    });
  }, []); // Empty deps = effect only runs once

  return <div>{greeting}</div>;
}
```

**What breaks**:
- Effect runs once with initial userId
- When userId changes to a new value, effect doesn't re-run
- greeting still shows the first user's name, never updates
- **Symptom**: UI shows stale data

### ❌ WRONG: Missing State Dependency

```typescript
function Counter() {
  const [count, setCount] = useState(0);

  // WRONG: count is used but not in deps
  useEffect(() => {
    const timer = setInterval(() => {
      setCount(count + 1); // Stale closure: count is always 0
    }, 1000);
    return () => clearInterval(timer);
  }, []); // Missing count

  return <div>Count: {count}</div>;
}
```

**What breaks**:
- Effect captures count=0 in the closure
- Every second, setCount(0 + 1) is called
- Count goes from 0 to 1, then never changes
- **Symptom**: Counter increments once then stops

### ✅ CORRECT: Include All Dependencies

```typescript
function UserGreeting({ userId }: { userId: string }) {
  const [greeting, setGreeting] = useState('');

  // userId is in deps
  useEffect(() => {
    fetchUserName(userId).then(name => {
      setGreeting(`Hello, ${name}!`);
    });
  }, [userId]); // Effect re-runs when userId changes

  return <div>{greeting}</div>;
}
```

**Why this works**: When userId changes, effect re-runs with new userId value, fetches new name, updates greeting.

### ✅ CORRECT: Use Functional State Update

```typescript
function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      // Functional update: doesn't depend on count value
      setCount(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []); // No deps needed - not reading count

  return <div>Count: {count}</div>;
}
```

**Why this works**: Functional update `prev => prev + 1` doesn't read count from closure, so no stale closure issue. Each update gets the current count.

---

## Rule 2: Object and Array Dependencies Need Memoization

**Statement**: If an object or array is in the dependency array, it must be memoized with useMemo or useCallback, or the effect will re-run on every render.

### Why This Matters

Objects and arrays are compared by reference, not by value. Every render creates new objects/arrays, even if their contents are identical. React sees a new reference and thinks the dependency changed, causing infinite re-render loops.

### ❌ WRONG: Plain Object in Dependency Array

```typescript
function UserList({ filters }: { filters: { status: string } }) {
  const [users, setUsers] = useState<User[]>([]);

  // WRONG: filters is a new object every render
  useEffect(() => {
    fetchUsers(filters).then(setUsers);
  }, [filters]); // New reference every time

  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

**What breaks**:
- Parent re-renders with same filters values
- filters is a new object reference: `{ status: 'active' }` !== `{ status: 'active' }`
- Effect sees "dependency changed" and re-runs
- Fetches users again unnecessarily
- **Symptom**: Infinite loop or excessive fetches

### ❌ WRONG: Inline Object in Dependency Array

```typescript
function DataTable() {
  const [data, setData] = useState([]);

  // WRONG: New object created every render
  useEffect(() => {
    fetchData({ page: 1, limit: 10 }).then(setData);
  }, [{ page: 1, limit: 10 }]); // New object every time!

  return <table>...</table>;
}
```

**What breaks**:
- Every render creates new object `{ page: 1, limit: 10 }`
- Effect sees "dependency changed" every render
- Fetches data infinitely
- **Symptom**: Infinite loop, browser freezes

### ✅ CORRECT: Memoize Object Dependencies

```typescript
function UserList({ filters }: { filters: { status: string } }) {
  const [users, setUsers] = useState<User[]>([]);

  // Memoize filters to stable reference
  const memoizedFilters = useMemo(() => filters, [filters.status]);

  useEffect(() => {
    fetchUsers(memoizedFilters).then(setUsers);
  }, [memoizedFilters]); // Stable reference

  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

**Why this works**: useMemo returns same reference if filters.status hasn't changed. Effect only re-runs when status actually changes.

### ✅ CORRECT: Depend on Primitive Values

```typescript
function UserList({ filters }: { filters: { status: string } }) {
  const [users, setUsers] = useState<User[]>([]);

  // Depend on primitive value instead of object
  useEffect(() => {
    fetchUsers({ status: filters.status }).then(setUsers);
  }, [filters.status]); // Primitive value comparison

  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

**Why this works**: Primitives (string, number, boolean) are compared by value. Effect only re-runs when status string actually changes.

### ✅ CORRECT: Move Object Inside Effect

```typescript
function DataTable() {
  const [data, setData] = useState([]);

  useEffect(() => {
    // Create object inside effect - not in deps
    const params = { page: 1, limit: 10 };
    fetchData(params).then(setData);
  }, []); // Empty deps - runs once

  return <table>...</table>;
}
```

**Why this works**: Object is created inside effect, not captured from outer scope. No dependency on outer values, so no deps needed.

---

## Rule 3: Functions in Dependencies Should Be Memoized

**Statement**: If a function from component scope is used in an effect, either include it in deps (wrapped with useCallback) or define it inside the effect.

### Why This Matters

Functions are objects - they're compared by reference. New function created every render = new reference = effect re-runs every render.

### ❌ WRONG: Function Dependency Not Memoized

```typescript
function SearchResults({ query }: { query: string }) {
  const [results, setResults] = useState([]);

  // New function every render
  const fetchResults = () => {
    fetch(`/api/search?q=${query}`).then(r => r.json()).then(setResults);
  };

  // WRONG: fetchResults is new every render
  useEffect(() => {
    fetchResults();
  }, [fetchResults]); // New reference every time

  return <ul>{results.map(r => <li key={r.id}>{r.title}</li>)}</ul>;
}
```

**What breaks**:
- Every render creates new fetchResults function
- Effect sees "dependency changed" and re-runs
- Infinite loop of fetches
- **Symptom**: Infinite loop

### ✅ CORRECT: Wrap Function with useCallback

```typescript
function SearchResults({ query }: { query: string }) {
  const [results, setResults] = useState([]);

  // Memoize function with useCallback
  const fetchResults = useCallback(() => {
    fetch(`/api/search?q=${query}`).then(r => r.json()).then(setResults);
  }, [query]); // Function only changes when query changes

  useEffect(() => {
    fetchResults();
  }, [fetchResults]); // Stable reference

  return <ul>{results.map(r => <li key={r.id}>{r.title}</li>)}</ul>;
}
```

**Why this works**: useCallback returns same function reference if query hasn't changed. Effect only re-runs when query changes.

### ✅ CORRECT: Define Function Inside Effect

```typescript
function SearchResults({ query }: { query: string }) {
  const [results, setResults] = useState([]);

  useEffect(() => {
    // Define function inside effect
    const fetchResults = () => {
      fetch(`/api/search?q=${query}`).then(r => r.json()).then(setResults);
    };
    fetchResults();
  }, [query]); // Only depend on query

  return <ul>{results.map(r => <li key={r.id}>{r.title}</li>)}</ul>;
}
```

**Why this works**: Function is defined inside effect, so it's not a dependency. Effect depends directly on query.

### ✅ CORRECT: Inline the Function Call

```typescript
function SearchResults({ query }: { query: string }) {
  const [results, setResults] = useState([]);

  useEffect(() => {
    // Inline the function logic
    fetch(`/api/search?q=${query}`).then(r => r.json()).then(setResults);
  }, [query]); // Only depend on query

  return <ul>{results.map(r => <li key={r.id}>{r.title}</li>)}</ul>;
}
```

**Why this works**: No function reference involved. Effect depends directly on the values it uses.

---

## Rule 4: Effects Must Clean Up Subscriptions and Timers

**Statement**: If an effect sets up a subscription, timer, or event listener, it must return a cleanup function that removes it.

### Why This Matters

Without cleanup:
- Subscriptions stay active after component unmounts → memory leak
- Timers keep running after unmount → memory leak, possible crashes
- Event listeners pile up → performance degradation
- Stale callbacks get invoked → bugs

### ❌ WRONG: Missing Cleanup for Subscription

```typescript
function ChatRoom({ roomId }: { roomId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);

  // WRONG: No cleanup function
  useEffect(() => {
    const subscription = chatAPI.subscribe(roomId, (msg: Message) => {
      setMessages(prev => [...prev, msg]);
    });
    // Missing: return () => subscription.unsubscribe();
  }, [roomId]);

  return <div>{messages.map(m => <div key={m.id}>{m.text}</div>)}</div>;
}
```

**What breaks**:
- User switches rooms: roomId changes
- New subscription created for new room
- Old subscription NOT cleaned up
- Component now subscribed to both rooms
- Memory leak + messages from wrong room appear
- **Symptom**: Memory leak, incorrect data

### ❌ WRONG: Missing Cleanup for Timer

```typescript
function AutoSave({ data }: { data: FormData }) {
  useEffect(() => {
    // WRONG: No cleanup for timer
    const timer = setTimeout(() => {
      saveData(data);
    }, 5000);
    // Missing: return () => clearTimeout(timer);
  }, [data]);

  return <div>Auto-saving...</div>;
}
```

**What breaks**:
- User types fast, data changes frequently
- New timer created on each data change
- Old timers NOT cleared
- Hundreds of timers pile up, all save when they fire
- **Symptom**: Memory leak, duplicate saves, performance issues

### ❌ WRONG: Missing Cleanup for Event Listener

```typescript
function WindowSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    // WRONG: No cleanup for listener
    const handleResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    // Missing: return () => window.removeEventListener('resize', handleResize);
  }, []);

  return <div>{size.width} x {size.height}</div>;
}
```

**What breaks**:
- Component unmounts (user navigates away)
- Event listener stays attached to window
- Component remounts later
- New listener added, old one still there
- Each resize fires multiple handlers
- **Symptom**: Memory leak, performance degradation

### ✅ CORRECT: Cleanup Subscription

```typescript
function ChatRoom({ roomId }: { roomId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    const subscription = chatAPI.subscribe(roomId, (msg: Message) => {
      setMessages(prev => [...prev, msg]);
    });

    // Cleanup function
    return () => {
      subscription.unsubscribe();
    };
  }, [roomId]);

  return <div>{messages.map(m => <div key={m.id}>{m.text}</div>)}</div>;
}
```

**Why this works**: When roomId changes or component unmounts, cleanup runs first, unsubscribing from old room before subscribing to new room.

### ✅ CORRECT: Cleanup Timer

```typescript
function AutoSave({ data }: { data: FormData }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      saveData(data);
    }, 5000);

    // Cleanup function
    return () => {
      clearTimeout(timer);
    };
  }, [data]);

  return <div>Auto-saving...</div>;
}
```

**Why this works**: When data changes, cleanup runs, clearing old timer before creating new one. Only one timer active at a time.

### ✅ CORRECT: Cleanup Event Listener

```typescript
function WindowSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const handleResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', handleResize);

    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <div>{size.width} x {size.height}</div>;
}
```

**Why this works**: When component unmounts, cleanup runs, removing listener. No memory leak.

---

## ESLint Configuration

Enable the exhaustive-deps linter:

```json
{
  "plugins": ["react-hooks"],
  "rules": {
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

This warns when dependencies are missing from useEffect/useMemo/useCallback.

**Note**: Use "warn" not "error" - sometimes you intentionally omit dependencies (rare but valid). Review warnings carefully.

---

## Agent Checklist: Dependency Arrays

Before submitting code with effects/memos/callbacks, verify:

- [ ] Every value from component scope used inside hook is in deps array
- [ ] No missing dependencies (check ESLint exhaustive-deps warnings)
- [ ] Object/array dependencies are memoized or replaced with primitives
- [ ] Function dependencies are wrapped with useCallback or defined inside effect
- [ ] No inline objects/arrays in deps (e.g., `[{ page: 1 }]`)
- [ ] Effects with subscriptions/timers/listeners have cleanup functions
- [ ] Cleanup functions properly remove subscriptions/timers/listeners
- [ ] If using empty deps `[]`, verified that effect truly doesn't depend on any values

---

## Common Patterns

### Pattern: Fetching Data with Dependencies

```typescript
function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchUser(userId)
      .then(setUser)
      .finally(() => setLoading(false));
  }, [userId]); // Re-fetch when userId changes

  if (loading) return <Spinner />;
  return <div>{user?.name}</div>;
}
```

### Pattern: Interval with Cleanup

```typescript
function Clock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []); // No deps - runs once

  return <div>{time.toLocaleTimeString()}</div>;
}
```

### Pattern: Abort Fetch on Unmount

```typescript
function SearchResults({ query }: { query: string }) {
  const [results, setResults] = useState([]);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/search?q=${query}`, { signal: controller.signal })
      .then(r => r.json())
      .then(setResults)
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error(err);
        }
      });

    return () => controller.abort(); // Cleanup
  }, [query]);

  return <ul>{results.map(r => <li key={r.id}>{r.title}</li>)}</ul>;
}
```

### Pattern: Memoizing Derived Value

```typescript
function ProductList({ products, filters }: Props) {
  // Expensive filtering operation
  const filteredProducts = useMemo(() => {
    return products.filter(p =>
      p.category === filters.category &&
      p.price <= filters.maxPrice
    );
  }, [products, filters.category, filters.maxPrice]); // Depend on used values

  return (
    <ul>
      {filteredProducts.map(p => <li key={p.id}>{p.name}</li>)}
    </ul>
  );
}
```

---

## Debugging Dependency Issues

**Symptom**: Effect runs on every render
- **Cause**: Object/array/function dependency without memoization
- **Fix**: Memoize with useMemo/useCallback or depend on primitives

**Symptom**: Stale values in effect
- **Cause**: Missing dependency
- **Fix**: Add missing value to deps array (check ESLint warning)

**Symptom**: Infinite loop
- **Cause**: Effect updates state that's in deps, causing re-run, causing update, etc.
- **Fix**: Use functional state update or rethink effect logic

**Symptom**: Memory leak warning
- **Cause**: Missing cleanup for subscription/timer/listener
- **Fix**: Return cleanup function from effect

**Symptom**: Effect doesn't re-run when it should
- **Cause**: Missing dependency or depending on stale memoized value
- **Fix**: Add dependency or fix memoization deps

---

## Summary

Dependency arrays control when effects, memos, and callbacks re-run. To get them right:

1. **Include ALL values from component scope** used in the hook
2. **Memoize object/array dependencies** to avoid infinite loops
3. **Memoize or inline functions** to avoid unnecessary re-runs
4. **Always clean up** subscriptions, timers, and listeners

ESLint's exhaustive-deps rule catches most violations. When it warns, listen.
