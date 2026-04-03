# Template: Component with useReducer

**When to Use**: Complex state logic with multiple sub-values or when next state depends on previous state in complex ways.

**Complexity**: Medium

**Common Mistakes Agents Make**:
- Not using discriminated unions for actions (missing `type` property)
- Using `any` for action or state types
- Forgetting exhaustive checking in reducer
- Not making reducer pure (side effects inside reducer)
- Mutating state instead of returning new state
- Dispatching actions without proper type

## Template

```typescript
import React, { useReducer } from 'react';

/**
 * State shape for {{ComponentName}}
 */
interface {{State}}Type {
  {{property1}}: {{Type1}};
  {{property2}}: {{Type2}};
  {{property3}}: {{Type3}};
}

/**
 * Action types using discriminated union
 * Each action has a `type` property and optional payload
 */
type {{Action}}Type =
  | { type: '{{ACTION_1}}'; payload: {{Payload1Type}} }
  | { type: '{{ACTION_2}}'; payload: {{Payload2Type}} }
  | { type: '{{ACTION_3}}' } // No payload
  | { type: '{{RESET}}' };

/**
 * Initial state
 */
const initial{{State}}: {{State}}Type = {
  {{property1}}: {{initialValue1}},
  {{property2}}: {{initialValue2}},
  {{property3}}: {{initialValue3}},
};

/**
 * Reducer function - MUST be pure (no side effects)
 * Takes current state and action, returns new state
 */
function {{reducer}}(
  state: {{State}}Type,
  action: {{Action}}Type
): {{State}}Type {
  switch (action.type) {
    case '{{ACTION_1}}':
      return {
        ...state,
        {{property1}}: action.payload,
      };

    case '{{ACTION_2}}':
      return {
        ...state,
        {{property2}}: action.payload,
      };

    case '{{ACTION_3}}':
      return {
        ...state,
        {{property3}}: {{computedValue}},
      };

    case '{{RESET}}':
      return initial{{State}};

    default:
      // Exhaustive check - TypeScript will error if we miss an action
      const exhaustiveCheck: never = action;
      return state;
  }
}

interface {{ComponentName}}Props {
  /**
   * Optional initial state override
   */
  initialState?: Partial<{{State}}Type>;
}

/**
 * {{ComponentName}} - {{Description}}
 */
export function {{ComponentName}}({ initialState }: {{ComponentName}}Props = {}) {
  const [state, dispatch] = useReducer(
    {{reducer}},
    { ...initial{{State}}, ...initialState }
  );

  /**
   * Action creators - helper functions to dispatch actions
   */
  const handle{{Action1}} = (value: {{Payload1Type}}) => {
    dispatch({ type: '{{ACTION_1}}', payload: value });
  };

  const handle{{Action2}} = (value: {{Payload2Type}}) => {
    dispatch({ type: '{{ACTION_2}}', payload: value });
  };

  const handle{{Action3}} = () => {
    dispatch({ type: '{{ACTION_3}}' });
  };

  const handleReset = () => {
    dispatch({ type: '{{RESET}}' });
  };

  return (
    <div className="{{component-name}}">
      <div>
        <p>Property 1: {state.{{property1}}}</p>
        <p>Property 2: {state.{{property2}}}</p>
        <p>Property 3: {state.{{property3}}}</p>
      </div>

      <div>
        <button onClick={() => handle{{Action1}}({{newValue}})}>
          Update Property 1
        </button>
        <button onClick={() => handle{{Action2}}({{newValue}})}>
          Update Property 2
        </button>
        <button onClick={handle{{Action3}}}>
          Update Property 3
        </button>
        <button onClick={handleReset}>
          Reset
        </button>
      </div>
    </div>
  );
}
```

## Adaptation Rules

- [ ] Replace `{{ComponentName}}`, `{{State}}Type`, `{{Action}}Type` with actual names
- [ ] Define state shape with specific properties
- [ ] Create discriminated union for all action types
- [ ] Use UPPER_SNAKE_CASE for action type strings
- [ ] Make reducer pure (no side effects, no mutations)
- [ ] Include exhaustive check in default case
- [ ] Create action creator functions for better ergonomics
- [ ] Use immutable updates (spread operator)
- [ ] Add more action types as needed

## Related

- Rule: @rules/hooks-rules.md (useReducer best practices)
- Rule: @rules/immutable-updates.md (immutable state updates)
- Decision: @decision-trees/state-management.md (useState vs useReducer)
- Template: @templates/component-with-state.tsx (simpler state management)

## Example: FormReducer Component

```typescript
import React, { useReducer } from 'react';

/**
 * Form state shape
 */
interface FormState {
  username: string;
  email: string;
  password: string;
  isSubmitting: boolean;
  error: string | null;
  isValid: boolean;
}

/**
 * Form actions using discriminated union
 */
type FormAction =
  | { type: 'UPDATE_USERNAME'; payload: string }
  | { type: 'UPDATE_EMAIL'; payload: string }
  | { type: 'UPDATE_PASSWORD'; payload: string }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_SUCCESS' }
  | { type: 'SUBMIT_ERROR'; payload: string }
  | { type: 'RESET' };

/**
 * Initial form state
 */
const initialFormState: FormState = {
  username: '',
  email: '',
  password: '',
  isSubmitting: false,
  error: null,
  isValid: false,
};

/**
 * Validate form state
 */
function isFormValid(state: FormState): boolean {
  return (
    state.username.length >= 3 &&
    state.email.includes('@') &&
    state.password.length >= 8
  );
}

/**
 * Form reducer - handles all form state updates
 */
function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'UPDATE_USERNAME': {
      const newState = {
        ...state,
        username: action.payload,
        error: null,
      };
      return {
        ...newState,
        isValid: isFormValid(newState),
      };
    }

    case 'UPDATE_EMAIL': {
      const newState = {
        ...state,
        email: action.payload,
        error: null,
      };
      return {
        ...newState,
        isValid: isFormValid(newState),
      };
    }

    case 'UPDATE_PASSWORD': {
      const newState = {
        ...state,
        password: action.payload,
        error: null,
      };
      return {
        ...newState,
        isValid: isFormValid(newState),
      };
    }

    case 'SUBMIT_START':
      return {
        ...state,
        isSubmitting: true,
        error: null,
      };

    case 'SUBMIT_SUCCESS':
      return {
        ...initialFormState,
        isSubmitting: false,
      };

    case 'SUBMIT_ERROR':
      return {
        ...state,
        isSubmitting: false,
        error: action.payload,
      };

    case 'RESET':
      return initialFormState;

    default: {
      // Exhaustive check
      const exhaustiveCheck: never = action;
      return state;
    }
  }
}

interface RegistrationFormProps {
  /**
   * Callback when form is successfully submitted
   */
  onSubmit?: (data: { username: string; email: string; password: string }) => Promise<void>;
}

/**
 * RegistrationForm - Complex form with useReducer
 */
export function RegistrationForm({ onSubmit }: RegistrationFormProps) {
  const [state, dispatch] = useReducer(formReducer, initialFormState);

  /**
   * Action creators
   */
  const updateUsername = (username: string) => {
    dispatch({ type: 'UPDATE_USERNAME', payload: username });
  };

  const updateEmail = (email: string) => {
    dispatch({ type: 'UPDATE_EMAIL', payload: email });
  };

  const updatePassword = (password: string) => {
    dispatch({ type: 'UPDATE_PASSWORD', payload: password });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!state.isValid) {
      return;
    }

    dispatch({ type: 'SUBMIT_START' });

    try {
      await onSubmit?.({
        username: state.username,
        email: state.email,
        password: state.password,
      });

      dispatch({ type: 'SUBMIT_SUCCESS' });
    } catch (error) {
      dispatch({
        type: 'SUBMIT_ERROR',
        payload: error instanceof Error ? error.message : 'Submission failed',
      });
    }
  };

  const handleReset = () => {
    dispatch({ type: 'RESET' });
  };

  return (
    <form className="registration-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="username">Username (min 3 chars)</label>
        <input
          id="username"
          type="text"
          value={state.username}
          onChange={(e) => updateUsername(e.target.value)}
          disabled={state.isSubmitting}
        />
      </div>

      <div className="form-group">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={state.email}
          onChange={(e) => updateEmail(e.target.value)}
          disabled={state.isSubmitting}
        />
      </div>

      <div className="form-group">
        <label htmlFor="password">Password (min 8 chars)</label>
        <input
          id="password"
          type="password"
          value={state.password}
          onChange={(e) => updatePassword(e.target.value)}
          disabled={state.isSubmitting}
        />
      </div>

      {state.error && (
        <div className="form-error">
          {state.error}
        </div>
      )}

      <div className="form-actions">
        <button
          type="submit"
          disabled={!state.isValid || state.isSubmitting}
        >
          {state.isSubmitting ? 'Submitting...' : 'Submit'}
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={state.isSubmitting}
        >
          Reset
        </button>
      </div>

      <div className="form-status">
        Valid: {state.isValid ? '✅' : '❌'}
      </div>
    </form>
  );
}
```

## Notes

### useState vs useReducer

**Use useState when:**
- Simple, independent state variables
- State updates are straightforward
- No complex update logic

**Use useReducer when:**
- Complex state with multiple sub-values
- Next state depends on previous state in complex ways
- Many different actions update the same state
- You want to test state logic independently

### Discriminated Unions

Always use discriminated unions for actions:

```typescript
// ❌ Wrong (no type discrimination)
type Action = {
  type: string;
  payload?: any;
};

// ✅ Correct (discriminated union)
type Action =
  | { type: 'ADD'; payload: number }
  | { type: 'REMOVE'; payload: string }
  | { type: 'RESET' };
```

### Reducer Purity

Reducers MUST be pure functions:

```typescript
// ❌ Wrong (side effects, mutation)
function reducer(state, action) {
  if (action.type === 'ADD') {
    state.items.push(action.payload); // Mutation!
    localStorage.setItem('items', state.items); // Side effect!
    return state;
  }
}

// ✅ Correct (pure, immutable)
function reducer(state, action) {
  switch (action.type) {
    case 'ADD':
      return {
        ...state,
        items: [...state.items, action.payload],
      };
    default:
      return state;
  }
}
```

### Exhaustive Checking

Use TypeScript to ensure all actions are handled:

```typescript
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ACTION_1':
      return { ...state, /* ... */ };
    case 'ACTION_2':
      return { ...state, /* ... */ };
    default:
      // If we add a new action type and forget to handle it,
      // TypeScript will error here
      const exhaustiveCheck: never = action;
      return state;
  }
}
```
