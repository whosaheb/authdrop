import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Button } from '../../components/ui/Button';
import { FormAlert } from '../../components/ui/Field';
import { PageLoader } from '../../components/ui/Spinner';
import { SESSION_KEY, useUser } from '../../hooks/useSession';
import { usePageTitle } from '../../hooks/usePageTitle';
import { scopeLabel } from '../../lib/format';
import { errorMessage } from '../../lib/messages';
import { followRedirect } from '../../lib/redirect';
import { parseUid } from '../../lib/validators';

export function ConsentPage() {
  usePageTitle('Allow access');
  const [params] = useSearchParams();
  const uid = parseUid(params.get('uid'));
  const user = useUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<'allow' | 'deny' | null>(null);

  const interaction = useQuery({ queryKey: ['interaction', uid], queryFn: () => authApi.interaction(uid as string), enabled: Boolean(uid), retry: false, staleTime: 0 });
  const decide = useMutation({
    mutationFn: (approve: boolean) => authApi.decideConsent(uid as string, approve),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: SESSION_KEY });
      if (!followRedirect(res.redirectTo, navigate)) navigate('/account/settings', { replace: true });
    },
    onError: (e) => setError(errorMessage(e)),
  });

  if (!uid) {
    return (
      <AuthLayout>
        <div className="stack">
          <h1>Nothing to approve</h1>
          <p className="muted">This page needs a sign-in request from an app. Start from the app you want to use.</p>
          <Button onClick={() => navigate('/account/settings')}>Go to my account</Button>
        </div>
      </AuthLayout>
    );
  }
  if (interaction.isPending) return <PageLoader />;
  if (interaction.isError) {
    return (
      <AuthLayout>
        <div className="stack">
          <h1>This request has expired</h1>
          <p className="muted">{errorMessage(interaction.error, 'Return to the app and start signing in again.')}</p>
          <Button onClick={() => navigate('/account/settings')}>Go to my account</Button>
        </div>
      </AuthLayout>
    );
  }
  if (interaction.data.prompt !== 'consent') return <Navigate to={`/login?uid=${encodeURIComponent(uid)}`} replace />;

  const { clientName, scopes } = interaction.data;
  const send = (approve: boolean) => {
    setError(null);
    setChoice(approve ? 'allow' : 'deny');
    decide.mutate(approve);
  };

  return (
    <AuthLayout
      context={
        <p className="auth-context">
          Continuing as <strong>{clientName}</strong>
        </p>
      }
    >
      <div className="stack-lg">
        <header className="stack-sm">
          <h1>
            Allow {clientName} to sign you in?
          </h1>
          <p className="muted">
            Signed in as <strong className="break">{user.email}</strong>
          </p>
        </header>
        <div className="stack-sm">
          <p className="field-label">{clientName} will be able to see:</p>
          <ul className="scopes">
            {scopes.map((s) => (
              <li key={s}>
                <span>{scopeLabel(s)}</span>
                <code>{s}</code>
              </li>
            ))}
          </ul>
        </div>
        <FormAlert message={error} />
        <div className="row row-stretch">
          <Button variant="secondary" onClick={() => send(false)} loading={decide.isPending && choice === 'deny'} disabled={decide.isPending}>
            Deny
          </Button>
          <Button onClick={() => send(true)} loading={decide.isPending && choice === 'allow'} disabled={decide.isPending}>
            Allow
          </Button>
        </div>
        <p className="muted small">You can revoke access any time under Account, Sessions and apps.</p>
      </div>
    </AuthLayout>
  );
}
