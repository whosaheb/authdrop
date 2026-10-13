import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sessionsApi } from '../api/sessions';

const SESSIONS_KEY = ['account', 'sessions'] as const;
const APPS_KEY = ['account', 'connected-apps'] as const;

export function usePortalSessions() {
  return useQuery({ queryKey: SESSIONS_KEY, queryFn: sessionsApi.list });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (ref: string) => sessionsApi.revoke(ref), onSuccess: () => qc.invalidateQueries({ queryKey: SESSIONS_KEY }) });
}

export function useRevokeOtherSessions() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: sessionsApi.revokeOthers, onSuccess: () => qc.invalidateQueries({ queryKey: SESSIONS_KEY }) });
}

export function useConnectedApps() {
  return useQuery({ queryKey: APPS_KEY, queryFn: sessionsApi.apps });
}

export function useRevokeApp() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (clientId: string) => sessionsApi.revokeApp(clientId), onSuccess: () => qc.invalidateQueries({ queryKey: APPS_KEY }) });
}
