import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ClientCredentials } from '../../api/types';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, EmptyState, ErrorState } from '../../components/ui/Card';
import { CopyButton } from '../../components/ui/CopyButton';
import { PageLoader } from '../../components/ui/Spinner';
import { Table } from '../../components/ui/Table';
import { useClients, useEnroll } from '../../hooks/useDeveloper';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useToast } from '../../components/ui/Toast';
import { formatDate } from '../../lib/format';
import { errorMessage } from '../../lib/messages';
import { CreateClientModal } from './CreateClientModal';
import { SecretRevealModal } from './SecretRevealModal';

/** Shown by RoleRoute to signed-in users who are not developers yet. */
export function EnrollCard() {
  usePageTitle('Developer access');
  const enroll = useEnroll();
  const toast = useToast();
  return (
    <Card title="Build with AuthDrop" description="Register apps and let your users sign in with a code, no passwords to store.">
      <div className="stack">
        <p className="muted">Turn on developer access to create clients, get a client ID and secret, and watch usage.</p>
        {enroll.isError ? (
          <div className="alert alert-danger" role="alert">
            {errorMessage(enroll.error)}
          </div>
        ) : null}
        <div>
          <Button loading={enroll.isPending} onClick={() => enroll.mutate(undefined, { onSuccess: () => toast.success('Developer access is on.') })}>
            Enable developer access
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function DeveloperConsole() {
  usePageTitle('Developer console');
  const clients = useClients();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<ClientCredentials | null>(null);

  return (
    <div className="page">
      <header className="page-head page-head-split">
        <div>
          <h1>Developer console</h1>
          <p className="muted">Apps that sign in users with AuthDrop.</p>
        </div>
        <Button onClick={() => setCreating(true)}>Create client</Button>
      </header>

      <Card>
        {clients.isPending ? <PageLoader /> : null}
        {clients.isError ? <ErrorState message={errorMessage(clients.error)} onRetry={() => void clients.refetch()} /> : null}
        {clients.data && clients.data.length === 0 ? (
          <EmptyState title="No clients yet" action={<Button onClick={() => setCreating(true)}>Create your first client</Button>}>
            A client is an app that uses AuthDrop to sign users in.
          </EmptyState>
        ) : null}
        {clients.data && clients.data.length > 0 ? (
          <Table caption="Registered clients">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Client ID</th>
                <th scope="col">Type</th>
                <th scope="col">Created</th>
              </tr>
            </thead>
            <tbody>
              {clients.data.map((c) => (
                <tr key={c.clientId}>
                  <th scope="row">
                    <Link to={`/developer/console/${encodeURIComponent(c.clientId)}`}>{c.name}</Link>
                  </th>
                  <td>
                    <span className="inline-copy">
                      <code>{c.clientId}</code>
                      <CopyButton value={c.clientId} label="Copy" describe={`client ID of ${c.name}`} variant="ghost" />
                    </span>
                  </td>
                  <td>
                    <Badge tone={c.clientType === 'PUBLIC' ? 'warning' : 'neutral'}>{c.clientType === 'PUBLIC' ? 'Public' : 'Confidential'}</Badge>
                  </td>
                  <td>{formatDate(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : null}
      </Card>

      <CreateClientModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(c) => {
          setCreating(false);
          setRevealed(c);
        }}
      />
      <SecretRevealModal
        credentials={revealed}
        title="Client created"
        onClose={() => {
          const id = revealed?.clientId;
          setRevealed(null);
          if (id) navigate(`/developer/console/${encodeURIComponent(id)}`);
        }}
      />
    </div>
  );
}
