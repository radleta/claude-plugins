# Template: Data Fetching in useEffect

**When to Use**: Fetching data when component mounts or when dependencies change.

**Complexity**: High

**Common Mistakes Agents Make**:
- Not handling loading and error states
- Missing cleanup with AbortController
- Not preventing state updates after unmount
- Forgetting to include dependencies in dependency array
- Making effect callback async (must use async function inside)
- Not handling race conditions

## Template

```typescript
import React, { useState, useEffect } from 'react';

/**
 * Data type for fetched data
 */
interface {{DataType}} {
  {{property1}}: {{Type1}};
  {{property2}}: {{Type2}};
}

interface {{ComponentName}}Props {
  /**
   * Parameter for data fetching (e.g., user ID)
   */
  {{fetchParam}}: string;

  /**
   * Optional callback when data is loaded
   */
  onDataLoaded?: (data: {{DataType}}) => void;
}

/**
 * {{ComponentName}} - Fetches data with proper loading/error handling
 */
export function {{ComponentName}}({
  {{fetchParam}},
  onDataLoaded,
}: {{ComponentName}}Props) {
  // State for fetched data
  const [data, setData] = useState<{{DataType}} | null>(null);

  // Loading state
  const [loading, setLoading] = useState<boolean>(false);

  // Error state
  const [error, setError] = useState<Error | null>(null);

  /**
   * Fetch data effect
   * Runs when {{fetchParam}} changes
   */
  useEffect(() => {
    // Create AbortController for cleanup
    const abortController = new AbortController();

    // Async fetch function
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/{{endpoint}}/${{{fetchParam}}}`, {
          signal: abortController.signal, // Pass abort signal
        });

        // Check if response is ok
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const jsonData: {{DataType}} = await response.json();

        // Only update state if not aborted
        if (!abortController.signal.aborted) {
          setData(jsonData);
          onDataLoaded?.(jsonData);
        }
      } catch (err) {
        // Don't set error if request was aborted
        if (err instanceof Error && err.name === 'AbortError') {
          console.log('Fetch aborted');
          return;
        }

        // Only update state if not aborted
        if (!abortController.signal.aborted) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
        }
      } finally {
        // Only update state if not aborted
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    // Start fetch
    fetchData();

    // Cleanup: Abort fetch if component unmounts or dependencies change
    return () => {
      abortController.abort();
    };
  }, [{{fetchParam}}, onDataLoaded]); // Re-fetch when dependencies change

  /**
   * Render loading state
   */
  if (loading) {
    return (
      <div className="{{component-name}} loading">
        <div className="spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  /**
   * Render error state
   */
  if (error) {
    return (
      <div className="{{component-name}} error">
        <p>Error: {error.message}</p>
        <button onClick={() => window.location.reload()}>
          Try Again
        </button>
      </div>
    );
  }

  /**
   * Render empty state
   */
  if (!data) {
    return (
      <div className="{{component-name}} empty">
        <p>No data available</p>
      </div>
    );
  }

  /**
   * Render data
   */
  return (
    <div className="{{component-name}}">
      <div>{data.{{property1}}}</div>
      <div>{data.{{property2}}}</div>
    </div>
  );
}
```

## Template with Manual Refetch

```typescript
import React, { useState, useEffect, useCallback } from 'react';

interface {{DataType}} {
  {{property}}: {{Type}};
}

interface {{ComponentName}}Props {
  {{fetchParam}}: string;
}

/**
 * {{ComponentName}} - Data fetching with manual refetch
 */
export function {{ComponentName}}({ {{fetchParam}} }: {{ComponentName}}Props) {
  const [data, setData] = useState<{{DataType}} | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Memoized fetch function
   */
  const fetchData = useCallback(async () => {
    const abortController = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/{{endpoint}}/${{{fetchParam}}}`, {
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const jsonData: {{DataType}} = await response.json();

      if (!abortController.signal.aborted) {
        setData(jsonData);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        if (!abortController.signal.aborted) {
          setError(err);
        }
      }
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }

    return abortController;
  }, [{{fetchParam}}]);

  /**
   * Auto-fetch on mount and when dependencies change
   */
  useEffect(() => {
    const abortController = fetchData();

    return () => {
      abortController.then(controller => controller.abort());
    };
  }, [fetchData]);

  /**
   * Manual refetch function
   */
  const handleRefetch = () => {
    fetchData();
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return (
      <div>
        <p>Error: {error.message}</p>
        <button onClick={handleRefetch}>Retry</button>
      </div>
    );
  }

  if (!data) {
    return <div>No data</div>;
  }

  return (
    <div>
      <div>{JSON.stringify(data)}</div>
      <button onClick={handleRefetch}>Refresh</button>
    </div>
  );
}
```

## Adaptation Rules

- [ ] Replace `{{ComponentName}}`, `{{DataType}}` with actual names
- [ ] Use AbortController for cleanup (prevents memory leaks)
- [ ] Handle all states: loading, error, empty, success
- [ ] Include all fetch parameters in dependency array
- [ ] Use async function INSIDE effect (not effect callback itself)
- [ ] Check abort signal before state updates
- [ ] Handle AbortError separately (don't show as error)
- [ ] Provide retry mechanism for errors

## Related

- Rule: @rules/dependency-arrays.md (effect dependencies and AbortController cleanup)
- Decision: @decision-trees/data-fetching.md (when to use libraries vs DIY)
- Template: @templates/component-with-effect.tsx (basic effects)
- Template: @templates/custom-hook.tsx (extract to useFetch hook)

## Example: User Profile Fetcher

```typescript
import React, { useState, useEffect } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  bio: string;
}

interface UserProfileProps {
  userId: string;
}

/**
 * UserProfile - Fetches and displays user profile
 */
export function UserProfile({ userId }: UserProfileProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Skip fetch if no userId
    if (!userId) {
      setUser(null);
      setLoading(false);
      return;
    }

    const abortController = new AbortController();
    let isMounted = true;

    const fetchUser = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log(`Fetching user ${userId}`);

        const response = await fetch(`https://api.example.com/users/${userId}`, {
          signal: abortController.signal,
          headers: {
            'Content-Type': 'application/json',
            // Add auth headers if needed
            // 'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('User not found');
          } else if (response.status === 401) {
            throw new Error('Unauthorized');
          } else {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
        }

        const userData: User = await response.json();

        // Only update if still mounted and not aborted
        if (isMounted && !abortController.signal.aborted) {
          setUser(userData);
          console.log(`User ${userId} loaded successfully`);
        }
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          console.log(`Fetch for user ${userId} was aborted`);
          return;
        }

        // Only update error if still mounted
        if (isMounted && !abortController.signal.aborted) {
          console.error(`Error fetching user ${userId}:`, err);
          setError(err instanceof Error ? err : new Error('Failed to load user'));
        }
      } finally {
        // Only update loading if still mounted
        if (isMounted && !abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchUser();

    // Cleanup function
    return () => {
      console.log(`Cleaning up fetch for user ${userId}`);
      isMounted = false;
      abortController.abort();
    };
  }, [userId]); // Re-fetch when userId changes

  /**
   * Loading state
   */
  if (loading) {
    return (
      <div className="user-profile loading">
        <div className="spinner" />
        <p>Loading user profile...</p>
      </div>
    );
  }

  /**
   * Error state
   */
  if (error) {
    return (
      <div className="user-profile error">
        <h2>Failed to Load Profile</h2>
        <p>{error.message}</p>
        <button onClick={() => window.location.reload()}>
          Try Again
        </button>
      </div>
    );
  }

  /**
   * Empty state
   */
  if (!user) {
    return (
      <div className="user-profile empty">
        <p>No user selected</p>
      </div>
    );
  }

  /**
   * Success state
   */
  return (
    <div className="user-profile">
      <div className="user-profile__header">
        <img
          src={user.avatar}
          alt={`${user.name}'s avatar`}
          className="user-profile__avatar"
        />
        <h1 className="user-profile__name">{user.name}</h1>
      </div>

      <div className="user-profile__details">
        <p>
          <strong>Email:</strong> {user.email}
        </p>
        <p>
          <strong>ID:</strong> {user.id}
        </p>
      </div>

      {user.bio && (
        <div className="user-profile__bio">
          <h3>Bio</h3>
          <p>{user.bio}</p>
        </div>
      )}
    </div>
  );
}
```

## Example: List with Pagination

```typescript
import React, { useState, useEffect } from 'react';

interface Item {
  id: string;
  title: string;
}

interface PaginatedResponse {
  items: Item[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * PaginatedList - Fetches paginated data
 */
export function PaginatedList() {
  const [data, setData] = useState<PaginatedResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const abortController = new AbortController();

    const fetchPage = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/items?page=${page}&pageSize=10`,
          { signal: abortController.signal }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch items');
        }

        const pageData: PaginatedResponse = await response.json();

        if (!abortController.signal.aborted) {
          setData(pageData);
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          if (!abortController.signal.aborted) {
            setError(err);
          }
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchPage();

    return () => {
      abortController.abort();
    };
  }, [page]); // Re-fetch when page changes

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div>
      {loading && <div>Loading...</div>}
      {error && <div>Error: {error.message}</div>}

      {data && (
        <>
          <ul>
            {data.items.map(item => (
              <li key={item.id}>{item.title}</li>
            ))}
          </ul>

          <div className="pagination">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
            >
              Previous
            </button>

            <span>Page {page} of {totalPages}</span>

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

## Notes

### AbortController is Essential

Always use AbortController to cleanup:

```typescript
// ❌ Without cleanup - memory leak risk
useEffect(() => {
  fetch('/api/data').then(res => setData(res));
}, []);

// ✅ With cleanup
useEffect(() => {
  const controller = new AbortController();

  fetch('/api/data', { signal: controller.signal })
    .then(res => setData(res));

  return () => controller.abort();
}, []);
```

### Async Effect Pattern

Never make effect callback async:

```typescript
// ❌ Wrong - effect callback cannot be async
useEffect(async () => {
  const data = await fetchData();
  setData(data);
}, []);

// ✅ Correct - async function inside effect
useEffect(() => {
  const loadData = async () => {
    const data = await fetchData();
    setData(data);
  };

  loadData();
}, []);
```

### Race Condition Prevention

Handle race conditions with abort signal:

```typescript
// Fast user clicks: userId changes from 1 → 2 → 3
// Without abort: All 3 requests complete, last one wins (might not be ID 3!)
// With abort: Requests 1 and 2 are cancelled, only 3 completes
useEffect(() => {
  const controller = new AbortController();

  fetch(`/api/users/${userId}`, { signal: controller.signal })
    .then(res => res.json())
    .then(data => {
      if (!controller.signal.aborted) {
        setData(data); // Only set if not cancelled
      }
    });

  return () => controller.abort(); // Cancel previous requests
}, [userId]);
```

### Error Handling

Handle different error types:

```typescript
try {
  const response = await fetch(url);

  // HTTP errors
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Not found');
    } else if (response.status === 401) {
      throw new Error('Unauthorized');
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  }

  const data = await response.json();
  setData(data);
} catch (err) {
  // Ignore abort errors
  if (err instanceof Error && err.name === 'AbortError') {
    return;
  }

  // Handle other errors
  setError(err instanceof Error ? err : new Error('Unknown error'));
}
```
