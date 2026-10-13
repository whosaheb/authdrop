import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { CopyButton } from '../../components/ui/CopyButton';
import { FormAlert } from '../../components/ui/Field';
import { OtpInput } from '../../components/ui/OtpInput';
import { Spinner } from '../../components/ui/Spinner';
import { useEnableTotp, useTotpSetup } from '../../hooks/useMfa';
import { errorMessage } from '../../lib/messages';
import { isSixDigits } from '../../lib/validators';

interface Props {
  /** Called with the one-time recovery codes once the authenticator is confirmed. */
  onEnabled: (codes: string[]) => void;
  onCancel: () => void;
  cancelLabel?: string;
}

const QR_PREFIX = 'data:image/png;base64,';

/** Scan the QR (or type the key), confirm with a 6-digit code. Shared by the sign-up wizard and the Security tab. */
export function TotpEnroll({ onEnabled, onCancel, cancelLabel = 'Cancel' }: Props) {
  const setup = useTotpSetup();
  const enable = useEnableTotp();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    setup.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirm = (c: string) => {
    if (!isSixDigits(c)) return setError('Enter the 6-digit code from your app.');
    setError(null);
    enable.mutate(c, {
      onSuccess: (res) => onEnabled(res.codes),
      onError: (err) => {
        setError(errorMessage(err, 'That code did not match. Check the time on your phone and try again.'));
        setCode('');
      },
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    confirm(code);
  };

  if (setup.isPending || (!setup.data && !setup.isError)) return <div className="center-stack"><Spinner label="Preparing your key…" /></div>;
  if (setup.isError) {
    return (
      <div className="stack">
        <FormAlert message={errorMessage(setup.error)} />
        <div className="row">
          <Button onClick={() => setup.mutate()}>Try again</Button>
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    );
  }

  const { qrCodeDataUrl, secret } = setup.data;
  const qrOk = qrCodeDataUrl.startsWith(QR_PREFIX);
  const spaced = secret.replace(/(.{4})/g, '$1 ').trim();

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <div className="enroll">
        <div className="qr">
          {qrOk ? <img src={qrCodeDataUrl} alt="QR code for your authenticator app" width={176} height={176} /> : <p className="muted">QR code unavailable. Use the key instead.</p>}
        </div>
        <div className="stack-sm">
          <p>
            Scan the code with Google Authenticator, Authy or 1Password. Cannot scan? Enter this key instead.
          </p>
          <div className="keybox">
            <code aria-label="Setup key">{spaced}</code>
            <CopyButton value={secret} label="Copy key" describe="setup key" />
          </div>
        </div>
      </div>
      <div className="stack-sm">
        <p className="field-label" id="enroll-code-label">
          Enter the 6-digit code it shows
        </p>
        <OtpInput value={code} onChange={(v) => { setCode(v); setError(null); }} onComplete={confirm} disabled={enable.isPending} invalid={Boolean(error)} label="Authenticator code" describedBy="enroll-code-label" />
        <FormAlert message={error} />
      </div>
      <div className="row">
        <Button type="submit" loading={enable.isPending}>
          Verify and turn on
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={enable.isPending}>
          {cancelLabel}
        </Button>
      </div>
    </form>
  );
}
