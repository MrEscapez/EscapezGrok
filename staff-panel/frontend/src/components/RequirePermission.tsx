import { Navigate, Outlet } from 'react-router-dom';
import { useMeQuery } from '../hooks/useMeQuery';
import { can } from '../lib/permissions';

type Props = {
  permission: string;
  /** When true, render children outlet; otherwise wrap a single element via children prop pattern — we use Outlet. */
};

export function RequirePermission({ permission }: Props) {
  const meQuery = useMeQuery();

  if (meQuery.isPending) {
    return (
      <div className="auth-loading">
        <p>Rechten controleren…</p>
      </div>
    );
  }

  if (!meQuery.data || !can(meQuery.data.permissions, permission)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <Outlet />;
}
