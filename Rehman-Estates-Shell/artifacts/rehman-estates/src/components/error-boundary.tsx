import {
  Component,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from 'react';

export interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  FallbackComponent?: ComponentType<ErrorFallbackProps>;
  /** Changing this clears a caught error. Pass the route to recover on navigation. */
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  error: Error | null;
}

function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  if (typeof value === 'string') {
    return new Error(value);
  }
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(String(value));
  }
}

function DefaultFallback({ error, resetError }: ErrorFallbackProps) {
  // Self-contained on purpose: this renders when part of the app has
  // crashed, so it must not depend on the router, mock data, or app
  // state — only the global CSS custom properties from index.css
  // (already loaded for the whole document) and inline styles.
  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-6"
      style={{ background: 'hsl(var(--background))' }}
    >
      <div
        className="max-w-lg w-full text-center"
        style={{
          background: 'rgba(255,255,255,0.68)',
          backdropFilter: 'blur(24px) saturate(1.6)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
          border: '1px solid rgba(148,163,184,0.20)',
          borderRadius: '20px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.05), 0 1px 0 rgba(255,255,255,0.90) inset',
          padding: '40px 32px',
        }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 mx-auto mb-5"
          style={{ background: 'hsl(var(--destructive) / 0.10)', border: '1px solid hsl(var(--destructive) / 0.20)' }}
        >
          <svg
            width="26" height="26" viewBox="0 0 24 24" fill="none"
            stroke="hsl(var(--destructive))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        <h1 className="text-xl font-bold" style={{ color: 'hsl(var(--foreground))' }}>
          Something went wrong
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>
          This part of the app hit an error. The rest of the app is still running.
        </p>

        {/* Dev only: messages can carry API responses and other internals. */}
        {import.meta.env.DEV ? (
          <pre
            className="mt-4 overflow-x-auto rounded-lg p-3 text-left text-xs"
            style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--foreground))' }}
          >
            {error.message || String(error)}
          </pre>
        ) : null}

        <button
          type="button"
          onClick={resetError}
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-opacity"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.75))',
            color: 'hsl(var(--primary-foreground))',
            boxShadow: '0 4px 16px hsl(var(--primary) / 0.30)',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.90'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: toError(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(
      'ErrorBoundary caught an error:',
      toError(error),
      info.componentStack,
    );
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (
      this.state.error !== null &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.resetError();
    }
  }

  resetError = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error === null) {
      return this.props.children;
    }
    const Fallback = this.props.FallbackComponent ?? DefaultFallback;
    return <Fallback error={error} resetError={this.resetError} />;
  }
}
