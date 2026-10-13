import { api, apiBlob } from './client';
import type { UpdateProfileBody, User } from './types';

export const accountApi = {
  me: () => api<User>('/users/me'),
  update: (body: UpdateProfileBody) => api<User>('/users/me', { method: 'PATCH', body }),
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api<User>('/users/me/avatar', { method: 'POST', form });
  },
  removeAvatar: () => api<User>('/users/me/avatar', { method: 'DELETE' }),
  exportData: () => apiBlob('/users/me/export'),
  deleteAccount: (confirmEmail: string) => api<void>('/users/me', { method: 'DELETE', body: { confirmEmail } }),
};
