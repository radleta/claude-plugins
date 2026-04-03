# Key Prop Requirements

The `key` prop is a special React attribute used when rendering lists. It helps React identify which items have changed, been added, or removed. Choosing the wrong key causes state corruption, performance issues, and mysterious bugs.

**The golden rule**: Keys must be stable, unique among siblings, and derived from data - never use array index.

---

## Rule 1: Never Use Array Index as Key (With Rare Exceptions)

**Statement**: Do not use array index as the key prop unless the list never reorders, filters, or has items added/removed.

### Why This Matters

React uses keys to match elements across renders. When you use index as key, React thinks "the item at index 0" is the same item on every render - even if it's actually a different item. This causes state to be attached to the wrong items.

### ❌ WRONG: Index as Key in Dynamic List

```typescript
function TodoList() {
  const [todos, setTodos] = useState([
    { text: 'Buy milk', done: false },
    { text: 'Walk dog', done: false },
    { text: 'Write code', done: false }
  ]);

  const removeTodo = (index: number) => {
    setTodos(todos.filter((_, i) => i !== index));
  };

  return (
    <ul>
      {/* WRONG: Using index as key */}
      {todos.map((todo, index) => (
        <li key={index}>
          <input type="checkbox" checked={todo.done} />
          {todo.text}
          <button onClick={() => removeTodo(index)}>Delete</button>
        </li>
      ))}
    </ul>
  );
}
```

**What breaks**:
1. User checks "Walk dog" (index 1)
2. User deletes "Buy milk" (index 0)
3. Array shifts: "Walk dog" is now at index 0
4. React sees key=0, thinks it's the same item
5. Checkbox state (checked) stays with key=0
6. "Walk dog" now appears checked even though it wasn't
7. **Symptom**: State attached to wrong item

### ❌ WRONG: Index as Key with Input Fields

```typescript
function NameList() {
  const [names, setNames] = useState(['Alice', 'Bob', 'Carol']);

  const addName = () => {
    setNames(['Zoe', ...names]); // Add to beginning
  };

  return (
    <div>
      {/* WRONG: Index as key with input state */}
      {names.map((name, index) => (
        <input key={index} defaultValue={name} />
      ))}
      <button onClick={addName}>Add Zoe</button>
    </div>
  );
}
```

**What breaks**:
1. User types in first input, changing "Alice" to "Alice Smith"
2. User clicks "Add Zoe"
3. Array becomes: ['Zoe', 'Alice', 'Bob', 'Carol']
4. React sees key=0, thinks it's the same input
5. First input still shows "Alice Smith" (the value user typed)
6. But data says it should show "Zoe"
7. **Symptom**: Input values don't match data

### ❌ WRONG: Index as Key When Sorting

```typescript
function UserList() {
  const [users, setUsers] = useState([
    { name: 'Charlie', age: 30 },
    { name: 'Alice', age: 25 },
    { name: 'Bob', age: 35 }
  ]);

  const sortByName = () => {
    setUsers([...users].sort((a, b) => a.name.localeCompare(b.name)));
  };

  return (
    <div>
      <button onClick={sortByName}>Sort by Name</button>
      {/* WRONG: Index as key when sorting */}
      {users.map((user, index) => (
        <UserCard key={index} user={user} />
      ))}
    </div>
  );
}
```

**What breaks**:
1. User expands "Charlie" card (index 0)
2. User clicks "Sort by Name"
3. Array reorders: "Alice" is now at index 0
4. React sees key=0, thinks it's the same component
5. "Alice" card appears expanded even though user expanded "Charlie"
6. **Symptom**: Component state (expanded/collapsed) follows wrong item

### ✅ CORRECT: Use Unique ID as Key

```typescript
function TodoList() {
  const [todos, setTodos] = useState([
    { id: '1', text: 'Buy milk', done: false },
    { id: '2', text: 'Walk dog', done: false },
    { id: '3', text: 'Write code', done: false }
  ]);

  const removeTodo = (id: string) => {
    setTodos(todos.filter(t => t.id !== id));
  };

  return (
    <ul>
      {/* CORRECT: Using unique id as key */}
      {todos.map(todo => (
        <li key={todo.id}>
          <input type="checkbox" checked={todo.done} />
          {todo.text}
          <button onClick={() => removeTodo(todo.id)}>Delete</button>
        </li>
      ))}
    </ul>
  );
}
```

**Why this works**: Each todo has a stable, unique ID. When array reorders or items are removed, React correctly tracks which item is which.

### ✅ CORRECT: Generate ID if Not Available

```typescript
import { nanoid } from 'nanoid'; // or use crypto.randomUUID()

function NameList() {
  const [names, setNames] = useState([
    { id: nanoid(), name: 'Alice' },
    { id: nanoid(), name: 'Bob' },
    { id: nanoid(), name: 'Carol' }
  ]);

  const addName = (name: string) => {
    setNames([{ id: nanoid(), name }, ...names]);
  };

  return (
    <div>
      {/* CORRECT: Using generated id as key */}
      {names.map(item => (
        <input key={item.id} defaultValue={item.name} />
      ))}
      <button onClick={() => addName('Zoe')}>Add Zoe</button>
    </div>
  );
}
```

**Why this works**: Each name has a stable ID generated once. ID doesn't change when array reorders.

### When Index IS Acceptable (Rare)

Index is acceptable as key ONLY when ALL of these are true:
- List never reorders
- List never filters/removes items
- List never adds items in the middle or beginning
- Items have no internal state (like input values or expanded/collapsed state)
- List is purely presentational

**Example of acceptable index usage**:

```typescript
function StaticList() {
  const items = ['Apple', 'Banana', 'Cherry']; // Never changes

  return (
    <ul>
      {items.map((item, index) => (
        <li key={index}>{item}</li> // Acceptable - purely static
      ))}
    </ul>
  );
}
```

**When in doubt, don't use index. Always prefer a stable unique ID.**

---

## Rule 2: Keys Must Be Stable Across Renders

**Statement**: A key should not change between renders unless the item it represents has actually changed.

### Why This Matters

When a key changes, React thinks the old item was removed and a new item was added. React unmounts the old component and mounts a new one. All component state is lost, and the component re-initializes from scratch.

### ❌ WRONG: Generating New Key Every Render

```typescript
import { nanoid } from 'nanoid';

function UserList({ users }: { users: User[] }) {
  return (
    <ul>
      {/* WRONG: Generating new key every render */}
      {users.map(user => (
        <li key={nanoid()}>
          <UserCard user={user} />
        </li>
      ))}
    </ul>
  );
}
```

**What breaks**:
1. Every render generates new nanoid()
2. React sees different key, thinks it's a new item
3. React unmounts old UserCard, mounts new UserCard
4. Any state in UserCard is lost
5. Animations restart, inputs lose focus
6. **Symptom**: Components unmount/remount on every render, state resets, poor performance

### ❌ WRONG: Key Based on Math.random()

```typescript
function TodoList({ todos }: { todos: Todo[] }) {
  return (
    <ul>
      {/* WRONG: Random key changes every render */}
      {todos.map(todo => (
        <li key={Math.random()}>
          {todo.text}
        </li>
      ))}
    </ul>
  );
}
```

**What breaks**: Same as above - new key every render causes unmount/remount cycle.

### ❌ WRONG: Key Based on Timestamp

```typescript
function MessageList({ messages }: { messages: Message[] }) {
  return (
    <ul>
      {/* WRONG: Date.now() is different every render */}
      {messages.map(message => (
        <li key={Date.now()}>
          {message.text}
        </li>
      ))}
    </ul>
  );
}
```

**What breaks**: Date.now() returns different value every millisecond. Components constantly unmount/remount.

### ✅ CORRECT: Stable Key from Data

```typescript
function UserList({ users }: { users: User[] }) {
  return (
    <ul>
      {/* CORRECT: Using stable id from data */}
      {users.map(user => (
        <li key={user.id}>
          <UserCard user={user} />
        </li>
      ))}
    </ul>
  );
}
```

**Why this works**: user.id is stable - same user has same ID across renders.

### ✅ CORRECT: Generate ID Once When Creating Item

```typescript
function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([]);

  const addTodo = (text: string) => {
    // Generate ID once when creating item
    const newTodo = {
      id: nanoid(), // Generated once, then stable
      text,
      done: false
    };
    setTodos([...todos, newTodo]);
  };

  return (
    <ul>
      {/* CORRECT: id is stable because it was generated once */}
      {todos.map(todo => (
        <li key={todo.id}>{todo.text}</li>
      ))}
    </ul>
  );
}
```

**Why this works**: ID generated when item is created, then remains stable. Same item always has same key.

---

## Rule 3: Keys Must Be Unique Among Siblings

**Statement**: Keys must be unique among siblings in the same list, but don't need to be globally unique.

### Why This Matters

React uses keys to distinguish items in a list from each other. If two siblings have the same key, React can't tell them apart, causing confusion and warnings.

### ❌ WRONG: Duplicate Keys

```typescript
function ProductList({ products }: { products: Product[] }) {
  return (
    <ul>
      {/* WRONG: Multiple products might have same category */}
      {products.map(product => (
        <li key={product.category}>
          {product.name}
        </li>
      ))}
    </ul>
  );
}
```

**What breaks**:
- Multiple products with category "Electronics"
- Multiple `<li>` elements with key="Electronics"
- React warning: "Encountered two children with the same key"
- React behavior is undefined when keys collide
- **Symptom**: React warnings, unpredictable behavior

### ❌ WRONG: Non-Unique IDs

```typescript
function CommentList({ comments }: { comments: Comment[] }) {
  return (
    <ul>
      {/* WRONG: Using user.id instead of comment.id */}
      {comments.map(comment => (
        <li key={comment.user.id}>
          {comment.text}
        </li>
      ))}
    </ul>
  );
}
```

**What breaks**:
- Same user posts multiple comments
- Multiple comments with same user.id
- Duplicate keys in the list
- **Symptom**: React warnings, wrong comments rendered

### ✅ CORRECT: Unique Key Per Item

```typescript
function ProductList({ products }: { products: Product[] }) {
  return (
    <ul>
      {/* CORRECT: Each product has unique id */}
      {products.map(product => (
        <li key={product.id}>
          {product.name}
        </li>
      ))}
    </ul>
  );
}
```

**Why this works**: Each product has a unique ID. No duplicates in the list.

### ✅ CORRECT: Composite Key When Necessary

```typescript
function OrderItems({ orderId, items }: Props) {
  return (
    <ul>
      {/* CORRECT: Combine orderId + itemId for uniqueness */}
      {items.map(item => (
        <li key={`${orderId}-${item.id}`}>
          {item.name}
        </li>
      ))}
    </ul>
  );
}
```

**Why this works**: Combining orderId and item.id ensures uniqueness within this list.

### Keys Only Need to Be Unique Among Siblings

Keys don't need to be globally unique - only unique within their immediate list:

```typescript
function App() {
  const users = [{ id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }];
  const products = [{ id: '1', name: 'Apple' }, { id: '2', name: 'Banana' }];

  return (
    <div>
      {/* OK: users and products are separate lists */}
      <ul>
        {users.map(user => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
      <ul>
        {products.map(product => (
          <li key={product.id}>{product.name}</li> {/* Same keys OK - different list */}
        ))}
      </ul>
    </div>
  );
}
```

**Why this works**: users list and products list are separate. Keys only need to be unique within each list.

---

## Rule 4: Key Goes on the Element Returned from .map()

**Statement**: The key prop must be on the top-level element returned from the .map() callback, not on a child element inside it.

### Why This Matters

React needs the key at the point where it's iterating over elements. Putting the key on a child element doesn't help React identify the list items.

### ❌ WRONG: Key on Child Element

```typescript
function TodoList({ todos }: { todos: Todo[] }) {
  return (
    <ul>
      {todos.map(todo => (
        <li>
          {/* WRONG: Key is on inner element, not the <li> */}
          <span key={todo.id}>{todo.text}</span>
        </li>
      ))}
    </ul>
  );
}
```

**What breaks**:
- React iterates over `<li>` elements but they have no keys
- React warning: "Each child in a list should have a unique 'key' prop"
- React can't identify which `<li>` is which
- **Symptom**: React warnings, performance issues

### ❌ WRONG: Key on Wrong Element

```typescript
function UserList({ users }: { users: User[] }) {
  return (
    <div>
      {users.map(user => (
        <div>
          <h3 key={user.id}>{user.name}</h3>
          <p>{user.bio}</p>
        </div>
      ))}
    </div>
  );
}
```

**What breaks**:
- React iterates over outer `<div>` elements but they have no keys
- Key on `<h3>` doesn't help React identify the `<div>`
- **Symptom**: React warnings

### ✅ CORRECT: Key on Top-Level Element

```typescript
function TodoList({ todos }: { todos: Todo[] }) {
  return (
    <ul>
      {/* CORRECT: Key on the element returned from .map() */}
      {todos.map(todo => (
        <li key={todo.id}>
          <span>{todo.text}</span>
        </li>
      ))}
    </ul>
  );
}
```

**Why this works**: Key is on the `<li>`, which is what React is iterating over.

### ✅ CORRECT: Key on Fragment When No Wrapper

```typescript
function UserList({ users }: { users: User[] }) {
  return (
    <div>
      {users.map(user => (
        <React.Fragment key={user.id}>
          <h3>{user.name}</h3>
          <p>{user.bio}</p>
        </React.Fragment>
      ))}
    </div>
  );
}
```

**Why this works**: When returning multiple elements without a wrapper, use Fragment with key prop.

**Note**: The short syntax `<>...</>` doesn't support keys. Use `<React.Fragment key={...}>`.

---

## Common Patterns

### Pattern: List with Unique IDs

```typescript
{items.map(item => (
  <div key={item.id}>{item.name}</div>
))}
```

### Pattern: List Without IDs (Generate Once)

```typescript
// Generate IDs when loading data
const [items, setItems] = useState(() =>
  rawItems.map(item => ({ ...item, id: nanoid() }))
);

{items.map(item => (
  <div key={item.id}>{item.name}</div>
))}
```

### Pattern: Nested Lists

```typescript
{categories.map(category => (
  <div key={category.id}>
    <h3>{category.name}</h3>
    <ul>
      {category.items.map(item => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  </div>
))}
```

### Pattern: Filtering List

```typescript
// Filter doesn't change item IDs, safe to use same keys
{items.filter(item => item.active).map(item => (
  <div key={item.id}>{item.name}</div>
))}
```

### Pattern: Mapping with Index for Display

```typescript
// Index as key is WRONG, but index for display is fine
{items.map((item, index) => (
  <div key={item.id}>
    {index + 1}. {item.name}
  </div>
))}
```

---

## ESLint Configuration

Enable the React key rules:

```json
{
  "rules": {
    "react/jsx-key": "error",
    "react/no-array-index-key": "warn"
  }
}
```

`react/jsx-key` catches missing keys. `react/no-array-index-key` warns when using index as key.

---

## Agent Checklist: Key Props

Before submitting code with lists, verify:

- [ ] Every .map() that returns JSX has a key on the returned element
- [ ] Keys are NOT array indices (unless list is static and never changes)
- [ ] Keys are stable (don't use Math.random(), Date.now(), or nanoid() in render)
- [ ] Keys are unique among siblings in the same list
- [ ] Keys are derived from data (item.id) or generated once when creating item
- [ ] Key is on the top-level element returned from .map(), not on a child
- [ ] When returning multiple elements, key is on Fragment
- [ ] No React warnings about missing or duplicate keys

---

## Debugging Key Issues

**Warning**: "Each child in a list should have a unique 'key' prop"
- **Cause**: Missing key on element returned from .map()
- **Fix**: Add key={item.id} to the top-level element

**Warning**: "Encountered two children with the same key"
- **Cause**: Duplicate keys in the list
- **Fix**: Ensure each item has a unique key (check data for duplicates)

**Symptom**: Input values swap when list reorders
- **Cause**: Using index as key
- **Fix**: Use stable unique ID instead of index

**Symptom**: Component state resets unexpectedly
- **Cause**: Key changes between renders
- **Fix**: Use stable key from data, don't generate new keys in render

**Symptom**: List re-renders unnecessarily
- **Cause**: Unstable keys changing every render
- **Fix**: Use stable key from data

---

## Summary

The key prop helps React identify which items have changed. To use keys correctly:

1. **Never use array index as key** (except for static, never-changing lists)
2. **Keys must be stable** - same item should have same key across renders
3. **Keys must be unique among siblings** - no duplicates in the same list
4. **Key goes on top-level element** returned from .map(), not on children

When in doubt, use a stable unique ID from your data. Generate IDs once when creating items, never during render.
