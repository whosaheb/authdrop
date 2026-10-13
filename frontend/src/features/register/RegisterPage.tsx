import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Button } from '../../components/ui/Button';
import { Field, FormAlert } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { PageLoader } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';
import { SESSION_KEY, useSession } from '../../hooks/useSession';
import { usePageTitle } from '../../hooks/usePageTitle';
import { errorMessage } from '../../lib/messages';
import { followRedirect } from '../../lib/redirect';
import { nameProblem } from '../../lib/validators';
import { BackupCodesPanel } from './BackupCodesPanel';
import { TotpEnroll } from './TotpEnroll';

type Phase = 'name' | 'secure' | 'enroll' | 'codes';

const STEPS = [
  { id: 'name', label: 'Your name' },
  { id: 'secure', label: 'Authenticator' },
  { id: 'codes', label: 'Recovery codes' },
] as const;

function stepIndex(phase: Phase): number {
  return phase === 'name' ? 0 : phase === 'codes' ? 2 : 1;
}

function Stepper({ phase }: { phase: Phase }) {
  const current = stepIndex(phase);
  return (
    <ol className="stepper" aria-label="Sign-up progress">
      {STEPS.map((s, i) => (
        <li key={s.id} aria-current={i === current ? 'step' : undefined} className={i < current ? 'done' : i === current ? 'current' : ''}>
          <span className="stepper-dot" aria-hidden="true">
            {i < current ? '✓' : i + 1}
          </span>
          <span className="stepper-label">{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

export function RegisterPage() {
  usePageTitle('Finish setting up');
  const session = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();

  const preauth = session.data?.preauth;
  const [phase, setPhase] = useState<Phase>('name');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [errors, setErrors] = useState<{ first: string | null; last: string | null }>({ first: null, last: null });
  const [formError, setFormError] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [prefilled, setPrefilled] = useState(false);

  // Resume where the server says we are, and prefill names handed over by a social provider.
  useEffect(() => {
    if (!preauth) return;
    if (preauth.step === 'security_setup' && phase === 'name') setPhase('secure');
    if (!prefilled) {
      setFirst(preauth.firstName ?? '');
      setLast(preauth.lastName ?? '');
      setPrefilled(true);
    }
  }, [preauth, phase, prefilled]);

  const finish = (redirectTo: string | null) => {
    void (async () => {
      await qc.invalidateQueries({ queryKey: SESSION_KEY });
      toast.success('Your account is ready.');
      if (!followRedirect(redirectTo, navigate)) navigate('/account/settings', { replace: true });
    })();
  };

  const profile = useMutation({
    mutationFn: authApi.registerProfile,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: SESSION_KEY });
      setPhase('secure');
    },
    onError: (e) => setFormError(errorMessage(e)),
  });
  const complete = useMutation({ mutationFn: authApi.completeRegistration, onSuccess: (r) => finish(r.redirectTo), onError: (e) => toast.error(errorMessage(e)) });

  if (session.isPending) return <PageLoader />;
  // Nothing half-finished: signed-in people belong in the portal, everyone else at the front door.
  if (!preauth && phase === 'name') return <Navigate to={session.data?.authenticated ? '/account/settings' : '/login'} replace />;

  const submitName = (e: FormEvent) => {
    e.preventDefault();
    const fe = nameProblem('first name', first);
    const le = nameProblem('last name', last);
    setErrors({ first: fe, last: le });
    setFormError(null);
    if (fe || le) return;
    profile.mutate({ firstName: first.trim(), lastName: last.trim() });
  };

  return (
    <AuthLayout wide>
      <div className="stack-lg">
        <Stepper phase={phase} />

        {phase === 'name' ? (
          <form className="stack-lg" onSubmit={submitName} noValidate>
            <header className="stack-sm">
              <h1>What should we call you?</h1>
              <p className="muted">{preauth?.maskedEmail ? `Creating an account for ${preauth.maskedEmail}.` : 'Just your name for now.'}</p>
            </header>
            <div className="grid-2">
              <Field label="First name" error={errors.first}>
                {(p) => <Input {...p} name="firstName" autoComplete="given-name" value={first} onChange={(e) => setFirst(e.target.value)} autoFocus maxLength={80} />}
              </Field>
              <Field label="Last name" error={errors.last}>
                {(p) => <Input {...p} name="lastName" autoComplete="family-name" value={last} onChange={(e) => setLast(e.target.value)} maxLength={80} />}
              </Field>
            </div>
            <FormAlert message={formError} />
            <Button type="submit" block loading={profile.isPending}>
              Create account
            </Button>
          </form>
        ) : null}

        {phase === 'secure' ? (
          <div className="stack-lg">
            <header className="stack-sm">
              <h1>Add a second lock?</h1>
              <p className="muted">Secure your account with an authenticator app such as Google Authenticator or Authy. You can also do this later in settings.</p>
            </header>
            <div className="stack">
              <Button block onClick={() => setPhase('enroll')}>
                Set up authenticator app
              </Button>
              <Button variant="ghost" block loading={complete.isPending} onClick={() => complete.mutate()}>
                Skip for now
              </Button>
            </div>
          </div>
        ) : null}

        {phase === 'enroll' ? (
          <div className="stack-lg">
            <header className="stack-sm">
              <h1>Connect your authenticator</h1>
            </header>
            <TotpEnroll
              onEnabled={(c) => {
                setCodes(c);
                setPhase('codes');
              }}
              onCancel={() => setPhase('secure')}
              cancelLabel="Back"
            />
          </div>
        ) : null}

        {phase === 'codes' ? (
          <div className="stack-lg">
            <header className="stack-sm">
              <h1>Keep your recovery codes</h1>
              <p className="muted">Authenticator app is on. These codes are your way back in if you lose your phone.</p>
            </header>
            <BackupCodesPanel codes={codes} onAcknowledge={() => complete.mutate()} pending={complete.isPending} acknowledgeLabel="Finish and continue" />
          </div>
        ) : null}
      </div>
    </AuthLayout>
  );
}
