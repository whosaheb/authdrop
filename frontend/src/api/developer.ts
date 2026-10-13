import { api } from './client';
import type {
  Client,
  ClientCredentials,
  ClientLogsPage,
  ClientMetrics,
  CreateClientBody,
  MessageResponse,
  UpdateClientBody,
} from './types';

const cp = (id: string): string => `/developer/clients/${encodeURIComponent(id)}`;

export const developerApi = {
  enroll: () => api<MessageResponse>('/developer/enroll', { method: 'POST' }),
  list: () => api<Client[]>('/developer/clients'),
  get: (id: string) => api<Client>(cp(id)),
  create: (body: CreateClientBody) => api<ClientCredentials>('/developer/clients', { method: 'POST', body }),
  update: (id: string, body: UpdateClientBody) => api<Client>(cp(id), { method: 'PATCH', body }),
  rotateSecret: (id: string) => api<ClientCredentials>(`${cp(id)}/rotate-secret`, { method: 'POST' }),
  remove: (id: string) => api<void>(cp(id), { method: 'DELETE' }),
  logs: (id: string, cursor?: string, limit = 25) => api<ClientLogsPage>(`${cp(id)}/logs`, { query: { limit, cursor } }),
  metrics: (id: string) => api<ClientMetrics>(`${cp(id)}/metrics`),
};
