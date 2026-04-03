# Template: Generic Component

**When to Use**: Creating reusable components that work with multiple types.

**Complexity**: High

**Common Mistakes Agents Make**:
- Not constraining generic types when needed
- Using `any` instead of proper generics
- Poor generic parameter naming (use descriptive names, not just T)
- Not providing defaults for generic types
- Over-complicating with unnecessary generics

## Template

```typescript
import React from 'react';

/**
 * Generic component with single type parameter
 */
interface {{ComponentName}}Props<{{T}}> {
  /**
   * Items of generic type
   */
  items: {{T}}[];

  /**
   * Render function for each item
   */
  render{{Item}}: (item: {{T}}) => React.ReactNode;

  /**
   * Optional key extractor
   */
  keyExtractor?: (item: {{T}}) => string;

  /**
   * Optional filter function
   */
  filter?: (item: {{T}}) => boolean;
}

/**
 * {{ComponentName}} - Generic list component
 */
export function {{ComponentName}}<{{T}}>({
  items,
  render{{Item}},
  keyExtractor = (item, index) => String(index),
  filter,
}: {{ComponentName}}Props<{{T}}>) {
  const filteredItems = filter ? items.filter(filter) : items;

  return (
    <div className="{{component-name}}">
      {filteredItems.map((item, index) => (
        <div key={keyExtractor(item, index)}>
          {render{{Item}}(item)}
        </div>
      ))}
    </div>
  );
}

/**
 * Generic component with constrained type parameter
 * Type must extend a base interface
 */
interface {{BaseItem}} {
  id: string;
  name: string;
}

interface {{ConstrainedComponentName}}Props<{{T}} extends {{BaseItem}}> {
  items: {{T}}[];
  onItemClick: (item: {{T}}) => void;
}

export function {{ConstrainedComponentName}}<{{T}} extends {{BaseItem}}>({
  items,
  onItemClick,
}: {{ConstrainedComponentName}}Props<{{T}}>) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id} onClick={() => onItemClick(item)}>
          {item.name} {/* TypeScript knows item has name */}
        </li>
      ))}
    </ul>
  );
}

/**
 * Generic component with multiple type parameters
 */
interface {{MultiGenericComponent}}Props<{{TData}}, {{TValue}}> {
  data: {{TData}};
  transform: (data: {{TData}}) => {{TValue}};
  render: (value: {{TValue}}) => React.ReactNode;
}

export function {{MultiGenericComponent}}<{{TData}}, {{TValue}}>({
  data,
  transform,
  render,
}: {{MultiGenericComponent}}Props<{{TData}}, {{TValue}}>) {
  const value = transform(data);
  return <div>{render(value)}</div>;
}

/**
 * Generic component with default type parameter
 */
interface {{ComponentWithDefault}}Props<{{T}} = string> {
  value: {{T}};
  onChange: (value: {{T}}) => void;
}

export function {{ComponentWithDefault}}<{{T}} = string>({
  value,
  onChange,
}: {{ComponentWithDefault}}Props<{{T}}>) {
  return (
    <div>
      {/* Implementation */}
    </div>
  );
}
```

## Adaptation Rules

- [ ] Replace `{{ComponentName}}` and type parameters with actual names
- [ ] Use descriptive generic names (TItem, TData, TValue) not just T
- [ ] Add constraints (`extends`) when generic must have certain properties
- [ ] Provide default types when appropriate
- [ ] Keep generics simple - only use when truly needed
- [ ] Ensure type inference works (users shouldn't need to specify types)
- [ ] Document what types are expected

## Related

- Rule: @rules/typescript-essentials.md (TypeScript + React generics)
- Template: @templates/function-component.tsx (basic component structure)
- Decision: @decision-trees/state-management.md (generic state management)

## Example: Generic DataTable Component

```typescript
import React from 'react';

/**
 * Column definition for DataTable
 */
interface Column<TData> {
  /**
   * Unique column identifier
   */
  id: string;

  /**
   * Column header text
   */
  header: string;

  /**
   * Function to render cell content
   */
  cell: (row: TData) => React.ReactNode;

  /**
   * Optional column width
   */
  width?: number;
}

/**
 * Props for DataTable
 */
interface DataTableProps<TData> {
  /**
   * Array of data rows
   */
  data: TData[];

  /**
   * Column definitions
   */
  columns: Array<Column<TData>>;

  /**
   * Function to extract unique key from row
   */
  getRowId: (row: TData) => string;

  /**
   * Optional row click handler
   */
  onRowClick?: (row: TData) => void;

  /**
   * Optional empty state message
   */
  emptyMessage?: string;
}

/**
 * DataTable - Generic, type-safe data table component
 */
export function DataTable<TData>({
  data,
  columns,
  getRowId,
  onRowClick,
  emptyMessage = 'No data available',
}: DataTableProps<TData>) {
  if (data.length === 0) {
    return (
      <div className="data-table-empty">
        {emptyMessage}
      </div>
    );
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          {columns.map((column) => (
            <th
              key={column.id}
              style={{ width: column.width }}
            >
              {column.header}
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {data.map((row) => (
          <tr
            key={getRowId(row)}
            onClick={() => onRowClick?.(row)}
            className={onRowClick ? 'clickable' : undefined}
          >
            {columns.map((column) => (
              <td key={column.id}>
                {column.cell(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Usage example with User type
 */
interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

function UserTable() {
  const users: User[] = [
    { id: '1', name: 'John', email: 'john@example.com', role: 'admin' },
    { id: '2', name: 'Jane', email: 'jane@example.com', role: 'user' },
  ];

  const columns: Array<Column<User>> = [
    {
      id: 'name',
      header: 'Name',
      cell: (user) => <strong>{user.name}</strong>,
    },
    {
      id: 'email',
      header: 'Email',
      cell: (user) => user.email,
    },
    {
      id: 'role',
      header: 'Role',
      cell: (user) => (
        <span className={`badge-${user.role}`}>
          {user.role}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      data={users}
      columns={columns}
      getRowId={(user) => user.id}
      onRowClick={(user) => console.log('Clicked:', user)}
    />
  );
}
```

## Example: Generic Select Component

```typescript
import React from 'react';

/**
 * Option shape for Select component
 */
interface SelectOption<TValue> {
  label: string;
  value: TValue;
  disabled?: boolean;
}

/**
 * Props for generic Select component
 */
interface SelectProps<TValue> {
  /**
   * Available options
   */
  options: Array<SelectOption<TValue>>;

  /**
   * Current selected value
   */
  value: TValue | null;

  /**
   * Change handler
   */
  onChange: (value: TValue) => void;

  /**
   * Optional placeholder
   */
  placeholder?: string;

  /**
   * Custom equality check
   */
  isEqual?: (a: TValue, b: TValue) => boolean;
}

/**
 * Select - Generic select component that works with any value type
 */
export function Select<TValue>({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  isEqual = (a, b) => a === b,
}: SelectProps<TValue>) {
  const selectedOption = options.find(
    (opt) => value !== null && isEqual(opt.value, value)
  );

  return (
    <div className="select">
      <button className="select__trigger">
        {selectedOption ? selectedOption.label : placeholder}
      </button>

      <ul className="select__options">
        {options.map((option, index) => (
          <li
            key={index}
            className={`select__option ${
              value !== null && isEqual(option.value, value) ? 'selected' : ''
            }`}
            onClick={() => !option.disabled && onChange(option.value)}
          >
            {option.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Usage with different types
 */

// String values
<Select
  options={[
    { label: 'Red', value: 'red' },
    { label: 'Blue', value: 'blue' },
  ]}
  value="red"
  onChange={(color) => console.log(color)}
/>

// Number values
<Select
  options={[
    { label: 'One', value: 1 },
    { label: 'Two', value: 2 },
  ]}
  value={1}
  onChange={(num) => console.log(num)}
/>

// Object values
interface User {
  id: string;
  name: string;
}

<Select
  options={[
    { label: 'John', value: { id: '1', name: 'John' } },
    { label: 'Jane', value: { id: '2', name: 'Jane' } },
  ]}
  value={{ id: '1', name: 'John' }}
  onChange={(user) => console.log(user)}
  isEqual={(a, b) => a.id === b.id}
/>
```

## Notes

### Type Inference

Design for automatic type inference:

```typescript
// ✅ Type inferred from data prop
<DataTable
  data={users} // TypeScript infers TData = User
  columns={columns}
  getRowId={(user) => user.id} // user is typed as User
/>

// ❌ Requiring explicit type parameter is worse UX
<DataTable<User> // User shouldn't need to specify
  data={users}
  columns={columns}
  getRowId={(user) => user.id}
/>
```

### Constrained Generics

Use constraints when you need specific properties:

```typescript
// Without constraint - can't access properties
function BadComponent<T>(props: { item: T }) {
  return <div>{props.item.id}</div>; // ❌ Error: T might not have id
}

// With constraint - can access guaranteed properties
interface HasId {
  id: string;
}

function GoodComponent<T extends HasId>(props: { item: T }) {
  return <div>{props.item.id}</div>; // ✅ T is guaranteed to have id
}
```

### When to Use Generics

**Use generics when:**
- Component works with multiple data types
- Type safety is important
- You want to preserve type information

**Don't use generics when:**
- Component only works with one type
- Logic is type-specific
- It makes the API more complex without benefit

```typescript
// ❌ Unnecessary generic
interface SimpleProps<T> {
  name: string; // T is never used!
}

// ✅ No generic needed
interface SimpleProps {
  name: string;
}
```
