# Immutable State Updates

React detects state changes by comparing the old state reference to the new state reference. If you mutate state directly (modify the existing object/array), React doesn't see a change and won't re-render. Your changes are lost.

**The golden rule**: Never mutate state directly. Always create a new object or array.

---

## Rule 1: Never Mutate State Directly

**Statement**: Never modify state objects or arrays in place. Always create new objects/arrays with the changes.

### Why This Matters

React uses **reference equality** to detect changes: `oldState === newState`. If you mutate the existing state object, the reference stays the same, React thinks nothing changed, and doesn't re-render.

### ❌ WRONG: Direct Mutation of Object State

```typescript
function UserProfile() {
  const [user, setUser] = useState({ name: 'Alice', age: 30 });

  const updateName = (newName: string) => {
    // WRONG: Mutating state directly
    user.name = newName;
    setUser(user); // Same reference, React won't re-render
  };

  return (
    <div>
      <div>Name: {user.name}</div>
      <button onClick={() => updateName('Bob')}>Change Name</button>
    </div>
  );
}
```

**What breaks**:
- user.name is modified
- setUser receives same object reference
- React compares: old user === new user (true!)
- React skips re-render
- UI shows old name
- **Symptom**: UI doesn't update when state changes

### ❌ WRONG: Direct Mutation of Array State

```typescript
function TodoList() {
  const [todos, setTodos] = useState<string[]>(['Task 1', 'Task 2']);

  const addTodo = (text: string) => {
    // WRONG: Mutating state array directly
    todos.push(text);
    setTodos(todos); // Same reference, React won't re-render
  };

  return (
    <div>
      <ul>{todos.map((t, i) => <li key={i}>{t}</li>)}</ul>
      <button onClick={() => addTodo('Task 3')}>Add Todo</button>
    </div>
  );
}
```

**What breaks**:
- todos.push() mutates the array
- setTodos receives same array reference
- React compares: old todos === new todos (true!)
- React skips re-render
- New todo doesn't appear
- **Symptom**: UI doesn't update

### ✅ CORRECT: Create New Object

```typescript
function UserProfile() {
  const [user, setUser] = useState({ name: 'Alice', age: 30 });

  const updateName = (newName: string) => {
    // Create new object with spread operator
    setUser({ ...user, name: newName });
  };

  return (
    <div>
      <div>Name: {user.name}</div>
      <button onClick={() => updateName('Bob')}>Change Name</button>
    </div>
  );
}
```

**Why this works**: `{ ...user, name: newName }` creates a new object. New reference, React detects change, re-renders.

### ✅ CORRECT: Create New Array

```typescript
function TodoList() {
  const [todos, setTodos] = useState<string[]>(['Task 1', 'Task 2']);

  const addTodo = (text: string) => {
    // Create new array with spread operator
    setTodos([...todos, text]);
  };

  return (
    <div>
      <ul>{todos.map((t, i) => <li key={i}>{t}</li>)}</ul>
      <button onClick={() => addTodo('Task 3')}>Add Todo</button>
    </div>
  );
}
```

**Why this works**: `[...todos, text]` creates a new array. New reference, React detects change, re-renders.

---

## Rule 2: Use Spread Operator or Immer for Updates

**Statement**: Use spread syntax (`...`) to copy objects/arrays before modifying, or use Immer library for complex updates.

### Why This Matters

Spread operator creates a shallow copy - a new reference with the same contents. You can then modify properties/items in the new copy without affecting the original.

### ❌ WRONG: Modifying Property Without Spread

```typescript
function Settings() {
  const [config, setConfig] = useState({
    theme: 'light',
    notifications: true,
    language: 'en'
  });

  const toggleNotifications = () => {
    // WRONG: Mutating before setting
    config.notifications = !config.notifications;
    setConfig(config);
  };

  return <button onClick={toggleNotifications}>Toggle Notifications</button>;
}
```

**What breaks**: Direct mutation, same reference, React doesn't re-render.

### ✅ CORRECT: Spread Then Override

```typescript
function Settings() {
  const [config, setConfig] = useState({
    theme: 'light',
    notifications: true,
    language: 'en'
  });

  const toggleNotifications = () => {
    // Spread old, override one property
    setConfig({ ...config, notifications: !config.notifications });
  };

  return <button onClick={toggleNotifications}>Toggle Notifications</button>;
}
```

**Why this works**: Creates new object with all old properties plus overridden notifications property.

### ✅ CORRECT: Using Immer for Complex Updates

```typescript
import { produce } from 'immer';

function ComplexState() {
  const [state, setState] = useState({
    user: { name: 'Alice', address: { city: 'NYC' } },
    items: [{ id: 1, qty: 5 }]
  });

  const updateCity = (newCity: string) => {
    // Immer allows "mutation" syntax, creates immutable copy
    setState(produce(draft => {
      draft.user.address.city = newCity;
    }));
  };

  return <button onClick={() => updateCity('SF')}>Move to SF</button>;
}
```

**Why this works**: Immer's produce creates a draft you can "mutate". Behind the scenes, Immer creates a new immutable state with the changes.

---

## Rule 3: Array Operations Must Be Immutable

**Statement**: Use immutable array methods (map, filter, concat, slice) instead of mutating methods (push, pop, splice, sort, reverse).

### Why This Matters

Mutating methods modify the array in place. Non-mutating methods return new arrays.

### Mutating vs Non-Mutating Array Methods

**Mutating (DON'T use with setState)**:
- `push()`, `pop()`, `shift()`, `unshift()`
- `splice()`
- `sort()`, `reverse()`
- Direct assignment: `arr[0] = value`

**Non-Mutating (SAFE to use)**:
- `concat()`, spread `[...arr]`
- `filter()`, `map()`, `slice()`
- `toSorted()`, `toReversed()` (new ES2023)

### ❌ WRONG: Using push()

```typescript
function ShoppingCart() {
  const [items, setItems] = useState<Item[]>([]);

  const addItem = (item: Item) => {
    // WRONG: push mutates the array
    items.push(item);
    setItems(items);
  };

  return <button onClick={() => addItem({ id: '1', name: 'Apple' })}>Add</button>;
}
```

**What breaks**: Array mutated, same reference, React doesn't re-render.

### ✅ CORRECT: Using Spread to Add

```typescript
function ShoppingCart() {
  const [items, setItems] = useState<Item[]>([]);

  const addItem = (item: Item) => {
    // Create new array with spread
    setItems([...items, item]);
  };

  return <button onClick={() => addItem({ id: '1', name: 'Apple' })}>Add</button>;
}
```

**Why this works**: `[...items, item]` creates new array.

### ❌ WRONG: Using splice() to Remove

```typescript
function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([...]);

  const removeTodo = (index: number) => {
    // WRONG: splice mutates the array
    todos.splice(index, 1);
    setTodos(todos);
  };

  return <ul>{todos.map((t, i) => <li key={t.id}>{t.text}</li>)}</ul>;
}
```

**What breaks**: Array mutated, same reference, React doesn't re-render.

### ✅ CORRECT: Using filter() to Remove

```typescript
function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([...]);

  const removeTodo = (id: string) => {
    // Create new array without the item
    setTodos(todos.filter(t => t.id !== id));
  };

  return <ul>{todos.map(t => <li key={t.id}>{t.text}</li>)}</ul>;
}
```

**Why this works**: filter() returns new array without the removed item.

### ❌ WRONG: Using sort() Directly

```typescript
function UserList() {
  const [users, setUsers] = useState<User[]>([...]);

  const sortByName = () => {
    // WRONG: sort mutates the array
    users.sort((a, b) => a.name.localeCompare(b.name));
    setUsers(users);
  };

  return <button onClick={sortByName}>Sort</button>;
}
```

**What breaks**: Array mutated in place, same reference, React doesn't re-render.

### ✅ CORRECT: Copy Then Sort

```typescript
function UserList() {
  const [users, setUsers] = useState<User[]>([...]);

  const sortByName = () => {
    // Create copy, then sort the copy
    const sorted = [...users].sort((a, b) => a.name.localeCompare(b.name));
    setUsers(sorted);
  };

  return <button onClick={sortByName}>Sort</button>;
}
```

**Why this works**: `[...users]` creates new array, sort() mutates the new array (not the state), setUsers receives new array.

### ✅ CORRECT: Using toSorted() (ES2023)

```typescript
function UserList() {
  const [users, setUsers] = useState<User[]>([...]);

  const sortByName = () => {
    // toSorted returns new array, doesn't mutate
    setUsers(users.toSorted((a, b) => a.name.localeCompare(b.name)));
  };

  return <button onClick={sortByName}>Sort</button>;
}
```

**Why this works**: toSorted() is non-mutating by design, returns new array.

---

## Rule 4: Updating Nested Objects/Arrays Requires Spreading All Levels

**Statement**: When updating nested state, you must create new objects/arrays at every level of nesting.

### Why This Matters

Spread operator creates a **shallow** copy - it only copies the first level. Nested objects/arrays are still the same references. You must spread at every level you want to update.

### ❌ WRONG: Only Spreading Top Level

```typescript
function UserProfile() {
  const [user, setUser] = useState({
    name: 'Alice',
    address: { city: 'NYC', zip: '10001' }
  });

  const updateCity = (newCity: string) => {
    // WRONG: Spreading top level but mutating nested object
    const newUser = { ...user };
    newUser.address.city = newCity; // Mutating nested object!
    setUser(newUser);
  };

  return <button onClick={() => updateCity('SF')}>Move to SF</button>;
}
```

**What breaks**:
- newUser is a new object (good)
- But newUser.address is the same reference as user.address (bad)
- Mutating newUser.address mutates user.address
- React might not detect the change correctly
- **Symptom**: Inconsistent updates, bugs in memoization/effects

### ✅ CORRECT: Spreading All Levels

```typescript
function UserProfile() {
  const [user, setUser] = useState({
    name: 'Alice',
    address: { city: 'NYC', zip: '10001' }
  });

  const updateCity = (newCity: string) => {
    // Spread both levels
    setUser({
      ...user,
      address: {
        ...user.address,
        city: newCity
      }
    });
  };

  return <button onClick={() => updateCity('SF')}>Move to SF</button>;
}
```

**Why this works**: New objects created at both levels. Fully immutable update.

### ❌ WRONG: Mutating Nested Array

```typescript
function TaskBoard() {
  const [board, setBoard] = useState({
    name: 'My Board',
    tasks: [{ id: '1', text: 'Task 1' }]
  });

  const addTask = (task: Task) => {
    // WRONG: Spreading board but mutating nested array
    const newBoard = { ...board };
    newBoard.tasks.push(task); // Mutating nested array!
    setBoard(newBoard);
  };

  return <button onClick={() => addTask({ id: '2', text: 'Task 2' })}>Add</button>;
}
```

**What breaks**: board is new, but board.tasks is same reference. Mutation detected incorrectly.

### ✅ CORRECT: Spreading Nested Array

```typescript
function TaskBoard() {
  const [board, setBoard] = useState({
    name: 'My Board',
    tasks: [{ id: '1', text: 'Task 1' }]
  });

  const addTask = (task: Task) => {
    // Spread board and spread tasks array
    setBoard({
      ...board,
      tasks: [...board.tasks, task]
    });
  };

  return <button onClick={() => addTask({ id: '2', text: 'Task 2' })}>Add</button>;
}
```

**Why this works**: New objects/arrays at all levels.

### ✅ CORRECT: Using Immer for Deep Nesting

```typescript
import { produce } from 'immer';

function ComplexState() {
  const [data, setData] = useState({
    users: [
      { id: '1', name: 'Alice', preferences: { theme: 'light' } }
    ]
  });

  const updateUserTheme = (userId: string, theme: string) => {
    // Immer handles all the spreading for you
    setData(produce(draft => {
      const user = draft.users.find(u => u.id === userId);
      if (user) {
        user.preferences.theme = theme;
      }
    }));
  };

  return <button onClick={() => updateUserTheme('1', 'dark')}>Dark Mode</button>;
}
```

**Why this works**: Immer automatically creates new objects/arrays at all levels. Much simpler for deeply nested state.

---

## Common Patterns

### Pattern: Toggle Boolean

```typescript
const [isOpen, setIsOpen] = useState(false);

// Toggle
setIsOpen(!isOpen);
// Or with functional update
setIsOpen(prev => !prev);
```

### Pattern: Increment Number

```typescript
const [count, setCount] = useState(0);

// Increment
setCount(count + 1);
// Or with functional update
setCount(prev => prev + 1);
```

### Pattern: Update Object Property

```typescript
const [user, setUser] = useState({ name: 'Alice', age: 30 });

// Update one property
setUser({ ...user, age: 31 });
```

### Pattern: Add to Array

```typescript
const [items, setItems] = useState<string[]>([]);

// Add to end
setItems([...items, 'new item']);
// Add to beginning
setItems(['new item', ...items]);
// Add at index
const index = 2;
setItems([...items.slice(0, index), 'new item', ...items.slice(index)]);
```

### Pattern: Remove from Array

```typescript
const [items, setItems] = useState<Item[]>([...]);

// Remove by id
setItems(items.filter(item => item.id !== idToRemove));
// Remove by index
setItems(items.filter((_, i) => i !== indexToRemove));
```

### Pattern: Update Item in Array

```typescript
const [items, setItems] = useState<Item[]>([...]);

// Update item by id
setItems(items.map(item =>
  item.id === idToUpdate
    ? { ...item, name: 'New Name' }
    : item
));
```

### Pattern: Replace Array

```typescript
const [items, setItems] = useState<Item[]>([...]);

// Replace entire array
setItems(newItems);
```

### Pattern: Clear Array

```typescript
const [items, setItems] = useState<Item[]>([...]);

// Clear
setItems([]);
```

### Pattern: Update Nested Object

```typescript
const [user, setUser] = useState({
  name: 'Alice',
  address: { city: 'NYC', zip: '10001' }
});

// Update nested property
setUser({
  ...user,
  address: {
    ...user.address,
    city: 'SF'
  }
});
```

### Pattern: Update Deeply Nested (3+ levels)

```typescript
// Without Immer - very verbose
setData({
  ...data,
  level1: {
    ...data.level1,
    level2: {
      ...data.level1.level2,
      level3: {
        ...data.level1.level2.level3,
        value: newValue
      }
    }
  }
});

// With Immer - much simpler
setData(produce(draft => {
  draft.level1.level2.level3.value = newValue;
}));
```

---

## ESLint Configuration

There's no ESLint rule that catches mutations directly, but you can use:

```json
{
  "rules": {
    "no-param-reassign": ["error", { "props": true }]
  }
}
```

This catches some mutations, but not all. Code review is critical.

---

## Agent Checklist: Immutable Updates

Before submitting code with state updates, verify:

- [ ] No direct assignment to state variables (e.g., `state.property = value`)
- [ ] No mutating array methods (push, pop, splice, shift, unshift, sort, reverse)
- [ ] All object updates use spread operator or Immer
- [ ] All array updates use spread, concat, filter, map, or slice
- [ ] Nested updates spread at ALL levels, or use Immer
- [ ] No `state[index] = value` array mutations
- [ ] setState always receives a new reference (new object/array)

---

## Debugging Mutation Issues

**Symptom**: State changes but UI doesn't update
- **Cause**: Direct mutation, same reference
- **Fix**: Use spread operator to create new object/array

**Symptom**: Unexpected values in state
- **Cause**: Nested mutation, shallow copy issue
- **Fix**: Spread at all levels or use Immer

**Symptom**: React DevTools shows state changed but component didn't re-render
- **Cause**: Mutation detected as "no change" by React
- **Fix**: Create new reference with spread/filter/map

**Symptom**: Effects not triggering when state changes
- **Cause**: State reference unchanged due to mutation
- **Fix**: Ensure setState receives new reference

---

## Summary

React detects changes by reference, not by value. To ensure React sees your state changes:

1. **Never mutate** state objects or arrays directly
2. **Always create new** objects/arrays with spread operator
3. **Use non-mutating array methods** (filter, map, concat, slice)
4. **Spread at all levels** for nested updates, or use Immer
5. **Avoid mutating methods** (push, splice, sort, direct assignment)

When in doubt, create a new object/array. Immutability is non-negotiable in React.
