import { useMutation } from '@tanstack/react-query';
import { accountApi } from '../api/account';
import type { UpdateProfileBody } from '../api/types';
import { useSetUser } from './useSession';

export function useUpdateProfile() {
  const setUser = useSetUser();
  return useMutation({ mutationFn: (body: UpdateProfileBody) => accountApi.update(body), onSuccess: setUser });
}

export function useUploadAvatar() {
  const setUser = useSetUser();
  return useMutation({ mutationFn: (file: File) => accountApi.uploadAvatar(file), onSuccess: setUser });
}

export function useRemoveAvatar() {
  const setUser = useSetUser();
  return useMutation({ mutationFn: () => accountApi.removeAvatar(), onSuccess: setUser });
}
