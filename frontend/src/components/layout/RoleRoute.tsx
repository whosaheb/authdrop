import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import type { UserRole } from '../../api/types';
import { useUser } from '../../hooks/useSession';
import { Card } from '../ui/Card';

interface RoleRouteProps {
  roles: readonly UserRole[];
  /** Shown instead of the route when the user lacks the role (e.g. an enrolment card). */
  fallback?: ReactNode;
}

export function RoleRoute({ roles, fallback }: RoleRouteProps) {
  const user = useUser();
  if (roles.includes(user.role)) return <Outlet />;
  return (
    <div className="page">
      {fallback ?? (
        <Card title="You do not have access">
          <p className="muted">Your account does not have permission to view this page.</p>
        </Card>
      )}
    </div>
  );
}
