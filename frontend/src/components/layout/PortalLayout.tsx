import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useLogout, useUser } from '../../hooks/useSession';
import { initials } from '../../lib/format';
import { useToast } from '../ui/Toast';
import { Wordmark } from './Logo';

export function Avatar({ url, first, last, size = 36 }: { url: string | null; first: string; last: string; size?: number }) {
  return url ? (
    <img className="avatar" src={url} alt="" width={size} height={size} referrerPolicy="no-referrer" />
  ) : (
    <span className="avatar avatar-fallback" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
      {initials(first, last)}
    </span>
  );
}

export function PortalLayout() {
  const user = useUser();
  const logout = useLogout();
  const navigate = useNavigate();
  const toast = useToast();
  const canDevelop = user.role === 'DEVELOPER' || user.role === 'ADMIN';

  const signOut = () => {
    logout.mutate(undefined, {
      onSettled: () => {
        toast.info('You are signed out.');
        navigate('/login', { replace: true });
      },
    });
  };

  return (
    <div className="portal">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/account/settings" className="topbar-brand" aria-label="AuthDrop home">
            <Wordmark />
          </NavLink>
          <nav className="topbar-nav" aria-label="Main">
            <NavLink to="/account/settings">Account</NavLink>
            <NavLink to="/developer/console">{canDevelop ? 'Developer' : 'Build with AuthDrop'}</NavLink>
          </nav>
          <div className="topbar-user">
            <Avatar url={user.avatarUrl} first={user.firstName} last={user.lastName} size={32} />
            <span className="topbar-name">{user.firstName}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={signOut} disabled={logout.isPending}>
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>
      <main id="main" className="portal-main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
