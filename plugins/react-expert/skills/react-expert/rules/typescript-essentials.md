# TypeScript Essentials for React

React and TypeScript together require specific type patterns for props, events, children, and generic components. Using the wrong types leads to build errors, runtime crashes, and loss of type safety.

**The golden rule**: Be explicit with types - don't rely on `any` or leave types implicit.

---

## Rule 1: Use Correct Event Types for Event Handlers

**Statement**: Event handlers must use React's event types (e.g., `React.ChangeEvent<HTMLInputElement>`), not native DOM event types.

### Why This Matters

React wraps native DOM events in SyntheticEvent objects. Using native types like `Event` or `MouseEvent` causes type mismatches because React's events have different properties and methods.

### ❌ WRONG: Using Native DOM Event Types

```typescript
function SearchBox() {
  // WRONG: Using native ChangeEvent
  const handleChange = (e: ChangeEvent) => {
    console.log(e.target.value); // Type error: target doesn't have value
  };

  return <input onChange={handleChange} />;
}
```

**What breaks**:
- TypeScript error: `ChangeEvent` is not defined or from wrong module
- If you import from DOM types, properties don't match React's SyntheticEvent
- **Symptom**: Type errors, loss of type safety

### ❌ WRONG: Using Generic Event Type

```typescript
function Button({ onClick }: { onClick: (e: Event) => void }) {
  // WRONG: Event is too generic
  return <button onClick={onClick}>Click</button>;
}
```

**What breaks**:
- TypeScript error: Event doesn't match React.MouseEvent
- Can't access React-specific properties like `e.currentTarget`
- **Symptom**: Type errors

### ❌ WRONG: Using `any` Type

```typescript
function Form() {
  // WRONG: any loses all type safety
  const handleSubmit = (e: any) => {
    e.preventDefault();
    console.log(e.target.elements.username.value); // No autocomplete, no type checking
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

**What breaks**:
- No type checking - typos in property names go undetected
- No autocomplete - harder to write correct code
- **Symptom**: Loss of type safety, potential runtime errors

### ✅ CORRECT: React Event Types

```typescript
function SearchBox() {
  // CORRECT: React.ChangeEvent with specific element type
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log(e.target.value); // Fully typed
  };

  return <input onChange={handleChange} />;
}
```

**Why this works**: `React.ChangeEvent<HTMLInputElement>` correctly types the event and the target element.

### Common Event Types

**Input events**:

```typescript
// Text input, textarea
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {};
const handleTextAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {};

// Select
const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {};
```

**Mouse events**:

```typescript
// Click, double-click
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {};
const handleDivClick = (e: React.MouseEvent<HTMLDivElement>) => {};
```

**Form events**:

```typescript
// Form submit
const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {};
```

**Keyboard events**:

```typescript
// Key press, key down, key up
const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {};
```

**Focus events**:

```typescript
// Focus, blur
const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {};
```

**Generic event (when element type doesn't matter)**:

```typescript
// Can use HTMLElement when specific element doesn't matter
const handleClick = (e: React.MouseEvent<HTMLElement>) => {};
```

### ✅ CORRECT: Form Submit with Typed Elements

```typescript
function LoginForm() {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Type the form elements
    const form = e.currentTarget;
    const formData = new FormData(form);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    login(username, password);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="username" />
      <input name="password" type="password" />
      <button type="submit">Login</button>
    </form>
  );
}
```

**Why this works**: Event is correctly typed, FormData API properly typed.

---

## Rule 2: Explicitly Type Children Prop (React 18+)

**Statement**: In React 18+, the `children` prop is no longer implicitly included in component props. You must explicitly type it as `children?: React.ReactNode`.

### Why This Matters

React 18 removed implicit children from the types. If you don't explicitly type children, TypeScript will error when you try to pass children to your component.

### ❌ WRONG: No Children Type (React 18+)

```typescript
// WRONG: children not in Props interface
interface CardProps {
  title: string;
}

function Card({ title, children }: CardProps) {
  // TypeScript error: Property 'children' does not exist on type 'CardProps'
  return (
    <div>
      <h2>{title}</h2>
      {children}
    </div>
  );
}

// Usage also errors
<Card title="My Card">
  <p>Content</p> {/* Error: 'Card' components don't have 'children' prop */}
</Card>
```

**What breaks**:
- TypeScript error on destructuring children
- TypeScript error when passing children to component
- **Symptom**: Build fails with type errors

### ❌ WRONG: Children as `any`

```typescript
interface CardProps {
  title: string;
  children: any; // WRONG: loses type safety
}

function Card({ title, children }: CardProps) {
  return (
    <div>
      <h2>{title}</h2>
      {children}
    </div>
  );
}
```

**What breaks**:
- Loses type safety - anything can be passed as children
- No validation that children are valid JSX
- **Symptom**: Loss of type safety

### ✅ CORRECT: Explicitly Type Children

```typescript
interface CardProps {
  title: string;
  children?: React.ReactNode; // CORRECT: explicit children type
}

function Card({ title, children }: CardProps) {
  return (
    <div>
      <h2>{title}</h2>
      {children}
    </div>
  );
}

// Usage works
<Card title="My Card">
  <p>Content</p>
</Card>
```

**Why this works**: `React.ReactNode` is the correct type for anything that can be rendered (JSX, strings, numbers, arrays, etc.).

### Children Type Options

```typescript
// Any valid React child
children?: React.ReactNode;

// Only single React element
children?: React.ReactElement;

// Only string
children?: string;

// Only function (render prop)
children?: (data: Data) => React.ReactNode;

// Required children (not optional)
children: React.ReactNode;

// Array of specific elements
children?: React.ReactElement<ListItemProps>[];
```

### ✅ CORRECT: Component with No Children

```typescript
// If component shouldn't accept children, don't include children in Props
interface ButtonProps {
  label: string;
  onClick: () => void;
}

function Button({ label, onClick }: ButtonProps) {
  return <button onClick={onClick}>{label}</button>;
}

// This will error (good!)
<Button label="Click" onClick={handleClick}>
  <span>Extra</span> {/* Error: Button doesn't accept children */}
</Button>
```

**Why this works**: Omitting children from Props interface prevents users from passing children.

---

## Rule 3: Properly Type Generic Components

**Statement**: When creating generic components, constrain type parameters and provide sensible defaults.

### Why This Matters

Generic components are reusable across different data types. Without proper constraints and defaults, you lose type safety or make the component hard to use.

### ❌ WRONG: No Type Parameter Constraint

```typescript
// WRONG: T is unconstrained, could be anything
function List<T>({ items }: { items: T[] }) {
  return (
    <ul>
      {items.map((item, index) => (
        <li key={index}>{item.toString()}</li> // Assumes toString exists
      ))}
    </ul>
  );
}
```

**What breaks**:
- No guarantee that T has toString()
- Could pass complex objects without toString()
- **Symptom**: Runtime errors

### ❌ WRONG: Using `any` Instead of Generics

```typescript
// WRONG: Loses type safety
interface ListProps {
  items: any[];
  renderItem: (item: any) => React.ReactNode;
}

function List({ items, renderItem }: ListProps) {
  return (
    <ul>
      {items.map((item, index) => (
        <li key={index}>{renderItem(item)}</li>
      ))}
    </ul>
  );
}
```

**What breaks**:
- No type checking on items or renderItem
- Can't enforce that renderItem matches items type
- **Symptom**: Loss of type safety

### ✅ CORRECT: Properly Constrained Generic

```typescript
interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  keyExtractor: (item: T) => string | number;
}

function List<T>({ items, renderItem, keyExtractor }: ListProps<T>) {
  return (
    <ul>
      {items.map(item => (
        <li key={keyExtractor(item)}>{renderItem(item)}</li>
      ))}
    </ul>
  );
}

// Usage - TypeScript infers type
<List
  items={users}
  renderItem={user => <div>{user.name}</div>}
  keyExtractor={user => user.id}
/>
```

**Why this works**: Type parameter T links items, renderItem, and keyExtractor together. TypeScript ensures they all use the same type.

### ✅ CORRECT: Generic with Constraint

```typescript
// Constrain T to have an id property
interface HasId {
  id: string | number;
}

interface ListProps<T extends HasId> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
}

function List<T extends HasId>({ items, renderItem }: ListProps<T>) {
  return (
    <ul>
      {items.map(item => (
        <li key={item.id}>{renderItem(item)}</li> // Safe: T always has id
      ))}
    </ul>
  );
}

// Usage
<List
  items={users} // users must have id property
  renderItem={user => <div>{user.name}</div>}
/>
```

**Why this works**: Constraint ensures T always has an id, making the component safer.

### ✅ CORRECT: Generic with Default Type

```typescript
interface SelectProps<T = string> {
  options: T[];
  value: T;
  onChange: (value: T) => void;
  getLabel: (option: T) => string;
}

function Select<T = string>({
  options,
  value,
  onChange,
  getLabel
}: SelectProps<T>) {
  return (
    <select
      value={getLabel(value)}
      onChange={e => {
        const selected = options.find(o => getLabel(o) === e.target.value);
        if (selected) onChange(selected);
      }}
    >
      {options.map(option => (
        <option key={getLabel(option)} value={getLabel(option)}>
          {getLabel(option)}
        </option>
      ))}
    </select>
  );
}

// Simple usage with default (string)
<Select
  options={['Red', 'Green', 'Blue']}
  value={color}
  onChange={setColor}
  getLabel={s => s}
/>

// Complex usage with explicit type
<Select<User>
  options={users}
  value={selectedUser}
  onChange={setSelectedUser}
  getLabel={user => user.name}
/>
```

**Why this works**: Default type makes simple cases easier, explicit type parameter for complex cases.

---

## Rule 4: Always Define Props Interface

**Statement**: Every component should have an explicitly defined Props interface - never rely on inline types or implicit any.

### Why This Matters

Explicit Props interfaces make components self-documenting, enable better autocomplete, and catch type errors early.

### ❌ WRONG: Inline Props Type

```typescript
// WRONG: Inline type is hard to read and reuse
function UserCard({ name, email, age }: { name: string; email: string; age: number }) {
  return (
    <div>
      <h3>{name}</h3>
      <p>{email}</p>
      <p>Age: {age}</p>
    </div>
  );
}
```

**What breaks**:
- Hard to read with many props
- Can't reuse type definition
- Hard to document
- **Symptom**: Poor code readability

### ❌ WRONG: No Props Type

```typescript
// WRONG: No type, relies on implicit any
function UserCard({ name, email, age }) {
  return (
    <div>
      <h3>{name}</h3>
      <p>{email}</p>
      <p>Age: {age}</p>
    </div>
  );
}
```

**What breaks**:
- No type checking
- No autocomplete
- Typos go undetected
- **Symptom**: Loss of type safety

### ✅ CORRECT: Named Props Interface

```typescript
interface UserCardProps {
  name: string;
  email: string;
  age: number;
}

function UserCard({ name, email, age }: UserCardProps) {
  return (
    <div>
      <h3>{name}</h3>
      <p>{email}</p>
      <p>Age: {age}</p>
    </div>
  );
}
```

**Why this works**: Clear, readable, reusable, self-documenting.

### ✅ CORRECT: With Optional Props and Defaults

```typescript
interface ButtonProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  onClick: () => void;
}

function Button({
  label,
  variant = 'primary',
  disabled = false,
  onClick
}: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant}`}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
```

**Why this works**: Optional props with `?`, defaults in destructuring, clear types.

### ✅ CORRECT: With Children

```typescript
interface CardProps {
  title: string;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}

function Card({ title, footer, children }: CardProps) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <div>{children}</div>
      {footer && <div className="footer">{footer}</div>}
    </div>
  );
}
```

**Why this works**: Explicitly types children and optional footer.

### ✅ CORRECT: Extending HTML Props

```typescript
// Extend built-in button props
interface CustomButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  loading?: boolean;
}

function CustomButton({
  variant = 'primary',
  loading = false,
  children,
  disabled,
  ...rest
}: CustomButtonProps) {
  return (
    <button
      className={`btn btn-${variant}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? 'Loading...' : children}
    </button>
  );
}

// Usage - inherits all button props
<CustomButton variant="primary" onClick={handleClick} type="submit">
  Submit
</CustomButton>
```

**Why this works**: Inherits all standard button props (onClick, type, disabled, etc.) while adding custom props.

---

## Common Patterns

### Pattern: Component with Callback Prop

```typescript
interface SearchProps {
  onSearch: (query: string) => void;
}

function Search({ onSearch }: SearchProps) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
    </form>
  );
}
```

### Pattern: Component with Async Callback

```typescript
interface LoginProps {
  onLogin: (username: string, password: string) => Promise<void>;
}

function Login({ onLogin }: LoginProps) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onLogin(username, password);
    } finally {
      setLoading(false);
    }
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### Pattern: Forwarding Refs

```typescript
interface InputProps {
  label: string;
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error }, ref) => {
    return (
      <div>
        <label>{label}</label>
        <input ref={ref} />
        {error && <span>{error}</span>}
      </div>
    );
  }
);
```

### Pattern: Component with Discriminated Union Props

```typescript
type ButtonProps =
  | { variant: 'link'; href: string; onClick?: never }
  | { variant?: 'primary' | 'secondary'; href?: never; onClick: () => void };

function Button(props: ButtonProps) {
  if (props.variant === 'link') {
    return <a href={props.href}>Link</a>;
  }
  return <button onClick={props.onClick}>Button</button>;
}
```

---

## ESLint Configuration

Enable TypeScript ESLint rules:

```json
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-module-boundary-types": "warn",
    "react/prop-types": "off"
  }
}
```

---

## Agent Checklist: TypeScript with React

Before submitting React TypeScript code, verify:

- [ ] All event handlers use React event types (React.ChangeEvent, React.MouseEvent, etc.)
- [ ] Event types specify target element (e.g., `<HTMLInputElement>`)
- [ ] Children prop explicitly typed as `React.ReactNode` (if component accepts children)
- [ ] Generic components have type parameters properly constrained
- [ ] Every component has named Props interface (not inline types)
- [ ] Optional props marked with `?` or given defaults
- [ ] No `any` types (use proper React types or generics)
- [ ] Props extending HTML attributes use `React.HTMLAttributes<T>` or specific types
- [ ] Forwarded refs typed with `React.forwardRef<Element, Props>`

---

## Debugging TypeScript Issues

**Error**: "Property 'value' does not exist on type 'EventTarget'"
- **Cause**: Using wrong event type or not specifying element type
- **Fix**: Use `React.ChangeEvent<HTMLInputElement>` (or appropriate element)

**Error**: "Property 'children' does not exist on type 'Props'"
- **Cause**: React 18+ doesn't include children implicitly
- **Fix**: Add `children?: React.ReactNode` to Props interface

**Error**: "Type 'string' is not assignable to type 'never'"
- **Cause**: Discriminated union with incorrect props
- **Fix**: Check discriminated union types, ensure all branches are valid

**Error**: "Cannot find name 'React'"
- **Cause**: Missing React import in TypeScript file
- **Fix**: Add `import React from 'react'` (or use new JSX transform)

---

## Summary

TypeScript with React requires specific type patterns:

1. **Use React event types** (React.ChangeEvent, React.MouseEvent) with specific element types
2. **Explicitly type children** as `React.ReactNode` (React 18+ requirement)
3. **Constrain generic components** with proper type parameters and defaults
4. **Always define Props interfaces** - never use inline types or implicit any

These patterns ensure type safety, better autocomplete, and catch errors at build time instead of runtime.
