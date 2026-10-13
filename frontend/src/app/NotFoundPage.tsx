import { Link } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';

export function NotFoundPage() {
  usePageTitle('Page not found');
  return (
    <main className="center-screen">
      <div className="card center-card">
        <p className="muted">404</p>
        <h1>That page does not exist</h1>
        <p className="muted">The link may be old or mistyped.</p>
        <Link className="btn btn-primary" to="/">
          <span>Back to AuthDrop</span>
        </Link>
      </div>
    </main>
  );
}
