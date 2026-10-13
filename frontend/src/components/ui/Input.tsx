import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={['input', className ?? ''].filter(Boolean).join(' ')} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={['input', 'select', className ?? ''].filter(Boolean).join(' ')}>
      {children}
    </select>
  );
}
