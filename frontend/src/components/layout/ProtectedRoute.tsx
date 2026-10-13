import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { isApiError } from '../../api/client';
import { useSession } from '../../hooks/useSession';
import { errorMessage } from '../../lib/messages';
import { parseUid } from '../../lib/validators';
import { Button } from '../ui/Button';
import { PageLoader } from '../ui/Spinner';

/** Renders children only for a signed-in user; otherwise sends the visitor to the right sign-in step. */
export function ProtectedRoute() {
  const { data, isPending, error, refetch } = useSession();
  const location = useLocation();

  if (isPending) return <PageLoader label="Checking your session…" />;
  if (error) {
    return (
      <main className="center-screen">
        <div className="card center-card" role="alert">
          <h1>Cannot reach AuthDrop</h1>
          <p className="muted">{isApiError(error) ? errorMessage(error) : 'Check your connection and try again.'}</p>
          <Button onClick={() => void refetch()}>Try again</Button>
        </div>
      </main>
    );
  }
  if (!data.authenticated || !data.user) {
    if (data.preauth && data.preauth.step !== 'mfa') return <Navigate to="/register/profile" replace />;
    // Keep an interaction id (validated) so an app-initiated flow survives the detour.
    const uid = parseUid(new URLSearchParams(location.search).get('uid'));
    return <Navigate to={uid ? `/login?uid=${encodeURIComponent(uid)}` : '/login'} replace />;
  }
  return <Outlet />;
}
