import { useState, type FormEvent } from 'react';
import type { Gender, UpdateProfileBody } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Field, FormAlert } from '../../components/ui/Field';
import { Input, Select } from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';
import { useUpdateProfile } from '../../hooks/useAccount';
import { useUser } from '../../hooks/useSession';
import { GENDER_LABELS } from '../../lib/format';
import { errorMessage } from '../../lib/messages';
import { nameProblem } from '../../lib/validators';
import { AvatarEditor } from './AvatarEditor';

const today = (): string => new Date().toISOString().slice(0, 10);

export function ProfileTab() {
  const user = useUser();
  const toast = useToast();
  const update = useUpdateProfile();

  const [first, setFirst] = useState(user.firstName);
  const [last, setLast] = useState(user.lastName);
  const [gender, setGender] = useState<Gender | ''>(user.gender ?? '');
  const [dob, setDob] = useState(user.dateOfBirth ?? '');
  const [errors, setErrors] = useState<{ first: string | null; last: string | null; dob: string | null }>({ first: null, last: null, dob: null });
  const [formError, setFormError] = useState<string | null>(null);

  const changes: UpdateProfileBody = {};
  if (first.trim() !== user.firstName) changes.firstName = first.trim();
  if (last.trim() !== user.lastName) changes.lastName = last.trim();
  if ((gender || null) !== user.gender) changes.gender = gender || null;
  if ((dob || null) !== user.dateOfBirth) changes.dateOfBirth = dob || null;
  const dirty = Object.keys(changes).length > 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = { first: nameProblem('first name', first), last: nameProblem('last name', last), dob: dob && (dob > today() || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) ? 'Enter a date of birth in the past.' : null };
    setErrors(next);
    setFormError(null);
    if (next.first || next.last || next.dob || !dirty) return;
    update.mutate(changes, {
      onSuccess: () => toast.success('Profile saved.'),
      onError: (err) => setFormError(errorMessage(err)),
    });
  };

  return (
    <div className="stack-lg">
      <Card title="Profile picture" description="Shown next to your name in AuthDrop.">
        {user.avatarUploadEnabled ? <AvatarEditor /> : <p className="muted">Profile pictures are not enabled on this server.</p>}
      </Card>
      <Card title="Personal details">
        <form className="stack" onSubmit={submit} noValidate>
          <div className="grid-2">
            <Field label="First name" error={errors.first}>
              {(p) => <Input {...p} autoComplete="given-name" value={first} onChange={(e) => setFirst(e.target.value)} maxLength={80} />}
            </Field>
            <Field label="Last name" error={errors.last}>
              {(p) => <Input {...p} autoComplete="family-name" value={last} onChange={(e) => setLast(e.target.value)} maxLength={80} />}
            </Field>
          </div>
          <Field label="Email address" hint="Your email is how you sign in, so it cannot be changed here.">
            {(p) => <Input {...p} type="email" value={user.email} readOnly />}
          </Field>
          <div className="grid-2">
            <Field label="Gender" optional>
              {(p) => (
                <Select {...p} value={gender} onChange={(e) => setGender(e.target.value as Gender | '')}>
                  <option value="">Not specified</option>
                  {(Object.keys(GENDER_LABELS) as Gender[]).map((g) => (
                    <option key={g} value={g}>
                      {GENDER_LABELS[g]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Date of birth" optional error={errors.dob}>
              {(p) => <Input {...p} type="date" max={today()} autoComplete="bday" value={dob} onChange={(e) => setDob(e.target.value)} />}
            </Field>
          </div>
          <FormAlert message={formError} />
          <div className="row">
            <Button type="submit" disabled={!dirty} loading={update.isPending}>
              Save changes
            </Button>
            {dirty ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setFirst(user.firstName);
                  setLast(user.lastName);
                  setGender(user.gender ?? '');
                  setDob(user.dateOfBirth ?? '');
                  setErrors({ first: null, last: null, dob: null });
                }}
              >
                Discard
              </Button>
            ) : null}
          </div>
        </form>
      </Card>
    </div>
  );
}
