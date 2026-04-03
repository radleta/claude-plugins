# Existing Patterns Investigation

## Purpose

Discover team's component conventions and code style preferences by examining existing codebase. This ensures generated code matches the project's established patterns rather than imposing external conventions.

## Why This Matters

**Teams have strong preferences**:
- Function declarations vs arrow functions → Consistency and code review expectations
- Props interface naming → Searchability and convention
- Export styles → Import patterns across codebase
- React import patterns → Affects every file

**Mismatched patterns are obvious**:
- New code stands out visually
- Code reviews get style feedback instead of logic review
- Developers must fix formatting manually

**Evidence-based decisions**:
- Don't assume "modern best practices"
- Discover what THIS project actually does
- Follow majority patterns in existing code

## Investigation Protocols

---

### Protocol 1: Component Style Detection

**Objective**: Determine if team uses function declarations or arrow functions for components

**Tool**: Grep → Search component files for patterns

**Search Patterns**:
1. `export function` - Function declaration pattern
2. `export const.*=` - Arrow function pattern
3. `function.*{` - Internal function declarations

**Extract**:
- Count matches for each pattern
- Identify majority pattern (>70% is clear preference)
- Note: Check actual component files, not utility files

**Error Handling**:
- If Grep finds 0 matches for all patterns → Report to user: "No React component files found. Is this directory correct?"
- If Grep fails → Fallback: Use function declarations (React documentation default)
- If only 1-2 components found → Report: "Too few components to establish pattern. Using function declarations as default."

**Decision Tree**:
```
Pattern distribution?
├─ Function Declarations (>70%)
│   ├─ Pattern: export function ComponentName(props: Props) {}
│   ├─ Characteristics:
│   │   ├─ Named function declarations
│   │   ├─ Hoisted (can be used before declaration)
│   │   ├─ Better stack traces in errors
│   │   └─ Traditional React style
│   │
│   └─ Generate:
│       export function UserProfile(props: UserProfileProps) {
│         return <div>...</div>
│       }
│
├─ Arrow Functions (>70%)
│   ├─ Pattern: export const ComponentName = (props: Props) => {}
│   ├─ Characteristics:
│   │   ├─ Const arrow function
│   │   ├─ Not hoisted
│   │   ├─ Consistent with modern JavaScript
│   │   └─ Lexical this binding (rarely matters in React)
│   │
│   └─ Generate:
│       export const UserProfile = (props: UserProfileProps) => {
│         return <div>...</div>
│       }
│
└─ Mixed / No Clear Pattern (<70% either way)
    ├─ Check: Is there a linting rule enforcing style?
    ├─ Fallback: Use function declarations (React documentation default)
    └─ Note: Suggest establishing convention with team
```

**Verification**:
```bash
# Count function declarations in components
grep -r "export function" src/components --include="*.tsx" --include="*.jsx" | wc -l

# Count arrow functions in components
grep -r "export const.*=" src/components --include="*.tsx" --include="*.jsx" | wc -l

# Show examples of each pattern
grep -r "export function" src/components --include="*.tsx" -m 3
grep -r "export const.*=" src/components --include="*.tsx" -m 3
```

**Example Output**:
```
Function declarations: 47 matches
Arrow functions: 12 matches

Ratio: 80% function declarations
Decision: Use function declarations
Pattern: export function ComponentName(props: Props) {}
```

---

### Protocol 2: Props Interface Naming Convention

**Objective**: Discover how team names props interfaces/types

**Tool**: Grep → Search for props interface patterns

**Search Patterns**:
1. `interface.*Props {` - Props suffix pattern
2. `interface I.*Props` - I-prefix pattern (older convention)
3. `type.*Props =` - Type alias pattern
4. Props parameter naming: `(props:` vs `({...}:` destructured

**Extract**:
- Naming convention (ComponentNameProps vs ComponentProps vs IComponentProps)
- interface vs type preference
- Destructuring style in parameters

**Error Handling**:
- If Grep finds 0 Props interfaces → Check if project uses JavaScript or different typing approach
- If too few examples (<5) → Fallback: Use ComponentNameProps pattern (React community standard)
- If mixed patterns with no clear majority → Report findings and ask user for preference

**Decision Tree**:
```
Props naming pattern?
├─ ComponentNameProps (e.g., UserProfileProps)
│   ├─ Most common modern pattern
│   ├─ Clear, searchable naming
│   ├─ Example: interface UserProfileProps { name: string }
│   └─ Generate: interface [ComponentName]Props { ... }
│
├─ ComponentProps (e.g., ProfileProps)
│   ├─ Shorter, less redundant
│   ├─ Example: interface ProfileProps { name: string }
│   └─ Generate: interface [ShortName]Props { ... }
│
├─ IComponentProps (I-prefix)
│   ├─ Older TypeScript convention
│   ├─ Example: interface IUserProfileProps { name: string }
│   ├─ Note: Less common in modern React
│   └─ Generate: interface I[ComponentName]Props { ... }
│
└─ Props (generic)
    ├─ Only for very small, local components
    ├─ Example: interface Props { value: string }
    └─ Note: Not searchable, avoid for exported components

Parameter style?
├─ Named props parameter
│   ├─ Pattern: function Component(props: Props) {}
│   ├─ Access: props.name, props.value
│   └─ Common when props are passed down
│
└─ Destructured parameters
    ├─ Pattern: function Component({ name, value }: Props) {}
    ├─ Access: name, value directly
    └─ Common for components with few props

Type vs Interface?
├─ interface Props (majority?)
│   ├─ Use interface for props
│   ├─ Better for object types
│   └─ Can be extended/merged
│
└─ type Props = (majority?)
    ├─ Use type for props
    ├─ More flexible (unions, intersections)
    └─ Team preference
```

**Verification**:
```bash
# Find props interface patterns
grep -r "interface.*Props" src --include="*.tsx" --include="*.ts" | head -20

# Check for I-prefix pattern
grep -r "interface I.*Props" src --include="*.tsx" --include="*.ts" | wc -l

# Check type vs interface preference
grep -r "^type.*Props = {" src --include="*.tsx" --include="*.ts" | wc -l
grep -r "^interface.*Props {" src --include="*.tsx" --include="*.ts" | wc -l

# Check parameter destructuring
grep -r "function.*({.*}:.*Props)" src --include="*.tsx" | wc -l
```

**Example Output**:
```
Patterns found:
  interface UserProfileProps: 15 matches
  interface ProfileProps: 3 matches
  interface IUserProfileProps: 0 matches

interface vs type:
  interface: 42 matches
  type: 8 matches

Decision: Use interface [ComponentName]Props pattern
Example: interface UserProfileProps { name: string; email: string; }
```

---

### Protocol 3: Export Style Convention

**Objective**: Determine if team uses named exports or default exports

**Tool**: Grep → Search for export patterns

**Search Patterns**:
1. `export default` - Default export pattern
2. `export function` or `export const` - Named export pattern
3. `export { ComponentName }` - Named export (separate)

**Extract**:
- Ratio of default vs named exports
- Component export style
- Index file pattern (if used)

**Error Handling**:
- If Grep finds no exports → Report to user: "No component exports found. Is this the correct source directory?"
- If too few exports (<5) to establish pattern → Fallback: Use named exports (React community standard)
- If equal mix (45-55% split) → Report findings to user and recommend named exports as industry best practice

**Decision Tree**:
```
Export style?
├─ Named Exports (>70%)
│   ├─ Pattern: export function ComponentName() {} or export const ComponentName = ...
│   ├─ Benefits:
│   │   ├─ Better tree shaking
│   │   ├─ Named imports prevent typos
│   │   ├─ Easier refactoring (named stays consistent)
│   │   └─ Better IDE autocomplete
│   │
│   ├─ Import: import { UserProfile } from './UserProfile'
│   │
│   └─ Generate:
│       export function UserProfile(props: UserProfileProps) {
│         return <div>...</div>
│       }
│
├─ Default Exports (>70%)
│   ├─ Pattern: export default ComponentName or export default function ComponentName()
│   ├─ Benefits:
│   │   ├─ Simpler import syntax
│   │   ├─ Allows renaming on import
│   │   └─ Common in older React projects
│   │
│   ├─ Import: import UserProfile from './UserProfile'
│   │
│   └─ Generate:
│       function UserProfile(props: UserProfileProps) {
│         return <div>...</div>
│       }
│       export default UserProfile
│
└─ Mixed / No Pattern
    ├─ Check: Next.js pages? (require default exports)
    ├─ Check: Component library? (usually named exports)
    ├─ Fallback: Use named exports (modern best practice)
    └─ Note: Consistency improves codebase maintainability

Index file pattern?
├─ Re-exporting from index files
│   ├─ Pattern: export { ComponentName } from './ComponentName'
│   ├─ Usage: import { Button, Input } from '@components'
│   └─ Generate: Add export to index.ts if pattern exists
│
└─ Direct imports
    ├─ Pattern: No index re-exports
    ├─ Usage: import Button from '@components/Button'
    └─ Generate: Standalone component file
```

**Verification**:
```bash
# Count default exports
grep -r "export default" src/components --include="*.tsx" --include="*.jsx" | wc -l

# Count named exports (inline)
grep -r "^export \(function\|const\)" src/components --include="*.tsx" --include="*.jsx" | wc -l

# Check for index.ts re-export pattern
find src/components -name "index.ts" -o -name "index.tsx" | head -5
cat src/components/index.ts 2>/dev/null | head -10
```

**Example Output**:
```
Default exports: 8 matches
Named exports: 52 matches

Ratio: 87% named exports
Decision: Use named exports
Pattern: export function ComponentName() {}

Index files: Found (re-exporting pattern)
Note: Add export to components/index.ts
```

---

### Protocol 4: React Import Style

**Objective**: Determine how React is imported (namespace vs named imports)

**Tool**: Grep → Search for React import patterns

**Search Patterns**:
1. `import React from 'react'` - Namespace import
2. `import { useState, useEffect } from 'react'` - Named imports
3. No React import (new JSX transform)

**Extract**:
- Import style preference
- Whether React object is referenced (React.useState vs useState)
- JSX transform configuration (from project-setup.md)

**Decision Tree**:
```
React import pattern?
├─ Named Imports (import { useState } from 'react')
│   ├─ Modern pattern (React 17+)
│   ├─ Smaller bundle (tree shaking)
│   ├─ Cleaner code (no React. prefix)
│   ├─ JSX transform: New (no React import needed for JSX)
│   │
│   └─ Generate:
│       import { useState, useEffect } from 'react'
│
│       export function Component() {
│         const [state, setState] = useState(0)
│         return <div>...</div>
│       }
│
├─ Namespace Import (import React from 'react')
│   ├─ Traditional pattern
│   ├─ Hooks accessed as React.useState
│   ├─ JSX transform: Old (React must be in scope)
│   │
│   └─ Generate:
│       import React from 'react'
│
│       export function Component() {
│         const [state, setState] = React.useState(0)
│         return <div>...</div>
│       }
│
├─ No React Import (JSX only files)
│   ├─ React 17+ new JSX transform
│   ├─ React not needed for JSX
│   ├─ Import hooks directly when used
│   │
│   └─ Generate:
│       import { useState } from 'react'  // Only when hooks used
│
│       export function Component() {
│         return <div>...</div>  // No React import needed
│       }
│
└─ Mixed Pattern
    ├─ Check: tsconfig.json jsx setting
    │   ├─ "jsx": "react-jsx" → New transform, no React import
    │   └─ "jsx": "react" → Old transform, React import required
    │
    └─ Follow project's JSX transform configuration
```

**Verification**:
```bash
# Count namespace imports
grep -r "import React from 'react'" src --include="*.tsx" --include="*.jsx" | wc -l

# Count named imports
grep -r "import {.*} from 'react'" src --include="*.tsx" --include="*.jsx" | wc -l

# Check for React. prefix usage
grep -r "React\.\(useState\|useEffect\|useCallback\)" src --include="*.tsx" --include="*.jsx" | wc -l

# Check JSX transform setting
cat tsconfig.json | grep '"jsx"'
```

**Example Output**:
```
Namespace imports: 5 matches
Named imports: 48 matches
React. prefix usage: 3 matches

tsconfig.json: "jsx": "react-jsx" (new transform)

Decision: Use named imports
Pattern: import { useState, useEffect } from 'react'
Note: React import not required for JSX
```

---

## Investigation Checklist

After completing existing patterns investigation, verify:

- [ ] Component style identified (function declaration vs arrow function)
- [ ] Props interface naming convention discovered
- [ ] interface vs type preference noted
- [ ] Export style determined (named vs default)
- [ ] React import pattern identified
- [ ] Parameter style preference noted (named props vs destructured)
- [ ] Index file re-export pattern checked
- [ ] Evidence collected (match counts) for each decision

## Pattern Application Priority

When patterns conflict or are unclear:

1. **Linting rules** (highest priority) - Enforced automatically
2. **Majority pattern** (>70% usage) - Clear team preference
3. **TypeScript config** - Framework-level decision
4. **Modern best practices** - When no clear pattern exists
5. **React documentation defaults** - Fallback for ambiguity

## Common Pattern Combinations

### Modern TypeScript React
```typescript
// Named imports, named exports, function declarations
import { useState } from 'react'

interface UserProfileProps {
  name: string
  email: string
}

export function UserProfile({ name, email }: UserProfileProps) {
  const [isActive, setIsActive] = useState(false)
  return <div>...</div>
}
```

### Traditional React with TypeScript
```typescript
// Namespace import, default export, arrow function
import React from 'react'

interface IUserProfileProps {
  name: string
  email: string
}

const UserProfile: React.FC<IUserProfileProps> = (props) => {
  const [isActive, setIsActive] = React.useState(false)
  return <div>...</div>
}

export default UserProfile
```

### JavaScript with Modern Patterns
```javascript
// Named imports, named exports, function declarations
import { useState } from 'react'

export function UserProfile({ name, email }) {
  const [isActive, setIsActive] = useState(false)
  return <div>...</div>
}
```

## Integration with Other Protocols

**After existing patterns investigation**:
1. Apply discovered patterns to code generation
2. Continue to `state-management-detection.md` if state management needed
3. Verify with `linting-rules.md` that patterns comply with rules

**Existing patterns inform**:
- Component file structure and syntax
- Import statements style
- Props interface definitions
- Export patterns for consistency

This pattern investigation ensures generated components visually and structurally match the existing codebase.
