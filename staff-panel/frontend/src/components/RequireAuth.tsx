import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { isUnauthenticated, useMeQuery } from '../hooks/useMeQuery';

export function RequireAuth() {
  const location = useLocation();
  const meQuery = useMeQuery();

  if (meQuery.isPending) {
    return (
      <div className="auth-loading">
        <p>Sessie controleren…</p>
      </div>
    );
  }

  if (meQuery.isError || !meQuery.data) {
    if (meQuery.isError && !isUnauthenticated(meQuery.error)) {
      return (
        <div className="auth-loading">
          <p>Kan sessie niet laden. Controleer of de API draait.</p>
        </div>
      );
    }
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
