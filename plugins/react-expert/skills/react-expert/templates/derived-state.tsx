# Template: Derived State

**When to Use**: Computing values from state during render instead of storing them in separate state.

**Complexity**: Low

**Common Mistakes Agents Make**:
- Using useState for values that can be computed from existing state
- Using useEffect to sync derived values (anti-pattern)
- Not using useMemo for expensive computations
- Creating unnecessary state variables

## Template

```typescript
import React, { useState, useMemo } from 'react';

interface {{ComponentName}}Props {
  {{propName}}: {{PropType}};
}

/**
 * {{ComponentName}} - Demonstrates derived state patterns
 */
export function {{ComponentName}}({ {{propName}} }: {{ComponentName}}Props) {
  // Source state
  const [{{sourceState1}}, set{{SourceState1}}] = useState<{{Type1}}>({{initialValue1}});
  const [{{sourceState2}}, set{{SourceState2}}] = useState<{{Type2}}>({{initialValue2}});

  /**
   * Pattern 1: Simple derivation (compute during render) ✅
   * No useState, no useEffect needed
   */
  const {{derivedValue1}} = {{sourceState1}}.{{computation}};

  /**
   * Pattern 2: Derivation from multiple sources ✅
   */
  const {{derivedValue2}} = {{sourceState1}} + {{sourceState2}};

  /**
   * Pattern 3: Conditional derivation ✅
   */
  const {{derivedValue3}} = {{sourceState1}} > 10
    ? {{sourceState1}} * 2
    : {{sourceState1}};

  /**
   * Pattern 4: Complex object derivation ✅
   */
  const {{derivedObject}} = {
    {{property1}}: {{sourceState1}}.{{computation1}},
    {{property2}}: {{sourceState2}}.{{computation2}},
    {{property3}}: {{derivedValue1}},
  };

  /**
   * Pattern 5: Expensive derivation with useMemo ✅
   * Only recompute when dependencies change
   */
  const {{expensiveDerivedValue}} = useMemo(() => {
    console.log('Computing expensive value...');

    // Expensive computation
    return {{sourceState1}}.{{expensiveOperation}}();
  }, [{{sourceState1}}]); // Only recompute when sourceState1 changes

  /**
   * Pattern 6: Array filtering/mapping (derived list) ✅
   */
  const {{filteredItems}} = useMemo(() => {
    return {{sourceState1}}.filter(item => item.{{property}} === {{condition}});
  }, [{{sourceState1}}]);

  /**
   * Pattern 7: Sorted array ✅
   */
  const {{sortedItems}} = useMemo(() => {
    return [...{{sourceState1}}].sort((a, b) =>
      a.{{sortProperty}}.localeCompare(b.{{sortProperty}})
    );
  }, [{{sourceState1}}]);

  // ❌ ANTI-PATTERN: Syncing derived state with useEffect
  // const [derivedValue, setDerivedValue] = useState(0);
  // useEffect(() => {
  //   setDerivedValue(sourceState * 2); // DON'T DO THIS!
  // }, [sourceState]);

  // ❌ ANTI-PATTERN: Storing computed value in state
  // const [total, setTotal] = useState(0);
  // const updateTotal = () => {
  //   setTotal(price * quantity); // Just compute directly!
  // };

  return (
    <div className="{{component-name}}">
      <div>Source: {{{sourceState1}}}</div>
      <div>Derived: {{{derivedValue1}}}</div>
      <div>Expensive: {{{expensiveDerivedValue}}}</div>
    </div>
  );
}
```

## Adaptation Rules

- [ ] Replace `{{ComponentName}}` with actual component name
- [ ] Compute derived values during render, don't store in state
- [ ] Use useMemo for expensive computations
- [ ] Include all source values in useMemo dependencies
- [ ] Avoid useEffect for syncing derived values
- [ ] Don't create unnecessary state for computed values

## Related

- Rule: @rules/dependency-arrays.md (useMemo dependencies)
- Rule: @rules/performance-traps.md (when NOT to memoize)
- Decision: @decision-trees/effect-usage.md (don't derive in effects - use render-time)

## Example: Shopping Cart

```typescript
import React, { useState, useMemo } from 'react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

/**
 * ShoppingCart - Demonstrates derived values in shopping cart
 */
export function ShoppingCart() {
  // Source state: cart items
  const [items, setItems] = useState<CartItem[]>([
    { id: '1', name: 'Widget', price: 10.00, quantity: 2 },
    { id: '2', name: 'Gadget', price: 25.50, quantity: 1 },
    { id: '3', name: 'Thing', price: 5.99, quantity: 5 },
  ]);

  const [taxRate, setTaxRate] = useState<number>(0.08); // 8% tax
  const [discountCode, setDiscountCode] = useState<string>('');

  /**
   * Derived: Total number of items
   * No need for useState - compute from items
   */
  const totalItemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  /**
   * Derived: Subtotal (before tax and discount)
   */
  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }, [items]);

  /**
   * Derived: Discount amount based on code
   */
  const discount = useMemo(() => {
    if (discountCode === 'SAVE10') {
      return subtotal * 0.10; // 10% off
    } else if (discountCode === 'SAVE20') {
      return subtotal * 0.20; // 20% off
    }
    return 0;
  }, [subtotal, discountCode]);

  /**
   * Derived: Amount after discount
   */
  const afterDiscount = subtotal - discount;

  /**
   * Derived: Tax amount
   */
  const tax = afterDiscount * taxRate;

  /**
   * Derived: Final total
   */
  const total = afterDiscount + tax;

  /**
   * Derived: Items above certain price
   */
  const expensiveItems = useMemo(() => {
    return items.filter(item => item.price > 20);
  }, [items]);

  /**
   * Derived: Is cart empty
   */
  const isEmpty = items.length === 0;

  /**
   * Derived: Can checkout (has items and total > 0)
   */
  const canCheckout = !isEmpty && total > 0;

  /**
   * Update item quantity
   */
  const updateQuantity = (itemId: string, quantity: number) => {
    setItems(prevItems =>
      prevItems.map(item =>
        item.id === itemId ? { ...item, quantity } : item
      )
    );
  };

  /**
   * Remove item
   */
  const removeItem = (itemId: string) => {
    setItems(prevItems => prevItems.filter(item => item.id !== itemId));
  };

  return (
    <div className="shopping-cart">
      <h1>Shopping Cart ({totalItemCount} items)</h1>

      {isEmpty ? (
        <p>Your cart is empty</p>
      ) : (
        <>
          <ul className="cart-items">
            {items.map(item => (
              <li key={item.id} className="cart-item">
                <div className="cart-item__info">
                  <h3>{item.name}</h3>
                  <p>${item.price.toFixed(2)} each</p>
                </div>

                <div className="cart-item__quantity">
                  <button onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                    -
                  </button>
                  <span>{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                    +
                  </button>
                </div>

                <div className="cart-item__total">
                  ${(item.price * item.quantity).toFixed(2)}
                </div>

                <button onClick={() => removeItem(item.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>

          <div className="cart-summary">
            <div className="cart-summary__line">
              <span>Subtotal:</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>

            {discount > 0 && (
              <div className="cart-summary__line cart-summary__discount">
                <span>Discount ({discountCode}):</span>
                <span>-${discount.toFixed(2)}</span>
              </div>
            )}

            <div className="cart-summary__line">
              <span>Tax ({(taxRate * 100).toFixed(0)}%):</span>
              <span>${tax.toFixed(2)}</span>
            </div>

            <div className="cart-summary__line cart-summary__total">
              <span>Total:</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          <div className="cart-actions">
            <input
              type="text"
              placeholder="Discount code"
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
            />

            <button disabled={!canCheckout}>
              Checkout
            </button>
          </div>

          {expensiveItems.length > 0 && (
            <div className="cart-notice">
              You have {expensiveItems.length} premium item(s) in your cart!
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

## Example: Filtered and Sorted List

```typescript
import React, { useState, useMemo } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
  isActive: boolean;
}

/**
 * UserList - Demonstrates filtering and sorting as derived state
 */
export function UserList() {
  // Source state
  const [users] = useState<User[]>([
    { id: '1', name: 'Alice', email: 'alice@example.com', role: 'admin', isActive: true },
    { id: '2', name: 'Bob', email: 'bob@example.com', role: 'user', isActive: true },
    { id: '3', name: 'Charlie', email: 'charlie@example.com', role: 'guest', isActive: false },
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'email'>('name');

  /**
   * Derived: Filtered users based on search and role
   */
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // Search filter
      const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           user.email.toLowerCase().includes(searchTerm.toLowerCase());

      // Role filter
      const matchesRole = filterRole === 'all' || user.role === filterRole;

      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, filterRole]);

  /**
   * Derived: Sorted users
   */
  const sortedUsers = useMemo(() => {
    return [...filteredUsers].sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else {
        return a.email.localeCompare(b.email);
      }
    });
  }, [filteredUsers, sortBy]);

  /**
   * Derived: User statistics
   */
  const stats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter(u => u.isActive).length,
      admins: users.filter(u => u.role === 'admin').length,
      filtered: sortedUsers.length,
    };
  }, [users, sortedUsers]);

  return (
    <div className="user-list">
      <div className="user-list__controls">
        <input
          type="text"
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
          <option value="guest">Guest</option>
        </select>

        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'name' | 'email')}>
          <option value="name">Sort by Name</option>
          <option value="email">Sort by Email</option>
        </select>
      </div>

      <div className="user-list__stats">
        <span>Total: {stats.total}</span>
        <span>Active: {stats.active}</span>
        <span>Admins: {stats.admins}</span>
        <span>Showing: {stats.filtered}</span>
      </div>

      <ul className="user-list__items">
        {sortedUsers.map(user => (
          <li key={user.id}>
            {user.name} - {user.email} ({user.role})
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Notes

### State vs Derived State

**Use state for:**
- User input (form values)
- Fetched data
- Toggle flags (modals, menus)
- Things that change independently

**Use derived values for:**
- Computed from other state
- Filtered/sorted arrays
- Totals, counts, averages
- Validation results
- Formatted values

```typescript
// ❌ Don't store derived value in state
const [price, setPrice] = useState(100);
const [quantity, setQuantity] = useState(2);
const [total, setTotal] = useState(200);

// Update total every time price or quantity changes
useEffect(() => {
  setTotal(price * quantity); // This is an anti-pattern!
}, [price, quantity]);

// ✅ Just compute during render
const [price, setPrice] = useState(100);
const [quantity, setQuantity] = useState(2);
const total = price * quantity; // Simple!
```

### When to Use useMemo

Use useMemo for expensive computations:

```typescript
// ✅ Cheap computation - no useMemo needed
const fullName = `${firstName} ${lastName}`;
const total = price + tax;
const isValid = value.length > 0;

// ✅ Expensive computation - use useMemo
const sortedItems = useMemo(() => {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}, [items]);

const filteredResults = useMemo(() => {
  return items.filter(item => complexValidation(item));
}, [items]);
```

### Common Anti-Pattern

Don't sync derived state with useEffect:

```typescript
// ❌ ANTI-PATTERN
const [items, setItems] = useState([]);
const [itemCount, setItemCount] = useState(0);

useEffect(() => {
  setItemCount(items.length); // Don't do this!
}, [items]);

// ✅ CORRECT
const [items, setItems] = useState([]);
const itemCount = items.length; // Just compute it!
```
