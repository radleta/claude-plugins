# Template: List Rendering

**When to Use**: Rendering arrays of data in React components.

**Complexity**: Low

**Common Mistakes Agents Make**:
- Using array index as key prop (anti-pattern that causes bugs)
- Missing key prop entirely
- Not handling empty array state
- Using non-unique keys
- Not typing array elements properly
- Forgetting to check if array exists before mapping

## Template

```typescript
import React from 'react';

/**
 * Item type for list
 */
interface {{ItemType}} {
  /**
   * Unique identifier (REQUIRED for key prop)
   */
  id: string;

  {{property1}}: {{Type1}};
  {{property2}}: {{Type2}};
}

interface {{ComponentName}}Props {
  /**
   * Array of items to render
   */
  items: {{ItemType}}[];

  /**
   * Optional callback when item is clicked
   */
  onItemClick?: (item: {{ItemType}}) => void;

  /**
   * Optional callback when item is deleted
   */
  onItemDelete?: (id: string) => void;

  /**
   * Message to show when list is empty
   */
  emptyMessage?: string;
}

/**
 * {{ComponentName}} - Renders a list of {{ItemType}} items
 */
export function {{ComponentName}}({
  items,
  onItemClick,
  onItemDelete,
  emptyMessage = 'No items to display',
}: {{ComponentName}}Props) {
  /**
   * Handle empty state
   */
  if (items.length === 0) {
    return (
      <div className="{{component-name}} empty">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="{{component-name}}">
      <div className="{{component-name}}__count">
        {items.length} {items.length === 1 ? 'item' : 'items'}
      </div>

      <ul className="{{component-name}}__list">
        {items.map((item) => (
          <li
            key={item.id} // ✅ Use unique ID, NOT index
            className="{{component-name}}__item"
            onClick={() => onItemClick?.(item)}
            role={onItemClick ? 'button' : undefined}
            tabIndex={onItemClick ? 0 : undefined}
          >
            <div className="{{component-name}}__item-content">
              <h3>{item.{{property1}}}</h3>
              <p>{item.{{property2}}}</p>
            </div>

            {onItemDelete && (
              <button
                className="{{component-name}}__item-delete"
                onClick={(e) => {
                  e.stopPropagation(); // Prevent parent onClick
                  onItemDelete(item.id);
                }}
                aria-label={`Delete ${item.{{property1}}}`}
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Adaptation Rules

- [ ] Replace `{{ComponentName}}`, `{{ItemType}}` with actual names
- [ ] Ensure `{{ItemType}}` has unique `id` property (string or number)
- [ ] Use `item.id` as key prop, NEVER use array index
- [ ] Handle empty array state appropriately
- [ ] Type the items array properly (`{{ItemType}}[]`)
- [ ] Add null/undefined checks if array might not exist
- [ ] Use semantic HTML (ul/li for lists)
- [ ] Add ARIA attributes for interactive items

## Related

- Rule: @rules/key-prop-requirements.md (key prop requirements - CRITICAL!)
- Rule: @rules/typescript-essentials.md (TypeScript for list items)
- Decision: @decision-trees/performance.md (when to virtualize large lists)

## Example: UserList Component

```typescript
import React from 'react';

/**
 * User item type
 */
interface User {
  /**
   * Unique user ID
   */
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
  isActive: boolean;
}

interface UserListProps {
  /**
   * Array of users to display
   */
  users: User[];

  /**
   * Callback when user is selected
   */
  onUserSelect?: (user: User) => void;

  /**
   * Callback when user is deleted
   */
  onUserDelete?: (userId: string) => void;

  /**
   * Filter to show only active users
   */
  showActiveOnly?: boolean;
}

/**
 * UserList - Displays a list of users with actions
 */
export function UserList({
  users,
  onUserSelect,
  onUserDelete,
  showActiveOnly = false,
}: UserListProps) {
  /**
   * Filter users if needed
   */
  const filteredUsers = showActiveOnly
    ? users.filter(user => user.isActive)
    : users;

  /**
   * Handle empty state
   */
  if (filteredUsers.length === 0) {
    return (
      <div className="user-list empty">
        <p>
          {showActiveOnly
            ? 'No active users found'
            : 'No users to display'}
        </p>
      </div>
    );
  }

  /**
   * Get role badge color
   */
  const getRoleBadgeClass = (role: User['role']): string => {
    switch (role) {
      case 'admin':
        return 'badge-admin';
      case 'user':
        return 'badge-user';
      case 'guest':
        return 'badge-guest';
      default:
        return 'badge-default';
    }
  };

  return (
    <div className="user-list">
      <div className="user-list__header">
        <h2>Users ({filteredUsers.length})</h2>
        {showActiveOnly && (
          <span className="user-list__filter-badge">Active Only</span>
        )}
      </div>

      <ul className="user-list__items">
        {filteredUsers.map((user) => (
          <li
            key={user.id} // ✅ Unique ID as key
            className={`user-list__item ${user.isActive ? 'active' : 'inactive'}`}
            onClick={() => onUserSelect?.(user)}
            role={onUserSelect ? 'button' : undefined}
            tabIndex={onUserSelect ? 0 : undefined}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onUserSelect?.(user);
              }
            }}
          >
            <div className="user-list__item-content">
              <div className="user-list__item-header">
                <h3 className="user-list__item-name">{user.name}</h3>
                <span className={`user-list__item-badge ${getRoleBadgeClass(user.role)}`}>
                  {user.role}
                </span>
              </div>

              <p className="user-list__item-email">{user.email}</p>

              <div className="user-list__item-status">
                <span className={`status-indicator ${user.isActive ? 'active' : 'inactive'}`}>
                  {user.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            {onUserDelete && (
              <button
                className="user-list__item-delete"
                onClick={(e) => {
                  e.stopPropagation(); // Don't trigger item click
                  onUserDelete(user.id);
                }}
                aria-label={`Delete user ${user.name}`}
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Example: Nested List (Categories with Items)

```typescript
import React from 'react';

interface CategoryItem {
  id: string;
  name: string;
  description: string;
}

interface Category {
  id: string;
  name: string;
  items: CategoryItem[];
}

interface CategoryListProps {
  categories: Category[];
}

/**
 * CategoryList - Renders nested list of categories and their items
 */
export function CategoryList({ categories }: CategoryListProps) {
  if (categories.length === 0) {
    return <div>No categories available</div>;
  }

  return (
    <div className="category-list">
      {categories.map((category) => (
        <div key={category.id} className="category">
          <h2 className="category__name">{category.name}</h2>

          {category.items.length === 0 ? (
            <p className="category__empty">No items in this category</p>
          ) : (
            <ul className="category__items">
              {category.items.map((item) => (
                <li key={item.id} className="category__item">
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
```

## Notes

### Key Prop Requirements

**The key prop MUST:**
- Be unique among siblings
- Be stable (same key for same item across renders)
- Not change (don't use random values or index)

```typescript
// ❌ WRONG: Using index as key
{items.map((item, index) => (
  <li key={index}>{item.name}</li>
))}

// ❌ WRONG: Using random value
{items.map((item) => (
  <li key={Math.random()}>{item.name}</li>
))}

// ✅ CORRECT: Using unique, stable ID
{items.map((item) => (
  <li key={item.id}>{item.name}</li>
))}
```

### Why Index as Key is Bad

Using index causes bugs when:
- Items are reordered
- Items are added/removed from middle
- Items have internal state

```typescript
// ❌ Bug: Reordering items causes wrong state association
const [items, setItems] = useState([
  { id: '1', name: 'First' },
  { id: '2', name: 'Second' },
]);

// If you reverse the array, React thinks the items didn't change
// because keys (0, 1) are the same. This causes bugs!
{items.map((item, index) => (
  <ItemWithState key={index} item={item} />
))}

// ✅ Correct: React knows items changed
{items.map((item) => (
  <ItemWithState key={item.id} item={item} />
))}
```

### What if Items Don't Have IDs?

**Option 1: Add IDs when creating items**
```typescript
const items = data.map(item => ({
  ...item,
  id: generateUniqueId(), // Use uuid or similar
}));
```

**Option 2: Use stable property combination**
```typescript
// If combination is guaranteed unique
{items.map((item) => (
  <li key={`${item.category}-${item.name}`}>
    {item.name}
  </li>
))}
```

**Option 3: Index as last resort**
Only when:
- List never reorders
- Items never added/removed from middle
- Items have no internal state

### Empty State Handling

Always handle empty arrays:

```typescript
// ✅ Handle empty state
if (items.length === 0) {
  return <div>No items</div>;
}

return (
  <ul>
    {items.map(item => (
      <li key={item.id}>{item.name}</li>
    ))}
  </ul>
);

// Alternative: Inline conditional
return (
  <div>
    {items.length === 0 ? (
      <p>No items</p>
    ) : (
      <ul>
        {items.map(item => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    )}
  </div>
);
```

### Optional Chaining for Safety

```typescript
// ✅ Safe: Handle undefined/null array
{items?.map(item => (
  <li key={item.id}>{item.name}</li>
))}

// Or with explicit check
{items && items.length > 0 && items.map(item => (
  <li key={item.id}>{item.name}</li>
))}
```

### Filtering and Sorting

Perform operations before map:

```typescript
// ✅ Filter and sort before rendering
const displayItems = items
  .filter(item => item.isActive)
  .sort((a, b) => a.name.localeCompare(b.name));

return (
  <ul>
    {displayItems.map(item => (
      <li key={item.id}>{item.name}</li>
    ))}
  </ul>
);

// ❌ Avoid: Multiple passes or inline operations that create new arrays
{items.filter(...).sort(...).map(...)} // Less efficient
```
