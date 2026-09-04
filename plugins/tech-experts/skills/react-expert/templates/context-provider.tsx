# Template: Context Provider

**When to Use**: Sharing state across component tree without prop drilling.

**Complexity**: Medium

**Common Mistakes Agents Make**:
- Not typing context value properly (using `any`)
- Creating context without default value or proper null handling
- Not creating custom useContext hook for type safety
- Using context for frequently changing values (performance issue)
- Not memoizing context value (causes unnecessary re-renders)
- Forgetting to handle case where context is used outside provider

## Template

```typescript
import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';

/**
 * Context value shape
 */
interface {{Context}}Value {
  // State values
  {{stateProperty1}}: {{StateType1}};
  {{stateProperty2}}: {{StateType2}};

  // Actions/methods
  {{actionMethod1}}: ({{param}}: {{ParamType}}) => void;
  {{actionMethod2}}: () => void;
}

/**
 * Create context with undefined default (will check in hook)
 */
const {{Context}}Context = createContext<{{Context}}Value | undefined>(undefined);

/**
 * Props for {{Context}}Provider
 */
interface {{Context}}ProviderProps {
  /**
   * Child components
   */
  children: ReactNode;

  /**
   * Optional initial values
   */
  initialValues?: {
    {{stateProperty1}}?: {{StateType1}};
    {{stateProperty2}}?: {{StateType2}};
  };
}

/**
 * {{Context}}Provider - Provides {{context}} state to component tree
 */
export function {{Context}}Provider({
  children,
  initialValues = {},
}: {{Context}}ProviderProps) {
  // Internal state
  const [{{stateProperty1}}, set{{StateProperty1}}] = useState<{{StateType1}}>(
    initialValues.{{stateProperty1}} ?? {{defaultValue1}}
  );

  const [{{stateProperty2}}, set{{StateProperty2}}] = useState<{{StateType2}}>(
    initialValues.{{stateProperty2}} ?? {{defaultValue2}}
  );

  /**
   * Action method 1 - Memoized with useCallback
   */
  const {{actionMethod1}} = useCallback(({{param}}: {{ParamType}}) => {
    set{{StateProperty1}}({{param}});
    // Additional logic
  }, []);

  /**
   * Action method 2
   */
  const {{actionMethod2}} = useCallback(() => {
    set{{StateProperty2}}({{newValue}});
    // Additional logic
  }, []);

  /**
   * Memoize context value to prevent unnecessary re-renders
   * Only recompute when dependencies change
   */
  const value = useMemo<{{Context}}Value>(
    () => ({
      {{stateProperty1}},
      {{stateProperty2}},
      {{actionMethod1}},
      {{actionMethod2}},
    }),
    [{{stateProperty1}}, {{stateProperty2}}, {{actionMethod1}}, {{actionMethod2}}]
  );

  return (
    <{{Context}}Context.Provider value={value}>
      {children}
    </{{Context}}Context.Provider>
  );
}

/**
 * Custom hook to use {{Context}} context
 * Provides type safety and ensures context is used within provider
 *
 * @throws {Error} If used outside {{Context}}Provider
 */
export function use{{Context}}(): {{Context}}Value {
  const context = useContext({{Context}}Context);

  if (context === undefined) {
    throw new Error('use{{Context}} must be used within a {{Context}}Provider');
  }

  return context;
}

/**
 * Optional: Selector hook for performance
 * Only re-renders when selected value changes
 */
export function use{{Context}}Selector<T>(
  selector: (value: {{Context}}Value) => T
): T {
  const context = use{{Context}}();
  return selector(context);
}
```

## Adaptation Rules

- [ ] Replace `{{Context}}` with context name (e.g., Auth, Theme, User)
- [ ] Define `{{Context}}Value` interface with all state and methods
- [ ] Create context with `undefined` default
- [ ] Memoize context value with `useMemo`
- [ ] Memoize action methods with `useCallback`
- [ ] Create custom `use{{Context}}` hook with error handling
- [ ] Export both Provider and custom hook
- [ ] Include all state dependencies in useMemo array

## Related

- Rule: @rules/hooks-rules.md (useContext best practices)
- Rule: @rules/dependency-arrays.md (useMemo for context value)
- Decision: @decision-trees/state-management.md (when to use Context vs library)

## Example: AuthProvider

```typescript
import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';

/**
 * User type
 */
interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

/**
 * Auth context value
 */
interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
}

/**
 * Create auth context
 */
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Props for AuthProvider
 */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider - Manages authentication state
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  /**
   * Derived state - computed from user
   */
  const isAuthenticated = user !== null;

  /**
   * Login method
   */
  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);

    try {
      // API call to login
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const userData: User = await response.json();
      setUser(userData);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Logout method
   */
  const logout = useCallback(() => {
    setUser(null);
    // Clear tokens, redirect, etc.
  }, []);

  /**
   * Update user method
   */
  const updateUser = useCallback((updates: Partial<User>) => {
    setUser(prevUser => {
      if (!prevUser) return null;
      return { ...prevUser, ...updates };
    });
  }, []);

  /**
   * Memoize context value
   */
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated,
      isLoading,
      login,
      logout,
      updateUser,
    }),
    [user, isAuthenticated, isLoading, login, logout, updateUser]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Custom hook to use auth context
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

/**
 * Selector hook for performance optimization
 * Only re-renders when user changes, not when isLoading changes
 */
export function useAuthUser(): User | null {
  const { user } = useAuth();
  return user;
}

/**
 * Another selector for isAuthenticated only
 */
export function useIsAuthenticated(): boolean {
  const { isAuthenticated } = useAuth();
  return isAuthenticated;
}
```

## Usage Example

```typescript
// App.tsx - Wrap app with provider
import { AuthProvider } from './contexts/AuthContext';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes />
      </Router>
    </AuthProvider>
  );
}

// LoginPage.tsx - Use auth context
import { useAuth } from './contexts/AuthContext';

function LoginPage() {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      // Redirect after successful login
    } catch (error) {
      // Handle error
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
}

// UserProfile.tsx - Use selector for performance
import { useAuthUser } from './contexts/AuthContext';

function UserProfile() {
  // Only re-renders when user changes, not when isLoading changes
  const user = useAuthUser();

  if (!user) {
    return <div>Not logged in</div>;
  }

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}
```

## Notes

### Context vs Other State Management

**Use Context when:**
- Data doesn't change frequently
- Sharing data across many components
- Avoiding prop drilling
- Examples: theme, auth, locale

**Don't use Context when:**
- Data changes very frequently (performance issue)
- Need time-travel debugging
- Complex state updates
- Consider: Redux, Zustand, Jotai instead

### Performance Optimization

Always memoize context value:

```typescript
// ❌ Creates new object on every render
return (
  <Context.Provider value={{ state, setState }}>
    {children}
  </Context.Provider>
);

// ✅ Memoized value
const value = useMemo(
  () => ({ state, setState }),
  [state, setState]
);

return (
  <Context.Provider value={value}>
    {children}
  </Context.Provider>
);
```

### Custom Hook is Essential

Always create custom hook for type safety:

```typescript
// ❌ No type safety, no error handling
export const MyContext = createContext<MyValue | undefined>(undefined);

// Component
const context = useContext(MyContext); // Could be undefined!

// ✅ Type-safe custom hook
export function useMyContext(): MyValue {
  const context = useContext(MyContext);

  if (context === undefined) {
    throw new Error('useMyContext must be used within MyProvider');
  }

  return context; // Guaranteed to be MyValue
}
```

### Multiple Contexts

Split contexts by concern:

```typescript
// ✅ Separate concerns
<AuthProvider>
  <ThemeProvider>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </ThemeProvider>
</AuthProvider>

// ❌ One giant context for everything
<AppProvider> // Contains auth, theme, language, user preferences...
  <App />
</AppProvider>
```
