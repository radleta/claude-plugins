# Template: Custom Hook

**When to Use**: Extracting reusable stateful logic that can be shared across components.

**Complexity**: Medium

**Common Mistakes Agents Make**:
- Not starting hook name with "use" prefix
- Poor return type choices (when to use tuple vs object)
- Not typing parameters and return values properly
- Including component-specific logic (hooks should be generic)
- Forgetting to include hook dependencies in effect arrays
- Not exporting types for hook parameters/returns

## Template

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Parameters for {{hookName}} hook
 */
interface {{HookName}}Params {
  {{param1}}: {{Type1}};
  {{param2}}?: {{Type2}}; // Optional parameter
}

/**
 * Return type for {{hookName}} hook
 * Use object when returning more than 2-3 values for clarity
 */
interface {{HookName}}Return {
  {{value1}}: {{ReturnType1}};
  {{value2}}: {{ReturnType2}};
  {{method1}}: ({{param}}: {{ParamType}}) => void;
  {{method2}}: () => void;
}

/**
 * {{hookName}} - {{Description of what the hook does}}
 *
 * @param params - Hook configuration
 * @returns Object containing state and methods
 *
 * @example
 * ```tsx
 * const { {{value1}}, {{method1}} } = {{hookName}}({ {{param1}}: {{value}} });
 * ```
 */
export function {{hookName}}({
  {{param1}},
  {{param2}},
}: {{HookName}}Params): {{HookName}}Return {
  // Internal state
  const [{{state1}}, set{{State1}}] = useState<{{StateType1}}>({{initialValue}});
  const [{{state2}}, set{{State2}}] = useState<{{StateType2}}>({{initialValue2}});

  // Refs for values that shouldn't trigger re-renders
  const {{refName}} = useRef<{{RefType}}>({{initialRefValue}});

  /**
   * Internal effect - runs when dependencies change
   */
  useEffect(() => {
    // Effect logic here

    return () => {
      // Cleanup logic here
    };
  }, [{{param1}}, {{param2}}]);

  /**
   * Method 1 - Memoized with useCallback to prevent unnecessary re-renders
   */
  const {{method1}} = useCallback(({{methodParam}}: {{MethodParamType}}) => {
    set{{State1}}({{methodParam}});
    // Additional logic
  }, [{{dependencies}}]);

  /**
   * Method 2 - Another action the hook provides
   */
  const {{method2}} = useCallback(() => {
    set{{State2}}({{newValue}});
    // Additional logic
  }, [{{dependencies}}]);

  // Return object with state and methods
  return {
    {{value1}}: {{state1}},
    {{value2}}: {{state2}},
    {{method1}},
    {{method2}},
  };
}

/**
 * Alternative: Tuple return (use when returning 2-3 simple values)
 */
export function {{simpleHookName}}(
  {{param}}: {{ParamType}}
): [{{ReturnType1}}, {{ReturnType2}}] {
  const [{{state}}, set{{State}}] = useState<{{StateType}}>({{initial}});

  // Hook logic

  return [{{state}}, set{{State}}];
}
```

## Adaptation Rules

- [ ] Replace `{{hookName}}` with actual hook name (MUST start with "use")
- [ ] Define clear parameter and return types
- [ ] Choose object return (>3 values) vs tuple return (2-3 values)
- [ ] Use useCallback for returned functions to prevent unnecessary re-renders
- [ ] Include all external dependencies in effect/callback dependency arrays
- [ ] Export types for parameters and return values
- [ ] Add JSDoc comments with usage examples
- [ ] Make hook generic and reusable (avoid component-specific logic)

## Related

- Rule: @rules/hooks-rules.md (custom hooks best practices)
- Rule: @rules/typescript-essentials.md (TypeScript typing for hooks)
- Decision: @decision-trees/state-management.md (when to extract custom hooks)

## Example 1: useLocalStorage Hook

```typescript
import { useState, useEffect, useCallback } from 'react';

/**
 * useLocalStorage - Syncs state with localStorage
 *
 * @param key - localStorage key
 * @param initialValue - Initial value if key doesn't exist
 * @returns Tuple of [value, setValue] similar to useState
 *
 * @example
 * ```tsx
 * const [name, setName] = useLocalStorage('username', 'Guest');
 * ```
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  // Get initial value from localStorage or use provided initial value
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return initialValue;
    }
  });

  /**
   * Update both state and localStorage
   */
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        // Allow value to be a function (like useState)
        const valueToStore = value instanceof Function ? value(storedValue) : value;

        setStoredValue(valueToStore);
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      } catch (error) {
        console.error('Error writing to localStorage:', error);
      }
    },
    [key, storedValue]
  );

  return [storedValue, setValue];
}
```

## Example 2: useFetch Hook (Complex)

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Parameters for useFetch hook
 */
interface UseFetchParams<T> {
  /**
   * URL to fetch
   */
  url: string;

  /**
   * Fetch options
   */
  options?: RequestInit;

  /**
   * Whether to fetch immediately on mount
   */
  immediate?: boolean;

  /**
   * Transform function for response data
   */
  transform?: (data: any) => T;
}

/**
 * Return type for useFetch hook
 */
interface UseFetchReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * useFetch - Generic data fetching hook with loading/error states
 *
 * @param params - Fetch configuration
 * @returns Object with data, loading, error, and refetch method
 *
 * @example
 * ```tsx
 * const { data, loading, error, refetch } = useFetch<User>({
 *   url: '/api/user',
 *   immediate: true,
 * });
 * ```
 */
export function useFetch<T = any>({
  url,
  options,
  immediate = true,
  transform,
}: UseFetchParams<T>): UseFetchReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef<boolean>(true);

  /**
   * Fetch data from URL
   */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const jsonData = await response.json();
      const transformedData = transform ? transform(jsonData) : jsonData;

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setData(transformedData);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [url, options, transform]);

  /**
   * Fetch immediately on mount if immediate is true
   */
  useEffect(() => {
    if (immediate) {
      fetchData();
    }

    // Cleanup: Mark component as unmounted
    return () => {
      isMountedRef.current = false;
    };
  }, [immediate, fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
}
```

## Example 3: useDebounce Hook (Simple)

```typescript
import { useState, useEffect } from 'react';

/**
 * useDebounce - Debounces a value by delaying updates
 *
 * @param value - Value to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced value
 *
 * @example
 * ```tsx
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearch = useDebounce(searchTerm, 500);
 *
 * // Use debouncedSearch for API calls
 * useEffect(() => {
 *   if (debouncedSearch) {
 *     fetchResults(debouncedSearch);
 *   }
 * }, [debouncedSearch]);
 * ```
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up timeout to update debounced value
    const timeoutId = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup: Clear timeout if value or delay changes
    return () => {
      clearTimeout(timeoutId);
    };
  }, [value, delay]);

  return debouncedValue;
}
```

## Notes

### Naming Convention

Custom hooks MUST start with "use":

```typescript
// ❌ Wrong
function fetchData() { ... }
function getUser() { ... }

// ✅ Correct
function useFetchData() { ... }
function useUser() { ... }
```

### Return Type: Tuple vs Object

**Use tuple when:**
- Returning 2 simple values (like useState)
- Values will be renamed by consumer
- Similar to existing hooks (useState, useReducer)

```typescript
// Tuple - consumer can rename
const [user, setUser] = useUser();
const [data, setData] = useUser(); // Different names
```

**Use object when:**
- Returning >2 values
- Want to enforce consistent naming
- Returning mix of values and methods

```typescript
// Object - consistent naming
const { data, loading, error, refetch } = useFetch();
```

### useCallback for Returned Functions

Wrap returned functions in useCallback to prevent unnecessary re-renders:

```typescript
// ❌ New function on every render
export function useCounter() {
  const [count, setCount] = useState(0);

  const increment = () => setCount(c => c + 1); // New function every render

  return { count, increment };
}

// ✅ Memoized function
export function useCounter() {
  const [count, setCount] = useState(0);

  const increment = useCallback(() => {
    setCount(c => c + 1);
  }, []); // Stable function reference

  return { count, increment };
}
```

### Generic Hooks

Use TypeScript generics for flexible, reusable hooks:

```typescript
// Generic hook works with any type
export function useArray<T>(initialValue: T[] = []) {
  const [array, setArray] = useState<T[]>(initialValue);

  const add = useCallback((item: T) => {
    setArray(prev => [...prev, item]);
  }, []);

  const remove = useCallback((index: number) => {
    setArray(prev => prev.filter((_, i) => i !== index));
  }, []);

  return { array, add, remove };
}

// Usage
const { array, add } = useArray<User>([]);
add({ id: '1', name: 'John' }); // Type-safe
```
