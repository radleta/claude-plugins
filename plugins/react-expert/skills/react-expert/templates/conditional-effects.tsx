# Template: Conditional Logic in Effects

**When to Use**: Running effects with conditional logic based on state or props.

**Complexity**: Medium

**Common Mistakes Agents Make**:
- Calling useEffect conditionally (WRONG - violates Rules of Hooks)
- Not including condition variables in dependency array
- Creating multiple effects when one with conditional logic is better
- Missing cleanup for conditional branches

## Template

```typescript
import React, { useEffect, useState } from 'react';

interface {{ComponentName}}Props {
  {{conditionProp}}: boolean;
  {{dataProp}}: {{DataType}};
}

/**
 * {{ComponentName}} - Demonstrates conditional logic in effects
 */
export function {{ComponentName}}({
  {{conditionProp}},
  {{dataProp}},
}: {{ComponentName}}Props) {
  const [{{state}}, set{{State}}] = useState<{{StateType}}>({{initialValue}});

  /**
   * Pattern 1: Condition INSIDE effect (✅ CORRECT)
   * Effect always runs, but logic is conditional
   */
  useEffect(() => {
    // Condition inside effect
    if ({{conditionProp}}) {
      console.log('Condition met, running effect logic');

      // Effect logic here
      const result = processData({{dataProp}});
      set{{State}}(result);
    } else {
      console.log('Condition not met, skipping effect logic');
    }

    // Cleanup always defined (runs even if condition was false)
    return () => {
      console.log('Cleanup runs regardless of condition');
      // Cleanup logic
    };
  }, [{{conditionProp}}, {{dataProp}}]); // Include condition in dependencies

  /**
   * Pattern 2: Early return in effect (✅ CORRECT)
   * Exit early if condition not met
   */
  useEffect(() => {
    // Early return if condition not met
    if (!{{conditionProp}}) {
      return; // No cleanup needed
    }

    // Effect logic runs only if condition met
    console.log('Running effect');
    const subscription = subscribe({{dataProp}});

    // Cleanup for conditional logic
    return () => {
      console.log('Cleanup conditional subscription');
      subscription.unsubscribe();
    };
  }, [{{conditionProp}}, {{dataProp}}]);

  /**
   * Pattern 3: Multiple conditions (✅ CORRECT)
   * Check multiple conditions inside one effect
   */
  useEffect(() => {
    if ({{condition1}} && {{condition2}}) {
      console.log('Both conditions met');
      // Logic when both true
    } else if ({{condition1}}) {
      console.log('Only condition1 met');
      // Logic when only condition1 true
    } else if ({{condition2}}) {
      console.log('Only condition2 met');
      // Logic when only condition2 true
    } else {
      console.log('No conditions met');
      // Default logic
    }

    return () => {
      // Cleanup
    };
  }, [{{condition1}}, {{condition2}}]);

  /**
   * Pattern 4: Conditional cleanup (✅ CORRECT)
   * Cleanup depends on what was set up
   */
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    if ({{conditionProp}}) {
      const resource = allocateResource();
      cleanup = () => resource.release();
    }

    // Return cleanup function or undefined
    return cleanup;
  }, [{{conditionProp}}]);

  // ❌ WRONG: Conditional effect call
  // if ({{conditionProp}}) {
  //   useEffect(() => {
  //     // This violates Rules of Hooks!
  //   }, []);
  // }

  return (
    <div className="{{component-name}}">
      {/* Component render */}
    </div>
  );
}
```

## Adaptation Rules

- [ ] Replace `{{ComponentName}}` with actual component name
- [ ] Put conditional logic INSIDE effect, never call useEffect conditionally
- [ ] Include all condition variables in dependency array
- [ ] Use early return for simple conditional logic
- [ ] Define cleanup function even if effect logic didn't run
- [ ] Consider splitting effects if they handle completely different concerns

## Related

- Rule: @rules/hooks-rules.md (Rules of Hooks - conditions INSIDE not around)
- Rule: @rules/dependency-arrays.md (effect dependencies and cleanup)
- Template: @templates/component-with-effect.tsx (basic effects)

## Example: Conditional Data Fetching

```typescript
import React, { useState, useEffect } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
}

interface UserProfileProps {
  userId: string | null;
  shouldFetch: boolean;
}

/**
 * UserProfile - Fetches user data conditionally
 */
export function UserProfile({ userId, shouldFetch }: UserProfileProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Fetch user data only if shouldFetch is true and userId exists
   */
  useEffect(() => {
    // Early return if conditions not met
    if (!shouldFetch || !userId) {
      setUser(null); // Clear user if conditions not met
      return;
    }

    let isCancelled = false;

    const fetchUser = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/users/${userId}`);

        if (!response.ok) {
          throw new Error('Failed to fetch user');
        }

        const data: User = await response.json();

        if (!isCancelled) {
          setUser(data);
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

    // Cleanup: Cancel ongoing fetch
    return () => {
      isCancelled = true;
    };
  }, [userId, shouldFetch]); // Re-run when either changes

  if (!shouldFetch) {
    return <div>Data fetching disabled</div>;
  }

  if (!userId) {
    return <div>No user selected</div>;
  }

  if (loading) {
    return <div>Loading user...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  if (!user) {
    return <div>No user data</div>;
  }

  return (
    <div className="user-profile">
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  );
}
```

## Example: Conditional Subscriptions

```typescript
import React, { useState, useEffect } from 'react';

interface RealtimeDataProps {
  isEnabled: boolean;
  channelId: string;
}

/**
 * RealtimeData - Subscribes to updates conditionally
 */
export function RealtimeData({ isEnabled, channelId }: RealtimeDataProps) {
  const [data, setData] = useState<any>(null);

  /**
   * Subscribe to realtime updates only if enabled
   */
  useEffect(() => {
    // Early return if not enabled
    if (!isEnabled) {
      console.log('Realtime updates disabled');
      setData(null); // Clear data when disabled
      return; // No cleanup needed
    }

    console.log(`Subscribing to channel: ${channelId}`);

    // Set up subscription
    const subscription = {
      onMessage: (message: any) => {
        console.log('Received message:', message);
        setData(message);
      },
      onError: (error: Error) => {
        console.error('Subscription error:', error);
      },
    };

    // Example: WebSocket connection
    const ws = new WebSocket(`wss://api.example.com/channel/${channelId}`);

    ws.onmessage = (event) => {
      subscription.onMessage(JSON.parse(event.data));
    };

    ws.onerror = (event) => {
      subscription.onError(new Error('WebSocket error'));
    };

    // Cleanup: Close connection when effect re-runs or component unmounts
    return () => {
      console.log(`Unsubscribing from channel: ${channelId}`);
      ws.close();
    };
  }, [isEnabled, channelId]); // Re-subscribe when either changes

  if (!isEnabled) {
    return <div>Realtime updates are disabled</div>;
  }

  return (
    <div className="realtime-data">
      <h3>Live Data</h3>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
```

## Example: Multiple Conditional Branches

```typescript
import React, { useEffect, useState } from 'react';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface ConnectionMonitorProps {
  autoReconnect: boolean;
  maxRetries: number;
}

/**
 * ConnectionMonitor - Different logic based on connection state
 */
export function ConnectionMonitor({
  autoReconnect,
  maxRetries,
}: ConnectionMonitorProps) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [retries, setRetries] = useState(0);

  /**
   * Handle different connection states with conditional logic
   */
  useEffect(() => {
    console.log(`Connection status: ${status}`);

    if (status === 'disconnected' && autoReconnect && retries < maxRetries) {
      // Reconnect after delay
      console.log(`Attempting reconnect (${retries + 1}/${maxRetries})`);

      const timeoutId = setTimeout(() => {
        setStatus('connecting');
        setRetries(prev => prev + 1);
      }, 2000);

      return () => {
        clearTimeout(timeoutId);
      };
    } else if (status === 'connecting') {
      // Simulate connection attempt
      const timeoutId = setTimeout(() => {
        const success = Math.random() > 0.5;
        setStatus(success ? 'connected' : 'disconnected');
      }, 1000);

      return () => {
        clearTimeout(timeoutId);
      };
    } else if (status === 'connected') {
      // Reset retries on successful connection
      setRetries(0);

      // Set up heartbeat
      const intervalId = setInterval(() => {
        console.log('Heartbeat');
      }, 5000);

      return () => {
        clearInterval(intervalId);
      };
    } else {
      // Max retries reached or auto-reconnect disabled
      console.log('Connection abandoned');
    }

    // No cleanup for other branches
  }, [status, autoReconnect, retries, maxRetries]);

  return (
    <div className="connection-monitor">
      <div>Status: {status}</div>
      {autoReconnect && (
        <div>Retries: {retries}/{maxRetries}</div>
      )}
    </div>
  );
}
```

## Notes

### Rules of Hooks Violation

Never call hooks conditionally:

```typescript
// ❌ WRONG: Conditional hook call
if (condition) {
  useEffect(() => { ... }, []);
}

// ❌ WRONG: Hook in callback
const handleClick = () => {
  useEffect(() => { ... }, []);
};

// ✅ CORRECT: Condition inside hook
useEffect(() => {
  if (condition) {
    // Conditional logic
  }
}, [condition]);
```

### Dependencies Must Include Conditions

```typescript
// ❌ Missing condition in dependencies
useEffect(() => {
  if (isEnabled) {
    doSomething(data);
  }
}, [data]); // Missing isEnabled!

// ✅ Correct: Condition in dependencies
useEffect(() => {
  if (isEnabled) {
    doSomething(data);
  }
}, [isEnabled, data]); // All dependencies included
```

### Early Return Pattern

```typescript
// ✅ Clean early return
useEffect(() => {
  if (!condition) {
    return; // Exit early, no cleanup
  }

  const subscription = subscribe();

  return () => {
    subscription.unsubscribe();
  };
}, [condition]);
```

### When to Split Effects

Split effects when they handle different concerns:

```typescript
// ❌ Mixed concerns in one effect
useEffect(() => {
  if (shouldFetch) {
    fetchData();
  }

  if (shouldSubscribe) {
    subscribe();
  }
}, [shouldFetch, shouldSubscribe]);

// ✅ Separate effects for separate concerns
useEffect(() => {
  if (shouldFetch) {
    fetchData();
  }
}, [shouldFetch]);

useEffect(() => {
  if (shouldSubscribe) {
    subscribe();
  }
}, [shouldSubscribe]);
```
