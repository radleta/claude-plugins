# Effect Usage Decision Tree

## When to Use This Tree

Use this tree when you're about to write `useEffect` or when you're debugging why an effect isn't working correctly. **This is arguably the most important tree** because useEffect is the most misused hook in React.

## The Core Question

**"Does this logic actually need useEffect, or is there a better way?"**

---

## The Decision Tree

```
Start: What needs to happen?

├─ I need to derive a value from props or state
│   │
│   ├─ The calculation is cheap (< 1ms)?
│   │   └─ → Compute during render (NO useEffect!)
│   │
│   └─ The calculation is expensive (> 1ms)?
│       └─ → Use useMemo (NO useEffect!)
│
├─ I need to synchronize with an external system
│   │
│   ├─ Fetch data from an API?
│   │   │
│   │   ├─ On component mount only?
│   │   │   └─ → useEffect with empty deps [] (or React Query)
│   │   │
│   │   └─ When a value changes?
│   │       └─ → useEffect with that value in deps array
│   │
│   ├─ Subscribe to external events (WebSocket, window events, etc.)?
│   │   └─ → useEffect with cleanup function
│   │
│   ├─ Manipulate DOM directly (focus, scroll, measure)?
│   │   │
│   │   ├─ Needs to happen before browser paint?
│   │   │   └─ → useLayoutEffect
│   │   │
│   │   └─ Can happen after browser paint?
│   │       └─ → useEffect
│   │
│   └─ Sync React state with external store (localStorage, etc.)?
│       └─ → useEffect with sync logic
│
├─ I need to run code in response to user action
│   │
│   ├─ User clicked, submitted, or triggered an event?
│   │   └─ → Event handler (NO useEffect!)
│   │
│   └─ User navigated or URL changed?
│       └─ → useEffect with location dependency (or router hook)
│
└─ I need to initialize something once when component mounts
    │
    ├─ Initialize local state?
    │   └─ → Lazy initial state in useState (NO useEffect!)
    │
    ├─ Run side effect once (analytics, logging)?
    │   └─ → useEffect with empty deps [] (be cautious in StrictMode)
    │
    └─ Connect to external service once?
        └─ → useEffect with empty deps [] and cleanup
```

---

## Code Examples for Each Solution

### Solution 1: Compute during render (NO useEffect)

**When:** Derive value from props/state, cheap calculation

```typescript
// ❌ WRONG - Don't use useEffect for this!
function UserGreeting({ firstName, lastName }: Props) {
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    setFullName(`${firstName} ${lastName}`);
  }, [firstName, lastName]);

  return <h1>Hello, {fullName}</h1>;
}

// ✅ RIGHT - Just compute during render!
function UserGreeting({ firstName, lastName }: Props) {
  const fullName = `${firstName} ${lastName}`;
  return <h1>Hello, {fullName}</h1>;
}

// Another example
function ShoppingCart({ items }: Props) {
  // ✅ Compute directly - no effect needed
  const total = items.reduce((sum, item) => sum + item.price, 0);
  const itemCount = items.length;

  return (
    <div>
      <p>{itemCount} items</p>
      <p>Total: ${total}</p>
    </div>
  );
}
```

**Why no effect:** React components are functions. If you can compute a value from props/state, just do it during render. No synchronization needed.

---

### Solution 2: Use useMemo for expensive calculations (NO useEffect)

**When:** Derive value from props/state, expensive calculation (> 1ms)

```typescript
// ❌ WRONG - Using effect for derived state
function DataTable({ data, filters }: Props) {
  const [filteredData, setFilteredData] = useState(data);

  useEffect(() => {
    const filtered = data.filter(item =>
      filters.every(filter => filter.fn(item))
    );
    setFilteredData(filtered);
  }, [data, filters]);

  return <Table data={filteredData} />;
}

// ✅ RIGHT - Use useMemo instead
function DataTable({ data, filters }: Props) {
  const filteredData = useMemo(() => {
    return data.filter(item =>
      filters.every(filter => filter.fn(item))
    );
  }, [data, filters]);

  return <Table data={filteredData} />;
}
```

**Why useMemo:** It memoizes the calculation result, only recomputing when dependencies change. Cleaner than useEffect + useState.

---

### Solution 3: useEffect for data fetching on mount

**When:** Fetch data from API when component mounts

```typescript
// ✅ Basic data fetching on mount
function UserProfile({ userId }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchUser() {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/users/${userId}`);
        const data = await response.json();

        if (!cancelled) {
          setUser(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchUser();

    return () => {
      cancelled = true; // Cleanup to prevent state updates after unmount
    };
  }, [userId]); // Re-fetch when userId changes

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!user) return null;

  return <div>{user.name}</div>;
}

// ✅ BETTER - Use React Query for data fetching
import { useQuery } from '@tanstack/react-query';

function UserProfile({ userId }: Props) {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetch(`/api/users/${userId}`).then(res => res.json())
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!user) return null;

  return <div>{user.name}</div>;
}
```

**Why useEffect:** Need to synchronize with external system (API). But prefer React Query/SWR for production code.

---

### Solution 4: useEffect with cleanup for subscriptions

**When:** Subscribe to external events (WebSocket, window events, timers)

```typescript
// ✅ WebSocket subscription
function ChatRoom({ roomId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    const ws = new WebSocket(`wss://chat.example.com/rooms/${roomId}`);

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      setMessages(prev => [...prev, message]);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    // Cleanup function - CRITICAL!
    return () => {
      ws.close();
    };
  }, [roomId]); // Reconnect when roomId changes

  return (
    <div>
      {messages.map(msg => <div key={msg.id}>{msg.text}</div>)}
    </div>
  );
}

// ✅ Window event subscription
function WindowSize() {
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  useEffect(() => {
    function handleResize() {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    }

    window.addEventListener('resize', handleResize);

    // Cleanup - remove listener!
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []); // Only set up once

  return <div>{size.width} x {size.height}</div>;
}

// ✅ Timer example
function Countdown({ seconds }: Props) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) return;

    const timerId = setInterval(() => {
      setRemaining(r => r - 1);
    }, 1000);

    // Cleanup - clear interval!
    return () => {
      clearInterval(timerId);
    };
  }, [remaining]);

  return <div>{remaining}s remaining</div>;
}
```

**Why useEffect:** External systems require cleanup to prevent memory leaks. Always return cleanup function for subscriptions.

---

### Solution 5: useLayoutEffect for synchronous DOM manipulation

**When:** Need to measure or manipulate DOM before browser paint

```typescript
// ✅ Use when you need to read layout and synchronously re-render
function Tooltip({ children, text }: Props) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    const tooltip = tooltipRef.current;
    if (!tooltip) return;

    // Measure DOM
    const rect = tooltip.getBoundingClientRect();

    // Update position based on measurement
    setPosition({
      top: rect.top - 40,
      left: rect.left + rect.width / 2
    });
  }, []); // Run once after mount

  return (
    <div>
      <div ref={tooltipRef}>{children}</div>
      <div
        style={{
          position: 'absolute',
          top: position.top,
          left: position.left
        }}
      >
        {text}
      </div>
    </div>
  );
}

// ✅ Focus input on mount
function SearchInput() {
  const inputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    inputRef.current?.focus();
  }, []);

  return <input ref={inputRef} type="search" />;
}
```

**Why useLayoutEffect:** Runs synchronously after DOM mutations but before browser paint. Prevents visual "flicker" from layout measurements.

---

### Solution 6: Event handler (NO useEffect!)

**When:** Run code in response to user action

```typescript
// ❌ WRONG - Don't use effect for user actions!
function Form() {
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (submitted) {
      // Submit logic here
      console.log('Submitting:', value);
      setSubmitted(false);
    }
  }, [submitted, value]);

  return (
    <form>
      <input value={value} onChange={(e) => setValue(e.target.value)} />
      <button onClick={() => setSubmitted(true)}>Submit</button>
    </form>
  );
}

// ✅ RIGHT - Use event handler directly!
function Form() {
  const [value, setValue] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    console.log('Submitting:', value);

    // Do async work directly in handler
    await fetch('/api/submit', {
      method: 'POST',
      body: JSON.stringify({ value })
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input value={value} onChange={(e) => setValue(e.target.value)} />
      <button type="submit">Submit</button>
    </form>
  );
}
```

**Why no effect:** User actions trigger event handlers. Do the work directly in the handler, not in an effect.

---

### Solution 7: Lazy initial state (NO useEffect!)

**When:** Initialize state with expensive computation

```typescript
// ❌ WRONG - Using effect to initialize state
function Component() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const expensiveData = computeExpensiveInitialValue();
    setData(expensiveData);
  }, []);

  return <div>{data}</div>;
}

// ✅ RIGHT - Use lazy initializer
function Component() {
  // Function only runs once on mount
  const [data, setData] = useState(() => {
    return computeExpensiveInitialValue();
  });

  return <div>{data}</div>;
}

// ✅ Another example - reading from localStorage
function Component() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ?? 'light';
  });

  // Sync changes back to localStorage
  useEffect(() => {
    localStorage.setItem('theme', theme);
  }, [theme]);

  return <div className={theme}>Content</div>;
}
```

**Why no effect for initialization:** useState accepts a function that only runs once. Use it for expensive initial state.

---

## Antipatterns: When NOT to Use useEffect

### Antipattern 1: Setting state based on props

❌ **WRONG:**
```typescript
function Component({ color }: Props) {
  const [selectedColor, setSelectedColor] = useState(color);

  // DON'T DO THIS!
  useEffect(() => {
    setSelectedColor(color);
  }, [color]);

  return <div style={{ color: selectedColor }}>Text</div>;
}
```

✅ **RIGHT - Option 1: Remove state entirely**
```typescript
function Component({ color }: Props) {
  // Just use the prop!
  return <div style={{ color }}>Text</div>;
}
```

✅ **RIGHT - Option 2: Use key to reset state**
```typescript
function Component({ color }: Props) {
  const [selectedColor, setSelectedColor] = useState(color);

  // Let user override color, but reset when color prop changes
  return <ColorPicker value={selectedColor} onChange={setSelectedColor} />;
}

// Usage: change key to force reset
<Component key={color} color={color} />
```

**Why it's wrong:** Creates unnecessary state synchronization. Either use the prop directly or use the `key` prop to reset state.

---

### Antipattern 2: Chains of effects

❌ **WRONG:**
```typescript
function Component() {
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);
  const [c, setC] = useState(0);

  useEffect(() => {
    setB(a * 2);
  }, [a]);

  useEffect(() => {
    setC(b + 10);
  }, [b]);

  // a changes → b updates → c updates (multiple renders!)
}
```

✅ **RIGHT - Compute during render:**
```typescript
function Component() {
  const [a, setA] = useState(0);

  // Compute b and c during render
  const b = a * 2;
  const c = b + 10;

  // Single render, no effects needed
}
```

**Why it's wrong:** Each effect causes a re-render. Chains create multiple re-renders and are hard to debug.

---

### Antipattern 3: Effects for event handling

❌ **WRONG:**
```typescript
function SearchBox() {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (query) {
      performSearch(query);
    }
  }, [query]);

  return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
}
```

✅ **RIGHT - Debounce in event handler or use specialized hook:**
```typescript
function SearchBox() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery) {
      performSearch(debouncedQuery);
    }
  }, [debouncedQuery]);

  return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
}

// Or use a library like use-debounce
import { useDebounce } from 'use-debounce';
```

**Why it's wrong (as written):** Searches on every keystroke. Need debouncing. But even then, consider if this should be in an effect or event handler.

---

### Antipattern 4: Fetching in effects without cleanup

❌ **WRONG:**
```typescript
function Component({ id }: Props) {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch(`/api/items/${id}`)
      .then(res => res.json())
      .then(setData); // Race condition! What if id changed?
  }, [id]);
}
```

✅ **RIGHT - Add cleanup:**
```typescript
function Component({ id }: Props) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/items/${id}`)
      .then(res => res.json())
      .then(result => {
        if (!cancelled) {
          setData(result);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);
}
```

**Why it's wrong:** Without cleanup, old requests can set state after component unmounts or after new requests start.

---

### Antipattern 5: Empty dependency array when values are used

❌ **WRONG:**
```typescript
function Component({ userId }: Props) {
  useEffect(() => {
    fetchUser(userId); // Uses userId but it's not in deps!
  }, []); // BUG: Will only fetch initial userId
}
```

✅ **RIGHT - Include all dependencies:**
```typescript
function Component({ userId }: Props) {
  useEffect(() => {
    fetchUser(userId);
  }, [userId]); // Re-fetch when userId changes
}
```

**Why it's wrong:** Effect will have stale values. Always include dependencies (or use ESLint rule to enforce).

---

## Decision Flowchart Shortcut

**Quick checklist before writing useEffect:**

1. **Am I deriving a value from props/state?**
   → Don't use effect. Compute during render or use `useMemo`.

2. **Am I responding to a user action?**
   → Don't use effect. Use event handler.

3. **Am I initializing state?**
   → Don't use effect (usually). Use lazy initializer in `useState`.

4. **Am I synchronizing with an external system?**
   → YES, use `useEffect`.

5. **Does the external system need cleanup?**
   → YES, return cleanup function.

6. **Does it need to run before browser paint?**
   → Use `useLayoutEffect` instead.

---

## Common Effect Patterns

### Pattern 1: Fetch data on mount or prop change

```typescript
useEffect(() => {
  let cancelled = false;

  async function fetchData() {
    const result = await fetch(`/api/data/${id}`);
    const json = await result.json();
    if (!cancelled) {
      setData(json);
    }
  }

  fetchData();

  return () => {
    cancelled = true;
  };
}, [id]);
```

### Pattern 2: Subscribe to external events

```typescript
useEffect(() => {
  function handleEvent(event) {
    // Handle event
  }

  eventEmitter.on('eventName', handleEvent);

  return () => {
    eventEmitter.off('eventName', handleEvent);
  };
}, []);
```

### Pattern 3: Sync to localStorage

```typescript
useEffect(() => {
  localStorage.setItem('key', JSON.stringify(value));
}, [value]);
```

### Pattern 4: Set up interval/timer

```typescript
useEffect(() => {
  const timerId = setInterval(() => {
    // Do something
  }, 1000);

  return () => {
    clearInterval(timerId);
  };
}, []);
```

---

## Effect Dependency Rules

**Rules (enforced by eslint-plugin-react-hooks):**

1. **Include ALL values used inside effect** in dependency array
2. **Functions and objects** should be memoized or moved inside effect
3. **Empty array `[]`** means "run once on mount"
4. **No array** means "run after every render" (rare!)

**Example of correct dependencies:**

```typescript
function Component({ userId, apiUrl }: Props) {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch(`${apiUrl}/users/${userId}`) // Uses apiUrl and userId
      .then(res => res.json())
      .then(setData);
  }, [apiUrl, userId]); // Both are in deps!
}
```

---

## See Also

- `@rules/hooks-rules.md` - General hook usage rules
- `@rules/dependency-arrays.md` - Effect dependencies and cleanup
- `@decision-trees/data-fetching.md` - Specific patterns for fetching data
- `@templates/component-with-effect.tsx` - Effect examples
