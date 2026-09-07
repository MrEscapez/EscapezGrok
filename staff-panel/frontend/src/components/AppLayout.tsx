import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useMeQuery } from '../hooks/useMeQuery';
import { logout } from '../lib/api';
import { can } from '../lib/permissions';

const NAV_ITEMS: { to: string; label: string; permission: string }[] = [
  { to: '/dashboard', label: 'Dashboard', permission: 'dashboard:view' },
  { to: '/players', label: 'Spelers', permission: 'players:view' },
  { to: '/reports', label: 'Reports', permission: 'reports:view' },
  { to: '/punishments', label: 'Straffen', permission: 'punishments:view' },
  { to: '/tickets', label: 'Tickets', permission: 'tickets:view' },
  { to: '/appeals', label: 'Appeals', permission: 'appeals:view' },
  { to: '/planner', label: 'Planner', permission: 'planner:view' },
  { to: '/server', label: 'Server', permission: 'server:view' },
  { to: '/audit', label: 'Audit', permission: 'audit:view' },
  { to: '/users', label: 'Gebruikers', permission: 'users:view' },
  { to: '/settings', label: 'Instellingen', permission: 'settings:view' },
];

export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const meQuery = useMeQuery();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: () => {
      queryClient.setQueryData(['auth', 'me'], null);
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      navigate('/login', { replace: true });
    },
  });

  const username = meQuery.data?.username ?? '…';
  const permissions = meQuery.data?.permissions;
  const visibleNav = NAV_ITEMS.filter((item) =>
    can(permissions, item.permission),
  );

  return (
    <div className="app-shell">
      <aside
        className={`sidebar ${drawerOpen ? 'sidebar--open' : ''}`}
        aria-label="Hoofdnavigatie"
      >
        <div className="sidebar__brand">
          <span className="sidebar__logo">EC</span>
          <div>
            <strong className="sidebar__title">EscapezCraft</strong>
            <span className="sidebar__subtitle">Staff Panel</span>
          </div>
        </div>
        <nav className="sidebar__nav">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `sidebar__link${isActive ? ' sidebar__link--active' : ''}`
              }
              onClick={() => setDrawerOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {drawerOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Sluit menu"
          onClick={() => setDrawerOpen(false)}
        />
      ) : null}

      <div className="main">
        <header className="topbar">
          <button
            type="button"
            className="topbar__menu"
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
          >
            ☰
          </button>
          <span className="topbar__hint">Dark neon · Staff Panel</span>
          <div className="topbar__user">
            <span className="topbar__username" title="Ingelogde gebruiker">
              {username}
            </span>
            <button
              type="button"
              className="topbar__logout"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              {logoutMutation.isPending ? 'Bezig…' : 'Uitloggen'}
            </button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
