# Template: Suspense and Lazy Loading

**When to Use**: Code splitting to reduce initial bundle size, loading components on demand.

**Complexity**: Medium

**Common Mistakes Agents Make**:
- Not wrapping lazy components in Suspense boundary
- Missing fallback UI for Suspense
- Not handling loading errors (need Error Boundary too)
- Lazy loading components that are always needed
- Not typing lazy imports properly

## Template

```typescript
import React, { lazy, Suspense } from 'react';

/**
 * Lazy-loaded component
 * Uses dynamic import() which returns a Promise
 */
const {{LazyComponent}} = lazy(() => import('./{{ComponentPath}}'));

/**
 * Another lazy-loaded component
 */
const {{AnotherLazyComponent}} = lazy(() => import('./{{AnotherComponentPath}}'));

/**
 * Loading fallback component
 */
function LoadingFallback() {
  return (
    <div className="loading-fallback">
      <div className="loading-spinner" />
      <p>Loading...</p>
    </div>
  );
}

interface {{ParentComponent}}Props {
  {{propName}}: {{PropType}};
}

/**
 * {{ParentComponent}} - Component with lazy-loaded children
 */
export function {{ParentComponent}}({ {{propName}} }: {{ParentComponent}}Props) {
  return (
    <div className="{{parent-component}}">
      <h1>{{Parent Component Title}}</h1>

      {/* Suspense boundary with fallback */}
      <Suspense fallback={<LoadingFallback />}>
        <{{LazyComponent}} {{prop}}={{{propName}}} />
      </Suspense>

      {/* Multiple lazy components in one Suspense */}
      <Suspense fallback={<div>Loading sections...</div>}>
        <{{AnotherLazyComponent}} />
      </Suspense>
    </div>
  );
}

/**
 * Alternative: Nested Suspense boundaries for granular loading
 */
export function {{NestedSuspenseExample}}() {
  return (
    <div>
      {/* Outer Suspense for main content */}
      <Suspense fallback={<div>Loading page...</div>}>
        <MainContent />

        {/* Nested Suspense for sidebar (loads independently) */}
        <Suspense fallback={<div>Loading sidebar...</div>}>
          <Sidebar />
        </Suspense>
      </Suspense>
    </div>
  );
}

/**
 * With Error Boundary for complete error/loading handling
 */
import { ErrorBoundary } from './ErrorBoundary';

export function {{ComponentWithErrorHandling}}() {
  return (
    <ErrorBoundary
      fallback={<div>Failed to load component</div>}
    >
      <Suspense fallback={<LoadingFallback />}>
        <{{LazyComponent}} />
      </Suspense>
    </ErrorBoundary>
  );
}
```

## Adaptation Rules

- [ ] Replace `{{LazyComponent}}` with actual component name
- [ ] Use `lazy(() => import('./path'))` for dynamic imports
- [ ] ALWAYS wrap lazy components in `<Suspense>` boundary
- [ ] Provide meaningful `fallback` UI for Suspense
- [ ] Combine with Error Boundary for error handling
- [ ] Use nested Suspense for granular loading states
- [ ] Only lazy load components that aren't immediately needed
- [ ] Ensure lazy-loaded components have default exports

## Related

- Rule: @rules/hooks-rules.md (Suspense and hooks best practices)
- Decision: @decision-trees/performance.md (when to code-split)
- Template: @templates/error-boundary.tsx (error handling for lazy loading)

## Example: Route-Based Code Splitting

```typescript
import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';

/**
 * Lazy-loaded route components
 */
const HomePage = lazy(() => import('./pages/HomePage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

/**
 * Loading component for route transitions
 */
function RouteLoadingFallback() {
  return (
    <div className="route-loading">
      <div className="route-loading__spinner" />
      <p>Loading page...</p>
    </div>
  );
}

/**
 * App component with lazy-loaded routes
 */
export function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary
        fallback={
          <div className="page-error">
            <h1>Page Failed to Load</h1>
            <p>Please refresh the page</p>
          </div>
        }
      >
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
```

## Example: Conditional Lazy Loading

```typescript
import React, { lazy, Suspense, useState } from 'react';

/**
 * Heavy components loaded only when needed
 */
const HeavyChart = lazy(() => import('./components/HeavyChart'));
const HeavyDataTable = lazy(() => import('./components/HeavyDataTable'));

/**
 * Dashboard with conditionally loaded components
 */
export function Dashboard() {
  const [showChart, setShowChart] = useState(false);
  const [showTable, setShowTable] = useState(false);

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>

      {/* Toggle buttons */}
      <div className="dashboard__controls">
        <button onClick={() => setShowChart(true)}>
          Show Chart
        </button>
        <button onClick={() => setShowTable(true)}>
          Show Data Table
        </button>
      </div>

      {/* Conditionally render and lazy load chart */}
      {showChart && (
        <ErrorBoundary fallback={<div>Chart failed to load</div>}>
          <Suspense fallback={<div>Loading chart...</div>}>
            <HeavyChart />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* Conditionally render and lazy load table */}
      {showTable && (
        <ErrorBoundary fallback={<div>Table failed to load</div>}>
          <Suspense fallback={<div>Loading table...</div>}>
            <HeavyDataTable />
          </Suspense>
        </ErrorBoundary>
      )}
    </div>
  );
}
```

## Example: Preloading Components

```typescript
import React, { lazy, Suspense } from 'react';

/**
 * Lazy component with preload function
 */
const HeavyComponent = lazy(() => import('./HeavyComponent'));

/**
 * Preload function to trigger loading before needed
 */
const preloadHeavyComponent = () => {
  import('./HeavyComponent');
};

/**
 * Component that preloads on hover
 */
export function ButtonWithPreload() {
  const [showHeavy, setShowHeavy] = useState(false);

  return (
    <div>
      <button
        onClick={() => setShowHeavy(true)}
        onMouseEnter={preloadHeavyComponent} // Preload on hover
        onFocus={preloadHeavyComponent} // Preload on focus
      >
        Show Heavy Component
      </button>

      {showHeavy && (
        <Suspense fallback={<div>Loading...</div>}>
          <HeavyComponent />
        </Suspense>
      )}
    </div>
  );
}
```

## Notes

### Suspense Requires Fallback

Always provide fallback UI:

```typescript
// ❌ Missing fallback (will error)
<Suspense>
  <LazyComponent />
</Suspense>

// ✅ With fallback
<Suspense fallback={<div>Loading...</div>}>
  <LazyComponent />
</Suspense>
```

### Default Export Required

Lazy-loaded components must use default export:

```typescript
// ❌ Named export won't work
export function MyComponent() { ... }

// ✅ Default export
export default function MyComponent() { ... }

// Or:
function MyComponent() { ... }
export default MyComponent;
```

### Error Boundaries and Suspense

Combine both for complete handling:

```typescript
// ✅ Complete error and loading handling
<ErrorBoundary fallback={<ErrorUI />}>
  <Suspense fallback={<LoadingUI />}>
    <LazyComponent />
  </Suspense>
</ErrorBoundary>

// Loading: Shows LoadingUI
// Error during load: Shows ErrorUI
// Success: Shows LazyComponent
```

### When to Use Lazy Loading

**Good candidates:**
- Route components (each page)
- Modal/dialog components (shown conditionally)
- Heavy libraries (charts, editors)
- Features behind feature flags
- Admin-only components

**Bad candidates:**
- Components always rendered
- Very small components (overhead not worth it)
- Critical above-the-fold content
- Components affecting initial paint

### Nested Suspense

Use nested Suspense for independent loading:

```typescript
// ✅ Independent loading states
<Suspense fallback={<PageLoading />}>
  <Header /> {/* Loads first */}

  <Suspense fallback={<SidebarLoading />}>
    <Sidebar /> {/* Can load independently */}
  </Suspense>

  <Suspense fallback={<ContentLoading />}>
    <Content /> {/* Can load independently */}
  </Suspense>
</Suspense>

// ❌ Single Suspense waits for all
<Suspense fallback={<PageLoading />}>
  <Header />
  <Sidebar />  {/* All must load */}
  <Content />  {/* before showing any */}
</Suspense>
```
