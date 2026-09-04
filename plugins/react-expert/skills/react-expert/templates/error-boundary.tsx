# Template: Error Boundary

**When to Use**: Catching JavaScript errors in component tree and displaying fallback UI.

**Complexity**: Medium

**Common Mistakes Agents Make**:
- Trying to use functional component (Error boundaries MUST be class components)
- Not typing state and props properly
- Not implementing both getDerivedStateFromError and componentDidCatch
- Not resetting error state
- Not logging errors properly
- Missing fallback UI

## Template

```typescript
import React, { Component, ErrorInfo, ReactNode } from 'react';

/**
 * Props for ErrorBoundary component
 */
interface ErrorBoundaryProps {
  /**
   * Child components to wrap
   */
  children: ReactNode;

  /**
   * Optional fallback UI (function or element)
   */
  fallback?: ReactNode | ((error: Error, errorInfo: ErrorInfo) => ReactNode);

  /**
   * Optional callback when error occurs
   */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;

  /**
   * Optional callback for reset
   */
  onReset?: () => void;
}

/**
 * State for ErrorBoundary component
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary - Catches errors in child component tree
 *
 * NOTE: Error boundaries MUST be class components. They cannot be functional components.
 *
 * Error boundaries catch errors:
 * - During rendering
 * - In lifecycle methods
 * - In constructors of whole tree below them
 *
 * Error boundaries DO NOT catch errors:
 * - In event handlers (use try-catch instead)
 * - In async code (setTimeout, promises)
 * - In server-side rendering
 * - In the error boundary itself
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  /**
   * Update state when error is thrown
   * This is called during render phase
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  /**
   * Log error details
   * This is called during commit phase (after render)
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to error reporting service
    console.error('Error caught by boundary:', error);
    console.error('Error info:', errorInfo);

    // Update state with error info
    this.setState({
      errorInfo,
    });

    // Call optional error callback
    this.props.onError?.(error, errorInfo);
  }

  /**
   * Reset error boundary state
   */
  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    // Call optional reset callback
    this.props.onReset?.();
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      // If custom fallback is a function, call it
      if (typeof fallback === 'function') {
        return fallback(error, errorInfo!);
      }

      // If custom fallback is provided, render it
      if (fallback) {
        return fallback;
      }

      // Default fallback UI
      return (
        <div className="error-boundary" role="alert">
          <div className="error-boundary__content">
            <h1 className="error-boundary__title">
              Something went wrong
            </h1>

            <p className="error-boundary__message">
              {error.message}
            </p>

            {process.env.NODE_ENV === 'development' && errorInfo && (
              <details className="error-boundary__details">
                <summary>Error Details (Development Only)</summary>
                <pre className="error-boundary__stack">
                  {errorInfo.componentStack}
                </pre>
              </details>
            )}

            <button
              className="error-boundary__reset-button"
              onClick={this.handleReset}
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    // No error, render children normally
    return children;
  }
}
```

## Adaptation Rules

- [ ] MUST use class component (cannot be functional component)
- [ ] Implement both `getDerivedStateFromError` and `componentDidCatch`
- [ ] Type props and state interfaces properly
- [ ] Provide fallback UI (default or custom)
- [ ] Include reset functionality
- [ ] Log errors to error reporting service (Sentry, etc.)
- [ ] Add development-only error details
- [ ] Consider providing onError callback

## Related

- Rule: @rules/typescript-essentials.md (TypeScript typing for error boundaries)
- Template: @templates/component-with-effect.tsx (error handling in effects)
- Decision: @decision-trees/state-management.md (error state management)

## Example: Page-Level Error Boundary

```typescript
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface PageErrorBoundaryProps {
  children: ReactNode;
  pageName?: string;
}

interface PageErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * PageErrorBoundary - Error boundary for entire pages
 */
export class PageErrorBoundary extends Component<
  PageErrorBoundaryProps,
  PageErrorBoundaryState
> {
  constructor(props: PageErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): PageErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log to error reporting service (e.g., Sentry)
    console.error(`Error in ${this.props.pageName || 'page'}:`, error);
    console.error('Component stack:', errorInfo.componentStack);

    // Example: Send to error tracking
    // Sentry.captureException(error, { extra: errorInfo });
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    window.location.reload(); // Reload page on reset
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="page-error">
          <h1>Page Error</h1>
          <p>
            We're sorry, but something went wrong while loading this page.
          </p>
          <p className="error-message">{this.state.error.message}</p>
          <button onClick={this.handleReset}>
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

## Usage Example

```typescript
// App-level error boundary
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary
      fallback={
        <div>
          <h1>Application Error</h1>
          <p>The application encountered an error. Please refresh.</p>
        </div>
      }
      onError={(error, errorInfo) => {
        // Send to error tracking service
        console.error('App error:', error, errorInfo);
      }}
    >
      <Router>
        <Routes />
      </Router>
    </ErrorBoundary>
  );
}

// Component-level error boundary
function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>

      <ErrorBoundary
        fallback={(error) => (
          <div className="widget-error">
            <p>Widget failed to load: {error.message}</p>
          </div>
        )}
      >
        <ComplexWidget />
      </ErrorBoundary>

      <ErrorBoundary>
        <AnotherWidget />
      </ErrorBoundary>
    </div>
  );
}

// Using custom fallback function
<ErrorBoundary
  fallback={(error, errorInfo) => (
    <div>
      <h2>Error: {error.message}</h2>
      <details>
        <summary>Technical Details</summary>
        <pre>{errorInfo?.componentStack}</pre>
      </details>
    </div>
  )}
>
  <YourComponent />
</ErrorBoundary>
```

## Notes

### Must Be Class Component

Error boundaries MUST be class components:

```typescript
// ❌ WRONG: Cannot use functional component
export function ErrorBoundary({ children }) {
  // This won't work!
  return children;
}

// ✅ CORRECT: Must be class component
export class ErrorBoundary extends Component {
  // Implementation
}
```

### What Error Boundaries Catch

**Catch (✅):**
- Rendering errors
- Lifecycle method errors
- Constructor errors in child components

**Don't Catch (❌):**
- Event handler errors (use try-catch)
- Async errors (promises, setTimeout)
- Server-side rendering errors
- Errors in error boundary itself

```typescript
// ❌ Not caught by error boundary
function MyComponent() {
  const handleClick = () => {
    throw new Error('Button error'); // Not caught!
  };

  return <button onClick={handleClick}>Click</button>;
}

// ✅ Must use try-catch in event handlers
function MyComponent() {
  const handleClick = () => {
    try {
      riskyOperation();
    } catch (error) {
      console.error(error);
      // Handle error
    }
  };

  return <button onClick={handleClick}>Click</button>;
}

// ✅ Caught by error boundary
function MyComponent() {
  const data = riskyOperation(); // Throws during render - caught!
  return <div>{data}</div>;
}
```

### Multiple Error Boundaries

Use multiple boundaries for better UX:

```typescript
// ✅ Granular error handling
<ErrorBoundary>
  <Header /> {/* Header error doesn't break page */}

  <ErrorBoundary>
    <Sidebar /> {/* Sidebar error doesn't break content */}
  </ErrorBoundary>

  <ErrorBoundary>
    <MainContent /> {/* Content error doesn't break sidebar */}
  </ErrorBoundary>
</ErrorBoundary>

// ❌ Single boundary - one error breaks everything
<ErrorBoundary>
  <Header />
  <Sidebar />
  <MainContent />
</ErrorBoundary>
```

### Reset Patterns

Different reset strategies:

```typescript
// Option 1: Simple state reset
handleReset = () => {
  this.setState({ hasError: false, error: null });
};

// Option 2: Key-based reset (force remount)
<ErrorBoundary key={resetKey}>
  <Component />
</ErrorBoundary>

// Option 3: Reload page
handleReset = () => {
  window.location.reload();
};

// Option 4: Reset parent state
handleReset = () => {
  this.setState({ hasError: false });
  this.props.onReset?.(); // Parent resets data
};
```
