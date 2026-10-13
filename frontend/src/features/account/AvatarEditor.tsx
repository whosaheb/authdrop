import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../../components/layout/PortalLayout';
import { Button } from '../../components/ui/Button';
import { FormAlert } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';
import { useRemoveAvatar, useUploadAvatar } from '../../hooks/useAccount';
import { useUser } from '../../hooks/useSession';
import { formatBytes } from '../../lib/format';
import { errorMessage } from '../../lib/messages';

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function AvatarEditor() {
  const user = useUser();
  const toast = useToast();
  const upload = useUploadAvatar();
  const remove = useRemoveAvatar();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const choose = (f: File | undefined) => {
    setError(null);
    if (!f) return;
    if (!TYPES.includes(f.type)) return setError('Choose a JPEG, PNG or WebP image.');
    if (f.size > MAX_BYTES) return setError(`That image is ${formatBytes(f.size)}. The limit is 5 MB.`);
    setFile(f);
  };

  const reset = () => {
    setFile(null);
    if (input.current) input.current.value = '';
  };

  const save = () => {
    if (!file) return;
    upload.mutate(file, {
      onSuccess: () => {
        toast.success('Profile picture updated.');
        reset();
      },
      onError: (e) => setError(errorMessage(e)),
    });
  };

  const del = () =>
    remove.mutate(undefined, {
      onSuccess: () => toast.success('Profile picture removed.'),
      onError: (e) => setError(errorMessage(e)),
    });

  if (!user.avatarUploadEnabled) return null;

  return (
    <div className="avatar-editor">
      {preview ? <img className="avatar" src={preview} alt="Preview of your new picture" width={72} height={72} /> : <Avatar url={user.avatarUrl} first={user.firstName} last={user.lastName} size={72} />}
      <div className="stack-sm">
        <div className="row">
          <input ref={input} id="avatar-file" className="sr-only" type="file" accept={TYPES.join(',')} onChange={(e) => choose(e.target.files?.[0])} />
          <label htmlFor="avatar-file" className="btn btn-secondary btn-sm">
            <span>{user.avatarUrl || file ? 'Choose another' : 'Upload picture'}</span>
          </label>
          {file ? (
            <>
              <Button size="sm" onClick={save} loading={upload.isPending}>
                Save picture
              </Button>
              <Button size="sm" variant="ghost" onClick={reset} disabled={upload.isPending}>
                Cancel
              </Button>
            </>
          ) : user.avatarUrl ? (
            <Button size="sm" variant="ghost" onClick={del} loading={remove.isPending}>
              Remove
            </Button>
          ) : null}
        </div>
        <p className="muted small">JPEG, PNG or WebP, up to 5 MB. We crop it to a square.</p>
        <FormAlert message={error} />
      </div>
    </div>
  );
}
