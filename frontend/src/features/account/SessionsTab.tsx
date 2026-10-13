import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ConnectedApp, PortalSession } from '../../api/types';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, EmptyState, ErrorState } from '../../components/ui/Card';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { PageLoader } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';
import { useConnectedApps, usePortalSessions, useRevokeApp, useRevokeOtherSessions, useRevokeSession } from '../../hooks/useSessions';
import { useRefreshSession } from '../../hooks/useSession';
import { describeUserAgent, formatDateTime, formatRelative, scopeLabel } from '../../lib/format';
import { errorMessage } from '../../lib/messages';

export function SessionsTab() {
  const sessions = usePortalSessions();
  const apps = useConnectedApps();
  const revokeSession = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const revokeApp = useRevokeApp();
  const refreshSession = useRefreshSession();
  const toast = useToast();
  const navigate = useNavigate();
  const [appToRevoke, setAppToRevoke] = useState<ConnectedApp | null>(null);
  const [busyRef, setBusyRef] = useState<string | null>(null);

  const onRevokeSession = (s: PortalSession) => {
    setBusyRef(s.ref);
    revokeSession.mutate(s.ref, {
      onSuccess: () => {
        if (s.current) {
          void refreshSession();
          navigate('/login', { replace: true });
        } else toast.success('Device signed out.');
      },
      onError: (e) => toast.error(errorMessage(e)),
      onSettled: () => setBusyRef(null),
    });
  };

  const others = sessions.data?.filter((s) => !s.current).length ?? 0;

  return (
    <div className="stack-lg">
      <Card
        title="Devices signed in"
        description="Browsers and devices that currently have access to your AuthDrop account."
        actions={
          others > 0 ? (
            <Button
              variant="secondary"
              size="sm"
              loading={revokeOthers.isPending}
              onClick={() =>
                revokeOthers.mutate(undefined, {
                  onSuccess: (r) => toast.success(`Signed out ${r.revoked} other ${r.revoked === 1 ? 'device' : 'devices'}.`),
                  onError: (e) => toast.error(errorMessage(e)),
                })
              }
            >
              Sign out other devices
            </Button>
          ) : null
        }
      >
        {sessions.isPending ? <PageLoader /> : null}
        {sessions.isError ? <ErrorState message={errorMessage(sessions.error)} onRetry={() => void sessions.refetch()} /> : null}
        {sessions.data && sessions.data.length === 0 ? <EmptyState title="No active sessions" /> : null}
        {sessions.data && sessions.data.length > 0 ? (
          <ul className="list">
            {sessions.data.map((s) => (
              <li key={s.ref} className="list-row">
                <div className="stack-xs">
                  <strong>
                    {describeUserAgent(s.userAgent)} {s.current ? <Badge tone="accent">This device</Badge> : null}
                  </strong>
                  <span className="muted small">
                    {s.ip} · Active {formatRelative(s.lastSeenAt)} · Signed in {formatDateTime(s.createdAt)}
                    {s.amr.includes('mfa') ? ' · Verified with authenticator' : ''}
                  </span>
                </div>
                <Button variant={s.current ? 'ghost' : 'secondary'} size="sm" loading={busyRef === s.ref} onClick={() => onRevokeSession(s)} aria-label={`${s.current ? 'Sign out of' : 'Sign out'} ${describeUserAgent(s.userAgent)}${s.current ? ' (this device)' : ''}`}>
                  {s.current ? 'Sign out' : 'Revoke'}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card title="Connected apps" description="Apps you let sign in with AuthDrop. Revoking access ends their tokens now and asks for your consent again next time.">
        {apps.isPending ? <PageLoader /> : null}
        {apps.isError ? <ErrorState message={errorMessage(apps.error)} onRetry={() => void apps.refetch()} /> : null}
        {apps.data && apps.data.length === 0 ? <EmptyState title="No connected apps">Apps you approve will appear here.</EmptyState> : null}
        {apps.data && apps.data.length > 0 ? (
          <ul className="list">
            {apps.data.map((a) => (
              <li key={a.clientId} className="list-row">
                <div className="stack-xs">
                  <strong>{a.name}</strong>
                  <span className="muted small">
                    Allowed {formatDateTime(a.authorizedAt)} · {a.scopes.map(scopeLabel).join(', ')}
                  </span>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setAppToRevoke(a)} aria-label={`Revoke access for ${a.name}`}>
                  Revoke access
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <ConfirmModal
        open={appToRevoke !== null}
        title={`Revoke access for ${appToRevoke?.name ?? 'this app'}?`}
        description="The app is signed out immediately and will ask for your permission again if you use it later."
        confirmLabel="Revoke access"
        pending={revokeApp.isPending}
        onClose={() => setAppToRevoke(null)}
        onConfirm={() => {
          if (!appToRevoke) return;
          revokeApp.mutate(appToRevoke.clientId, {
            onSuccess: () => {
              toast.success(`Access revoked for ${appToRevoke.name}.`);
              setAppToRevoke(null);
            },
            onError: (e) => toast.error(errorMessage(e)),
          });
        }}
      />
    </div>
  );
}
