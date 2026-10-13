import { createBrowserRouter, Navigate, Outlet, useRouteError, type RouteObject } from 'react-router-dom';
import { PortalLayout } from '../components/layout/PortalLayout';
import { ProtectedRoute } from '../components/layout/ProtectedRoute';
import { RoleRoute } from '../components/layout/RoleRoute';
import { PageLoader } from '../components/ui/Spinner';
import { useSession } from '../hooks/useSession';
import { CrashScreen } from './ErrorBoundary';
import { NotFoundPage } from './NotFoundPage';
import { EnrollCard } from '../features/developer/DeveloperConsole';

/** "/" sends signed-in people to their account and everyone else to sign in. */
function RootRedirect() {
  const { data, isPending } = useSession();
  if (isPending) return <PageLoader />;
  return <Navigate to={data?.authenticated ? '/account/settings' : '/login'} replace />;
}

function RouteError() {
  const error = useRouteError();
  console.error('Route error', error instanceof Error ? error.message : 'unknown');
  return <CrashScreen />;
}

const lazyPage = <T extends Record<string, unknown>>(load: () => Promise<T>, key: keyof T): RouteObject['lazy'] => async () => ({ Component: (await load())[key] as React.ComponentType });

export const routes: RouteObject[] = [
  {
    element: <Outlet />,
    errorElement: <RouteError />,
    hydrateFallbackElement: <PageLoader />,
    children: [
      { path: '/', element: <RootRedirect /> },
      { path: '/login', lazy: lazyPage(() => import('../features/auth/LoginPage'), 'LoginPage') },
      { path: '/register/profile', lazy: lazyPage(() => import('../features/register/RegisterPage'), 'RegisterPage') },
      {
        element: <ProtectedRoute />,
        children: [
          { path: '/consent', lazy: lazyPage(() => import('../features/consent/ConsentPage'), 'ConsentPage') },
          {
            element: <PortalLayout />,
            children: [
              { path: '/account', element: <Navigate to="/account/settings" replace /> },
              { path: '/account/settings', lazy: lazyPage(() => import('../features/account/AccountPage'), 'AccountPage') },
              {
                element: <RoleRoute roles={['DEVELOPER', 'ADMIN']} fallback={<EnrollCard />} />,
                children: [
                  { path: '/developer', element: <Navigate to="/developer/console" replace /> },
                  { path: '/developer/console', lazy: lazyPage(() => import('../features/developer/DeveloperConsole'), 'DeveloperConsole') },
                  { path: '/developer/console/:clientId', lazy: lazyPage(() => import('../features/developer/ClientDetailPage'), 'ClientDetailPage') },
                ],
              },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
