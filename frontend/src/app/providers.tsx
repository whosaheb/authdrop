import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { isApiError, onUnauthorized } from '../api/client';
import { ToastProvider } from '../components/ui/Toast';
import { SESSION_KEY } from '../hooks/useSession';

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: false,
        retry: (count, error) => !(isApiError(error) && error.status >= 400 && error.status < 500) && count < 2,
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(makeClient);

  // A 401 from any authenticated call means the session is gone: re-check it so route guards send the user to /login.
  useEffect(() => onUnauthorized(() => void client.invalidateQueries({ queryKey: SESSION_KEY })), [client]);

  return (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
