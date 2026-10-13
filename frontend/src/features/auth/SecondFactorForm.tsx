import { useState, type FormEvent } from 'react';
import type { SecondFactor } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { Field, FormAlert } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { OtpInput } from '../../components/ui/OtpInput';
import { backupCodeProblem, isSixDigits } from '../../lib/validators';

interface Props {
  onSubmit: (factor: SecondFactor) => void;
  pending: boolean;
  error: string | null;
  submitLabel: string;
  autoFocus?: boolean;
  /** Offer the recovery-code alternative (always allowed by the backend). */
  allowBackup?: boolean;
  onClearError?: () => void;
}

/** Authenticator code (6 digits) or single-use recovery code. Never logs or stores what is typed. */
export function SecondFactorForm({ onSubmit, pending, error, submitLabel, autoFocus = true, allowBackup = true, onClearError }: Props) {
  const [mode, setMode] = useState<'totp' | 'backup'>('totp');
  const [code, setCode] = useState('');
  const [backup, setBackup] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (mode === 'totp') {
      if (!isSixDigits(code)) return setLocalError('Enter the 6-digit code from your authenticator app.');
      setLocalError(null);
      onSubmit({ code });
    } else {
      const problem = backupCodeProblem(backup);
      if (problem) return setLocalError(problem);
      setLocalError(null);
      onSubmit({ backupCode: backup.trim() });
    }
  };

  const switchMode = () => {
    setMode((m) => (m === 'totp' ? 'backup' : 'totp'));
    setLocalError(null);
    onClearError?.();
  };

  const shown = localError ?? error;

  return (
    <form onSubmit={submit} noValidate className="stack">
      {mode === 'totp' ? (
        <div className="stack-sm">
          <p className="field-label" id="totp-label">
            Authenticator code
          </p>
          <OtpInput
            value={code}
            onChange={(v) => {
              setCode(v);
              setLocalError(null);
            }}
            onComplete={(v) => onSubmit({ code: v })}
            disabled={pending}
            invalid={Boolean(shown)}
            autoFocus={autoFocus}
            label="Authenticator code"
            describedBy="totp-label"
          />
        </div>
      ) : (
        <Field label="Recovery code" hint="Each recovery code works once." error={null}>
          {(p) => <Input {...p} value={backup} onChange={(e) => setBackup(e.target.value)} placeholder="ABCDE-FGH23" autoComplete="off" autoCapitalize="characters" spellCheck={false} autoFocus={autoFocus} disabled={pending} />}
        </Field>
      )}
      <FormAlert message={shown} />
      <Button type="submit" block loading={pending}>
        {submitLabel}
      </Button>
      {allowBackup ? (
        <button type="button" className="link-btn" onClick={switchMode}>
          {mode === 'totp' ? 'Use a recovery code instead' : 'Use authenticator code instead'}
        </button>
      ) : null}
    </form>
  );
}
