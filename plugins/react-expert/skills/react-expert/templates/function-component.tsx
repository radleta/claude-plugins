# Template: Basic Functional Component

**When to Use**: Creating any functional component that receives props but has no internal state or side effects.

**Complexity**: Low

**Common Mistakes Agents Make**:
- Using `any` for props type
- Forgetting to define props interface
- Mixing default and named exports inconsistently
- Not destructuring props for readability
- Adding unnecessary FC/FunctionComponent type (it's optional and discouraged in modern React)

## Template

```typescript
import React from 'react';

/**
 * Props for {{ComponentName}} component
 */
interface {{ComponentName}}Props {
  /**
   * {{Description of prop}}
   */
  {{propName}}: {{propType}};

  /**
   * Optional {{description}}
   */
  {{optionalProp}}?: {{optionalType}};

  /**
   * Callback function {{description}}
   */
  {{callbackProp}}?: ({{param}}: {{paramType}}) => void;

  /**
   * Children elements
   */
  children?: React.ReactNode;
}

/**
 * {{ComponentName}} - {{Brief description of component purpose}}
 *
 * {{More detailed description if needed}}
 */
export function {{ComponentName}}({
  {{propName}},
  {{optionalProp}},
  {{callbackProp}},
  children,
}: {{ComponentName}}Props) {
  return (
    <div className="{{component-name}}">
      <h2>{{propName}}</h2>

      {{{optionalProp}} && (
        <p>{{optionalProp}}</p>
      )}

      {children}

      {{{callbackProp}} && (
        <button onClick={() => {{callbackProp}}({{propName}})}>
          Click me
        </button>
      )}
    </div>
  );
}

// Alternative: Default export (choose one based on project conventions)
// export default {{ComponentName}};
```

## Adaptation Rules

- [ ] Replace `{{ComponentName}}` with your component name (PascalCase)
- [ ] Replace `{{propName}}`, `{{propType}}` with actual props
- [ ] Add/remove props based on requirements
- [ ] Update JSDoc comments with actual descriptions
- [ ] Choose named export vs default export (match project style)
- [ ] Match project's className convention (CSS modules, styled-components, etc.)
- [ ] Remove unused props (children, callbacks) if not needed
- [ ] Ensure all prop types are specific (avoid `any`, `object`)

## Related

- Rule: @rules/typescript-essentials.md (TypeScript + React typing)
- Rule: @rules/hooks-rules.md (if using hooks in component)
- Decision: @decision-trees/state-management.md (if adding state)

## Example: UserCard Component

```typescript
import React from 'react';

/**
 * Props for UserCard component
 */
interface UserCardProps {
  /**
   * User's full name
   */
  name: string;

  /**
   * User's email address
   */
  email: string;

  /**
   * Optional avatar URL
   */
  avatarUrl?: string;

  /**
   * Callback when user card is clicked
   */
  onClick?: (email: string) => void;
}

/**
 * UserCard - Displays user information in a card format
 *
 * Renders user name, email, and optional avatar image.
 * Supports click interaction for selection or navigation.
 */
export function UserCard({
  name,
  email,
  avatarUrl,
  onClick,
}: UserCardProps) {
  return (
    <div
      className="user-card"
      onClick={() => onClick?.(email)}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {avatarUrl && (
        <img
          src={avatarUrl}
          alt={`${name}'s avatar`}
          className="user-card__avatar"
        />
      )}

      <div className="user-card__info">
        <h3 className="user-card__name">{name}</h3>
        <p className="user-card__email">{email}</p>
      </div>
    </div>
  );
}
```

## Notes

### Why Not Use React.FC?

Modern React (18+) discourages `React.FC` or `React.FunctionComponent` because:
- It's more verbose
- It implicitly includes `children` (which may not be desired)
- Regular function syntax is clearer and more flexible

```typescript
// ❌ Avoid (outdated pattern)
const {{ComponentName}}: React.FC<{{ComponentName}}Props> = ({ prop1 }) => {
  return <div>{prop1}</div>;
};

// ✅ Prefer (modern pattern)
export function {{ComponentName}}({ prop1 }: {{ComponentName}}Props) {
  return <div>{prop1}</div>;
}
```

### Prop Destructuring

Always destructure props in the function signature for:
- Readability: Clear what props are used
- TypeScript: Better inference and completion
- Performance: No difference, but cleaner code

### Children Prop

Only include `children?: React.ReactNode` if your component wraps other components:
- Layout components: Yes
- Presentation components: Usually no
- Form components: Sometimes (for custom labels)

### Optional Chaining for Callbacks

Use optional chaining `onClick?.()` when calling optional callback props:
```typescript
onClick?.(email)  // ✅ Safe, won't error if undefined
onClick(email)    // ❌ Error if onClick is undefined
```
