import { useEffect, useState, type FormEvent } from 'react';
import { Button } from './Button';
import { Field, FormAlert } from './Field';
import { Input } from './Input';
import { Modal } from './Modal';

interface Props {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  pending?: boolean;
  error?: string | null;
  /** When set, the user must type exactly this text before the button enables. */
  typeToConfirm?: string;
  typeLabel?: string;
  tone?: 'danger' | 'primary';
  /** When true, the typed text is compared case-insensitively (e.g. email addresses). */
  ignoreCase?: boolean;
}

export function ConfirmModal({ open, title, description, confirmLabel, onConfirm, onClose, pending = false, error, typeToConfirm, typeLabel, tone = 'danger', ignoreCase = false }: Props) {
  const [typed, setTyped] = useState('');
  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);

  const matches = !typeToConfirm || (ignoreCase ? typed.trim().toLowerCase() === typeToConfirm.toLowerCase() : typed.trim() === typeToConfirm);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (matches && !pending) onConfirm();
  };

  return (
    <Modal open={open} title={title} description={description} onClose={onClose} dismissible={!pending}>
      <form className="stack" onSubmit={submit} noValidate>
        {typeToConfirm ? (
          <Field label={typeLabel ?? `Type ${typeToConfirm} to confirm`}>
            {(p) => <Input {...p} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} autoFocus />}
          </Field>
        ) : null}
        <FormAlert message={error} />
        <div className="row row-end">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant={tone === 'danger' ? 'danger' : 'primary'} disabled={!matches} loading={pending}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
