import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { accountApi } from '../../api/account';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, ErrorState } from '../../components/ui/Card';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Modal } from '../../components/ui/Modal';
import { PageLoader } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';
import { useDisableTotp, useMfaStatus, useRegenerateBackupCodes } from '../../hooks/useMfa';
import { useUser } from '../../hooks/useSession';
import { formatDate, formatDateTime, saveBlob } from '../../lib/format';
import { errorMessage } from '../../lib/messages';
import { useQueryClient } from '@tanstack/react-query';
import { SecondFactorForm } from '../auth/SecondFactorForm';
import { BackupCodesPanel } from '../register/BackupCodesPanel';
import { TotpEnroll } from '../register/TotpEnroll';

type Panel = null | 'enroll' | 'codes' | 'disable' | 'regen';

const PROVIDER_NAMES: Record<string, string> = { google: 'Google', github: 'GitHub', facebook: 'Facebook', linkedin: 'LinkedIn' };

export function SecurityTab() {
  const user = useUser();
  const status = useMfaStatus();
  const toast = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [panel, setPanel] = useState<Panel>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [factorError, setFactorError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const disable = useDisableTotp();
  const regen = useRegenerateBackupCodes();
  const exportData = useMutation({
    mutationFn: accountApi.exportData,
    onSuccess: (blob) => {
      saveBlob(blob, 'authdrop-data-export.json');
      toast.success('Your data export has downloaded.');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const del = useMutation({
    mutationFn: () => accountApi.deleteAccount(user.email),
    onSuccess: () => {
      qc.clear();
      toast.info('Your account has been deleted.');
      navigate('/login', { replace: true });
    },
  });

  const closePanel = () => {
    setPanel(null);
    setFactorError(null);
  };

  return (
    <div className="stack-lg">
      <Card
        title="Authenticator app"
        description="Ask for a code from your phone each time you sign in."
        actions={status.data ? <Badge tone={status.data.enabled ? 'success' : 'neutral'}>{status.data.enabled ? 'On' : 'Off'}</Badge> : null}
      >
        {status.isPending ? <PageLoader /> : null}
        {status.isError ? <ErrorState message={errorMessage(status.error)} onRetry={() => void status.refetch()} /> : null}
        {status.data && !status.data.enabled ? (
          panel === 'enroll' ? (
            <TotpEnroll
              onEnabled={(c) => {
                setCodes(c);
                setPanel('codes');
              }}
              onCancel={closePanel}
            />
          ) : panel === 'codes' ? (
            <BackupCodesPanel
              codes={codes}
              acknowledgeLabel="Done"
              onAcknowledge={() => {
                setCodes([]);
                closePanel();
                toast.success('Authenticator app is on.');
              }}
            />
          ) : (
            <Button onClick={() => setPanel('enroll')}>Enable authenticator app</Button>
          )
        ) : null}
        {status.data?.enabled ? (
          panel === 'codes' ? (
            <BackupCodesPanel
              codes={codes}
              acknowledgeLabel="Done"
              onAcknowledge={() => {
                setCodes([]);
                closePanel();
              }}
            />
          ) : (
            <div className="stack">
              <p className="muted">
                Turned on {formatDateTime(status.data.enabledAt)}. You have <strong>{status.data.backupCodesRemaining}</strong> unused recovery {status.data.backupCodesRemaining === 1 ? 'code' : 'codes'}.
              </p>
              <div className="row">
                <Button variant="secondary" onClick={() => setPanel('regen')}>
                  Regenerate recovery codes
                </Button>
                <Button variant="danger" onClick={() => setPanel('disable')}>
                  Turn off
                </Button>
              </div>
            </div>
          )
        ) : null}
      </Card>

      <Card title="Linked accounts" description="Social accounts that can sign you in to this email.">
        {user.linkedProviders.length === 0 ? (
          <p className="muted">No social accounts are linked. Signing in with a social provider that uses the same verified email links it automatically.</p>
        ) : (
          <ul className="list">
            {user.linkedProviders.map((p) => (
              <li key={p.provider} className="list-row">
                <strong>{PROVIDER_NAMES[p.provider] ?? p.provider}</strong>
                <span className="muted">Linked {formatDate(p.linkedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Your data" description="Download everything AuthDrop holds about you as a JSON file.">
        <Button variant="secondary" onClick={() => exportData.mutate()} loading={exportData.isPending}>
          Download my data
        </Button>
      </Card>

      <Card title="Delete account" description="Permanently removes your account, signs you out everywhere and revokes every app you connected. This cannot be undone." tone="danger">
        <Button variant="danger" onClick={() => setDeleteOpen(true)}>
          Delete my account
        </Button>
      </Card>

      <Modal open={panel === 'disable'} title="Turn off authenticator app" description="Enter a current code to confirm. Your account will only need an email code to sign in." onClose={closePanel} dismissible={!disable.isPending}>
        <SecondFactorForm
          pending={disable.isPending}
          error={factorError}
          onClearError={() => setFactorError(null)}
          submitLabel="Turn off authenticator"
          onSubmit={(f) => {
            setFactorError(null);
            disable.mutate(f, {
              onSuccess: () => {
                closePanel();
                toast.success('Authenticator app is off.');
              },
              onError: (e) => setFactorError(errorMessage(e, 'That code did not work.')),
            });
          }}
        />
      </Modal>

      <Modal open={panel === 'regen'} title="Regenerate recovery codes" description="Your old codes stop working the moment you confirm. Enter a current code to continue." onClose={closePanel} dismissible={!regen.isPending}>
        <SecondFactorForm
          pending={regen.isPending}
          error={factorError}
          onClearError={() => setFactorError(null)}
          submitLabel="Generate new codes"
          onSubmit={(f) => {
            setFactorError(null);
            regen.mutate(f, {
              onSuccess: (res) => {
                setCodes(res.codes);
                setPanel('codes');
              },
              onError: (e) => setFactorError(errorMessage(e, 'That code did not work.')),
            });
          }}
        />
      </Modal>

      <ConfirmModal
        open={deleteOpen}
        title="Delete your account?"
        description={`This permanently deletes ${user.email} and everything linked to it.`}
        typeToConfirm={user.email}
        typeLabel="Type your email address to confirm"
        ignoreCase
        confirmLabel="Delete account"
        pending={del.isPending}
        error={del.isError ? errorMessage(del.error) : null}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => del.mutate()}
      />
    </div>
  );
}
