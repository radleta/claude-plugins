# React + TypeScript Templates

This folder contains **working code templates** for common React + TypeScript patterns that agents frequently generate incorrectly. Each template is production-ready code with placeholder variables for adaptation.

## Purpose

These templates solve the **TypeScript + React integration problem** where agents:
- Use `any` types instead of proper typing
- Mistype event handlers (`event: any` instead of `React.ChangeEvent<HTMLInputElement>`)
- Create conditional effects (wrong) instead of conditional logic inside effects (correct)
- Use array index as key prop (anti-pattern)
- Forget cleanup functions in useEffect
- Improperly type custom hooks, reducers, and context

## How to Use Templates

### Step 1: Select Template
Choose the template that matches your implementation need (see index below).

### Step 2: Copy Complete Code
Copy the entire template code block - it's already working code.

### Step 3: Replace Placeholders
All placeholders use `{{DoubleBracesFormat}}` with specific naming conventions:

**Naming Convention by Type**:
- **Components**: `{{ComponentName}}` → PascalCase (e.g., UserProfile, TodoList)
- **Props/Variables**: `{{propName}}`, `{{itemName}}` → camelCase (e.g., userName, todoItem)
- **Types/Interfaces**: `{{PropType}}`, `{{DataType}}` → PascalCase (e.g., UserProfileProps, TodoItem)
- **Hooks**: `{{hookName}}` → camelCase with 'use' prefix (e.g., useLocalStorage, useFetch)
- **CSS Classes**: `{{class-name}}` → kebab-case (e.g., user-profile, todo-item)
- **Constants**: `{{CONSTANT_NAME}}` → UPPER_SNAKE_CASE (e.g., MAX_RETRIES, API_URL)

**Common Placeholders**:
- `{{ComponentName}}` → Your component name (PascalCase)
- `{{PropType}}` → Your props type name (PascalCase)
- `{{hookName}}` → Your custom hook name (camelCase with 'use')
- `{{dataType}}` → Your data structure type (PascalCase)
- `{{propName}}` → Property/variable name (camelCase)
- `{{className}}` → CSS class name (camelCase for JS, kebab-case for CSS)

### Step 4: Match Project Conventions
After placeholder replacement:
- Match project's export style (named vs default)
- Match project's naming convention (PascalCase, camelCase)
- Match project's file organization
- Add additional props/logic as needed

### Step 5: Verify TypeScript
Ensure all types are present and no `any` remains.

## Template Format

Each template file includes:
- **When to Use**: Scenario for this pattern
- **Complexity**: Low/Medium/High
- **Common Mistakes**: What agents do wrong
- **Template**: Complete working code
- **Adaptation Rules**: Checklist for customization
- **Related**: Links to rules and decisions
- **Example**: Concrete implementation

## Template Index

### Basic Components

#### 1. function-component.tsx
**Use Case**: Basic functional component with typed props
**Complexity**: Low
**Key Features**: Interface definition, proper exports, no state

#### 2. component-with-state.tsx
**Use Case**: Component with local state using useState
**Complexity**: Low
**Key Features**: Multiple state variables, immutable updates, proper typing

#### 3. component-with-effect.tsx
**Use Case**: Component with side effects (data fetching, subscriptions)
**Complexity**: Medium
**Key Features**: Cleanup functions, dependencies, multiple effects

### Advanced State Management

#### 4. component-with-reducer.tsx
**Use Case**: Complex state logic with useReducer
**Complexity**: Medium
**Key Features**: Discriminated unions for actions, exhaustive checking, typed dispatch

#### 5. custom-hook.tsx
**Use Case**: Extracting reusable stateful logic
**Complexity**: Medium
**Key Features**: Proper parameter/return typing, internal state, clear naming

#### 6. context-provider.tsx
**Use Case**: Sharing state across component tree
**Complexity**: Medium
**Key Features**: Typed context, custom hook, provider pattern

### Forms & User Input

#### 7. form-controlled.tsx
**Use Case**: Controlled form inputs with validation
**Complexity**: Medium
**Key Features**: Properly typed event handlers, form submission, validation

#### 8. event-handlers.tsx
**Use Case**: All common event types reference
**Complexity**: Low
**Key Features**: onClick, onChange, onSubmit, onKeyDown with proper types

### Lists & Rendering

#### 9. list-rendering.tsx
**Use Case**: Rendering arrays of data
**Complexity**: Low
**Key Features**: Proper key prop (NOT index), array typing, empty states

#### 10. conditional-effects.tsx
**Use Case**: Effects with conditional logic
**Complexity**: Medium
**Key Features**: Conditions INSIDE effect, not conditional effect calls

#### 11. derived-state.tsx
**Use Case**: Computing values from state
**Complexity**: Low
**Key Features**: Render-time calculation, useMemo for expensive derivations

### Performance Optimization

#### 12. memo-component.tsx
**Use Case**: Preventing unnecessary re-renders
**Complexity**: Medium
**Key Features**: React.memo, custom comparison, when to use

#### 13. data-fetching-effect.tsx
**Use Case**: Fetching data in useEffect
**Complexity**: High
**Key Features**: Loading/error/success states, AbortController, proper cleanup

### Error Handling & Code Splitting

#### 14. error-boundary.tsx
**Use Case**: Catching React errors in component tree
**Complexity**: Medium
**Key Features**: Class component, componentDidCatch, fallback UI

#### 15. suspense-lazy.tsx
**Use Case**: Code splitting with React.lazy
**Complexity**: Medium
**Key Features**: Dynamic imports, Suspense boundary, loading states

### Advanced TypeScript Patterns

#### 16. generic-component.tsx
**Use Case**: Components that work with multiple types
**Complexity**: High
**Key Features**: Type parameters, constraints, proper inference

#### 17. forward-ref.tsx
**Use Case**: Exposing ref to parent components
**Complexity**: Medium
**Key Features**: forwardRef typing, useImperativeHandle

## Common Placeholder Patterns

```typescript
// Component names (PascalCase)
{{ComponentName}}  // e.g., UserProfile, DataTable, LoginForm

// Type/Interface names (PascalCase)
{{PropType}}       // e.g., UserProfileProps, DataItem
{{StateType}}      // e.g., FormState, UserData
{{ActionType}}     // e.g., CounterAction, FormAction

// Hook names (camelCase with 'use' prefix)
{{hookName}}       // e.g., useAuth, useFetch, useLocalStorage

// Variable names (camelCase)
{{variableName}}   // e.g., userId, fetchData, handleSubmit
{{dataType}}       // e.g., User, Product, ApiResponse

// Generic type parameters (single capital letter)
{{T}}              // Generic type parameter
```

## Quality Standards

Every template in this folder:
- ✅ Is complete, working TypeScript + React code
- ✅ Includes all necessary imports
- ✅ Uses proper TypeScript types (no `any`)
- ✅ Follows React best practices
- ✅ Includes explanatory comments
- ✅ Has clear placeholder names
- ✅ Links to related rules

## Integration with React-Expert Skill

These templates are referenced by:
- **@rules/**: Rule files link to templates as examples
- **@decision-trees/**: Decision trees recommend templates
- **DETECTION.md**: Maps user requests to appropriate templates

When a rule or workflow says "use template X", come to this folder and follow the usage instructions above.

## Testing Templates

Before using a template in production:
1. Replace all `{{placeholders}}`
2. Ensure no TypeScript errors
3. Match project conventions
4. Add tests for component logic
5. Review accessibility requirements

## Template Maintenance

When updating templates:
- Keep placeholder format consistent
- Update related rule/decision links
- Maintain working code status
- Update this README index if adding/removing templates
