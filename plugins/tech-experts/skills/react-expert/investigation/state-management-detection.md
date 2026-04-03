# State Management Detection

## Purpose

Identify the project's state management library and integration patterns to ensure new state logic follows established conventions and integrates seamlessly with existing data flow.

## Why This Matters

**State management is critical**:
- Determines how data flows through application
- Affects component structure and prop drilling
- Impacts testing strategy
- Wrong library = complete rewrite needed

**Many options exist**:
- Redux / Redux Toolkit (most popular)
- Zustand (lightweight, growing)
- Jotai (atomic state)
- Recoil (Facebook's atomic state)
- MobX (observable state)
- XState (state machines)
- Context API (built-in)

**Integration patterns vary**:
- Store structure and organization
- How components access state
- Action creators vs direct updates
- Middleware and side effects

## Investigation Protocols

---

### Protocol 1: State Management Library Detection

**Objective**: Identify which state management library (if any) is used in the project

**Tool**: Read → `package.json`

**Extract**:
Check `dependencies` and `devDependencies` for:

**Error Handling**:
- If `package.json` doesn't exist → Report to user: "No package.json found. Cannot detect state management library."
- If no state management library found → Fallback: Check for Context API usage with Grep, or use local useState
- If multiple state libraries found → Report to user: "Multiple state management libraries detected (list them). Please clarify which is primary."
- `redux` - Classic Redux
- `@reduxjs/toolkit` - Redux Toolkit (modern Redux)
- `react-redux` - React bindings for Redux
- `zustand` - Zustand state management
- `jotai` - Jotai atomic state
- `recoil` - Recoil atomic state
- `mobx` - MobX observable state
- `mobx-react-lite` - MobX React bindings
- `xstate` - XState state machines
- `@xstate/react` - XState React bindings

**Decision Tree**:
```
State management library?
├─ Redux Toolkit (@reduxjs/toolkit)
│   ├─ Modern Redux with simplified API
│   ├─ Key concepts:
│   │   ├─ Slices (createSlice)
│   │   ├─ Store (configureStore)
│   │   ├─ Async thunks (createAsyncThunk)
│   │   └─ RTK Query (optional, for API calls)
│   │
│   ├─ Integration:
│   │   ├─ useSelector hook for reading state
│   │   ├─ useDispatch hook for actions
│   │   ├─ Provider wraps app
│   │   └─ Slices organized by feature
│   │
│   └─ Generate:
│       import { useSelector, useDispatch } from 'react-redux'
│       import { selectUser, updateUser } from '@/store/userSlice'
│
│       const user = useSelector(selectUser)
│       const dispatch = useDispatch()
│       dispatch(updateUser({ name: 'John' }))
│
├─ Classic Redux (redux without toolkit)
│   ├─ Traditional Redux with manual setup
│   ├─ Key concepts:
│   │   ├─ Actions (action creators)
│   │   ├─ Reducers (pure functions)
│   │   ├─ Store (createStore)
│   │   └─ Middleware (thunk, saga)
│   │
│   ├─ Note: Consider suggesting Redux Toolkit migration
│   └─ Follow existing action/reducer patterns
│
├─ Zustand
│   ├─ Lightweight, minimal boilerplate
│   ├─ Key concepts:
│   │   ├─ create() function defines store
│   │   ├─ Hook-based access
│   │   ├─ Direct mutations in actions
│   │   └─ No Provider needed
│   │
│   ├─ Integration:
│   │   ├─ useStore() hook (custom name)
│   │   ├─ Selectors for specific state
│   │   ├─ Actions defined in store
│   │   └─ Middleware available
│   │
│   └─ Generate:
│       import { useUserStore } from '@/store/userStore'
│
│       const { user, updateUser } = useUserStore()
│       updateUser({ name: 'John' })
│
├─ Jotai
│   ├─ Atomic state management
│   ├─ Key concepts:
│   │   ├─ atom() defines state atoms
│   │   ├─ useAtom() hook for read/write
│   │   ├─ useAtomValue() for read-only
│   │   └─ Provider optional (default works)
│   │
│   ├─ Integration:
│   │   ├─ Define atoms in separate files
│   │   ├─ useAtom(atom) in components
│   │   ├─ Derived atoms for computed values
│   │   └─ Async atoms for data fetching
│   │
│   └─ Generate:
│       import { useAtom } from 'jotai'
│       import { userAtom } from '@/atoms/userAtom'
│
│       const [user, setUser] = useAtom(userAtom)
│       setUser({ name: 'John' })
│
├─ Recoil
│   ├─ Facebook's atomic state (similar to Jotai)
│   ├─ Key concepts:
│   │   ├─ atom() defines state atoms
│   │   ├─ selector() for derived state
│   │   ├─ useRecoilState() hook
│   │   └─ RecoilRoot required
│   │
│   ├─ Integration:
│   │   ├─ RecoilRoot wraps app
│   │   ├─ useRecoilState(atom) in components
│   │   ├─ useRecoilValue() for read-only
│   │   └─ useSetRecoilState() for write-only
│   │
│   └─ Generate:
│       import { useRecoilState } from 'recoil'
│       import { userState } from '@/recoil/atoms'
│
│       const [user, setUser] = useRecoilState(userState)
│       setUser({ name: 'John' })
│
├─ MobX
│   ├─ Observable state with automatic tracking
│   ├─ Key concepts:
│   │   ├─ makeObservable / makeAutoObservable
│   │   ├─ observer() wrapper for components
│   │   ├─ action() for mutations
│   │   └─ computed for derived values
│   │
│   ├─ Integration:
│   │   ├─ Store classes with observables
│   │   ├─ observer(Component) for reactivity
│   │   ├─ useContext for store access
│   │   └─ Direct property mutation
│   │
│   └─ Generate:
│       import { observer } from 'mobx-react-lite'
│       import { useUserStore } from '@/stores/userStore'
│
│       export const Component = observer(() => {
│         const userStore = useUserStore()
│         userStore.updateUser({ name: 'John' })
│       })
│
├─ XState
│   ├─ State machines and statecharts
│   ├─ Key concepts:
│   │   ├─ createMachine() defines state machine
│   │   ├─ useMachine() hook
│   │   ├─ States, events, transitions
│   │   └─ Guards, actions, services
│   │
│   ├─ Integration:
│   │   ├─ Define machines separately
│   │   ├─ useMachine(machine) in components
│   │   ├─ send(event) to transition
│   │   └─ state.matches() to check state
│   │
│   └─ Generate:
│       import { useMachine } from '@xstate/react'
│       import { userMachine } from '@/machines/userMachine'
│
│       const [state, send] = useMachine(userMachine)
│       send({ type: 'UPDATE', data: { name: 'John' } })
│
└─ None / Context API only
    ├─ Built-in React Context for state
    ├─ Key concepts:
    │   ├─ createContext() defines context
    │   ├─ Provider component supplies value
    │   ├─ useContext() hook consumes
    │   └─ Custom hooks wrap context logic
    │
    ├─ Integration:
    │   ├─ Context + useReducer pattern common
    │   ├─ Separate contexts by domain
    │   ├─ Provider composition for multiple contexts
    │   └─ Performance: memo, useMemo for optimization
    │
    └─ Generate:
        import { useContext } from 'react'
        import { UserContext } from '@/contexts/UserContext'

        const { user, setUser } = useContext(UserContext)
        setUser({ name: 'John' })
```

**Verification**:
```bash
# Check for state management libraries
grep -E '"(redux|@reduxjs/toolkit|react-redux|zustand|jotai|recoil|mobx|xstate)"' package.json

# Count which library is present
grep '"redux"' package.json && echo "Redux found"
grep '"@reduxjs/toolkit"' package.json && echo "Redux Toolkit found"
grep '"zustand"' package.json && echo "Zustand found"
grep '"jotai"' package.json && echo "Jotai found"
grep '"recoil"' package.json && echo "Recoil found"
```

**Example Output**:
```
State management: @reduxjs/toolkit (Redux Toolkit)
Version: 2.0.1
Also installed: react-redux 9.0.0

Decision: Use Redux Toolkit patterns
  - createSlice for state slices
  - useSelector and useDispatch hooks
  - configureStore for store setup
```

---

### Protocol 2: Redux/Redux Toolkit Pattern Detection

**Objective**: Discover Redux store structure and usage patterns (if Redux detected)

**Tool**: Grep → Search for Redux patterns in codebase

**Search Patterns**:
1. `createSlice` - Redux Toolkit slice pattern
2. `configureStore` - Store configuration
3. `createAsyncThunk` - Async action pattern
4. `useSelector` / `useDispatch` - Hook usage
5. Store file structure

**Extract**:
- Slice organization (by feature, by type)
- Selector patterns (inline vs exported)
- Async handling (thunks, saga, etc.)
- Store file location

**Decision Tree**:
```
Redux Toolkit patterns?
├─ Slice organization
│   ├─ Feature-based (userSlice, productsSlice)
│   │   ├─ One slice per feature/domain
│   │   ├─ Location: store/userSlice.ts, store/productsSlice.ts
│   │   └─ Generate: New slice for new feature
│   │
│   └─ Type-based (less common)
│       ├─ Grouped by concern (entities, ui, etc.)
│       └─ Follow existing structure
│
├─ Selector patterns
│   ├─ Exported selectors
│   │   ├─ Pattern: export const selectUser = (state) => state.user
│   │   ├─ Benefit: Reusable, encapsulated
│   │   └─ Generate: Export selectors from slice file
│   │
│   └─ Inline selectors
│       ├─ Pattern: useSelector(state => state.user.name)
│       ├─ Benefit: Simple for one-time use
│       └─ Use: For unique, non-reused selections
│
├─ Async patterns
│   ├─ createAsyncThunk
│   │   ├─ Pattern: export const fetchUser = createAsyncThunk(...)
│   │   ├─ Handled in extraReducers
│   │   └─ Generate: New thunks for API calls
│   │
│   ├─ RTK Query
│   │   ├─ Pattern: createApi with endpoints
│   │   ├─ Auto-generated hooks
│   │   └─ Generate: Add endpoints to existing API
│   │
│   └─ Manual middleware
│       ├─ Redux Saga or custom middleware
│       └─ Follow existing saga/middleware patterns
│
└─ Store structure
    ├─ Centralized store file
    │   ├─ Single store/index.ts with all slices
    │   └─ Import: All slices combined
    │
    └─ Distributed slices
        ├─ Slices import into store as needed
        └─ More modular approach
```

**Verification**:
```bash
# Find slice files
find . -name "*Slice.ts" -o -name "*slice.ts" 2>/dev/null

# Check for createSlice usage
grep -r "createSlice" src --include="*.ts" --include="*.tsx"

# Check selector exports
grep -r "export const select" src/store --include="*.ts"

# Check async thunks
grep -r "createAsyncThunk" src --include="*.ts"
```

**Example Output**:
```
Redux Toolkit patterns found:
  - Slices: userSlice.ts, productsSlice.ts, cartSlice.ts
  - Organization: Feature-based (one slice per domain)
  - Selectors: Exported from slice files
  - Async: createAsyncThunk pattern (12 thunks found)

Decision: Create feature-based slices with exported selectors
Example file: store/newFeatureSlice.ts
```

---

### Protocol 3: Zustand Store Pattern Detection

**Objective**: Discover Zustand store structure and usage (if Zustand detected)

**Tool**: Grep → Search for Zustand patterns

**Search Patterns**:
1. `create(` - Store creation
2. `useStore` - Store hook naming
3. Store file organization
4. Middleware usage (persist, immer, etc.)

**Extract**:
- Store naming convention
- Single store vs multiple stores
- Action definition pattern
- Middleware usage

**Decision Tree**:
```
Zustand patterns?
├─ Store organization
│   ├─ Single global store
│   │   ├─ One store with all state
│   │   ├─ File: store/index.ts or store/store.ts
│   │   └─ Usage: const { user, products } = useStore()
│   │
│   └─ Multiple domain stores
│       ├─ Separate stores per feature
│       ├─ Files: store/useUserStore.ts, store/useProductsStore.ts
│       └─ Usage: const { user } = useUserStore()
│
├─ Store naming
│   ├─ useXyzStore pattern
│   │   ├─ Example: useUserStore, useCartStore
│   │   └─ Hook-like naming convention
│   │
│   └─ xyzStore pattern
│       ├─ Example: userStore, cartStore
│       └─ Regular variable naming
│
├─ Action definition
│   ├─ Actions in store
│   │   ├─ Pattern: { state, actions: { updateUser: () => set(...) } }
│   │   └─ Organized, clear separation
│   │
│   └─ Flat structure
│       ├─ Pattern: { state, updateUser: () => set(...) }
│       └─ Simpler, direct access
│
└─ Middleware usage
    ├─ persist middleware
    │   ├─ Pattern: persist(storeConfig, { name: 'storage-key' })
    │   └─ Local storage persistence
    │
    ├─ immer middleware
    │   ├─ Pattern: immer((set) => ({ ... }))
    │   └─ Mutable updates (internally immutable)
    │
    └─ devtools middleware
        ├─ Pattern: devtools(storeConfig)
        └─ Redux DevTools integration
```

**Verification**:
```bash
# Find Zustand store files
find . -path "*/store/*.ts" -o -path "*/stores/*.ts" 2>/dev/null | grep -i store

# Check store creation pattern
grep -r "create(" src/store --include="*.ts" -A 5

# Check middleware usage
grep -r "persist\|immer\|devtools" src/store --include="*.ts"
```

**Example Output**:
```
Zustand patterns found:
  - Organization: Multiple domain stores
  - Files: useUserStore.ts, useCartStore.ts, useProductsStore.ts
  - Naming: useXyzStore convention
  - Middleware: persist (for cart), devtools (all stores)

Decision: Create separate domain store with useXyzStore naming
Include: persist middleware if data needs persistence
```

---

### Protocol 4: Context API Pattern Detection

**Objective**: Discover Context usage patterns (when no library is used)

**Tool**: Grep → Search for Context patterns

**Search Patterns**:
1. `createContext` - Context creation
2. `.Provider` - Provider usage
3. `useContext` - Context consumption
4. Custom hook wrappers

**Extract**:
- Context organization
- Provider pattern
- Custom hooks for contexts
- useReducer integration

**Decision Tree**:
```
Context API patterns?
├─ Context organization
│   ├─ Separate context per domain
│   │   ├─ Files: contexts/UserContext.tsx, contexts/ThemeContext.tsx
│   │   ├─ One Provider per context
│   │   └─ Import: Multiple providers composed
│   │
│   └─ Combined context
│       ├─ Single app-wide context
│       └─ Less common, harder to optimize
│
├─ Provider pattern
│   ├─ Provider component with hooks
│   │   ├─ Pattern: Function component with useState/useReducer
│   │   ├─ Exports: Context, Provider, custom hook
│   │   └─ Usage: <UserProvider><App /></UserProvider>
│   │
│   └─ HOC pattern (older)
│       ├─ Pattern: withUser(Component)
│       └─ Less common in modern React
│
├─ Custom hooks
│   ├─ useXyz hook exports
│   │   ├─ Pattern: export function useUser() { return useContext(UserContext) }
│   │   ├─ Benefit: Encapsulation, error checking
│   │   └─ Generate: Custom hook for new contexts
│   │
│   └─ Direct useContext
│       ├─ Pattern: const value = useContext(UserContext)
│       └─ Less encapsulated, but works
│
└─ State management in context
    ├─ useState in provider
    │   ├─ Simple state management
    │   └─ Good for basic needs
    │
    └─ useReducer in provider
        ├─ More complex state logic
        ├─ Redux-like pattern
        └─ Better for complex updates
```

**Verification**:
```bash
# Find context files
find . -path "*/context*/*.tsx" -o -path "*/context*/*.ts" 2>/dev/null

# Check context creation
grep -r "createContext" src --include="*.tsx" --include="*.ts"

# Check custom hooks
grep -r "export.*function use.*Context" src --include="*.tsx" --include="*.ts"

# Check useReducer usage
grep -r "useReducer" src/context --include="*.tsx"
```

**Example Output**:
```
Context API patterns found:
  - Organization: Separate contexts per domain
  - Files: UserContext.tsx, ThemeContext.tsx, CartContext.tsx
  - Custom hooks: useUser(), useTheme(), useCart()
  - State: useReducer for complex (Cart), useState for simple (Theme)

Decision: Create separate context with custom hook
Pattern: export function useNewFeature() wrapper
Include: useReducer if complex state logic needed
```

---

## Investigation Checklist

After completing state management investigation, verify:

- [ ] State management library identified (or Context API detected)
- [ ] Store/context organization pattern discovered
- [ ] Naming conventions noted
- [ ] Action/mutation patterns understood
- [ ] Async handling approach identified
- [ ] Middleware usage documented
- [ ] Integration hooks usage confirmed
- [ ] File location pattern for new state code determined

## Common Scenarios

### Scenario 1: Redux Toolkit with Feature Slices
```
Library: @reduxjs/toolkit
Organization: Feature-based slices
Pattern: Export selectors, createAsyncThunk for API
Generate: New slice in store/newFeatureSlice.ts
```

### Scenario 2: Zustand with Multiple Stores
```
Library: zustand
Organization: Separate domain stores
Pattern: useXyzStore naming, persist middleware
Generate: New store in store/useNewFeatureStore.ts
```

### Scenario 3: Context API with Custom Hooks
```
Library: None (Context API)
Organization: Separate contexts
Pattern: Custom useXyz hooks, useReducer for complex state
Generate: New context in contexts/NewFeatureContext.tsx
```

## Integration with Other Protocols

**After state management detection**:
1. Apply discovered patterns when implementing state logic
2. Use appropriate hooks (useSelector, useStore, useContext, etc.)
3. Follow file organization conventions
4. Verify with `linting-rules.md` for state-related rules

**State management informs**:
- Where to add new state (which store/slice/context)
- How to access state in components (hooks pattern)
- How to update state (dispatch, set, setState)
- How to handle async operations (thunks, mutations, etc.)

This investigation ensures new state logic integrates seamlessly with existing state management architecture.
