import { api } from './client';
import type { ConnectedApp, PortalSession, RevokedCount } from './types';

export const sessionsApi = {
  list: () => api<PortalSession[]>('/account/sessions'),
  revoke: (ref: string) => api<void>(`/account/sessions/${encodeURIComponent(ref)}`, { method: 'DELETE' }),
  revokeOthers: () => api<RevokedCount>('/account/sessions/revoke-others', { method: 'POST' }),
  apps: () => api<ConnectedApp[]>('/account/connected-apps'),
  revokeApp: (clientId: string) => api<void>(`/account/connected-apps/${encodeURIComponent(clientId)}`, { method: 'DELETE' }),
};
