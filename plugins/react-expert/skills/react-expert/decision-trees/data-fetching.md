# Data Fetching Decision Tree

## When to Use This Tree

Use this tree when you need to decide **how and where to fetch data** from an API in a React application. The right approach depends heavily on your rendering environment (server vs client) and your requirements (caching, revalidation, optimistic updates).

## The Core Question

**"Where is this component rendered, and what are my data fetching requirements?"**

---

## The Decision Tree

```
Start: Where is this component rendered?

├─ Server (Next.js App Router, Remix, or other SSR framework)
│   │
│   ├─ Using Next.js App Router (React Server Components)?
│   │   │
│   │   ├─ Data is static or changes rarely?
│   │   │   └─ → async Server Component with fetch (with revalidate)
│   │   │
│   │   └─ Data is dynamic per request?
│   │       └─ → async Server Component with fetch (with cache: 'no-store')
│   │
│   └─ Using Remix or Next.js Pages Router?
│       └─ → Use framework's loader function (Remix) or getServerSideProps (Next.js)
│
└─ Client (browser only)
    │
    ├─ Simple one-time fetch (no caching, no refetching needed)?
    │   └─ → useEffect + fetch + useState
    │
    └─ Need advanced features (caching, revalidation, optimistic updates)?
        │
        ├─ Fetching from REST API?
        │   │
        │   ├─ Want batteries-included, powerful features?
        │   │   └─ → React Query (TanStack Query)
        │   │
        │   └─ Want minimal, lightweight solution?
        │       └─ → SWR (Stale-While-Revalidate)
        │
        ├─ Fetching from GraphQL API?
        │   │
        │   ├─ Need full-featured GraphQL client?
        │   │   └─ → Apollo Client
        │   │
        │   └─ Want lightweight GraphQL client?
        │       └─ → urql
        │
        └─ Real-time data (WebSocket, SSE)?
            └─ → useEffect with WebSocket + cleanup
```

---

## Code Examples for Each Solution

### Solution 1: Next.js App Router - Server Component (Static/Cached)

**When:** Using Next.js 13+ App Router, data is static or changes rarely

```typescript
// app/users/[id]/page.tsx
// ✅ Server Component - runs on server, no client JS needed for data fetching

interface User {
  id: string;
  name: string;
  email: string;
}

async function getUser(id: string): Promise<User> {
  const res = await fetch(`https://api.example.com/users/${id}`, {
    // Revalidate cache every 60 seconds
    next: { revalidate: 60 }
  });

  if (!res.ok) {
    throw new Error('Failed to fetch user');
  }

  return res.json();
}

export default async function UserPage({ params }: { params: { id: string } }) {
  const user = await getUser(params.id);

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}

// ✅ Generate static params at build time
export async function generateStaticParams() {
  const res = await fetch('https://api.example.com/users');
  const users: User[] = await res.json();

  return users.map((user) => ({
    id: user.id,
  }));
}
```

**Use for:** Blog posts, product pages, user profiles (static or infrequently updated)

---

### Solution 2: Next.js App Router - Server Component (Dynamic)

**When:** Using Next.js 13+ App Router, data is per-request dynamic

```typescript
// app/dashboard/page.tsx
// ✅ Server Component with no caching - always fresh data

async function getUserDashboard(userId: string) {
  const res = await fetch(`https://api.example.com/dashboard/${userId}`, {
    // No caching - always fetch fresh data
    cache: 'no-store'
  });

  if (!res.ok) {
    throw new Error('Failed to fetch dashboard');
  }

  return res.json();
}

export default async function DashboardPage() {
  // In real app, get userId from auth
  const userId = 'current-user-id';
  const dashboard = await getUserDashboard(userId);

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Balance: ${dashboard.balance}</p>
      <p>Last login: {dashboard.lastLogin}</p>
    </div>
  );
}

// ✅ Prevent static generation - force dynamic rendering
export const dynamic = 'force-dynamic';
```

**Use for:** Dashboards, personalized content, real-time data displays

---

### Solution 3: Remix Loaders

**When:** Using Remix framework

```typescript
// app/routes/users.$id.tsx
import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';

// ✅ Loader runs on server
export async function loader({ params }: LoaderFunctionArgs) {
  const res = await fetch(`https://api.example.com/users/${params.id}`);

  if (!res.ok) {
    throw new Response('Not Found', { status: 404 });
  }

  const user = await res.json();
  return json({ user });
}

// ✅ Component renders with data
export default function UserPage() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}
```

**Use for:** All data fetching in Remix apps

---

### Solution 4: useEffect + fetch (Client-side, Simple)

**When:** Client-side only, simple one-time fetch, no caching needed

```typescript
// ✅ Basic client-side fetching with loading and error states
function UserProfile({ userId }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchUser() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/users/${userId}`);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (!cancelled) {
          setUser(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'An error occurred');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchUser();

    // Cleanup to prevent state updates after unmount
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!user) return null;

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}
```

**Use for:** Simple apps, prototypes, educational purposes

**Don't use for:** Production apps with complex data needs (use React Query instead)

---

### Solution 5: React Query (TanStack Query)

**When:** Client-side, REST API, need caching/revalidation/mutations

```typescript
// ✅ React Query - production-ready data fetching
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface User {
  id: string;
  name: string;
  email: string;
}

// Query function
async function fetchUser(userId: string): Promise<User> {
  const response = await fetch(`/api/users/${userId}`);
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  return response.json();
}

function UserProfile({ userId }: Props) {
  // ✅ Automatic caching, refetching, and loading states
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!user) return null;

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}

// ✅ Mutations with optimistic updates
function UpdateUserForm({ userId }: Props) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (updatedUser: Partial<User>) => {
      return fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedUser),
      }).then(res => res.json());
    },
    onMutate: async (updatedUser) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['user', userId] });

      // Snapshot previous value
      const previousUser = queryClient.getQueryData(['user', userId]);

      // Optimistically update
      queryClient.setQueryData(['user', userId], (old: User) => ({
        ...old,
        ...updatedUser,
      }));

      return { previousUser };
    },
    onError: (err, updatedUser, context) => {
      // Rollback on error
      queryClient.setQueryData(['user', userId], context?.previousUser);
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
    },
  });

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      mutation.mutate({ name: 'New Name' });
    }}>
      <button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Updating...' : 'Update'}
      </button>
    </form>
  );
}

// ✅ Setup QueryClient at app root
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <YourApp />
    </QueryClientProvider>
  );
}
```

**Use for:**
- Production apps with REST APIs
- Need caching, background refetching
- Optimistic updates
- Automatic retry logic
- DevTools support

---

### Solution 6: SWR (Stale-While-Revalidate)

**When:** Client-side, REST API, want lightweight alternative to React Query

```typescript
// ✅ SWR - similar to React Query but more minimal
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function UserProfile({ userId }: Props) {
  const { data: user, error, isLoading } = useSWR(
    `/api/users/${userId}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute
    }
  );

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!user) return null;

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}

// ✅ Mutations with SWR
import useSWRMutation from 'swr/mutation';

async function updateUser(url: string, { arg }: { arg: Partial<User> }) {
  return fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(arg),
  }).then(res => res.json());
}

function UpdateUserForm({ userId }: Props) {
  const { trigger, isMutating } = useSWRMutation(
    `/api/users/${userId}`,
    updateUser
  );

  return (
    <button
      onClick={() => trigger({ name: 'New Name' })}
      disabled={isMutating}
    >
      {isMutating ? 'Updating...' : 'Update'}
    </button>
  );
}

// ✅ Setup SWR at app root
import { SWRConfig } from 'swr';

function App() {
  return (
    <SWRConfig
      value={{
        refreshInterval: 0,
        fetcher: (url: string) => fetch(url).then(res => res.json()),
      }}
    >
      <YourApp />
    </SWRConfig>
  );
}
```

**Use for:**
- Production apps wanting simpler API than React Query
- Smaller bundle size priority
- Vercel/Next.js ecosystem (made by Vercel)

---

### Solution 7: Apollo Client (GraphQL)

**When:** Fetching from GraphQL API, need full-featured client

```typescript
// ✅ Apollo Client for GraphQL
import { ApolloClient, InMemoryCache, gql, useQuery, useMutation } from '@apollo/client';

// Setup client
const client = new ApolloClient({
  uri: 'https://api.example.com/graphql',
  cache: new InMemoryCache(),
});

// Define query
const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
      email
      posts {
        id
        title
      }
    }
  }
`;

function UserProfile({ userId }: Props) {
  const { loading, error, data } = useQuery(GET_USER, {
    variables: { id: userId },
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1>{data.user.name}</h1>
      <p>{data.user.email}</p>
      <ul>
        {data.user.posts.map(post => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
    </div>
  );
}

// ✅ Mutations
const UPDATE_USER = gql`
  mutation UpdateUser($id: ID!, $name: String!) {
    updateUser(id: $id, name: $name) {
      id
      name
    }
  }
`;

function UpdateUserForm({ userId }: Props) {
  const [updateUser, { loading }] = useMutation(UPDATE_USER, {
    refetchQueries: [{ query: GET_USER, variables: { id: userId } }],
  });

  return (
    <button
      onClick={() => updateUser({ variables: { id: userId, name: 'New Name' } })}
      disabled={loading}
    >
      {loading ? 'Updating...' : 'Update'}
    </button>
  );
}

// ✅ Setup at app root
import { ApolloProvider } from '@apollo/client';

function App() {
  return (
    <ApolloProvider client={client}>
      <YourApp />
    </ApolloProvider>
  );
}
```

**Use for:**
- GraphQL APIs
- Need normalized caching
- Complex data relationships
- Optimistic UI updates

---

### Solution 8: WebSocket / Real-time Data

**When:** Real-time updates, WebSocket or Server-Sent Events

```typescript
// ✅ WebSocket for real-time data
function LiveChat({ roomId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  useEffect(() => {
    const ws = new WebSocket(`wss://api.example.com/chat/${roomId}`);

    ws.onopen = () => {
      setConnectionStatus('connected');
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      setMessages(prev => [...prev, message]);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('disconnected');
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
    };

    // Cleanup - CRITICAL!
    return () => {
      ws.close();
    };
  }, [roomId]);

  const sendMessage = (text: string) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ text, roomId }));
    }
  };

  return (
    <div>
      <div>Status: {connectionStatus}</div>
      <ul>
        {messages.map((msg, idx) => (
          <li key={idx}>{msg.text}</li>
        ))}
      </ul>
    </div>
  );
}

// ✅ Server-Sent Events (SSE)
function LiveNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const eventSource = new EventSource('/api/notifications/stream');

    eventSource.onmessage = (event) => {
      const notification = JSON.parse(event.data);
      setNotifications(prev => [...prev, notification]);
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      eventSource.close();
    };

    // Cleanup
    return () => {
      eventSource.close();
    };
  }, []);

  return (
    <ul>
      {notifications.map((notif, idx) => (
        <li key={idx}>{notif.message}</li>
      ))}
    </ul>
  );
}
```

**Use for:**
- Chat applications
- Live notifications
- Stock tickers
- Collaborative editing

---

## Antipatterns: Common Data Fetching Mistakes

### Antipattern 1: Fetching in render (not effect)

❌ **WRONG:**
```typescript
// DON'T fetch in render!
function Component({ userId }: Props) {
  const [user, setUser] = useState(null);

  // This runs on EVERY render!
  fetch(`/api/users/${userId}`)
    .then(res => res.json())
    .then(setUser);

  return <div>{user?.name}</div>;
}
```

✅ **RIGHT:**
```typescript
function Component({ userId }: Props) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(setUser);
  }, [userId]);

  return <div>{user?.name}</div>;
}
```

---

### Antipattern 2: No loading or error states

❌ **WRONG:**
```typescript
function Component({ userId }: Props) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(setUser);
  }, [userId]);

  // What if still loading? What if error?
  return <div>{user.name}</div>; // Can crash!
}
```

✅ **RIGHT:**
```typescript
function Component({ userId }: Props) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setIsLoading(true);
    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(data => {
        setUser(data);
        setIsLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setIsLoading(false);
      });
  }, [userId]);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  return <div>{user.name}</div>;
}
```

---

### Antipattern 3: No cleanup for async operations

❌ **WRONG:**
```typescript
useEffect(() => {
  fetch(`/api/users/${userId}`)
    .then(res => res.json())
    .then(setUser); // Can update state after unmount!
}, [userId]);
```

✅ **RIGHT:**
```typescript
useEffect(() => {
  let cancelled = false;

  fetch(`/api/users/${userId}`)
    .then(res => res.json())
    .then(data => {
      if (!cancelled) {
        setUser(data);
      }
    });

  return () => {
    cancelled = true;
  };
}, [userId]);
```

---

## Decision Criteria Summary

| Scenario | Solution |
|----------|----------|
| Next.js App Router, static data | Server Component + fetch with revalidate |
| Next.js App Router, dynamic data | Server Component + fetch with no-store |
| Remix | Loader functions |
| Client, simple fetch | useEffect + fetch |
| Client, production REST | React Query |
| Client, lightweight REST | SWR |
| Client, GraphQL | Apollo Client or urql |
| Real-time data | WebSocket + useEffect |

---

## See Also

- `@decision-trees/effect-usage.md` - When to use useEffect for data fetching
- `@decision-trees/state-management.md` - How to manage fetched data state
- `@templates/data-fetching-effect.tsx` - Data fetching implementation examples
