import { useId, type ReactNode } from 'react';

export interface FieldControlProps {
  id: string;
  'aria-describedby': string | undefined;
  'aria-invalid': true | undefined;
}

interface FieldProps {
  label: string;
  hint?: string;
  error?: string | null;
  optional?: boolean;
  children: (props: FieldControlProps) => ReactNode;
}

/** Label + control + hint + error, wired together with ids so screen readers announce all of them. */
export function Field({ label, hint, error, optional, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const describedBy = [hint ? hintId : null, error ? errId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
        {optional ? <span className="field-optional"> (optional)</span> : null}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {hint ? (
        <p className="field-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      <p className="field-error" id={errId} role={error ? 'alert' : undefined}>
        {error ?? ''}
      </p>
    </div>
  );
}

/** Form-level alert (server errors). Always in the DOM so assistive tech announces changes. */
export function FormAlert({ message, tone = 'danger' }: { message?: string | null; tone?: 'danger' | 'info' | 'success' }) {
  return (
    <div className={`alert alert-${tone}`} role={tone === 'danger' ? 'alert' : 'status'} aria-live={tone === 'danger' ? 'assertive' : 'polite'} hidden={!message}>
      {message}
    </div>
  );
}
