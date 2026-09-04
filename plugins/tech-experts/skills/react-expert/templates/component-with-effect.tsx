# Template: Component with Effects

**When to Use**: Component needs side effects (data fetching, subscriptions, timers, DOM manipulation).

**Complexity**: Medium

**Common Mistakes Agents Make**:
- Forgetting cleanup function for subscriptions, timers, or event listeners
- Wrong or missing dependencies in dependency array
- Running effects on every render (missing dependency array)
- Putting too much logic in one effect (should split by concern)
- Not handling async operations properly in effects
- Conditional effect calls (should be conditional logic INSIDE effect)

## Template

```typescript
import React, { useState, useEffect } from 'react';

interface {{ComponentName}}Props {
  /**
   * {{Description}}
   */
  {{propName}}: {{PropType}};
}

/**
 * {{ComponentName}} - {{Description}}
 */
export function {{ComponentName}}({ {{propName}} }: {{ComponentName}}Props) {
  const [{{stateVariable}}, set{{StateVariable}}] = useState<{{StateType}} | null>(null);
  const [{{loading}}, set{{Loading}}] = useState<boolean>(false);
  const [{{error}}, set{{Error}}] = useState<Error | null>(null);

  /**
   * Effect 1: Run once on mount (setup)
   * Example: Initialize third-party library, focus input
   */
  useEffect(() => {
    console.log('Component mounted');

    // Initialization logic here

    // Cleanup function (runs on unmount)
    return () => {
      console.log('Component unmounted');
      // Cleanup logic here
    };
  }, []); // Empty array = run once on mount

  /**
   * Effect 2: Run when specific prop changes
   * Example: Fetch data when ID changes
   */
  useEffect(() => {
    console.log('{{propName}} changed to:', {{propName}});

    // Logic that depends on {{propName}}

    // Optional cleanup
    return () => {
      // Cleanup for this effect
    };
  }, [{{propName}}]); // Run when {{propName}} changes

  /**
   * Effect 3: Subscription pattern (WebSocket, event listener, interval)
   * MUST include cleanup to prevent memory leaks
   */
  useEffect(() => {
    // Example: Event listener
    const handleEvent = (event: Event) => {
      console.log('Event occurred:', event);
    };

    window.addEventListener('{{eventName}}', handleEvent);

    // Cleanup: Remove event listener
    return () => {
      window.removeEventListener('{{eventName}}', handleEvent);
    };
  }, []); // Stable subscription

  /**
   * Effect 4: Timer pattern (setTimeout, setInterval)
   * MUST cleanup to prevent memory leaks
   */
  useEffect(() => {
    // Example: Interval
    const intervalId = setInterval(() => {
      console.log('Interval tick');
      // Update state or perform action
    }, {{intervalMs}});

    // Cleanup: Clear interval
    return () => {
      clearInterval(intervalId);
    };
  }, []); // Stable timer

  /**
   * Effect 5: Async data fetching pattern
   * Cannot make effect itself async, use async function inside
   */
  useEffect(() => {
    let isCancelled = false;

    const fetchData = async () => {
      set{{Loading}}(true);
      set{{Error}}(null);

      try {
        const response = await fetch(`/api/{{endpoint}}/${{{propName}}}`);

        if (!response.ok) {
          throw new Error('Failed to fetch');
        }

        const data = await response.json();

        // Only update state if not cancelled
        if (!isCancelled) {
          set{{StateVariable}}(data);
        }
      } catch (err) {
        if (!isCancelled) {
          set{{Error}}(err instanceof Error ? err : new Error('Unknown error'));
        }
      } finally {
        if (!isCancelled) {
          set{{Loading}}(false);
        }
      }
    };

    fetchData();

    // Cleanup: Cancel ongoing request
    return () => {
      isCancelled = true;
    };
  }, [{{propName}}]); // Re-fetch when {{propName}} changes

  /**
   * Effect 6: Multiple dependencies
   * Runs when ANY dependency changes
   */
  useEffect(() => {
    console.log('Multiple deps changed:', {{dep1}}, {{dep2}});

    // Logic using multiple dependencies

    return () => {
      // Cleanup if needed
    };
  }, [{{dep1}}, {{dep2}}]); // Runs when dep1 OR dep2 changes

  /**
   * Effect 7: Conditional logic INSIDE effect (not conditional effect call)
   */
  useEffect(() => {
    // ✅ Correct: Condition inside effect
    if ({{condition}}) {
      console.log('Condition met, running effect logic');
      // Effect logic here
    }

    return () => {
      // Cleanup always defined, even if effect logic didn't run
    };
  }, [{{condition}}]); // Include condition in dependencies

  // ❌ Wrong: Conditional effect call
  // if ({{condition}}) {
  //   useEffect(() => { ... }, []);
  // }

  if ({{loading}}) {
    return <div>Loading...</div>;
  }

  if ({{error}}) {
    return <div>Error: {{{error}}.message}</div>;
  }

  return (
    <div className="{{component-name}}">
      {{{stateVariable}} && (
        <div>Data: {JSON.stringify({{stateVariable}})}</div>
      )}
    </div>
  );
}
```

## Adaptation Rules

- [ ] Replace `{{ComponentName}}`, `{{propName}}` with actual names
- [ ] Keep only the effect patterns you need (remove unused examples)
- [ ] Always include cleanup function for subscriptions, timers, event listeners
- [ ] Use `isCancelled` flag for async operations to prevent state updates after unmount
- [ ] Include all variables used inside effect in dependency array
- [ ] Split effects by concern (don't combine unrelated logic in one effect)
- [ ] Put conditional logic INSIDE effect, not around effect call
- [ ] Never make effect callback itself async (use async function inside instead)

## Related

- Rule: @rules/hooks-rules.md (useEffect best practices)
- Rule: @rules/dependency-arrays.md (dependency array rules and cleanup patterns)
- Decision: @decision-trees/effect-usage.md (when to use useEffect)
- Template: @templates/data-fetching-effect.tsx (specialized data fetching)
- Template: @templates/conditional-effects.tsx (conditional logic in effects)

## Example: UserProfileLoader Component

```typescript
import React, { useState, useEffect } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
}

interface UserProfileLoaderProps {
  /**
   * User ID to load
   */
  userId: string;

  /**
   * Callback when user data is loaded
   */
  onUserLoaded?: (user: User) => void;
}

/**
 * UserProfileLoader - Fetches and displays user profile
 */
export function UserProfileLoader({
  userId,
  onUserLoaded,
}: UserProfileLoaderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  /**
   * Effect 1: Fetch user data when userId changes
   */
  useEffect(() => {
    let isCancelled = false;

    const fetchUser = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/users/${userId}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch user: ${response.statusText}`);
        }

        const userData: User = await response.json();

        if (!isCancelled) {
          setUser(userData);
          setLastUpdate(new Date());
          onUserLoaded?.(userData);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchUser();

    // Cleanup: Prevent state updates if component unmounts during fetch
    return () => {
      isCancelled = true;
    };
  }, [userId, onUserLoaded]); // Re-fetch when userId changes

  /**
   * Effect 2: Auto-refresh every 30 seconds
   */
  useEffect(() => {
    const intervalId = setInterval(() => {
      console.log('Auto-refreshing user data...');
      setLastUpdate(new Date());
    }, 30000); // 30 seconds

    // Cleanup: Clear interval on unmount
    return () => {
      clearInterval(intervalId);
    };
  }, []); // Stable interval

  /**
   * Effect 3: Log when user data changes
   */
  useEffect(() => {
    if (user) {
      console.log('User loaded:', user.name);
    }
  }, [user]); // Run when user changes

  /**
   * Effect 4: Document title update
   */
  useEffect(() => {
    const originalTitle = document.title;

    if (user) {
      document.title = `Profile: ${user.name}`;
    }

    // Cleanup: Restore original title
    return () => {
      document.title = originalTitle;
    };
  }, [user]); // Update when user changes

  if (loading) {
    return <div className="user-profile-loader loading">Loading user...</div>;
  }

  if (error) {
    return (
      <div className="user-profile-loader error">
        Error: {error.message}
      </div>
    );
  }

  if (!user) {
    return <div className="user-profile-loader empty">No user found</div>;
  }

  return (
    <div className="user-profile-loader">
      <h2>{user.name}</h2>
      <p>Email: {user.email}</p>
      <p>ID: {user.id}</p>
      <small>Last updated: {lastUpdate.toLocaleTimeString()}</small>
    </div>
  );
}
```

## Notes

### Effect Cleanup is Critical

**Always cleanup:**
- Event listeners
- Timers (setTimeout, setInterval)
- Subscriptions (WebSocket, EventSource)
- Animation frames
- External library instances

```typescript
// ❌ Memory leak (no cleanup)
useEffect(() => {
  const intervalId = setInterval(() => {
    console.log('tick');
  }, 1000);
}, []);

// ✅ Proper cleanup
useEffect(() => {
  const intervalId = setInterval(() => {
    console.log('tick');
  }, 1000);

  return () => {
    clearInterval(intervalId);
  };
}, []);
```

### Async Effects Pattern

Never make effect callback async directly:

```typescript
// ❌ Wrong (effect callback cannot be async)
useEffect(async () => {
  const data = await fetchData();
}, []);

// ✅ Correct (async function inside effect)
useEffect(() => {
  const loadData = async () => {
    const data = await fetchData();
    setData(data);
  };

  loadData();
}, []);
```

### Cancellation Pattern

Prevent state updates after unmount:

```typescript
useEffect(() => {
  let isCancelled = false;

  const fetchData = async () => {
    const result = await fetch('/api/data');

    // Only update if component still mounted
    if (!isCancelled) {
      setData(result);
    }
  };

  fetchData();

  return () => {
    isCancelled = true;
  };
}, []);
```

### Dependency Array Rules

```typescript
// ❌ Missing dependencies (ESLint will warn)
useEffect(() => {
  console.log(userId); // Uses userId but not in deps
}, []);

// ✅ All dependencies included
useEffect(() => {
  console.log(userId);
}, [userId]);

// ❌ Missing dep array (runs on every render)
useEffect(() => {
  console.log('Every render!');
});

// ✅ Empty array (runs once on mount)
useEffect(() => {
  console.log('Once on mount');
}, []);
```

### Splitting Effects

Split by concern, not by dependency:

```typescript
// ❌ Mixed concerns in one effect
useEffect(() => {
  fetchUser(userId);
  logAnalytics('page_view');
  document.title = `User ${userId}`;
}, [userId]);

// ✅ Separate effects for separate concerns
useEffect(() => {
  fetchUser(userId);
}, [userId]);

useEffect(() => {
  logAnalytics('page_view');
}, []);

useEffect(() => {
  document.title = `User ${userId}`;
}, [userId]);
```
