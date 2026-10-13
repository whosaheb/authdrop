import { useEffect, useState, type FormEvent } from 'react';
import type { ClientCredentials, ClientType } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { Field, FormAlert } from '../../components/ui/Field';
import { Input, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useCreateClient } from '../../hooks/useDeveloper';
import { errorMessage } from '../../lib/messages';
import { clientNameProblem, redirectUriListProblems } from '../../lib/validators';
import { RedirectUriEditor } from './RedirectUriEditor';

export function CreateClientModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (c: ClientCredentials) => void }) {
  const create = useCreateClient();
  const [name, setName] = useState('');
  const [uris, setUris] = useState<string[]>(['']);
  const [type, setType] = useState<ClientType>('CONFIDENTIAL');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setUris(['']);
      setType('CONFIDENTIAL');
      setSubmitted(false);
      setError(null);
      create.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const nameErr = clientNameProblem(name);
  const list = redirectUriListProblems(uris);
  const valid = !nameErr && !list.list && list.rows.every((r) => r === null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setError(null);
    if (!valid) return;
    create.mutate(
      { name: name.trim(), redirectUris: uris.map((u) => u.trim()), clientType: type },
      { onSuccess: onCreated, onError: (err) => setError(errorMessage(err)) },
    );
  };

  return (
    <Modal open={open} title="Create client" description="Register an app that signs in users with AuthDrop." onClose={onClose} dismissible={!create.isPending} size="lg">
      <form className="stack" onSubmit={submit} noValidate>
        <Field label="App name" error={submitted ? nameErr : null} hint="Users see this on the consent screen.">
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus autoComplete="off" />}
        </Field>
        <RedirectUriEditor label="Redirect URI" hint="Exact callback URLs. Use https, or http for localhost." values={uris} onChange={setUris} problems={list.rows} listProblem={list.list} showErrors={submitted} />
        <Field label="Client type">
          {(p) => (
            <Select {...p} value={type} onChange={(e) => setType(e.target.value as ClientType)}>
              <option value="CONFIDENTIAL">Confidential: server-side app with a client secret</option>
              <option value="PUBLIC">Public: browser or mobile app, PKCE only</option>
            </Select>
          )}
        </Field>
        <FormAlert message={error} />
        <div className="row row-end">
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending}>
            Create client
          </Button>
        </div>
      </form>
    </Modal>
  );
}
