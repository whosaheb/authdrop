import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mfaApi } from '../api/mfa';
import type { SecondFactor } from '../api/types';
import { SESSION_KEY } from './useSession';

export const MFA_KEY = ['mfa', 'status'] as const;

export function useMfaStatus() {
  return useQuery({ queryKey: MFA_KEY, queryFn: mfaApi.status });
}

function useRefreshMfa() {
  const qc = useQueryClient();
  return async () => {
    await Promise.all([qc.invalidateQueries({ queryKey: MFA_KEY }), qc.invalidateQueries({ queryKey: SESSION_KEY })]);
  };
}

export function useTotpSetup() {
  return useMutation({ mutationFn: mfaApi.setup });
}

export function useEnableTotp() {
  const refresh = useRefreshMfa();
  return useMutation({ mutationFn: (code: string) => mfaApi.enable(code), onSuccess: refresh });
}

export function useDisableTotp() {
  const refresh = useRefreshMfa();
  return useMutation({ mutationFn: (body: SecondFactor) => mfaApi.disable(body), onSuccess: refresh });
}

export function useRegenerateBackupCodes() {
  const refresh = useRefreshMfa();
  return useMutation({ mutationFn: (body: SecondFactor) => mfaApi.regenerateBackupCodes(body), onSuccess: refresh });
}
