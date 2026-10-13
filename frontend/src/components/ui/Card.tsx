import { useId, type ReactNode } from 'react';

interface CardProps {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  tone?: 'default' | 'danger';
  className?: string;
}

export function Card({ title, description, actions, children, tone = 'default', className }: CardProps) {
  const id = useId();
  return (
    <section className={['card', tone === 'danger' ? 'card-danger' : '', className ?? ''].filter(Boolean).join(' ')} aria-labelledby={title ? id : undefined}>
      {title || actions ? (
        <header className="card-header">
          <div>
            {title ? <h2 id={id}>{title}</h2> : null}
            {description ? <p className="muted">{description}</p> : null}
          </div>
          {actions ? <div className="card-actions">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {children ? <p className="muted">{children}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="empty empty-error" role="alert">
      <p className="empty-title">We could not load this</p>
      <p className="muted">{message}</p>
      {onRetry ? (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
          <span>Try again</span>
        </button>
      ) : null}
    </div>
  );
}
