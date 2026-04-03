# State Management Decision Tree

## When to Use This Tree

Use this tree when you need to decide **how to store and manage state** in a React application. This is one of the most common architectural decisions and also one of the most frequently done wrong.

## The Core Question

**"What kind of state am I dealing with, and how should I manage it?"**

---

## The Decision Tree

```
Start: What kind of state is this?

├─ Simple value (single number, string, boolean, or simple object)
│   │
│   ├─ Used in ONE component only?
│   │   └─ → Use useState in that component
│   │
│   └─ Needed by MULTIPLE components?
│       │
│       ├─ Parent-child relationship (2-3 levels deep)?
│       │   └─ → Lift state to common parent, pass as props
│       │
│       └─ Deep nesting (4+ levels) OR many unrelated components?
│           └─ → Use Context API
│
├─ Complex state (object with multiple related fields, arrays of objects)
│   │
│   ├─ 2-4 fields with simple updates (set entire object)?
│   │   └─ → useState with object
│   │
│   └─ 5+ fields OR complex update logic (partial updates, computed values)?
│       └─ → useReducer with typed actions
│
└─ Global application state (auth, theme, user profile, app settings)
    │
    ├─ Simple global state (<5 state fields)?
    │   └─ → Context API with provider
    │
    └─ Complex global state (≥5 fields OR multiple features OR cross-cutting concerns)?
        │
        ├─ Need time-travel debugging, middleware, or DevTools?
        │   └─ → Redux Toolkit (RTK)
        │
        ├─ Need simple API, minimal boilerplate?
        │   └─ → Zustand
        │
        ├─ Need atomic state, fine-grained reactivity?
        │   └─ → Jotai or Recoil
        │
        └─ Need state machines, predictable state transitions?
            └─ → XState
```

---

## Code Examples for Each Solution

### Solution 1: useState in single component

**When:** Simple value, one component only

```typescript
// ✅ Perfect for local, simple state
function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}
```

**Use for:** Form inputs, toggles, local UI state, component-specific values

---

### Solution 2: Lift state to parent, pass props

**When:** Multiple components, parent-child relationship (2-3 levels)

```typescript
// ✅ Good for related components with shallow nesting
function ParentForm() {
  const [email, setEmail] = useState('');
  const [isValid, setIsValid] = useState(false);

  return (
    <div>
      <EmailInput
        value={email}
        onChange={setEmail}
        onValidationChange={setIsValid}
      />
      <SubmitButton disabled={!isValid} />
    </div>
  );
}

function EmailInput({ value, onChange, onValidationChange }: Props) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    onValidationChange(newValue.includes('@'));
  };

  return <input type="email" value={value} onChange={handleChange} />;
}
```

**Use for:** Form state, coordinated UI elements, sibling component communication

---

### Solution 3: Context API

**When:** Multiple components, deep nesting (4+) or many unrelated components

```typescript
// ✅ Good for avoiding prop drilling
interface ThemeContextValue {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

// Usage anywhere in tree
function Button() {
  const { theme } = useTheme();
  return <button className={theme}>Click me</button>;
}
```

**Use for:** Theme, locale, simple auth state, feature flags (< 5 values)

---

### Solution 4: useState with object

**When:** Complex state with 2-4 fields, simple updates

```typescript
// ✅ Good for forms with 2-4 fields
interface FormData {
  name: string;
  email: string;
  age: number;
}

function SimpleForm() {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    age: 0
  });

  // Update entire object
  const handleNameChange = (name: string) => {
    setFormData({ ...formData, name });
  };

  // Or use single handler
  const handleChange = (field: keyof FormData, value: string | number) => {
    setFormData({ ...formData, [field]: value });
  };

  return (
    <form>
      <input
        value={formData.name}
        onChange={(e) => handleChange('name', e.target.value)}
      />
      <input
        value={formData.email}
        onChange={(e) => handleChange('email', e.target.value)}
      />
      <input
        type="number"
        value={formData.age}
        onChange={(e) => handleChange('age', parseInt(e.target.value))}
      />
    </form>
  );
}
```

**Use for:** Small forms, simple multi-field state, coordinated values

---

### Solution 5: useReducer with typed actions

**When:** Complex state with 5+ fields OR complex update logic

```typescript
// ✅ Best for complex state with interdependent fields
interface CartState {
  items: Array<{ id: string; quantity: number; price: number }>;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  discountCode?: string;
  discountAmount: number;
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: { id: string; price: number } }
  | { type: 'REMOVE_ITEM'; payload: { id: string } }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'APPLY_DISCOUNT'; payload: { code: string; amount: number } }
  | { type: 'CLEAR_CART' };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existingItem = state.items.find(item => item.id === action.payload.id);
      const items = existingItem
        ? state.items.map(item =>
            item.id === action.payload.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          )
        : [...state.items, { ...action.payload, quantity: 1 }];

      const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const tax = subtotal * 0.08;
      const shipping = subtotal > 50 ? 0 : 5.99;
      const total = subtotal + tax + shipping - state.discountAmount;

      return { ...state, items, subtotal, tax, shipping, total };
    }

    case 'REMOVE_ITEM': {
      const items = state.items.filter(item => item.id !== action.payload.id);
      const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const tax = subtotal * 0.08;
      const shipping = subtotal > 50 ? 0 : 5.99;
      const total = subtotal + tax + shipping - state.discountAmount;

      return { ...state, items, subtotal, tax, shipping, total };
    }

    case 'UPDATE_QUANTITY': {
      const items = state.items.map(item =>
        item.id === action.payload.id
          ? { ...item, quantity: action.payload.quantity }
          : item
      );
      const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const tax = subtotal * 0.08;
      const shipping = subtotal > 50 ? 0 : 5.99;
      const total = subtotal + tax + shipping - state.discountAmount;

      return { ...state, items, subtotal, tax, shipping, total };
    }

    case 'APPLY_DISCOUNT':
      return {
        ...state,
        discountCode: action.payload.code,
        discountAmount: action.payload.amount,
        total: state.subtotal + state.tax + state.shipping - action.payload.amount
      };

    case 'CLEAR_CART':
      return {
        items: [],
        subtotal: 0,
        tax: 0,
        shipping: 0,
        total: 0,
        discountAmount: 0
      };

    default:
      return state;
  }
}

function ShoppingCart() {
  const [state, dispatch] = useReducer(cartReducer, {
    items: [],
    subtotal: 0,
    tax: 0,
    shipping: 0,
    total: 0,
    discountAmount: 0
  });

  const addItem = (id: string, price: number) => {
    dispatch({ type: 'ADD_ITEM', payload: { id, price } });
  };

  return (
    <div>
      <ul>
        {state.items.map(item => (
          <li key={item.id}>
            {item.id} - ${item.price} x {item.quantity}
          </li>
        ))}
      </ul>
      <p>Subtotal: ${state.subtotal.toFixed(2)}</p>
      <p>Tax: ${state.tax.toFixed(2)}</p>
      <p>Shipping: ${state.shipping.toFixed(2)}</p>
      <p>Total: ${state.total.toFixed(2)}</p>
    </div>
  );
}
```

**Use for:** Forms with 5+ fields, computed values, interdependent state, undo/redo

---

### Solution 6: Redux Toolkit (RTK)

**When:** Complex global state, need DevTools, middleware, or time-travel debugging

```typescript
// ✅ Best for large apps with complex global state
import { createSlice, configureStore, PayloadAction } from '@reduxjs/toolkit';

interface AuthState {
  user: { id: string; name: string; email: string } | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    token: null,
    isLoading: false,
    error: null
  } as AuthState,
  reducers: {
    loginStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    loginSuccess: (state, action: PayloadAction<{ user: AuthState['user']; token: string }>) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isLoading = false;
    },
    loginFailure: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
    }
  }
});

export const { loginStart, loginSuccess, loginFailure, logout } = authSlice.actions;

const store = configureStore({
  reducer: {
    auth: authSlice.reducer
  }
});

// Usage in components
function LoginButton() {
  const dispatch = useDispatch();
  const { isLoading } = useSelector((state: RootState) => state.auth);

  const handleLogin = async () => {
    dispatch(loginStart());
    try {
      const response = await fetch('/api/login', { method: 'POST' });
      const data = await response.json();
      dispatch(loginSuccess({ user: data.user, token: data.token }));
    } catch (error) {
      dispatch(loginFailure(error.message));
    }
  };

  return <button onClick={handleLogin} disabled={isLoading}>Login</button>;
}
```

**Use for:** Large apps, multiple features sharing state, complex async logic

---

### Solution 7: Zustand

**When:** Complex global state but want minimal boilerplate

```typescript
// ✅ Best for simple API with global state
import create from 'zustand';

interface UserStore {
  user: { id: string; name: string } | null;
  theme: 'light' | 'dark';
  setUser: (user: UserStore['user']) => void;
  toggleTheme: () => void;
  logout: () => void;
}

const useUserStore = create<UserStore>((set) => ({
  user: null,
  theme: 'light',
  setUser: (user) => set({ user }),
  toggleTheme: () => set((state) => ({
    theme: state.theme === 'light' ? 'dark' : 'light'
  })),
  logout: () => set({ user: null })
}));

// Usage - super simple!
function UserProfile() {
  const user = useUserStore((state) => state.user);
  const logout = useUserStore((state) => state.logout);

  if (!user) return <div>Not logged in</div>;

  return (
    <div>
      <p>Welcome, {user.name}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

**Use for:** Global state with less ceremony than Redux, medium-sized apps

---

### Solution 8: Jotai (Atomic State)

**When:** Need fine-grained reactivity, atomic state updates

```typescript
// ✅ Best for granular, composable state
import { atom, useAtom } from 'jotai';

// Define atoms
const emailAtom = atom('');
const passwordAtom = atom('');

// Derived atom
const isValidAtom = atom((get) => {
  const email = get(emailAtom);
  const password = get(passwordAtom);
  return email.includes('@') && password.length >= 8;
});

function EmailInput() {
  const [email, setEmail] = useAtom(emailAtom);
  return <input value={email} onChange={(e) => setEmail(e.target.value)} />;
}

function PasswordInput() {
  const [password, setPassword] = useAtom(passwordAtom);
  return <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />;
}

function SubmitButton() {
  const [isValid] = useAtom(isValidAtom);
  return <button disabled={!isValid}>Submit</button>;
}
```

**Use for:** Composable state, derived values, granular subscriptions

---

## Antipatterns: Common Wrong Choices

### Antipattern 1: Using Redux for Everything

❌ **Wrong:**
```typescript
// Using Redux for simple local UI state
const uiSlice = createSlice({
  name: 'ui',
  initialState: { isModalOpen: false },
  reducers: {
    openModal: (state) => { state.isModalOpen = true; },
    closeModal: (state) => { state.isModalOpen = false; }
  }
});
```

✅ **Right:**
```typescript
// Just use useState!
function MyComponent() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  return <button onClick={() => setIsModalOpen(true)}>Open</button>;
}
```

**Why it's wrong:** Adding Redux overhead (actions, reducers, selectors) for state that's only used in one component is unnecessary complexity.

---

### Antipattern 2: Prop Drilling Instead of Context

❌ **Wrong:**
```typescript
// Passing theme through 5 levels
<App theme={theme}>
  <Layout theme={theme}>
    <Sidebar theme={theme}>
      <Nav theme={theme}>
        <Button theme={theme} />
      </Nav>
    </Sidebar>
  </Layout>
</App>
```

✅ **Right:**
```typescript
// Use Context to avoid prop drilling
<ThemeProvider value={theme}>
  <App>
    <Layout>
      <Sidebar>
        <Nav>
          <Button /> {/* Gets theme from useTheme() hook */}
        </Nav>
      </Sidebar>
    </Layout>
  </App>
</ThemeProvider>
```

**Why it's wrong:** Prop drilling makes code brittle and hard to maintain. Context solves this.

---

### Antipattern 3: Using useState for Complex Interdependent State

❌ **Wrong:**
```typescript
// Multiple related useState calls
const [items, setItems] = useState([]);
const [subtotal, setSubtotal] = useState(0);
const [tax, setTax] = useState(0);
const [total, setTotal] = useState(0);

// Have to manually keep in sync!
const addItem = (item) => {
  const newItems = [...items, item];
  setItems(newItems);
  const newSubtotal = calculateSubtotal(newItems);
  setSubtotal(newSubtotal);
  setTax(newSubtotal * 0.08);
  setTotal(newSubtotal * 1.08);
};
```

✅ **Right:**
```typescript
// Use useReducer for interdependent state
const [state, dispatch] = useReducer(cartReducer, initialState);

const addItem = (item) => {
  dispatch({ type: 'ADD_ITEM', payload: item });
  // Reducer handles all derived calculations
};
```

**Why it's wrong:** Easy to forget updating one piece of state, leading to bugs.

---

### Antipattern 4: Using Context for High-Frequency Updates

❌ **Wrong:**
```typescript
// Context value changes on every mouse move!
function App() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  return (
    <MouseContext.Provider value={mousePos}>
      <div onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}>
        <ExpensiveComponent /> {/* Re-renders on every mouse move! */}
      </div>
    </MouseContext.Provider>
  );
}
```

✅ **Right:**
```typescript
// Use Zustand or Jotai for high-frequency updates
const useMouseStore = create((set) => ({
  x: 0,
  y: 0,
  setPosition: (x, y) => set({ x, y })
}));

// Components only subscribe to what they need
function MouseX() {
  const x = useMouseStore((state) => state.x); // Only re-renders when x changes
  return <div>{x}</div>;
}
```

**Why it's wrong:** Context causes ALL consumers to re-render on any change. Use atomic state for high-frequency updates.

---

## Decision Criteria Summary

| Criteria | Solution |
|----------|----------|
| Local to 1 component | `useState` |
| 2-3 components, shallow nesting | Lift state + props |
| Deep nesting (4+ levels) | Context API |
| 2-4 fields, simple updates | `useState` with object |
| 5+ fields OR complex logic | `useReducer` |
| Simple global state (< 5 fields) | Context API |
| Complex global + DevTools | Redux Toolkit |
| Complex global + minimal code | Zustand |
| Atomic, fine-grained | Jotai/Recoil |
| State machines | XState |

---

## When to Re-evaluate Your Choice

**Upgrade from useState to useReducer when:**
- You add a 5th field to your state object
- You find yourself writing the same update logic in multiple places
- State updates depend on previous state in complex ways

**Upgrade from Context to Zustand/Redux when:**
- Context provider causes performance issues
- You need middleware (logging, persistence)
- State logic becomes complex enough to warrant DevTools

**Downgrade from Redux to Context when:**
- You realize you're only storing 2-3 simple values
- No components outside the subtree need the state
- You don't use any Redux-specific features (middleware, time-travel)

---

## See Also

- `@rules/immutable-updates.md` - How to update state correctly
- `@templates/component-with-state.tsx` - useState examples
- `@templates/component-with-reducer.tsx` - useReducer examples
- `@decision-trees/performance.md` - When state choices affect performance
