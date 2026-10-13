import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from './Spinner';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  loading?: boolean;
  block?: boolean;
  children: ReactNode;
}

export function Button({ variant = 'primary', size = 'md', loading = false, block = false, className, disabled, children, type = 'button', ...rest }: ButtonProps) {
  const cls = ['btn', `btn-${variant}`, size === 'sm' ? 'btn-sm' : '', block ? 'btn-block' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <button {...rest} type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined}>
      {loading ? <Spinner size={16} /> : null}
      <span>{children}</span>
    </button>
  );
}

/** A link that looks like a button (for full-page navigation such as social sign-in). */
export function LinkButton({ href, children, variant = 'secondary', block = false, className }: { href: string; children: ReactNode; variant?: ButtonProps['variant']; block?: boolean; className?: string }) {
  const cls = ['btn', `btn-${variant}`, block ? 'btn-block' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <a className={cls} href={href}>
      {children}
    </a>
  );
}
