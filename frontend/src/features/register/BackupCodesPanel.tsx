import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { CopyButton } from '../../components/ui/CopyButton';
import { saveText } from '../../lib/format';

interface Props {
  codes: string[];
  onAcknowledge: () => void;
  pending?: boolean;
  acknowledgeLabel?: string;
}

/** Shows recovery codes exactly once. The user must confirm they stored them before continuing. */
export function BackupCodesPanel({ codes, onAcknowledge, pending = false, acknowledgeLabel = 'Continue' }: Props) {
  const [saved, setSaved] = useState(false);
  const text = codes.join('\n');

  return (
    <div className="stack">
      <div className="alert alert-warning" role="note">
        <strong>You will only see these once.</strong> Each code signs you in one time if you lose your authenticator. Store them somewhere safe, like a password manager.
      </div>
      <ol className="codes" aria-label="Recovery codes">
        {codes.map((c) => (
          <li key={c}>
            <code>{c}</code>
          </li>
        ))}
      </ol>
      <div className="row">
        <CopyButton value={text} label="Copy all" describe="recovery codes" />
        <Button variant="secondary" size="sm" onClick={() => saveText(`AuthDrop recovery codes\n\n${text}\n`, 'authdrop-recovery-codes.txt')}>
          Download .txt
        </Button>
      </div>
      <label className="check">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        <span>I have saved my recovery codes.</span>
      </label>
      <Button block disabled={!saved} loading={pending} onClick={onAcknowledge}>
        {acknowledgeLabel}
      </Button>
    </div>
  );
}
