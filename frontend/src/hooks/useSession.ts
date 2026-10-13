import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/auth';
import type { SessionState, User } from '../api/types';

export const SESSION_KEY = ['session'] as const;

export function useSession() {
  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: ({ signal }) => authApi.session(signal),
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: true,
  });
}

/** The signed-in user. Only call below <ProtectedRoute>. */
export function useUser(): User {
  const { data } = useSession();
  if (!data?.user) throw new Error('useUser called without a signed-in user');
  return data.user;
}

export function useRefreshSession() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: SESSION_KEY });
}

/** Write a fresh user (returned by PATCH / avatar calls) into the session cache. */
export function useSetUser() {
  const qc = useQueryClient();
  return (user: User) => qc.setQueryData<SessionState>(SESSION_KEY, (prev) => (prev ? { ...prev, authenticated: true, user } : prev));
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      qc.clear();
    },
  });
}
