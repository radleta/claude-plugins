# React Expert Validation Checklist

**Purpose**: Comprehensive post-generation checklist to catch the Top 10 agent mistakes when working with React.

**When to use**: After generating or modifying React components, run through this checklist to ensure code quality, correctness, and adherence to React best practices.

**How to use**:
1. Review each category sequentially
2. Run automated checks where provided
3. Manually verify items that require code inspection
4. Fix any issues found before submitting for review

---

## Quick Validation Script

Run all automated checks at once:

```bash
# Run all automated checks
npx eslint --rule 'react-hooks/rules-of-hooks: error' --rule 'react-hooks/exhaustive-deps: error' src/
npx tsc --noEmit
grep -r "key={index}" src/ || echo "✅ No index keys found"
grep -r "key={i}" src/ || echo "✅ No index keys found"
grep -rE "if.*use[A-Z]|for.*use[A-Z]|while.*use[A-Z]" src/ || echo "✅ No conditional hooks found"
```

---

## 1. Hooks Compliance (7 items)

**Quick Check**: `grep -rE "if.*use[A-Z]|for.*use[A-Z]|while.*use[A-Z]" src/`

React Hooks must follow the Rules of Hooks. Violations cause bugs and unpredictable behavior.

### [ ] All hooks called at top level

**What to check**: No hooks inside conditions, loops, or nested functions

**Why it matters**: React relies on hook call order to maintain state between renders. Conditional hooks break this contract.

**Check**:
```bash
# Search for conditional hook calls
grep -rE "if.*use[A-Z]|for.*use[A-Z]|while.*use[A-Z]" src/
```

Manual review: Look for hooks inside if statements, loops, or callback functions

**Fix**:
```tsx
// ❌ WRONG
function Component({ shouldFetch }) {
  if (shouldFetch) {
    const data = useFetch('/api'); // Hook inside condition
  }
}

// ✅ CORRECT
function Component({ shouldFetch }) {
  const data = useFetch(shouldFetch ? '/api' : null); // Hook at top level
}
```

---

### [ ] Hooks called in consistent order

**What to check**: Same hooks, same order, every render. No early returns before all hooks.

**Why it matters**: React tracks hooks by their call order. Changing order causes state mismatches.

**Check**:
```bash
# Look for early returns before hooks
grep -A 20 "^function\|^const.*=.*=>.*{" src/**/*.tsx | grep -B 5 "return" | grep -A 5 "use[A-Z]"
```

Manual review: Ensure all hooks appear before any conditional returns

**Fix**:
```tsx
// ❌ WRONG
function Component({ data }) {
  if (!data) return null; // Early return
  const [state, setState] = useState(0); // Hook after return
}

// ✅ CORRECT
function Component({ data }) {
  const [state, setState] = useState(0); // All hooks first
  if (!data) return null; // Returns after hooks
}
```

---

### [ ] All useEffect dependencies included

**What to check**: Run ESLint exhaustive-deps rule to ensure all dependencies are included

**Why it matters**: Missing dependencies cause stale closures and bugs. Effects won't re-run when they should.

**Check**:
```bash
# Run ESLint with exhaustive-deps rule
npx eslint --rule 'react-hooks/exhaustive-deps: error' src/

# Or in package.json, ensure this rule is enabled:
# "react-hooks/exhaustive-deps": "error"
```

**Fix**:
```tsx
// ❌ WRONG
useEffect(() => {
  fetchData(userId); // userId not in deps
}, []); // Empty deps = missing userId

// ✅ CORRECT
useEffect(() => {
  fetchData(userId);
}, [userId]); // Include all dependencies
```

Use ESLint autofix:
```bash
npx eslint --fix --rule 'react-hooks/exhaustive-deps: error' src/
```

---

### [ ] Effect cleanup for subscriptions

**What to check**: useEffect returns cleanup for event listeners, timers, subscriptions

**Why it matters**: Missing cleanup causes memory leaks and unexpected behavior after unmount.

**Check**:
```bash
# Search for common subscription patterns without cleanup
grep -r "addEventListener" src/ -A 10 | grep -L "removeEventListener"
grep -r "setInterval" src/ -A 10 | grep -L "clearInterval"
grep -r "setTimeout" src/ -A 10 | grep -L "clearTimeout"
grep -r "subscribe" src/ -A 10 | grep -L "unsubscribe"
```

Manual review: Every effect with subscriptions should return a cleanup function

**Fix**:
```tsx
// ❌ WRONG
useEffect(() => {
  window.addEventListener('resize', handleResize);
  // No cleanup = memory leak
}, []);

// ✅ CORRECT
useEffect(() => {
  window.addEventListener('resize', handleResize);
  return () => {
    window.removeEventListener('resize', handleResize); // Cleanup
  };
}, []);
```

**Common patterns**:
```tsx
// Event listeners
return () => window.removeEventListener('event', handler);

// Timers
return () => clearInterval(intervalId);
return () => clearTimeout(timeoutId);

// Subscriptions
return () => subscription.unsubscribe();

// WebSocket
return () => socket.close();
```

---

### [ ] Custom hooks start with "use"

**What to check**: All custom hooks have "use" prefix

**Why it matters**: ESLint rules of hooks only apply to functions starting with "use". Without this, hook violations go undetected.

**Check**:
```bash
# Find functions that call hooks but don't start with "use"
grep -rE "^(function|const) [a-z][^u].*=.*=>.*{" src/ -A 20 | grep "use[A-Z]"
```

Manual review: Look for custom hook functions without "use" prefix

**Fix**:
```tsx
// ❌ WRONG
function fetchData() {
  const [data, setData] = useState(null);
  useEffect(() => { /* ... */ }, []);
  return data;
}

// ✅ CORRECT
function useFetchData() {
  const [data, setData] = useState(null);
  useEffect(() => { /* ... */ }, []);
  return data;
}
```

---

### [ ] useMemo/useCallback dependencies complete

**What to check**: Same as useEffect deps - all dependencies included in dependency array

**Why it matters**: Missing dependencies cause stale closures. Memoization won't update when it should.

**Check**:
```bash
# ESLint exhaustive-deps applies to all dependency arrays
npx eslint --rule 'react-hooks/exhaustive-deps: error' src/
```

**Fix**:
```tsx
// ❌ WRONG
const memoizedValue = useMemo(() => {
  return computeExpensiveValue(a, b); // b not in deps
}, [a]);

// ✅ CORRECT
const memoizedValue = useMemo(() => {
  return computeExpensiveValue(a, b);
}, [a, b]); // All dependencies included
```

---

### [ ] No object/array in deps without useMemo

**What to check**: Objects/arrays directly in dependency arrays cause infinite loops

**Why it matters**: New object/array created every render → dependency changes → effect runs → infinite loop

**Check**:
Manual review: Look for objects/arrays created inline in dependency arrays

**Fix**:
```tsx
// ❌ WRONG
useEffect(() => {
  fetchData(config);
}, [{ url: '/api', method: 'GET' }]); // New object every render = infinite loop

// ✅ CORRECT - Option 1: useMemo
const config = useMemo(() => ({ url: '/api', method: 'GET' }), []);
useEffect(() => {
  fetchData(config);
}, [config]);

// ✅ CORRECT - Option 2: Extract primitive values
const url = '/api';
const method = 'GET';
useEffect(() => {
  fetchData({ url, method });
}, [url, method]);

// ✅ CORRECT - Option 3: Move stable object outside component
const CONFIG = { url: '/api', method: 'GET' };
function Component() {
  useEffect(() => {
    fetchData(CONFIG);
  }, []); // CONFIG is stable, no dependency needed
}
```

---

## 2. State Management (5 items)

State management mistakes are among the most common React bugs. Immutability and proper update patterns are critical.

### [ ] No direct state mutation

**What to check**: All setState calls use immutable patterns

**Why it matters**: React uses reference equality to detect changes. Mutating state directly doesn't trigger re-renders.

**Check**:
```bash
# Search for common mutation patterns
grep -r "state\.push\|state\.pop\|state\.shift\|state\.unshift\|state\.splice" src/
grep -r "state\[.*\] =" src/
grep -r "state\..*=" src/
```

Manual review: Look for direct modifications to state objects/arrays

**Fix**:
```tsx
// ❌ WRONG - Arrays
const [items, setItems] = useState([]);
items.push(newItem); // Direct mutation
setItems(items); // Won't trigger re-render

// ✅ CORRECT - Arrays
setItems([...items, newItem]); // New array
setItems(items.concat(newItem)); // New array
setItems(prev => [...prev, newItem]); // Functional update

// ❌ WRONG - Objects
const [user, setUser] = useState({ name: 'John' });
user.name = 'Jane'; // Direct mutation
setUser(user); // Won't trigger re-render

// ✅ CORRECT - Objects
setUser({ ...user, name: 'Jane' }); // New object
setUser(prev => ({ ...prev, name: 'Jane' })); // Functional update
```

**Common immutable patterns**:
```tsx
// Add to array
setArray([...array, newItem]);

// Remove from array
setArray(array.filter(item => item.id !== id));

// Update array item
setArray(array.map(item =>
  item.id === id ? { ...item, updated: true } : item
));

// Update nested object
setUser({
  ...user,
  address: { ...user.address, city: 'New York' }
});
```

---

### [ ] State updates use functional form when depending on previous

**What to check**: Multiple setState calls or updates depending on previous value use `setState(prev => ...)`

**Why it matters**: setState is asynchronous. Multiple non-functional updates can use stale values.

**Check**:
Manual review: Look for setState calls that read from current state

**Fix**:
```tsx
// ❌ WRONG
const [count, setCount] = useState(0);
setCount(count + 1); // Uses stale count
setCount(count + 1); // Both use same stale value

// ✅ CORRECT
setCount(prev => prev + 1); // Uses latest value
setCount(prev => prev + 1); // Uses result of previous update

// ❌ WRONG
const [items, setItems] = useState([]);
setItems([...items, newItem]); // Uses stale items

// ✅ CORRECT
setItems(prev => [...prev, newItem]); // Uses latest items
```

**When to use functional updates**:
- Multiple updates in quick succession
- Updates in callbacks/async functions
- Updates that depend on previous state
- Updates inside loops or event handlers

---

### [ ] Complex state uses useReducer

**What to check**: 5+ related state variables or complex update logic should use useReducer

**Why it matters**: Multiple useState calls are hard to maintain. useReducer centralizes logic and guarantees atomic updates.

**Check**:
Manual review: Count useState calls and assess update complexity

**Fix**:
```tsx
// ❌ WRONG - Too many useState
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);
const [data, setData] = useState(null);
const [retryCount, setRetryCount] = useState(0);
const [lastFetch, setLastFetch] = useState(null);

// ✅ CORRECT - useReducer
const [state, dispatch] = useReducer(reducer, {
  loading: false,
  error: null,
  data: null,
  retryCount: 0,
  lastFetch: null,
});

function reducer(state, action) {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true, error: null };
    case 'FETCH_SUCCESS':
      return {
        ...state,
        loading: false,
        data: action.payload,
        lastFetch: Date.now()
      };
    case 'FETCH_ERROR':
      return {
        ...state,
        loading: false,
        error: action.error,
        retryCount: state.retryCount + 1
      };
    default:
      return state;
  }
}
```

**When to use useReducer**:
- 5+ related state variables
- Complex state update logic
- State transitions (loading → success → error)
- Multiple actions that affect same state
- Need to ensure atomic updates

---

### [ ] No derived state in useState

**What to check**: Values computed from props/state don't need useState

**Why it matters**: Derived state duplicates data and can get out of sync. Compute during render instead.

**Check**:
Manual review: Look for useState initialized from props or computed values

**Fix**:
```tsx
// ❌ WRONG
function Component({ items }) {
  const [filteredItems, setFilteredItems] = useState(
    items.filter(item => item.active)
  ); // Derived state

  useEffect(() => {
    setFilteredItems(items.filter(item => item.active));
  }, [items]); // Must sync manually
}

// ✅ CORRECT - Compute during render
function Component({ items }) {
  const filteredItems = items.filter(item => item.active);
  // Always in sync, no effect needed
}

// ✅ CORRECT - Expensive computation? Use useMemo
function Component({ items }) {
  const filteredItems = useMemo(
    () => items.filter(item => item.active),
    [items]
  );
}
```

**Common derived state mistakes**:
```tsx
// ❌ fullName from firstName/lastName
const [fullName, setFullName] = useState(`${firstName} ${lastName}`);

// ✅ Compute it
const fullName = `${firstName} ${lastName}`;

// ❌ total from items
const [total, setTotal] = useState(items.reduce(...));

// ✅ Compute it
const total = items.reduce((sum, item) => sum + item.price, 0);

// ❌ isValid from formData
const [isValid, setIsValid] = useState(validateForm(formData));

// ✅ Compute it
const isValid = validateForm(formData);
```

---

### [ ] State at appropriate level

**What to check**: Not too high (prop drilling) or too low (duplication)

**Why it matters**: State placement affects maintainability, performance, and code organization.

**Check**:
Manual review: Review state location and usage patterns

**Guidelines**:
1. **Start local** - Place state in component that uses it
2. **Lift up** - When multiple siblings need it, lift to common parent
3. **Context** - When many distant components need it
4. **Global store** - When truly global (Redux, Zustand, etc.)

**Fix**:
```tsx
// ❌ WRONG - State too high (prop drilling)
function App() {
  const [modalOpen, setModalOpen] = useState(false);
  return (
    <Layout>
      <Header modalOpen={modalOpen} />
      <Main modalOpen={modalOpen} />
      <Footer modalOpen={modalOpen} setModalOpen={setModalOpen} />
    </Layout>
  );
}

// ✅ CORRECT - State at appropriate level
function Footer() {
  const [modalOpen, setModalOpen] = useState(false);
  // Only Footer needs it
}

// ❌ WRONG - State too low (duplication)
function Parent() {
  return (
    <>
      <ChildA /> {/* Has own selectedId state */}
      <ChildB /> {/* Has own selectedId state */}
    </>
  );
}

// ✅ CORRECT - Lift state to parent
function Parent() {
  const [selectedId, setSelectedId] = useState(null);
  return (
    <>
      <ChildA selectedId={selectedId} onSelect={setSelectedId} />
      <ChildB selectedId={selectedId} onSelect={setSelectedId} />
    </>
  );
}
```

---

## 3. Props & TypeScript (5 items)

TypeScript prevents entire classes of bugs. Proper typing is mandatory for production React code.

### [ ] All props typed

**What to check**: Interface or type for component props. No implicit any.

**Why it matters**: Type safety catches bugs at compile time. Self-documenting code. Better autocomplete.

**Check**:
```bash
# TypeScript will catch untyped props
npx tsc --noEmit

# Look for components without prop types
grep -r "function.*({.*})" src/**/*.tsx | grep -v "interface\|type"
```

**Fix**:
```tsx
// ❌ WRONG - No types
function Button({ label, onClick, disabled }) {
  return <button onClick={onClick} disabled={disabled}>{label}</button>;
}

// ✅ CORRECT - Explicit interface
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

function Button({ label, onClick, disabled }: ButtonProps) {
  return <button onClick={onClick} disabled={disabled}>{label}</button>;
}

// ✅ ALSO CORRECT - Inline type
function Button({
  label,
  onClick,
  disabled
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return <button onClick={onClick} disabled={disabled}>{label}</button>;
}
```

---

### [ ] Event handlers typed correctly

**What to check**: React.ChangeEvent, React.MouseEvent, React.FormEvent, etc.

**Why it matters**: `event: any` loses type safety. Correct types enable autocomplete and catch errors.

**Check**:
```bash
# Look for event: any
grep -r "event: any" src/
grep -r "(event)" src/ | grep -v "React\."
```

**Fix**:
```tsx
// ❌ WRONG
function handleClick(event: any) {
  event.preventDefault();
}

function handleChange(event: any) {
  setValue(event.target.value);
}

// ✅ CORRECT
function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
  event.preventDefault();
}

function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
  setValue(event.target.value);
}

function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
}
```

**Common event types**:
```tsx
// Mouse events
React.MouseEvent<HTMLButtonElement>
React.MouseEvent<HTMLDivElement>

// Keyboard events
React.KeyboardEvent<HTMLInputElement>

// Form events
React.ChangeEvent<HTMLInputElement>
React.ChangeEvent<HTMLSelectElement>
React.ChangeEvent<HTMLTextAreaElement>
React.FormEvent<HTMLFormElement>

// Focus events
React.FocusEvent<HTMLInputElement>

// Generic element
React.SyntheticEvent<HTMLElement>
```

---

### [ ] Children prop typed

**What to check**: `children?: React.ReactNode` (React 18+)

**Why it matters**: React 18+ doesn't include children automatically. Must be explicit.

**Check**:
Manual review: Components using `props.children` without typing it

**Fix**:
```tsx
// ❌ WRONG - React 18+
interface CardProps {
  title: string;
  // children not typed
}

function Card({ title, children }: CardProps) {
  return <div><h2>{title}</h2>{children}</div>;
}

// ✅ CORRECT
interface CardProps {
  title: string;
  children?: React.ReactNode;
}

function Card({ title, children }: CardProps) {
  return <div><h2>{title}</h2>{children}</div>;
}
```

**Children type options**:
```tsx
// Any renderable content (most common)
children?: React.ReactNode;

// Single React element
children?: React.ReactElement;

// Only string/number
children?: string | number;

// Function as children
children?: (data: Data) => React.ReactNode;

// Required children
children: React.ReactNode;
```

---

### [ ] Generic components properly constrained

**What to check**: Type parameters have constraints. Not just `<T>`.

**Why it matters**: Unconstrained generics lose type safety. Constraints document requirements.

**Check**:
Manual review: Look for generic components with unconstrained `<T>`

**Fix**:
```tsx
// ❌ WRONG - Unconstrained
function List<T>({ items }: { items: T[] }) {
  return items.map(item => <div>{item.id}</div>); // Error: T might not have id
}

// ✅ CORRECT - Constrained
interface HasId {
  id: string | number;
}

function List<T extends HasId>({ items }: { items: T[] }) {
  return items.map(item => <div key={item.id}>{item.id}</div>); // Safe
}

// ✅ BETTER - Multiple constraints
interface Item extends HasId {
  name: string;
}

function List<T extends Item>({ items }: { items: T[] }) {
  return items.map(item => (
    <div key={item.id}>
      {item.name} {/* Both id and name guaranteed */}
    </div>
  ));
}
```

---

### [ ] No implicit any

**What to check**: TypeScript strict mode passes. No implicit any types.

**Why it matters**: Implicit any defeats the purpose of TypeScript. Loses all type safety.

**Check**:
```bash
# Run TypeScript compiler
npx tsc --noEmit

# Check tsconfig.json has strict mode
grep -A 5 "compilerOptions" tsconfig.json | grep "strict"
```

**Fix tsconfig.json**:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true
  }
}
```

**Fix implicit any**:
```tsx
// ❌ WRONG
function process(data) { // Implicit any
  return data.map(item => item.value); // Any
}

// ✅ CORRECT
function process(data: Array<{ value: number }>) {
  return data.map(item => item.value);
}
```

---

## 4. Lists & Keys (4 items)

Keys are critical for React's reconciliation algorithm. Incorrect keys cause serious bugs.

### [ ] Key prop on mapped elements

**What to check**: All `.map()` returns have key prop

**Why it matters**: React needs keys to track which items changed. Missing keys cause rendering bugs.

**Check**:
```bash
# Search for .map without key
grep -r "\.map(" src/ -A 3 | grep -v "key="
```

Manual review: Every element returned from `.map()` needs a key

**Fix**:
```tsx
// ❌ WRONG
items.map(item => <div>{item.name}</div>)

// ✅ CORRECT
items.map(item => <div key={item.id}>{item.name}</div>)
```

---

### [ ] No array indexes as keys

**What to check**: Keys use item.id or stable identifier, not array index

**Why it matters**: Index keys cause bugs when list order changes. Items lose identity and state.

**Check**:
```bash
# Search for index as key
grep -r "key={index}" src/
grep -r "key={i}" src/
grep -r "\.map((.*,.*i.*)" src/ -A 2 | grep "key={i"
```

**Fix**:
```tsx
// ❌ WRONG
items.map((item, index) => <div key={index}>{item.name}</div>)

// ✅ CORRECT
items.map(item => <div key={item.id}>{item.name}</div>)

// ✅ IF NO ID - Generate stable ID once
const itemsWithIds = items.map(item => ({
  ...item,
  id: `${item.name}-${item.timestamp}` // Stable identifier
}));

itemsWithIds.map(item => <div key={item.id}>{item.name}</div>)
```

**When index keys cause bugs**:
```tsx
// User reorders list → wrong items get selected
// User filters list → state attached to wrong items
// User adds item at start → all items re-render unnecessarily
```

**Exceptions** (index keys OK):
- Static list that never changes
- List has no reordering, filtering, or additions
- Items have no state or identity

---

### [ ] Keys unique among siblings

**What to check**: No duplicate keys at same level

**Why it matters**: Duplicate keys break React's reconciliation. Causes silent bugs.

**Check**:
Manual review: Verify key values are unique

**Fix**:
```tsx
// ❌ WRONG - Same key used multiple times
<>
  <Item key="item" data={data1} />
  <Item key="item" data={data2} /> {/* Duplicate key */}
</>

// ✅ CORRECT
<>
  <Item key={data1.id} data={data1} />
  <Item key={data2.id} data={data2} />
</>

// ❌ WRONG - Non-unique compound key
items.map(item => (
  <div key={item.category}> {/* Multiple items per category */}
    {item.name}
  </div>
))

// ✅ CORRECT - Unique compound key
items.map(item => (
  <div key={`${item.category}-${item.id}`}>
    {item.name}
  </div>
))
```

---

### [ ] Key on correct element

**What to check**: Key on the component returned from .map(), not nested inside

**Why it matters**: React needs the key on the direct child of the mapped array.

**Check**:
Manual review: Verify key placement

**Fix**:
```tsx
// ❌ WRONG - Key on wrong element
items.map(item => (
  <div>
    <Card key={item.id} title={item.title} /> {/* Key inside wrapper */}
  </div>
))

// ✅ CORRECT - Key on outer element
items.map(item => (
  <div key={item.id}>
    <Card title={item.title} />
  </div>
))

// ✅ ALSO CORRECT - Key on component itself
items.map(item => (
  <Card key={item.id} title={item.title} />
))

// ❌ WRONG - Fragment without key
items.map(item => (
  <>
    <dt>{item.term}</dt>
    <dd>{item.definition}</dd>
  </>
))

// ✅ CORRECT - Key on Fragment
items.map(item => (
  <React.Fragment key={item.id}>
    <dt>{item.term}</dt>
    <dd>{item.definition}</dd>
  </React.Fragment>
))
```

---

## 5. Effects & Lifecycle (4 items)

Effects are one of the most misused React features. Use them only for synchronization with external systems.

### [ ] Effects not overused

**What to check**: Effects only for side effects, not for deriving values

**Why it matters**: Effects add complexity and bugs. Most derived values should be computed during render.

**Check**:
Manual review: Look for useEffect that computes values

**Fix**:
```tsx
// ❌ WRONG - Effect for derived value
function Component({ items }) {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setTotal(items.reduce((sum, item) => sum + item.price, 0));
  }, [items]); // Unnecessary effect
}

// ✅ CORRECT - Compute during render
function Component({ items }) {
  const total = items.reduce((sum, item) => sum + item.price, 0);
}

// ✅ EXPENSIVE? Use useMemo
function Component({ items }) {
  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.price, 0),
    [items]
  );
}
```

**When to use useEffect**:
- Fetching data from API
- Setting up subscriptions
- Manually manipulating DOM
- Logging analytics
- Synchronizing with external systems (localStorage, WebSocket, etc.)

**When NOT to use useEffect**:
- Computing derived values → compute during render
- Transforming data for rendering → compute during render
- Handling user events → use event handlers
- Initializing state → use useState initializer or lazy initialization

---

### [ ] Dependencies not omitted

**What to check**: No empty deps `[]` when variables are used inside effect

**Why it matters**: Missing dependencies cause stale closures. Effect uses old values.

**Check**:
```bash
# ESLint exhaustive-deps
npx eslint --rule 'react-hooks/exhaustive-deps: error' src/
```

**Fix**:
```tsx
// ❌ WRONG
function Component({ userId }) {
  useEffect(() => {
    fetchUser(userId); // userId used but not in deps
  }, []); // Missing dependency
}

// ✅ CORRECT
function Component({ userId }) {
  useEffect(() => {
    fetchUser(userId);
  }, [userId]); // Include all dependencies
}

// ❌ WRONG - Stale closure
function Component() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      console.log(count); // Always logs 0 (stale)
    }, 1000);
    return () => clearInterval(id);
  }, []); // Missing count dependency
}

// ✅ CORRECT
function Component() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      console.log(count); // Logs current count
    }, 1000);
    return () => clearInterval(id);
  }, [count]); // Include count
}
```

---

### [ ] Cleanup prevents memory leaks

**What to check**: Subscriptions, timers, listeners cleaned up

**Why it matters**: No cleanup = memory leaks, multiple subscriptions, unexpected behavior.

**Check**:
```bash
# Look for subscription patterns without cleanup
grep -r "addEventListener\|setInterval\|setTimeout\|subscribe" src/ -A 10 | grep -L "return.*=>"
```

**Fix**:
See "Effect cleanup for subscriptions" in section 1.

---

### [ ] Effect timing correct

**What to check**: useEffect vs useLayoutEffect choice appropriate

**Why it matters**: Wrong timing causes flicker or performance issues.

**Check**:
Manual review: Verify effect timing matches use case

**Guidelines**:

**useEffect** (default - 99% of cases):
- Fetching data
- Setting up subscriptions
- Logging
- Most side effects
- Runs AFTER browser paint (non-blocking)

**useLayoutEffect** (rare - only when necessary):
- Reading layout from DOM (scroll position, element size)
- Synchronous DOM mutations before paint
- Preventing visual flicker
- Runs BEFORE browser paint (blocks painting)

**Fix**:
```tsx
// ❌ WRONG - Causes flicker
function Component() {
  const [height, setHeight] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    // Runs after paint → user sees height 0 first → flicker
    setHeight(ref.current.offsetHeight);
  }, []);

  return <div ref={ref} style={{ height }} />;
}

// ✅ CORRECT - No flicker
function Component() {
  const [height, setHeight] = useState(0);
  const ref = useRef(null);

  useLayoutEffect(() => {
    // Runs before paint → no flicker
    setHeight(ref.current.offsetHeight);
  }, []);

  return <div ref={ref} style={{ height }} />;
}
```

**Warning**: useLayoutEffect blocks painting. Only use when necessary. Causes performance issues if overused.

---

## 6. Performance (3 items)

Performance optimization should be measured, not guessed. Premature optimization adds complexity without benefit.

### [ ] No premature optimization

**What to check**: Memo/useMemo/useCallback only when measured slow

**Why it matters**: Memoization adds complexity and memory overhead. Often slower than re-rendering.

**Check**:
Manual review: Look for memoization without profiler data or performance issues

**Guidelines**:

**DON'T memoize** unless:
- React Profiler shows slow renders
- Component is in a hot path (renders frequently)
- Expensive computation measured with console.time()
- Preventing child re-renders is measured improvement

**DO optimize when**:
- Profiler shows component taking >16ms
- List with 100+ items re-rendering
- Expensive calculation measured >10ms
- Context causing excessive re-renders

**Fix**:
```tsx
// ❌ PREMATURE - No evidence it's slow
const MemoizedComponent = React.memo(SimpleComponent);

function Parent() {
  const value = useMemo(() => someValue, [someValue]);
  const handler = useCallback(() => {}, []);
  return <MemoizedComponent value={value} onClick={handler} />;
}

// ✅ START SIMPLE
function Parent() {
  return <SimpleComponent value={someValue} onClick={() => {}} />;
}

// ✅ OPTIMIZE IF MEASURED SLOW
// 1. Use React Profiler
// 2. Identify slow components
// 3. Apply targeted optimization
// 4. Measure improvement
```

**Measuring performance**:
```tsx
// Use React Profiler in DevTools
// Or programmatic profiling:
console.time('expensive-calc');
const result = expensiveCalculation();
console.timeEnd('expensive-calc');
```

---

### [ ] Expensive calculations memoized

**What to check**: Heavy computations use useMemo with correct deps

**Why it matters**: Running expensive calculations every render wastes CPU and causes lag.

**Check**:
Manual review: Find expensive operations in render function

**What's expensive**:
- Array operations on 1000+ items
- Recursive algorithms
- Complex transformations
- Data processing
- Sorting/filtering large datasets

**Fix**:
```tsx
// ❌ WRONG - Expensive calculation every render
function Component({ items }) {
  const sorted = items
    .map(item => ({ ...item, score: calculateScore(item) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10); // Runs every render

  return <List items={sorted} />;
}

// ✅ CORRECT - Memoize expensive calculation
function Component({ items }) {
  const sorted = useMemo(() => {
    return items
      .map(item => ({ ...item, score: calculateScore(item) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [items]); // Only recalculate when items change

  return <List items={sorted} />;
}
```

**Measurement threshold**:
```tsx
// Measure first
console.time('calculation');
const result = expensiveCalculation();
console.timeEnd('calculation');
// If > 10ms, consider useMemo
```

---

### [ ] List virtualization for large lists

**What to check**: 100+ items use react-window, react-virtualized, or similar

**Why it matters**: Rendering 1000+ DOM nodes causes performance issues. Virtualization renders only visible items.

**Check**:
Manual review: Find lists rendering 100+ items

**Fix**:
```tsx
// ❌ WRONG - Rendering 1000 items
function Component({ items }) {
  return (
    <div>
      {items.map(item => <div key={item.id}>{item.name}</div>)}
    </div>
  );
}

// ✅ CORRECT - Virtualize large list
import { FixedSizeList } from 'react-window';

function Component({ items }) {
  return (
    <FixedSizeList
      height={600}
      itemCount={items.length}
      itemSize={35}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style} key={items[index].id}>
          {items[index].name}
        </div>
      )}
    </FixedSizeList>
  );
}
```

**Libraries**:
- `react-window` - Lightweight, recommended for most cases
- `react-virtualized` - Feature-rich, larger bundle
- `@tanstack/react-virtual` - Headless, flexible

**When to virtualize**:
- 100+ items: Consider it
- 500+ items: Strongly recommended
- 1000+ items: Essential
- Infinite scroll: Essential

---

## 7. Accessibility (2 items)

Accessibility is not optional. All interactive elements must be keyboard navigable and screen reader friendly.

### [ ] Semantic HTML

**What to check**: Buttons are `<button>`, not `<div onClick>`. Use semantic elements.

**Why it matters**: Screen readers, keyboard navigation, SEO all depend on semantic HTML.

**Check**:
```bash
# Look for div/span with onClick
grep -r "<div.*onClick" src/
grep -r "<span.*onClick" src/
```

Manual review: Verify semantic HTML usage

**Fix**:
```tsx
// ❌ WRONG
<div onClick={handleClick}>Click me</div>
<span onClick={handleSubmit}>Submit</span>

// ✅ CORRECT
<button onClick={handleClick}>Click me</button>
<button type="submit" onClick={handleSubmit}>Submit</button>

// ❌ WRONG - Non-semantic structure
<div>
  <div>Title</div>
  <div>Subtitle</div>
  <div>
    <div onClick={handleEdit}>Edit</div>
  </div>
</div>

// ✅ CORRECT - Semantic structure
<article>
  <h2>Title</h2>
  <p>Subtitle</p>
  <footer>
    <button onClick={handleEdit}>Edit</button>
  </footer>
</article>
```

**Semantic HTML elements**:
- `<button>` - Clickable actions
- `<a>` - Navigation links
- `<nav>` - Navigation sections
- `<main>` - Main content
- `<header>` / `<footer>` - Page sections
- `<article>` / `<section>` - Content sections
- `<h1>` - `<h6>` - Headings
- `<ul>` / `<ol>` / `<li>` - Lists
- `<form>` - Forms
- `<label>` - Form labels
- `<input>` / `<select>` / `<textarea>` - Form controls

---

### [ ] ARIA labels where needed

**What to check**: Inputs have labels, images have alt text, interactive elements have accessible names

**Why it matters**: Screen readers can't describe unlabeled elements. Inaccessible to visually impaired users.

**Check**:
```bash
# Look for inputs without labels
grep -r "<input" src/ | grep -v "aria-label\|id="

# Look for images without alt
grep -r "<img" src/ | grep -v "alt="

# Look for buttons without text
grep -r "<button.*onClick" src/ -A 1 | grep -v "aria-label" | grep ">"
```

**Fix**:
```tsx
// ❌ WRONG - No label
<input type="text" />

// ✅ CORRECT - Label with for/id
<label htmlFor="username">Username</label>
<input id="username" type="text" />

// ✅ ALSO CORRECT - Wrapping label
<label>
  Username
  <input type="text" />
</label>

// ✅ ARIA LABEL - When visual label not desired
<input type="text" aria-label="Username" />

// ❌ WRONG - Image without alt
<img src="/logo.png" />

// ✅ CORRECT
<img src="/logo.png" alt="Company Logo" />

// ✅ DECORATIVE - Empty alt for decorative images
<img src="/decoration.png" alt="" />

// ❌ WRONG - Icon button without label
<button onClick={handleDelete}>
  <TrashIcon />
</button>

// ✅ CORRECT - aria-label for icon button
<button onClick={handleDelete} aria-label="Delete item">
  <TrashIcon />
</button>

// ❌ WRONG - No form structure
<div>
  <input type="text" />
  <input type="password" />
  <button>Login</button>
</div>

// ✅ CORRECT - Proper form with labels
<form onSubmit={handleSubmit}>
  <label htmlFor="email">Email</label>
  <input id="email" type="email" required />

  <label htmlFor="password">Password</label>
  <input id="password" type="password" required />

  <button type="submit">Login</button>
</form>
```

**Common ARIA attributes**:
- `aria-label` - Accessible name for element
- `aria-labelledby` - ID of element that labels this element
- `aria-describedby` - ID of element that describes this element
- `aria-hidden` - Hide from screen readers
- `role` - Semantic role when HTML element insufficient
- `aria-live` - Announce dynamic content changes
- `aria-expanded` - Collapsible state
- `aria-pressed` - Toggle button state

**Keyboard navigation**:
```tsx
// Ensure interactive elements are keyboard accessible
<button onKeyDown={handleKeyDown} onClick={handleClick}>
  Action
</button>

// Tab order with tabIndex
<div tabIndex={0} role="button" onClick={handleClick}>
  Custom button
</div>
```

---

## Validation Complete

After checking all items:

- [ ] **All automated checks pass** (ESLint, TypeScript, grep commands)
- [ ] **All manual reviews completed**
- [ ] **All issues fixed or documented**
- [ ] **Code ready for peer review**

---

## Summary Statistics

**Total checks**: 30 items across 7 categories
- Hooks Compliance: 7 items
- State Management: 5 items
- Props & TypeScript: 5 items
- Lists & Keys: 4 items
- Effects & Lifecycle: 4 items
- Performance: 3 items
- Accessibility: 2 items

**Automated checks**: 12 items (grep, ESLint, TypeScript)
**Manual checks**: 18 items (code review, pattern inspection)

**Time estimate**: 10-15 minutes for thorough validation

---

## Next Steps

1. **Run automated checks** - Execute quick validation script
2. **Review each category** - Go through items systematically
3. **Fix issues** - Address problems found
4. **Document exceptions** - Note any intentional deviations
5. **Submit for review** - Code is ready for peer review

This checklist catches the top 10 agent mistakes and ensures production-ready React code.
