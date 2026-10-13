import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { developerApi } from '../api/developer';
import type { CreateClientBody, UpdateClientBody } from '../api/types';
import { SESSION_KEY } from './useSession';

const CLIENTS_KEY = ['developer', 'clients'] as const;

export function useClients() {
  return useQuery({ queryKey: CLIENTS_KEY, queryFn: developerApi.list });
}

export function useClient(id: string) {
  return useQuery({ queryKey: [...CLIENTS_KEY, id], queryFn: () => developerApi.get(id), retry: false });
}

export function useEnroll() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: developerApi.enroll, onSuccess: () => qc.invalidateQueries({ queryKey: SESSION_KEY }) });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: CreateClientBody) => developerApi.create(body), onSuccess: () => qc.invalidateQueries({ queryKey: CLIENTS_KEY }) });
}

export function useUpdateClient(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: UpdateClientBody) => developerApi.update(id, body), onSuccess: () => qc.invalidateQueries({ queryKey: CLIENTS_KEY }) });
}

export function useRotateSecret(id: string) {
  return useMutation({ mutationFn: () => developerApi.rotateSecret(id) });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => developerApi.remove(id), onSuccess: () => qc.invalidateQueries({ queryKey: CLIENTS_KEY }) });
}

export function useClientLogs(id: string) {
  return useInfiniteQuery({
    queryKey: [...CLIENTS_KEY, id, 'logs'],
    queryFn: ({ pageParam }) => developerApi.logs(id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useClientMetrics(id: string) {
  return useQuery({ queryKey: [...CLIENTS_KEY, id, 'metrics'], queryFn: () => developerApi.metrics(id) });
}
