import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { isApiError } from '../../api/client';
import type { AuthStepResponse, InteractionResult } from '../../api/types';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Button } from '../../components/ui/Button';
import { Field, FormAlert } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { OtpInput } from '../../components/ui/OtpInput';
import { Spinner } from '../../components/ui/Spinner';
import { SESSION_KEY, useSession } from '../../hooks/useSession';
import { usePageTitle } from '../../hooks/usePageTitle';
import { errorMessage, loginErrorMessage } from '../../lib/messages';
import { followRedirect } from '../../lib/redirect';
import { emailProblem, isSixDigits, normalizeEmail, parseUid } from '../../lib/validators';
import { SecondFactorForm } from './SecondFactorForm';
import { SocialButtons } from './SocialButtons';
import { useCooldown } from './useCooldown';

type Step = 'email' | 'otp' | 'mfa';
const RESEND_SECONDS = 60;

export function LoginPage() {
  usePageTitle('Sign in');
  const [params] = useSearchParams();
  const uid = parseUid(params.get('uid'));
  const queryError = loginErrorMessage(params.get('error'));
  const navigate = useNavigate();
  const qc = useQueryClient();
  const session = useSession();

  const interaction = useQuery({
    queryKey: ['interaction', uid],
    queryFn: () => authApi.interaction(uid as string),
    enabled: Boolean(uid),
    retry: false,
    staleTime: 0,
  });
  // A dead interaction must not be sent along with the OTP calls.
  const activeUid = uid && !interaction.isError ? uid : undefined;

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [resendNote, setResendNote] = useState<string | null>(null);
  const cooldown = useCooldown();

  const continued = useRef(false);
  const go = (res: AuthStepResponse | InteractionResult) => {
    continued.current = true; // the response already tells us where to go: never also fire the SSO "continue" call
    void (async () => {
      await qc.invalidateQueries({ queryKey: SESSION_KEY });
      if (res.status === 'consent_required') return navigate(`/consent?uid=${encodeURIComponent(uid ?? '')}`, { replace: true });
      if (res.status === 'mfa_required') return setStep('mfa');
      if (res.status === 'profile_required' || res.status === 'profile_created') return navigate('/register/profile', { replace: true });
      if (!followRedirect(res.redirectTo, navigate)) navigate('/account/settings', { replace: true });
    })();
  };

  // ── silent SSO: already signed in and an app is waiting ──
  const cont = useMutation({ mutationFn: (u: string) => authApi.continueInteraction(u), onSuccess: go });
  const signedIn = session.data?.authenticated === true;
  const canContinue = signedIn && Boolean(uid) && interaction.isSuccess && !interaction.data.forceReauth;
  useEffect(() => {
    if (canContinue && uid && !continued.current) {
      continued.current = true;
      cont.mutate(uid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canContinue, uid]);

  // A half-finished sign-in (second factor pending, e.g. after social login) resumes at that step.
  const preauthStep = session.data?.preauth?.step;
  useEffect(() => {
    if (preauthStep === 'mfa') setStep('mfa');
  }, [preauthStep]);

  const requestOtp = useMutation({
    mutationFn: () => authApi.requestOtp({ email: normalizeEmail(email), ...(activeUid ? { uid: activeUid } : {}) }),
    onSuccess: () => {
      cooldown.start(RESEND_SECONDS);
      setCode('');
      setCodeError(null);
    },
  });
  const verifyOtp = useMutation({ mutationFn: (c: string) => authApi.verifyOtp({ email: normalizeEmail(email), code: c, ...(activeUid ? { uid: activeUid } : {}) }), onSuccess: go });
  const verifyMfa = useMutation({ mutationFn: authApi.verifyMfa, onSuccess: go });

  const submitEmail = (e: FormEvent) => {
    e.preventDefault();
    const problem = emailProblem(email);
    setEmailError(problem);
    if (problem) return;
    requestOtp.mutate(undefined, {
      onSuccess: () => setStep('otp'),
      onError: (err) => {
        if (isApiError(err) && err.status === 429 && err.retryAfterSeconds) cooldown.start(err.retryAfterSeconds);
        setEmailError(errorMessage(err));
      },
    });
  };

  const submitCode = (c: string) => {
    if (!isSixDigits(c)) return setCodeError('Enter all 6 digits.');
    setCodeError(null);
    verifyOtp.mutate(c, {
      onError: (err) => {
        setCodeError(errorMessage(err, 'That code did not work. Check it and try again.'));
        setCode('');
      },
    });
  };

  const resend = () => {
    setResendNote(null);
    requestOtp.mutate(undefined, {
      onSuccess: () => setResendNote('A new code is on its way.'),
      onError: (err) => {
        if (isApiError(err) && err.status === 429 && err.retryAfterSeconds) cooldown.start(err.retryAfterSeconds);
        setCodeError(errorMessage(err));
      },
    });
  };

  // ── render ──
  if (session.isPending || (uid && interaction.isPending)) {
    return (
      <AuthLayout>
        <div className="center-stack">
          <Spinner label="Loading…" size={24} />
        </div>
      </AuthLayout>
    );
  }

  const appName = interaction.data?.clientName;
  const context = appName ? (
    <p className="auth-context">
      Continuing as <strong>{appName}</strong>
    </p>
  ) : null;

  if (signedIn && !uid) return <Navigate to="/account/settings" replace />;
  if (preauthStep === 'profile' || preauthStep === 'security_setup') return <Navigate to="/register/profile" replace />;

  if (canContinue && !cont.isError) {
    return (
      <AuthLayout context={context}>
        <div className="center-stack" role="status">
          <Spinner size={28} />
          <h1>Signing you in…</h1>
          <p className="muted">{appName ? `Taking you back to ${appName}.` : 'One moment.'}</p>
        </div>
      </AuthLayout>
    );
  }

  const notices: string[] = [];
  if (queryError) notices.push(queryError);
  if (interaction.isError) notices.push('This sign-in request has expired. Return to the app and start again, or sign in to AuthDrop directly.');
  if (cont.isError) notices.push(errorMessage(cont.error));
  const forceReauth = signedIn && interaction.data?.forceReauth;

  return (
    <AuthLayout context={context}>
      {step === 'email' ? (
        <div className="stack-lg">
          <header className="stack-sm">
            <h1>Sign in or create an account</h1>
            <p className="muted">{forceReauth ? `${appName ?? 'This app'} needs you to sign in again.` : 'Enter your email and we will send you a 6-digit code. No password needed.'}</p>
          </header>
          {notices.map((n) => (
            <FormAlert key={n} message={n} />
          ))}
          <form onSubmit={submitEmail} noValidate className="stack">
            <Field label="Email address" error={emailError}>
              {(p) => <Input {...p} type="email" name="email" inputMode="email" autoComplete="email username" autoCapitalize="none" spellCheck={false} placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus disabled={requestOtp.isPending} />}
            </Field>
            <Button type="submit" size="md" block loading={requestOtp.isPending}>
              Email me a code
            </Button>
          </form>
          <SocialButtons providers={session.data?.providers ?? []} uid={activeUid} />
        </div>
      ) : null}

      {step === 'otp' ? (
        <div className="stack-lg">
          <header className="stack-sm">
            <h1>Check your email</h1>
            <p className="muted">
              If <strong className="break">{normalizeEmail(email)}</strong> can be used, a 6-digit code is on its way. It expires in 10 minutes.
            </p>
          </header>
          <div className="stack">
            <OtpInput value={code} onChange={(v) => { setCode(v); setCodeError(null); }} onComplete={submitCode} disabled={verifyOtp.isPending} invalid={Boolean(codeError)} autoFocus label="6-digit sign-in code" />
            <FormAlert message={codeError} />
            <FormAlert message={resendNote} tone="success" />
            <Button block loading={verifyOtp.isPending} onClick={() => submitCode(code)}>
              Verify code
            </Button>
          </div>
          <div className="row-between">
            <button type="button" className="link-btn" onClick={() => { setStep('email'); setCode(''); setCodeError(null); setResendNote(null); }}>
              Use a different email
            </button>
            <button type="button" className="link-btn" onClick={resend} disabled={cooldown.remaining > 0 || requestOtp.isPending}>
              {cooldown.remaining > 0 ? `Resend code in ${cooldown.remaining}s` : 'Resend code'}
            </button>
          </div>
        </div>
      ) : null}

      {step === 'mfa' ? (
        <div className="stack-lg">
          <header className="stack-sm">
            <h1>One more step</h1>
            <p className="muted">
              {session.data?.preauth?.maskedEmail ? `Confirm it is you, ${session.data.preauth.maskedEmail}. ` : ''}Enter the code from your authenticator app.
            </p>
          </header>
          <SecondFactorForm
            pending={verifyMfa.isPending}
            error={mfaError}
            onClearError={() => setMfaError(null)}
            submitLabel="Verify and sign in"
            onSubmit={(factor) => {
              setMfaError(null);
              verifyMfa.mutate(factor, { onError: (err) => setMfaError(errorMessage(err, 'That code did not work. Try again.')) });
            }}
          />
        </div>
      ) : null}
    </AuthLayout>
  );
}
