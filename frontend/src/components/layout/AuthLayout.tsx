import type { ReactNode } from 'react';
import { Wordmark } from './Logo';

interface AuthLayoutProps {
  children: ReactNode;
  /** Optional context shown on the brand panel, e.g. the app the user is signing in to. */
  context?: ReactNode;
  wide?: boolean;
}

/** Split layout: an ink panel with a ripple (the "drop") beside the form column. */
export function AuthLayout({ children, context, wide = false }: AuthLayoutProps) {
  return (
    <div className="auth-shell">
      <aside className="auth-brand" aria-hidden={context ? undefined : true}>
        <div className="ripples" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="auth-brand-top">
          <Wordmark />
        </div>
        <div className="auth-brand-copy">
          <p className="auth-brand-line">Sign in with a code, not a password.</p>
          {context}
        </div>
      </aside>
      <main className="auth-main" id="main">
        <div className="auth-mobile-brand">
          <Wordmark />
        </div>
        <div className={wide ? 'auth-panel auth-panel-wide' : 'auth-panel'}>{children}</div>
      </main>
    </div>
  );
}
