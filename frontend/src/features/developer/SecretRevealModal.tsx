import { useEffect, useState } from 'react';
import type { ClientCredentials } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { CopyButton } from '../../components/ui/CopyButton';
import { Modal } from '../../components/ui/Modal';

/** One-time reveal. Not dismissible by Escape or backdrop, so the secret is not lost by accident. */
export function SecretRevealModal({ credentials, onClose, title = 'Save your client secret' }: { credentials: ClientCredentials | null; onClose: () => void; title?: string }) {
  const [ack, setAck] = useState(false);
  useEffect(() => setAck(false), [credentials]);

  return (
    <Modal
      open={credentials !== null}
      title={title}
      onClose={onClose}
      dismissible={false}
      size="lg"
      footer={
        <Button disabled={!ack} onClick={onClose}>
          Done
        </Button>
      }
    >
      {credentials ? (
        <div className="stack">
          <p>
            <strong>{credentials.name}</strong> is ready.
          </p>
          <div className="secret-row">
            <span className="field-label">Client ID</span>
            <div className="keybox">
              <code>{credentials.clientId}</code>
              <CopyButton value={credentials.clientId} label="Copy" describe="client ID" />
            </div>
          </div>
          {credentials.clientSecret ? (
            <>
              <div className="alert alert-warning" role="alert">
                <strong>You will not see this secret again.</strong> Copy it now and store it in your app&apos;s secret manager. If you lose it, rotate the secret.
              </div>
              <div className="secret-row">
                <span className="field-label">Client secret</span>
                <div className="keybox">
                  <code data-secret>{credentials.clientSecret}</code>
                  <CopyButton value={credentials.clientSecret} label="Copy" describe="client secret" variant="primary" />
                </div>
              </div>
              <label className="check">
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                <span>I have copied the client secret.</span>
              </label>
            </>
          ) : (
            <>
              <p className="muted">This is a public client, so it has no secret. It must use PKCE.</p>
              <label className="check">
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                <span>I have copied the client ID.</span>
              </label>
            </>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
