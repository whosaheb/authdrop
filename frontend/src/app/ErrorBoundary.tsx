import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  failed: boolean;
}

/** Last line of defence: a render crash anywhere shows this instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Only the component stack and message: never log user data.
    console.error('Unhandled UI error', error.message, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return <CrashScreen />;
  }
}

export function CrashScreen() {
  return (
    <main className="center-screen">
      <div className="card center-card" role="alert">
        <h1>Something broke</h1>
        <p className="muted">The page hit an unexpected error. Your data is safe. Reload to try again.</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          <span>Reload page</span>
        </button>
      </div>
    </main>
  );
}
