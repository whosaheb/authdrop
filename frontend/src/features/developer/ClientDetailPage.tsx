import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Client, ClientCredentials } from '../../api/types';
import { isApiError } from '../../api/client';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, EmptyState, ErrorState } from '../../components/ui/Card';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { CopyButton } from '../../components/ui/CopyButton';
import { Field, FormAlert } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { PageLoader } from '../../components/ui/Spinner';
import { Table } from '../../components/ui/Table';
import { TabPanel, Tabs, type TabItem } from '../../components/ui/Tabs';
import { useToast } from '../../components/ui/Toast';
import { useClient, useClientLogs, useClientMetrics, useDeleteClient, useRotateSecret, useUpdateClient } from '../../hooks/useDeveloper';
import { usePageTitle } from '../../hooks/usePageTitle';
import { eventLabel, formatDate, formatDateTime } from '../../lib/format';
import { errorMessage } from '../../lib/messages';
import { clientNameProblem, redirectUriListProblems } from '../../lib/validators';
import { RedirectUriEditor } from './RedirectUriEditor';
import { SecretRevealModal } from './SecretRevealModal';
import { UsageChart } from './UsageChart';

const TABS = [
  { id: 'usage', label: 'Usage' },
  { id: 'settings', label: 'Settings' },
] as const satisfies readonly TabItem<string>[];
type TabId = (typeof TABS)[number]['id'];

export function ClientDetailPage() {
  const { clientId = '' } = useParams();
  const client = useClient(clientId);
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const tab: TabId = raw === 'settings' ? 'settings' : 'usage';
  usePageTitle(client.data?.name ?? 'Client');

  if (client.isPending) return <PageLoader />;
  if (client.isError) {
    const notFound = isApiError(client.error) && client.error.status === 404;
    return (
      <div className="page">
        <Link to="/developer/console" className="back-link">
          Back to clients
        </Link>
        {notFound ? <EmptyState title="Client not found">It may have been deleted, or it belongs to another developer.</EmptyState> : <ErrorState message={errorMessage(client.error)} onRetry={() => void client.refetch()} />}
      </div>
    );
  }
  const c = client.data;

  return (
    <div className="page">
      <Link to="/developer/console" className="back-link">
        Back to clients
      </Link>
      <header className="page-head page-head-split">
        <div>
          <h1>
            {c.name} <Badge tone={c.clientType === 'PUBLIC' ? 'warning' : 'neutral'}>{c.clientType === 'PUBLIC' ? 'Public' : 'Confidential'}</Badge>
          </h1>
          <p className="muted inline-copy">
            <code>{c.clientId}</code>
            <CopyButton value={c.clientId} label="Copy" describe="client ID" variant="ghost" />
          </p>
        </div>
        <p className="muted small">Created {formatDate(c.createdAt)}</p>
      </header>
      <Tabs items={TABS} value={tab} onChange={(id) => setParams({ tab: id }, { replace: true })} label="Client sections" idPrefix="client" />
      <TabPanel idPrefix="client" id={tab}>
        {tab === 'usage' ? <UsageSection clientId={c.clientId} /> : <SettingsSection client={c} />}
      </TabPanel>
    </div>
  );
}

function UsageSection({ clientId }: { clientId: string }) {
  const metrics = useClientMetrics(clientId);
  const logs = useClientLogs(clientId);
  const items = logs.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="stack-lg">
      <Card title="Activity" description="Daily counts over the last 30 days.">
        {metrics.isPending ? <PageLoader /> : null}
        {metrics.isError ? <ErrorState message={errorMessage(metrics.error)} onRetry={() => void metrics.refetch()} /> : null}
        {metrics.data ? (
          <div className="stack">
            <p className="muted">
              <strong>{metrics.data.activeUsers.toLocaleString()}</strong> {metrics.data.activeUsers === 1 ? 'user has' : 'users have'} an active grant for this app.
            </p>
            {metrics.data.daily.length === 0 ? <EmptyState title="No activity yet">Sign-ins and token requests will show up here.</EmptyState> : <UsageChart daily={metrics.data.daily} windowDays={metrics.data.windowDays} />}
          </div>
        ) : null}
      </Card>

      <Card title="Usage log" description="Authorizations, token grants and configuration changes.">
        {logs.isPending ? <PageLoader /> : null}
        {logs.isError ? <ErrorState message={errorMessage(logs.error)} onRetry={() => void logs.refetch()} /> : null}
        {logs.data && items.length === 0 ? <EmptyState title="Nothing logged yet" /> : null}
        {items.length > 0 ? (
          <>
            <Table caption="Usage log">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Event</th>
                  <th scope="col">Result</th>
                  <th scope="col">User (sub)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((l) => (
                  <tr key={l.id}>
                    <td>{formatDateTime(l.occurredAt)}</td>
                    <td>{eventLabel(l.event)}</td>
                    <td>
                      <Badge tone={l.outcome === 'SUCCESS' ? 'success' : 'danger'}>{l.outcome === 'SUCCESS' ? 'Success' : 'Failed'}</Badge>
                    </td>
                    <td>{l.sub ? <code className="break">{l.sub}</code> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {logs.hasNextPage ? (
              <div className="center-row">
                <Button variant="secondary" loading={logs.isFetchingNextPage} onClick={() => void logs.fetchNextPage()}>
                  Load more
                </Button>
              </div>
            ) : (
              <p className="muted small center-row">End of log.</p>
            )}
          </>
        ) : null}
      </Card>
    </div>
  );
}

function SettingsSection({ client }: { client: Client }) {
  const toast = useToast();
  const navigate = useNavigate();
  const update = useUpdateClient(client.clientId);
  const rotate = useRotateSecret(client.clientId);
  const del = useDeleteClient();

  const [name, setName] = useState(client.name);
  const [uris, setUris] = useState<string[]>(client.redirectUris);
  const [logoutUris, setLogoutUris] = useState<string[]>(client.postLogoutRedirectUris);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [secret, setSecret] = useState<ClientCredentials | null>(null);

  // Re-sync the form when the server copy changes (after a save).
  useEffect(() => {
    setName(client.name);
    setUris(client.redirectUris);
    setLogoutUris(client.postLogoutRedirectUris);
  }, [client]);

  const nameErr = clientNameProblem(name);
  const list = redirectUriListProblems(uris);
  const logoutList = logoutUris.length === 0 ? { rows: [], list: null } : redirectUriListProblems(logoutUris);
  const valid = !nameErr && !list.list && list.rows.every((r) => r === null) && logoutList.rows.every((r) => r === null);

  const same = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);
  const trimmed = uris.map((u) => u.trim());
  const trimmedLogout = logoutUris.map((u) => u.trim());
  const dirty = name.trim() !== client.name || !same(trimmed, client.redirectUris) || !same(trimmedLogout, client.postLogoutRedirectUris);

  const save = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setError(null);
    if (!valid || !dirty) return;
    update.mutate(
      { name: name.trim(), redirectUris: trimmed, postLogoutRedirectUris: trimmedLogout },
      { onSuccess: () => { setSubmitted(false); toast.success('Client saved.'); }, onError: (err) => setError(errorMessage(err)) },
    );
  };

  return (
    <div className="stack-lg">
      <Card title="Settings">
        <form className="stack" onSubmit={save} noValidate>
          <Field label="App name" error={submitted ? nameErr : null}>
            {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="off" />}
          </Field>
          <RedirectUriEditor label="Redirect URI" hint="Exact callback URLs. Requests with any other redirect_uri are rejected." values={uris} onChange={setUris} problems={list.rows} listProblem={list.list} showErrors={submitted} />
          <RedirectUriEditor label="Post-logout redirect URI" hint="Where users may land after signing out of your app. Optional." values={logoutUris} onChange={setLogoutUris} problems={logoutList.rows} showErrors={submitted} addLabel="Add post-logout URL" placeholder="https://app.example.com/signed-out" />
          <FormAlert message={error} />
          <div className="row">
            <Button type="submit" disabled={!dirty} loading={update.isPending}>
              Save changes
            </Button>
          </div>
        </form>
      </Card>

      {client.clientType === 'CONFIDENTIAL' ? (
        <Card title="Client secret" description="Secrets are stored encrypted and cannot be shown again. Rotating issues a new one and the old one stops working immediately.">
          <Button variant="secondary" onClick={() => setRotateOpen(true)}>
            Rotate secret
          </Button>
        </Card>
      ) : null}

      <Card title="Delete client" description="Removes this client and revokes every token and grant issued to it." tone="danger">
        <Button variant="danger" onClick={() => setDeleteOpen(true)}>
          Delete client
        </Button>
      </Card>

      <ConfirmModal
        open={rotateOpen}
        title="Rotate client secret?"
        description="Your app will fail to exchange codes until you deploy the new secret."
        confirmLabel="Rotate secret"
        pending={rotate.isPending}
        error={rotate.isError ? errorMessage(rotate.error) : null}
        onClose={() => setRotateOpen(false)}
        onConfirm={() =>
          rotate.mutate(undefined, {
            onSuccess: (c) => {
              setRotateOpen(false);
              setSecret(c);
            },
          })
        }
      />
      <SecretRevealModal credentials={secret} title="Save your new client secret" onClose={() => setSecret(null)} />
      <ConfirmModal
        open={deleteOpen}
        title={`Delete ${client.name}?`}
        description="Users of this app are signed out of it and it can no longer use AuthDrop. This cannot be undone."
        typeToConfirm={client.name}
        typeLabel={`Type "${client.name}" to confirm`}
        confirmLabel="Delete client"
        pending={del.isPending}
        error={del.isError ? errorMessage(del.error) : null}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() =>
          del.mutate(client.clientId, {
            onSuccess: () => {
              toast.success(`${client.name} deleted.`);
              navigate('/developer/console', { replace: true });
            },
          })
        }
      />
    </div>
  );
}
